// =============================================================
// InsuranceService.js - optional insurance: premium, Q5 node creation, 6h scheduled payout (async)
// =============================================================
import { GameError, Codes } from './errors.js';
import { nextDue, batchSeqAt, isAlive } from './engine-payout.js';

export class InsuranceService {
  constructor(store, cfg) { this.store = store; this.cfg = cfg; }

  async isActive(uid) {
    const u = await this.store.getUser(uid);
    const a = await this.store.getAccount(uid);
    return !!u.insSwitch && a.premium >= this.cfg.premiumMin;
  }
  async hasActiveNodes(uid) {
    try {
      const nodes = await this.store.listNodes({ uid });
      return nodes && nodes.length > 0;
    } catch { return false; }
  }
  async setSwitch(uid, on) {
    await this.store.getUser(uid);
    return await this.store.setUserSwitch(uid, !!on);
  }

  async depositPremium(uid, amount) {
    if (amount <= 0n) throw new GameError(Codes.BAD_INPUT, 'Premium deposit must be positive (units)');
    return await this.store.transaction(async () => {
      const a = await this.store.getAccount(uid);
      if (a.available < amount) throw new GameError(Codes.INSUFFICIENT_BALANCE, 'Insufficient available balance');
      const after = await this.store.applyAccount(uid, { avail: -amount, premium: amount });
      await this.store.addFlow(uid, 'PREMIUM_IN', amount);
      return after.premium;
    }, 'depositPremium');
  }

  /**
   * Premium withdrawal to available: only allowed when insurance switch is off (prevents withdrawing while insured).
   * If amountInner omitted, withdraw all premium; internal account available/premium transfer, ledger conserved.
   */
  async withdrawPremium(uid, amountInner = null) {
    return await this.store.transaction(async () => {
      const u = await this.store.getUser(uid);
      if (u.insSwitch) throw new GameError(Codes.BAD_INPUT, 'Please turn off insurance switch before withdrawing premium');
      const a = await this.store.getAccount(uid);
      const amount = amountInner == null ? a.premium : BigInt(amountInner);
      if (amount <= 0n) throw new GameError(Codes.BAD_INPUT, 'No premium to withdraw');
      if (amount > a.premium) throw new GameError(Codes.BAD_INPUT, 'Withdrawal amount exceeds premium balance');
      const after = await this.store.applyAccount(uid, { avail: amount, premium: -amount });
      await this.store.addFlow(uid, 'PREMIUM_OUT', amount);
      return after;
    }, 'withdrawPremium');
  }

  /** Distinct direct invitees with nodes under an inviter */
  async countDistinctNodeInvitees(inviterUid) {
    const nodes = await this.store.listNodes({});
    const set = new Set();
    for (const n of nodes) {
      const u = await this.store.getUser(n.uid);
      if (u.inviterUid === inviterUid) set.add(n.uid);
    }
    return set.size;
  }
  async newestNodeSeq(uid) {
    const nodes = await this.store.listNodes({ uid });
    let seq = null;
    for (const n of nodes) if (seq === null || n.batchSeq > seq) seq = n.batchSeq;
    return seq;
  }

  /** Q5 internal posting (wrapped by settlement transaction, no own transaction) */
  async accrueLossInternal(uid, lossAdd, atSec) {
    if (lossAdd <= 0n) return [];
    const cfg = this.cfg, s = this.store;
    let a = await s.applyAccount(uid, { loss: lossAdd });
    const created = [];
    while (a.lossAccum >= cfg.nodeThreshold && a.premium >= cfg.nodePremium) {
      await s.applyAccount(uid, { premium: -cfg.nodePremium, loss: -cfg.nodeThreshold });
      await s.applyLedger({ ins: cfg.nodePremium }); // 20 units premium to insurance pool
      const node = {
        nodeId: await s.nextId('node', 'N'), uid, total: cfg.nodeTotal, periodN: 0, paidAmount: 0n,
        paidToUserAmount: 0n, forfeitedAmount: 0n, state: 'active', createdAtSec: atSec, batchSeq: batchSeqAt(atSec, cfg),
      };
      await s.insertNode(node);
      await s.addFlow(uid, 'NODE_PREMIUM_OUT', cfg.nodePremium, { nodeId: node.nodeId });
      created.push(node);
      a = await s.getAccount(uid);
    }
    if (a.premium < cfg.nodePremium && a.lossAccum > 0n) {
      await s.applyAccount(uid, { loss: -a.lossAccum }); // premium insufficient, remainder zeroed
    }
    return created;
  }

