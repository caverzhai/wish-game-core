// =============================================================
// InsuranceService.js —— 可选保险：保费账户、Q5 节点生成、6h 定点赔付
// =============================================================
import { GameError, Codes } from './errors.js';
import { nextDue, batchSeqAt, isAlive } from './engine-payout.js';

export class InsuranceService {
  constructor(store, cfg) {
    this.store = store;
    this.cfg = cfg;
  }

  /** 保险是否生效：开关打开 且 保费账户 >= 20 枚 */
  isActive(uid) {
    const u = this.store.getUser(uid);
    const a = this.store.account(uid);
    return !!u.insSwitch && a.premium >= this.cfg.premiumMin;
  }

  setSwitch(uid, on) {
    const u = this.store.getUser(uid);
    u.insSwitch = !!on;
    return u.insSwitch;
  }

  /** 可用余额 -> 保费账户（预存保费） */
  depositPremium(uid, amount) {
    if (amount <= 0n) throw new GameError(Codes.BAD_INPUT, '存入保费必须为正数（枚）');
    return this.store.transaction(() => {
      const a = this.store.account(uid);
      if (a.available < amount) throw new GameError(Codes.INSUFFICIENT_BALANCE, '可用余额不足');
      a.available -= amount;
      a.premium += amount;
      this.store.addFlow(uid, 'PREMIUM_IN', amount);
      return a.premium;
    }, 'depositPremium');
  }

  /** 邀请人名下「生成过节点的去重直邀人数」——决定返佣档位 */
  countDistinctNodeInvitees(inviterUid) {
    const set = new Set();
    for (const n of this.store.nodes) {
      const u = this.store.users.get(n.uid);
      if (u && u.inviterUid === inviterUid) set.add(n.uid);
    }
    return set.size;
  }

  /** 用户最新节点所在批次序号（用于 168h=28 批续命判定） */
  newestNodeSeq(uid) {
    let seq = null;
    for (const n of this.store.nodes) {
      if (n.uid === uid && (seq === null || n.batchSeq > seq)) seq = n.batchSeq;
    }
    return seq;
  }

  /**
   * Q5：亏损只加不减；每满 100 枚且保费>=20 枚 -> 开 1 节点、扣 20 枚保费入保池；
   * 结束后保费<20 -> 剩余累计亏损清零；保费>=20 -> 不足 100 的零头保留。
   * 注意：本方法为「内部记账」，由外层事务包裹，自身不再开事务。
   */
  accrueLossInternal(uid, lossAdd, atSec) {
    if (lossAdd <= 0n) return [];
    const cfg = this.cfg, s = this.store, a = s.account(uid);
    a.lossAccum += lossAdd;
    const created = [];
    while (a.lossAccum >= cfg.nodeThreshold && a.premium >= cfg.nodePremium) {
      a.premium -= cfg.nodePremium;
      s.ledger.insurancePool += cfg.nodePremium; // 扣的 20 枚保费进保险池
      a.lossAccum -= cfg.nodeThreshold;
      const node = {
        nodeId: s.nextId('node', 'N'),
        uid,
        total: cfg.nodeTotal,
        periodN: 0,
        paidAmount: 0n,        // 已处置总额（到账+充公），用于末期补差与完成判定
        paidToUserAmount: 0n,  // 已实际到账
        forfeitedAmount: 0n,   // 断保充公
        state: 'active',
        createdAtSec: atSec,
        batchSeq: batchSeqAt(atSec, cfg),
      };
      s.nodes.push(node);
      s.addFlow(uid, 'NODE_PREMIUM_OUT', cfg.nodePremium, { nodeId: node.nodeId });
      created.push(node);
    }
    if (a.premium < cfg.nodePremium) a.lossAccum = 0n; // 保费不够开门，零头清零
    return created;
  }

  /**
   * 6 小时全局赔付（UTC 3/9/15/21 点由调度器触发，幂等：同一批次只成功一次）
   * currentSec=当前秒（测试可虚拟推进）
   */
  runPayoutBatch(currentSec) {
    const s = this.store, cfg = this.cfg;
    const currentSeq = batchSeqAt(currentSec, cfg);
    // 幂等：该批次已成功则跳过
    if (s.payoutBatches.find((b) => b.seq === currentSeq && b.state === 'paid')) {
      return { status: 'skip', currentSeq };
    }
    return s.transaction(() => {
      const active = s.nodes.filter((n) => n.state === 'active');
      let dueTotal = 0n;
      const dues = new Map();
      for (const n of active) {
        const due = nextDue(n, cfg);
        if (due != null) { dues.set(n.nodeId, due); dueTotal += due; }
      }
      // 保险池不足本次全部应赔 -> 整批顺延：不推进期号、不充公（168h 窗口随之冻结）
      if (dueTotal > 0n && s.ledger.insurancePool < dueTotal) {
        const batch = { batchId: s.nextId('batch', 'B'), seq: currentSeq, state: 'deferred', dueTotal, at: currentSec };
        s.payoutBatches.push(batch);
        return { status: 'deferred', currentSeq, dueTotal, insurancePool: s.ledger.insurancePool };
      }
      const newestSeq = new Map();
      for (const n of active) newestSeq.set(n.uid, this.newestNodeSeq(n.uid));

      let paidToUser = 0n, forfeited = 0n;
      for (const n of active) {
        const due = dues.get(n.nodeId);
        if (due == null) { n.state = 'done'; continue; }
        const alive = isAlive(newestSeq.get(n.uid), currentSeq, cfg);
        if (alive) {
          s.ledger.insurancePool -= due;
          s.account(n.uid).available += due;
          s.addFlow(n.uid, 'NODE_PAYOUT', due, { nodeId: n.nodeId });
          n.paidToUserAmount += due;
          paidToUser += due;
        } else {
          // 断保：仅「当期」充公——资金本就留在保险池，不做科目移动（否则总账凭空增多），
          // 只登记充公凭证、期号照走不补发；后续期次保留，再续命可续领。
          s.addFlow(n.uid, 'NODE_FORFEIT', due, { nodeId: n.nodeId });
          n.forfeitedAmount += due;
          forfeited += due;
        }
        n.periodN += 1;
        n.paidAmount += due;
        if (n.periodN >= 100) n.state = 'done';
        s.nodeLogs.push({ nodeId: n.nodeId, uid: n.uid, periodN: n.periodN, due, dest: alive ? 'user' : 'forfeit', seq: currentSeq });
      }
      const batch = { batchId: s.nextId('batch', 'B'), seq: currentSeq, state: 'paid', dueTotal, paidToUser, forfeited, at: currentSec };
      s.payoutBatches.push(batch);
      return { status: 'paid', currentSeq, paidToUser, forfeited, dueTotal };
    }, 'runPayoutBatch');
  }
}
