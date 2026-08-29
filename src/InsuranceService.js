// =============================================================
// InsuranceService.js —— 可选保险：保费、Q5 节点生成、6h 定点赔付（async）
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
  async setSwitch(uid, on) {
    await this.store.getUser(uid);
    return await this.store.setUserSwitch(uid, !!on);
  }

  async depositPremium(uid, amount) {
    if (amount <= 0n) throw new GameError(Codes.BAD_INPUT, '存入保费必须为正数（枚）');
    return await this.store.transaction(async () => {
      const a = await this.store.getAccount(uid);
      if (a.available < amount) throw new GameError(Codes.INSUFFICIENT_BALANCE, '可用余额不足');
      const after = await this.store.applyAccount(uid, { avail: -amount, premium: amount });
      await this.store.addFlow(uid, 'PREMIUM_IN', amount);
      return after.premium;
    }, 'depositPremium');
  }

  /** 邀请人名下「生成过节点的去重直邀人数」 */
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

  /** Q5 内部记账（由结算事务包裹，自身不开事务） */
  async accrueLossInternal(uid, lossAdd, atSec) {
    if (lossAdd <= 0n) return [];
    const cfg = this.cfg, s = this.store;
    let a = await s.applyAccount(uid, { loss: lossAdd });
    const created = [];
    while (a.lossAccum >= cfg.nodeThreshold && a.premium >= cfg.nodePremium) {
      await s.applyAccount(uid, { premium: -cfg.nodePremium, loss: -cfg.nodeThreshold });
      await s.applyLedger({ ins: cfg.nodePremium }); // 20 枚保费进保险池
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
      await s.applyAccount(uid, { loss: -a.lossAccum }); // 保费不足，零头清零
    }
    return created;
  }

  /** 6h 全局赔付，幂等（同一批次只成功一次） */
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

  /** 保险池公示：总资金 + 下一批次应释放总额 + 差额对比（每次请求实时计算，全员看到同一结果） */
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
      nextBatchAt: (seq + 1) * cfg.payoutEverySec, // 下一个 3/9/15/21 点(UTC)
      nextDueTotal,
      activeNodeCount: active.length,
      nextPayNodeCount,
      gap: ledger.insurancePool - nextDueTotal,
      sufficient: ledger.insurancePool >= nextDueTotal,
    };
  }
}
