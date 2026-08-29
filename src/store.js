// =============================================================
// store.js —— 内存仓储（async 接口，与 MysqlStore 同构）
// 领域服务只依赖本文件声明的方法；生产换 MysqlStore 即可，业务代码不变
// 金额一律 BigInt（枚的 1e-6 最小单位）
// =============================================================
import { GameError, Codes } from './errors.js';

export class MemoryStore {
  constructor() {
    this.users = new Map();
    this.accounts = new Map();
    this.rounds = new Map();
    this.bets = [];
    this.nodes = [];
    this.nodeLogs = [];
    this.payoutBatches = [];
    this.referralLogs = [];
    this.flows = [];
    this.withdraws = [];
    this.posts = [];
    this.replies = [];
    this.blockedWords = new Set();
    this.ledger = { insurancePool: 0n, platform: 0n, pendingWithdraw: 0n, issued: 0n, withdrawn: 0n };
    this._seq = { user: 0, round: 0, bet: 0, node: 0, flow: 0, withdraw: 0, batch: 0, post: 0, reply: 0 };
  }

  async init() { /* 内存版无需建表 */ }
  get kind() { return 'memory'; }

  nextId(kind, prefix) {
    this._seq[kind] += 1;
    return `${prefix}${this._seq[kind]}`;
  }

  // -------- 用户 / 账户 --------
  async createUser({ wallet, inviterUid = null, createdAt = 0 }) {
    if (await this.getUserByWallet(wallet)) throw new GameError(Codes.ALREADY_EXISTS, '该钱包已注册');
    const uid = await this.nextId('user', 'U');
    const user = { uid, wallet, inviterUid, insSwitch: false, banned: false, createdAt };
    this.users.set(uid, user);
    this.accounts.set(uid, { available: 0n, frozen: 0n, premium: 0n, lossAccum: 0n });
    return { ...user };
  }
  async getUserByWallet(wallet) {
    for (const u of this.users.values()) if (u.wallet === wallet) return { ...u };
    return null;
  }
  async getUser(uid) {
    const u = this.users.get(uid);
    if (!u) throw new GameError(Codes.NOT_FOUND, '用户不存在');
    return { ...u };
  }
  async listUsers() { return [...this.users.values()].map((u) => ({ ...u })); }
  async setUserSwitch(uid, on) { const u = this.users.get(uid); u.insSwitch = !!on; return u.insSwitch; }
  async setBanned(uid, banned) { const u = this.users.get(uid); if (!u) throw new GameError(Codes.NOT_FOUND, '用户不存在'); u.banned = !!banned; return u.banned; }

  async getAccount(uid) {
    const a = this.accounts.get(uid);
    if (!a) throw new GameError(Codes.NOT_FOUND, '账户不存在');
    return { ...a };
  }
  async applyAccount(uid, d = {}) {
    const a = this.accounts.get(uid);
    if (!a) throw new GameError(Codes.NOT_FOUND, '账户不存在');
    a.available += BigInt(d.avail ?? 0);
    a.frozen += BigInt(d.frozen ?? 0);
    a.premium += BigInt(d.premium ?? 0);
    a.lossAccum += BigInt(d.loss ?? 0);
    return { ...a };
  }
  async applyLedger(d = {}) {
    const L = this.ledger;
    L.insurancePool += BigInt(d.ins ?? 0);
    L.platform += BigInt(d.plat ?? 0);
    L.pendingWithdraw += BigInt(d.pending ?? 0);
    L.issued += BigInt(d.issued ?? 0);
    L.withdrawn += BigInt(d.withdrawn ?? 0);
    return { ...L };
  }
  async getLedger() { return { ...this.ledger }; }

  // -------- 对局 --------
  async insertRound(r) { this.rounds.set(r.roundId, { ...r }); return r.roundId; }
  async updateRound(roundId, patch) { Object.assign(this.rounds.get(roundId), patch); }
  async getRound(roundId) {
    const r = this.rounds.get(roundId);
    return r ? { ...r } : null;
  }
  async findOpenRound() {
    for (const r of [...this.rounds.values()].reverse()) {
      if (r.state === 'active' || r.state === 'locked') return { ...r };
    }
    return null;
  }
  async listRecentRounds(limit = 100) { return [...this.rounds.values()].slice(-limit).reverse().map((r) => ({ ...r })); }
  async insertBet(b) { this.bets.push({ ...b }); }
  async listBetsByRound(roundId) { return this.bets.filter((b) => b.roundId === roundId).map((b) => ({ ...b })); }
  async countBetsOfRound(roundId) { return this.bets.filter((b) => b.roundId === roundId).length; }
  async markBetsSettled(roundId) { this.bets.filter((b) => b.roundId === roundId).forEach((b) => (b.settled = true)); }

  // -------- 保险节点 --------
  async insertNode(n) { this.nodes.push({ ...n }); }
  async listNodes({ uid = null, active = null } = {}) {
    return this.nodes.filter((n) =>
      (uid == null || n.uid === uid) && (active == null || (n.state === 'active') === active)).map((n) => ({ ...n }));
  }
  async updateNode(nodeId, patch) { Object.assign(this.nodes.find((n) => n.nodeId === nodeId), patch); }
  async addNodeLog(x) { this.nodeLogs.push({ ...x }); }
  async listNodeLogs(uid) { return this.nodeLogs.filter((x) => x.uid === uid).map((x) => ({ ...x })); }

