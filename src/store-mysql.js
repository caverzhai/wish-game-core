// =============================================================
// store-mysql.js —— MySQL 持久化仓储，接口与 MemoryStore 完全一致
// Railway 添加 MySQL 后会注入 MYSQLHOST/PORT/USER/PASSWORD/DATABASE，自动启用
// 金额列用 BIGINT 存 1e-6 最小单位；写入用字符串、读取统一转 BigInt
// =============================================================
import { AsyncLocalStorage } from 'node:async_hooks';
import { GameError, Codes } from './errors.js';

const B = (v) => (v === null || v === undefined || v === '' ? 0n : BigInt(v));
const jstr = (o) => JSON.stringify(o, (k, v) => (typeof v === 'bigint' ? v.toString() : v));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, uid VARCHAR(16) UNIQUE, wallet VARCHAR(128) UNIQUE,
  inviter_uid VARCHAR(16) NULL, ins_switch TINYINT DEFAULT 0, created_at BIGINT DEFAULT 0
);
CREATE TABLE IF NOT EXISTS accounts (
  uid VARCHAR(16) PRIMARY KEY,
  available BIGINT DEFAULT 0, frozen BIGINT DEFAULT 0, premium BIGINT DEFAULT 0, loss_accum BIGINT DEFAULT 0
);
CREATE TABLE IF NOT EXISTS seq (name VARCHAR(20) PRIMARY KEY, val INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS rounds (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, round_id VARCHAR(16) UNIQUE,
  start_at BIGINT, lock_at BIGINT, settle_at BIGINT, state VARCHAR(16),
  red_total BIGINT DEFAULT 0, green_total BIGINT DEFAULT 0, sum_pick INT DEFAULT 0, result_json TEXT NULL
);
CREATE TABLE IF NOT EXISTS bets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, bet_id VARCHAR(16) UNIQUE, round_id VARCHAR(16), uid VARCHAR(16),
  side VARCHAR(8), amount BIGINT, pick INT, win_credit BIGINT DEFAULT 0, ins_cut BIGINT DEFAULT 0,
  settled TINYINT DEFAULT 0, at BIGINT
);
CREATE TABLE IF NOT EXISTS nodes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, node_id VARCHAR(16) UNIQUE, uid VARCHAR(16), total BIGINT,
  period_n INT DEFAULT 0, paid_amount BIGINT DEFAULT 0, paid_to_user BIGINT DEFAULT 0, forfeited BIGINT DEFAULT 0,
  state VARCHAR(16), created_at BIGINT, batch_seq INT, KEY idx_uid(uid), KEY idx_state(state)
);
CREATE TABLE IF NOT EXISTS node_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, node_id VARCHAR(16), uid VARCHAR(16), period_n INT, due BIGINT, dest VARCHAR(8), seq INT
);
CREATE TABLE IF NOT EXISTS payout_batches (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, batch_id VARCHAR(16) UNIQUE, seq INT, state VARCHAR(16),
  due_total BIGINT DEFAULT 0, paid_to_user BIGINT DEFAULT 0, forfeited BIGINT DEFAULT 0, at BIGINT
);
CREATE TABLE IF NOT EXISTS referral_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, round_id VARCHAR(16), inviter_uid VARCHAR(16), from_uid VARCHAR(16),
  stake BIGINT, per_mille INT, reward BIGINT, at BIGINT, KEY idx_inv(inviter_uid)
);
CREATE TABLE IF NOT EXISTS flows (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, flow_id VARCHAR(16) UNIQUE, uid VARCHAR(16), biz_type VARCHAR(32),
  amount BIGINT, ref_json TEXT NULL, at BIGINT, KEY idx_uid(uid)
);
CREATE TABLE IF NOT EXISTS withdraws (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, withdraw_id VARCHAR(16) UNIQUE, uid VARCHAR(16), amount BIGINT,
  fee BIGINT, arrive BIGINT, to_wallet VARCHAR(128), state VARCHAR(16), txhash VARCHAR(128) NULL
);
CREATE TABLE IF NOT EXISTS ledger (
  id TINYINT PRIMARY KEY, insurance_pool BIGINT DEFAULT 0, platform BIGINT DEFAULT 0,
  pending_withdraw BIGINT DEFAULT 0, issued BIGINT DEFAULT 0, withdrawn BIGINT DEFAULT 0
);
INSERT IGNORE INTO ledger(id,insurance_pool,platform,pending_withdraw,issued,withdrawn)
  VALUES (1,0,0,0,0,0);
