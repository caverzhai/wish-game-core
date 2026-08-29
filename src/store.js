// =============================================================
// store.js —— 内存仓储（权威账本）+ 总账守恒校验 + 事务快照
// 生产环境用实现同一接口的 MySQL 仓储平替即可，领域服务不感知
// 所有金额字段均为 BigInt（单位：枚的 1e-6 最小单位）
// =============================================================
import { GameError, Codes } from './errors.js';

export class MemoryStore {
  constructor() {
    this.users = new Map();    // uid -> {uid, wallet, inviterUid, insSwitch, createdAt}
    this.accounts = new Map(); // uid -> {available, frozen, premium, lossAccum}
    this.rounds = new Map();   // roundId -> round
    this.bets = [];            // 每笔下注
    this.nodes = [];           // 赔付节点
    this.nodeLogs = [];        // 节点每期去向流水
    this.payoutBatches = [];   // 6h 全局赔付批次
    this.referralLogs = [];    // 邀请返佣流水
    this.flows = [];           // 全站资金流水
    this.withdraws = [];       // 提现单
    // 总账科目
    this.ledger = {
      insurancePool: 0n, // 保险池
      platform: 0n,      // 平台收入
      pendingWithdraw: 0n, // 提现待上链在途
      issued: 0n,        // 累计发放/充值入账
      withdrawn: 0n,     // 累计提币出系统（已上链成功）
    };
    this._seq = { user: 0, round: 0, bet: 0, node: 0, flow: 0, withdraw: 0, batch: 0 };
  }

  nextId(kind, prefix) {
    this._seq[kind] += 1;
    return `${prefix}${this._seq[kind]}`;
  }

  // -------- 用户与账户 --------
  createUser({ wallet, inviterUid = null, createdAt = 0 }) {
    for (const u of this.users.values()) {
      if (u.wallet === wallet) throw new GameError(Codes.ALREADY_EXISTS, '该钱包已注册');
    }
    const uid = this.nextId('user', 'U');
    this.users.set(uid, { uid, wallet, inviterUid, insSwitch: false, createdAt });
    this.accounts.set(uid, { available: 0n, frozen: 0n, premium: 0n, lossAccum: 0n });
    return this.users.get(uid);
  }
  getUser(uid) {
    const u = this.users.get(uid);
    if (!u) throw new GameError(Codes.NOT_FOUND, '用户不存在');
    return u;
  }
  account(uid) {
    const a = this.accounts.get(uid);
    if (!a) throw new GameError(Codes.NOT_FOUND, '账户不存在');
    return a;
  }

  addFlow(uid, bizType, amount, ref = {}) {
    const id = this.nextId('flow', 'F');
    this.flows.push({ id, uid, bizType, amount, ref, at: ref.at ?? Date.now() });
    return id;
  }

  // -------- 守恒平账：系统内资产 == 累计发放 - 累计提出 --------
  totalInside() {
    let userSum = 0n;
    for (const a of this.accounts.values()) {
      userSum += a.available + a.frozen + a.premium;
    }
    const L = this.ledger;
    return userSum + L.insurancePool + L.platform + L.pendingWithdraw;
  }
  totalSource() {
    return this.ledger.issued - this.ledger.withdrawn;
  }
  assertBalanced(tag = '') {
    const inside = this.totalInside();
    const source = this.totalSource();
    if (inside !== source) {
      throw new GameError(
        Codes.LEDGER_UNBALANCED,
        `总账不平[${tag}]：系统内=${inside}，来源净额=${source}，差额=${inside - source}`
      );
    }
  }

  /**
   * 事务：执行前快照全部余额，执行后强校验守恒；任一异常则回滚快照。
   * 内存版用深拷贝实现；MySQL 版对应 BEGIN/COMMIT/ROLLBACK + 行锁。
   */
  transaction(fn, tag = 'tx') {
    const snap = this._snapshot();
    try {
      const r = fn();
      this.assertBalanced(tag);
      return r;
    } catch (e) {
      this._restore(snap);
      throw e;
    }
  }
  _snapshot() {
    return {
      accounts: new Map([...this.accounts].map(([k, v]) => [k, { ...v }])),
      ledger: { ...this.ledger },
      len: {
        bets: this.bets.length, nodes: this.nodes.length, nodeLogs: this.nodeLogs.length,
        payoutBatches: this.payoutBatches.length, referralLogs: this.referralLogs.length,
        flows: this.flows.length, withdraws: this.withdraws.length, rounds: this.rounds.size,
      },
      seq: { ...this._seq },
    };
  }
  _restore(snap) {
    this.accounts = snap.accounts;
    this.ledger = snap.ledger;
    this.bets.length = snap.len.bets;
    this.nodes.length = snap.len.nodes;
    this.nodeLogs.length = snap.len.nodeLogs;
    this.payoutBatches.length = snap.len.payoutBatches;
    this.referralLogs.length = snap.len.referralLogs;
    this.flows.length = snap.len.flows;
    this.withdraws.length = snap.len.withdraws;
    // rounds 在事务内通常只改状态，回滚到快照大小
    const keep = [...this.rounds].slice(0, snap.len.rounds);
    this.rounds = new Map(keep);
    this._seq = snap.seq;
  }
}