  // -------- 赔付批次 --------
  async addPayoutBatch(b) { this.payoutBatches.push({ ...b }); }
  async hasPaidBatch(seq) { return this.payoutBatches.some((b) => b.seq === seq && b.state === 'paid'); }

  // -------- 邀请返佣 / 流水 / 提现 --------
  async addReferralLog(x) { this.referralLogs.push({ ...x }); }
  async referralSummary(inviterUid) {
    let total = 0n; const invitees = new Set();
    for (const x of this.referralLogs.filter((r) => r.inviterUid === inviterUid)) { total += x.reward; invitees.add(x.fromUid); }
    return { total, activeInvitees: invitees.size };
  }
  async addFlow(uid, bizType, amount, ref = {}) {
    const id = await this.nextId('flow', 'F');
    this.flows.push({ id, uid, bizType, amount, ref, at: ref.at ?? Date.now() });
    return id;
  }
  async listFlows(uid, limit = 100) {
    return this.flows.filter((f) => f.uid === uid).slice(-limit).reverse().map((f) => ({ ...f }));
  }
  async insertWithdraw(w) { this.withdraws.push({ ...w }); }
  async findWithdraw(id) { const w = this.withdraws.find((x) => x.withdrawId === id); return w ? { ...w } : null; }
  async updateWithdraw(id, patch) { Object.assign(this.withdraws.find((x) => x.withdrawId === id), patch); }
  /** 自动代付模式下「未广播成功」的遗留在途单（无交易哈希），用于自愈退回 */
  async listStalePending(uid) { return this.withdraws.filter((w) => w.uid === uid && w.state === 'pending' && !w.txhash).map((w) => ({ ...w })); }

  // -------- BBS 帖子 / 回复 --------
  async addPost(p) { this.posts.push({ ...p }); }
  async listPosts(limit = 50) { return this.posts.slice(-limit).reverse().map((p) => ({ ...p })); }
  async getPost(postId) { const p = this.posts.find((x) => x.postId === postId); return p ? { ...p } : null; }
  async addReply(r) { this.replies.push({ ...r }); }
  async listRepliesAll() { return this.replies.map((r) => ({ ...r })); }
  async deletePost(postId) {
    const before = this.posts.length;
    this.posts = this.posts.filter((p) => p.postId !== postId);
    this.replies = this.replies.filter((r) => r.postId !== postId);
    return before !== this.posts.length;
  }
  // —— 屏蔽词 ——
  async seedBlockedWords(words = []) { for (const w of words) if (w) this.blockedWords.add(String(w).trim().toLowerCase()); return [...this.blockedWords]; }
  async addBlockedWord(w) { const x = String(w ?? '').trim().toLowerCase(); if (x) this.blockedWords.add(x); return [...this.blockedWords]; }
  async removeBlockedWord(w) { this.blockedWords.delete(String(w ?? '').trim().toLowerCase()); return [...this.blockedWords]; }
  async listBlockedWords() { return [...this.blockedWords]; }

  // -------- 守恒 --------
  async totalInside() {
    let userSum = 0n;
    for (const a of this.accounts.values()) userSum += a.available + a.frozen + a.premium;
    const L = this.ledger;
    return userSum + L.insurancePool + L.platform + L.pendingWithdraw;
  }
  async totalSource() { return this.ledger.issued - this.ledger.withdrawn; }
  async assertBalanced(tag = '') {
    const inside = await this.totalInside();
    const source = await this.totalSource();
    if (inside !== source) throw new GameError(Codes.LEDGER_UNBALANCED, `总账不平[${tag}]：差额=${inside - source}`);
  }

  async transaction(fn, tag = 'tx') {
    const snap = this._snapshot();
    try { const r = await fn(); await this.assertBalanced(tag); return r; }
    catch (e) { this._restore(snap); throw e; }
  }
  _snapshot() {
    return {
      accounts: new Map([...this.accounts].map(([k, v]) => [k, { ...v }])),
      ledger: { ...this.ledger },
      len: { bets: this.bets.length, nodes: this.nodes.length, nodeLogs: this.nodeLogs.length, payoutBatches: this.payoutBatches.length, referralLogs: this.referralLogs.length, flows: this.flows.length, withdraws: this.withdraws.length, posts: this.posts.length, replies: this.replies.length, rounds: this.rounds.size, users: this.users.size },
      seq: { ...this._seq },
    };
  }
  _restore(s) {
    this.accounts = s.accounts; this.ledger = s.ledger;
    this.bets.length = s.len.bets; this.nodes.length = s.len.nodes; this.nodeLogs.length = s.len.nodeLogs;
    this.payoutBatches.length = s.len.payoutBatches; this.referralLogs.length = s.len.referralLogs;
    this.flows.length = s.len.flows; this.withdraws.length = s.len.withdraws;
    this.posts.length = s.len.posts; this.replies.length = s.len.replies;
    this.rounds = new Map([...this.rounds].slice(0, s.len.rounds));
    this.users = new Map([...this.users].slice(0, s.len.users));
    this._seq = s.seq;
  }
}