`;

export class MysqlStore {
  constructor(env = process.env) {
    this.tx = new AsyncLocalStorage();
    this.env = env;
    this.pool = null;
  }
  get kind() { return 'mysql'; }

  async init() {
    let mysql;
    try { mysql = await import('mysql2/promise'); }
    catch { throw new Error('启用 MySQL 需要依赖 mysql2（npm i mysql2），Railway 构建会自动安装'); }
    const e = this.env;
    const url = e.DATABASE_URL || e.MYSQL_URL || e.MYSQL_PUBLIC_URL;
    this.pool = url
      ? mysql.createPool(url)
      : mysql.createPool({
          host: e.MYSQLHOST || '127.0.0.1', port: Number(e.MYSQLPORT || 3306),
          user: e.MYSQLUSER || 'root', password: e.MYSQLPASSWORD || '', database: e.MYSQLDATABASE || 'railway',
          supportBigNumbers: true, bigNumberStrings: false, connectionLimit: 10,
        });
    for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) {
      await this.pool.query(stmt);
    }
  }

  _c() { return this.tx.getStore() || this.pool; }
  async exec(sql, params = []) {
    const [rows] = await this._c().execute(sql, params.map((p) => (typeof p === 'bigint' ? p.toString() : p)));
    return rows;
  }

  async transaction(fn, tag = 'tx') {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const r = await this.tx.run(conn, fn);
      await this.assertBalanced(tag);
      await conn.commit();
      return r;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async nextId(kind, prefix) {
    await this.exec('INSERT INTO seq(name,val) VALUES(?,1) ON DUPLICATE KEY UPDATE val=val+1', [kind]);
    const rows = await this.exec('SELECT val FROM seq WHERE name=?', [kind]);
    return `${prefix}${rows[0].val}`;
  }

  _userRow(r) { return r && { uid: r.uid, wallet: r.wallet, inviterUid: r.inviter_uid, insSwitch: !!r.ins_switch, createdAt: Number(r.created_at) }; }
  _acctRow(r) { return r && { available: B(r.available), frozen: B(r.frozen), premium: B(r.premium), lossAccum: B(r.loss_accum) }; }
  _roundRow(r) {
    return r && { roundId: r.round_id, startAt: Number(r.start_at), lockAt: Number(r.lock_at), settleAt: Number(r.settle_at),
      state: r.state, redTotal: B(r.red_total), greenTotal: B(r.green_total), sumPick: r.sum_pick,
      result: r.result_json ? JSON.parse(r.result_json) : null };
  }

  async createUser(d) {
    const exist = await this.getUserByWallet(d.wallet);
    if (exist) throw new GameError(Codes.ALREADY_EXISTS, '该钱包已注册');
    const id = await this.nextId('user', 'U');
    await this.exec('INSERT INTO users(uid,wallet,inviter_uid,ins_switch,created_at) VALUES(?,?,?,?,?)',
      [id, d.wallet, d.inviterUid, 0, d.createdAt || 0]);
    await this.exec('INSERT INTO accounts(uid,available,frozen,premium,loss_accum) VALUES(?,0,0,0,0)', [id]);
    return this.getUser(id);
  }
  async getUserByWallet(w) { const r = await this.exec('SELECT * FROM users WHERE wallet=? LIMIT 1', [w]); return this._userRow(r[0]); }
  async getUser(uid) { const r = await this.exec('SELECT * FROM users WHERE uid=? LIMIT 1', [uid]); if (!r[0]) throw new GameError(Codes.NOT_FOUND, '用户不存在'); return this._userRow(r[0]); }
  async listUsers() { return (await this.exec('SELECT * FROM users ORDER BY id')).map((r) => this._userRow(r)); }
  async setUserSwitch(uid, on) { await this.exec('UPDATE users SET ins_switch=? WHERE uid=?', [on ? 1 : 0, uid]); return on; }

  async getAccount(uid) {
    const forUpdate = this.tx.getStore() ? ' FOR UPDATE' : '';
    const r = await this.exec(`SELECT * FROM accounts WHERE uid=?${forUpdate}`, [uid]);
    if (!r[0]) throw new GameError(Codes.NOT_FOUND, '账户不存在');
    return this._acctRow(r[0]);
  }
  async applyAccount(uid, d = {}) {
    await this.exec('UPDATE accounts SET available=available+?, frozen=frozen+?, premium=premium+?, loss_accum=loss_accum+? WHERE uid=?',
      [BigInt(d.avail ?? 0), BigInt(d.frozen ?? 0), BigInt(d.premium ?? 0), BigInt(d.loss ?? 0), uid]);
    return await this.getAccount(uid);
  }
  async applyLedger(d = {}) {
    await this.exec('UPDATE ledger SET insurance_pool=insurance_pool+?, platform=platform+?, pending_withdraw=pending_withdraw+?, issued=issued+?, withdrawn=withdrawn+? WHERE id=1',
      [BigInt(d.ins ?? 0), BigInt(d.plat ?? 0), BigInt(d.pending ?? 0), BigInt(d.issued ?? 0), BigInt(d.withdrawn ?? 0)]);
    return await this.getLedger();
  }
  async getLedger() {
    const r = await this.exec('SELECT * FROM ledger WHERE id=1');
    return { insurancePool: B(r[0].insurance_pool), platform: B(r[0].platform), pendingWithdraw: B(r[0].pending_withdraw), issued: B(r[0].issued), withdrawn: B(r[0].withdrawn) };
  }

  async insertRound(r) {
    await this.exec('INSERT INTO rounds(round_id,start_at,lock_at,settle_at,state,red_total,green_total,sum_pick,result_json) VALUES(?,?,?,?,?,?,?,?,?)',
      [r.roundId, r.startAt, r.lockAt, r.settleAt, r.state, r.redTotal, r.greenTotal, r.sumPick, r.result ? jstr(r.result) : null]);
  }
  async updateRound(id, p = {}) {
    const col = { redTotal: 'red_total', greenTotal: 'green_total', sumPick: 'sum_pick', state: 'state', result: 'result_json' };
    const sets = [], vals = [];
    for (const k of Object.keys(p)) {
      if (k === 'result') { sets.push('result_json=?'); vals.push(p[k] ? jstr(p[k]) : null); }
      else if (col[k]) { sets.push(`${col[k]}=?`); vals.push(p[k]); }
    }
    if (sets.length) { vals.push(id); await this.exec(`UPDATE rounds SET ${sets.join(',')} WHERE round_id=?`, vals); }
  }
  async getRound(id) { const r = await this.exec('SELECT * FROM rounds WHERE round_id=? LIMIT 1', [id]); return this._roundRow(r[0]); }
  async findOpenRound() { const r = await this.exec("SELECT * FROM rounds WHERE state IN ('active','locked') ORDER BY id DESC LIMIT 1"); return this._roundRow(r[0]); }
  async listRecentRounds(limit = 100) { return (await this.exec('SELECT * FROM (SELECT * FROM rounds ORDER BY id DESC LIMIT ?) t ORDER BY id DESC', [limit])).map((r) => this._roundRow(r)); }
  async insertBet(b) {
    await this.exec('INSERT INTO bets(bet_id,round_id,uid,side,amount,pick,win_credit,ins_cut,settled,at) VALUES(?,?,?,?,?,?,?,0,0,?)',
      [b.betId, b.roundId, b.uid, b.side, b.amount, b.pick, b.winCredit || 0n, b.atSec]);
  }
  async listBetsByRound(rid) {
    return (await this.exec('SELECT * FROM bets WHERE round_id=? ORDER BY id', [rid])).map((r) => ({
      betId: r.bet_id, roundId: r.round_id, uid: r.uid, side: r.side, amount: B(r.amount), pick: r.pick, settled: !!r.settled,
    }));
  }
  async countBetsOfRound(rid) { return (await this.exec('SELECT COUNT(*) c FROM bets WHERE round_id=?', [rid]))[0].c; }
  async markBetsSettled(rid) { await this.exec('UPDATE bets SET settled=1 WHERE round_id=?', [rid]); }

  async insertNode(n) {
    await this.exec('INSERT INTO nodes(node_id,uid,total,period_n,paid_amount,paid_to_user,forfeited,state,created_at,batch_seq) VALUES(?,?,?,0,0,0,0,?,?,?)',
      [n.nodeId, n.uid, n.total, n.state, n.createdAtSec, n.batchSeq]);
  }
  async listNodes({ uid = null, active = null } = {}) {
    const where = [], vals = [];
    if (uid) { where.push('uid=?'); vals.push(uid); }
    if (active != null) { where.push('state=?'); vals.push(active ? 'active' : 'done'); }
    const sql = `SELECT * FROM nodes ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id`;
    return (await this.exec(sql, vals)).map((r) => ({
      nodeId: r.node_id, uid: r.uid, total: B(r.total), periodN: r.period_n, paidAmount: B(r.paid_amount),
      paidToUserAmount: B(r.paid_to_user), forfeitedAmount: B(r.forfeited), state: r.state, createdAtSec: Number(r.created_at), batchSeq: r.batch_seq,
    }));
  }
  async updateNode(id, p = {}) {
    // periodN/state 为直接赋值，金额类为累加
    const col = { paidAmount: 'paid_amount', paidToUserAmount: 'paid_to_user', forfeitedAmount: 'forfeited' };
    const sets = [], vals = [];
    if ('periodN' in p) { sets.push('period_n=?'); vals.push(p.periodN); }
    if ('state' in p) { sets.push('state=?'); vals.push(p.state); }
    for (const k of Object.keys(col)) if (k in p) { sets.push(`${col[k]}=${col[k]}+?`); vals.push(p[k]); }
    if (sets.length) { vals.push(id); await this.exec(`UPDATE nodes SET ${sets.join(',')} WHERE node_id=?`, vals); }
  }
  async addNodeLog(x) { await this.exec('INSERT INTO node_logs(node_id,uid,period_n,due,dest,seq) VALUES(?,?,?,?,?,?)', [x.nodeId, x.uid, x.periodN, x.due, x.dest, x.seq]); }
  async listNodeLogs(uid) { return (await this.exec('SELECT * FROM node_logs WHERE uid=? ORDER BY id', [uid])).map((r) => ({ nodeId: r.node_id, periodN: r.period_n, due: B(r.due), dest: r.dest, seq: r.seq })); }

  async addPayoutBatch(b) {
    await this.exec('INSERT INTO payout_batches(batch_id,seq,state,due_total,paid_to_user,forfeited,at) VALUES(?,?,?,?,?,?,?)',
      [b.batchId, b.seq, b.state, b.dueTotal || 0n, b.paidToUser || 0n, b.forfeited || 0n, b.at]);
  }
  async hasPaidBatch(seq) { return Number((await this.exec("SELECT COUNT(*) c FROM payout_batches WHERE seq=? AND state='paid'", [seq]))[0].c) > 0; }

  async addReferralLog(x) { await this.exec('INSERT INTO referral_logs(round_id,inviter_uid,from_uid,stake,per_mille,reward,at) VALUES(?,?,?,?,?,?,?)', [x.roundId, x.inviterUid, x.fromUid, x.stake, Number(x.perMille), x.reward, x.atSec]); }
  async referralSummary(inviterUid) {
    const r = await this.exec('SELECT COALESCE(SUM(reward),0) total, COUNT(DISTINCT from_uid) cnt FROM referral_logs WHERE inviter_uid=?', [inviterUid]);
    return { total: B(r[0].total), activeInvitees: Number(r[0].cnt) };
  }
  async addFlow(uid, bizType, amount, ref = {}) {
    const id = await this.nextId('flow', 'F');
    await this.exec('INSERT INTO flows(flow_id,uid,biz_type,amount,ref_json,at) VALUES(?,?,?,?,?,?)', [id, uid, bizType, amount, ref && Object.keys(ref).length ? jstr(ref) : null, ref.at ?? Date.now()]);
    return id;
  }
  async listFlows(uid, limit = 100) {
    return (await this.exec('SELECT * FROM flows WHERE uid=? ORDER BY id DESC LIMIT ?', [uid, limit])).map((r) => ({ id: r.flow_id, uid: r.uid, bizType: r.biz_type, amount: B(r.amount), ref: r.ref_json ? JSON.parse(r.ref_json) : {}, at: Number(r.at) }));
  }
  async insertWithdraw(w) { await this.exec('INSERT INTO withdraws(withdraw_id,uid,amount,fee,arrive,to_wallet,state,txhash) VALUES(?,?,?,?,?,?,?,?)', [w.withdrawId, w.uid, w.amount, w.fee, w.arrive, w.toWallet, w.state, w.txhash]); }
  async findWithdraw(id) { const r = await this.exec('SELECT * FROM withdraws WHERE withdraw_id=? LIMIT 1', [id]); return r[0] && { withdrawId: r.withdraw_id, uid: r.uid, amount: B(r.amount), fee: B(r.fee), arrive: B(r.arrive), toWallet: r.to_wallet, state: r.state, txhash: r.txhash }; }
  async updateWithdraw(id, p = {}) {
    const sets = [], vals = [];
    if (p.state) { sets.push('state=?'); vals.push(p.state); }
    if ('txhash' in p) { sets.push('txhash=?'); vals.push(p.txhash); }
    if (sets.length) { vals.push(id); await this.exec(`UPDATE withdraws SET ${sets.join(',')} WHERE withdraw_id=?`, vals); }
  }

  async totalInside() {
    const a = (await this.exec('SELECT COALESCE(SUM(available+frozen+premium),0) s FROM accounts'))[0].s;
    const l = await this.getLedger();
    return B(a) + l.insurancePool + l.platform + l.pendingWithdraw;
  }
  async totalSource() { const l = await this.getLedger(); return l.issued - l.withdrawn; }
  async assertBalanced(t = '') {
    const inside = await this.totalInside(), source = await this.totalSource();
    if (inside !== source) throw new GameError(Codes.LEDGER_UNBALANCED, `总账不平[${t}]：差额=${inside - source}`);
  }
}