  /** 6h global payout, idempotent (each batch succeeds once) */
  async runPayoutBatch(currentSec) {
    const s = this.store, cfg = this.cfg;
    const currentSeq = batchSeqAt(currentSec, cfg);
    if (await s.hasPaidBatch(currentSeq)) return { status: 'skip', currentSeq };

    return await s.transaction(async () => {
      const active = await s.listNodes({ active: true });
      let dueTotal = 0n;
      const dues = new Map();
      for (const n of active) {
        const due = nextDue(n, cfg);
        if (due != null) { dues.set(n.nodeId, due); dueTotal += due; }
      }
      const ledger = await s.getLedger();
      if (dueTotal > 0n && ledger.insurancePool < dueTotal) {
        await s.addPayoutBatch({ batchId: await s.nextId('batch', 'B'), seq: currentSeq, state: 'deferred', dueTotal, at: currentSec });
        return { status: 'deferred', currentSeq, dueTotal, insurancePool: ledger.insurancePool };
      }
      const newestSeq = new Map();
      for (const n of active) newestSeq.set(n.uid, await this.newestNodeSeq(n.uid));

      let paidToUser = 0n, forfeited = 0n;
      for (const n of active) {
        const due = dues.get(n.nodeId);
        if (due == null) { await s.updateNode(n.nodeId, { state: 'done' }); continue; }
        const alive = isAlive(newestSeq.get(n.uid), currentSeq, cfg);
        if (alive) {
          await s.applyLedger({ ins: -due });
          await s.applyAccount(n.uid, { avail: due });
          await s.updateNode(n.nodeId, { paidToUserAmount: n.paidToUserAmount + due });
          await s.addFlow(n.uid, 'NODE_PAYOUT', due, { nodeId: n.nodeId });
          paidToUser += due;
        } else {
          await s.updateNode(n.nodeId, { forfeitedAmount: n.forfeitedAmount + due });
          await s.addFlow(n.uid, 'NODE_FORFEIT', due, { nodeId: n.nodeId });
          forfeited += due;
        }
        await s.updateNode(n.nodeId, { periodN: n.periodN + 1, paidAmount: n.paidAmount + due, state: n.periodN + 1 >= 100 ? 'done' : 'active' });
        await s.addNodeLog({ nodeId: n.nodeId, uid: n.uid, periodN: n.periodN + 1, due, dest: alive ? 'user' : 'forfeit', seq: currentSeq });
      }
      await s.addPayoutBatch({ batchId: await s.nextId('batch', 'B'), seq: currentSeq, state: 'paid', dueTotal, paidToUser, forfeited, at: currentSec });
      return { status: 'paid', currentSeq, paidToUser, forfeited, dueTotal };
    }, 'runPayoutBatch');
  }

  /** Insurance pool public: total + next batch pending total + delta comparison (real-time per request, all see same result) */
  async poolPublic(nowSec = Math.floor(Date.now() / 1000)) {
    const s = this.store, cfg = this.cfg;
    const ledger = await s.getLedger();
    const active = await s.listNodes({ active: true });
    let nextDueTotal = 0n;
    let nextPayNodeCount = 0;
    for (const n of active) {
      const due = nextDue(n, cfg);
      if (due != null) { nextDueTotal += due; nextPayNodeCount++; }
    }
    const seq = batchSeqAt(nowSec, cfg);
    return {
      poolBalance: ledger.insurancePool,
      nextBatchSeq: seq,
      nextBatchAt: (seq + 1) * cfg.payoutEverySec, // next 3/9/15/21 UTC
      nextDueTotal,
      activeNodeCount: active.length,
      nextPayNodeCount,
      gap: ledger.insurancePool - nextDueTotal,
      sufficient: ledger.insurancePool >= nextDueTotal,
    };
  }
}
