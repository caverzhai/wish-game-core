// =============================================================
// store-mysql.js - MySQL persistent store, interface identical to MemoryStore
// Railway injects MYSQLHOST/PORT/USER/PASSWORD/DATABASE when MySQL added, auto-enabled
// Amount columns use BIGINT for 1e-6 min unit; write as string, read converts to BigInt
// =============================================================
import { AsyncLocalStorage } from 'node:async_hooks';
import { GameError, Codes } from './errors.js';
import { SCALE } from './money.js';

const B = (v) => (v === null || v === undefined || v === '' ? 0n : BigInt(v));
const jstr = (o) => JSON.stringify(o, (k, v) => (typeof v === 'bigint' ? Number(v) / Number(SCALE) : v));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, uid VARCHAR(16) UNIQUE, wallet VARCHAR(128) UNIQUE,
  inviter_uid VARCHAR(16) NULL, ins_switch TINYINT DEFAULT 0, banned TINYINT DEFAULT 0, created_at BIGINT DEFAULT 0
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
  fee BIGINT, arrive BIGINT, to_wallet VARCHAR(128), state VARCHAR(16), txhash VARCHAR(128) NULL, created_at BIGINT DEFAULT 0
);
CREATE TABLE IF NOT EXISTS posts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, post_id VARCHAR(16) UNIQUE, uid VARCHAR(16),
  content VARCHAR(400), at BIGINT, KEY idx_id(id)
);
CREATE TABLE IF NOT EXISTS replies (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, reply_id VARCHAR(16) UNIQUE, post_id VARCHAR(16), uid VARCHAR(16),
  content VARCHAR(400), at BIGINT, KEY idx_post(post_id), KEY idx_id(id)
);
CREATE TABLE IF NOT EXISTS ledger (
  id TINYINT PRIMARY KEY, insurance_pool BIGINT DEFAULT 0, platform BIGINT DEFAULT 0,
  pending_withdraw BIGINT DEFAULT 0, issued BIGINT DEFAULT 0, withdrawn BIGINT DEFAULT 0
);
INSERT IGNORE INTO ledger(id,insurance_pool,platform,pending_withdraw,issued,withdrawn)
  VALUES (1,0,0,0,0,0);
CREATE TABLE IF NOT EXISTS blocked_words (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, word VARCHAR(64) UNIQUE
);
CREATE TABLE IF NOT EXISTS whitelist (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, wallet VARCHAR(128) UNIQUE, per_mille INT DEFAULT 0
);
CREATE TABLE IF NOT EXISTS admins (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, wallet VARCHAR(128) UNIQUE, created_at BIGINT
);
CREATE TABLE IF NOT EXISTS announcement (
  id TINYINT PRIMARY KEY, content TEXT, at BIGINT DEFAULT 0, uid VARCHAR(16) NULL, wallet VARCHAR(128) NULL
);
CREATE TABLE IF NOT EXISTS chain_txs (
  tx_hash VARCHAR(80) PRIMARY KEY, uid VARCHAR(16), amount BIGINT, at BIGINT
);
CREATE TABLE IF NOT EXISTS voice_rooms (
  room_id VARCHAR(32) PRIMARY KEY, type VARCHAR(16), name VARCHAR(64),
  host_uid VARCHAR(16), balance BIGINT DEFAULT 0, per_minute BIGINT DEFAULT 0,
  created_at BIGINT, last_active_at BIGINT, empty_since BIGINT NULL,
  guest_uid VARCHAR(16) NULL, description VARCHAR(200) DEFAULT '',
  destroyed TINYINT DEFAULT 0
);
CREATE TABLE IF NOT EXISTS npcs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, npc_id VARCHAR(16) UNIQUE,
  uid VARCHAR(16), wallet VARCHAR(128), name VARCHAR(64),
  enabled TINYINT DEFAULT 1, created_at BIGINT,
  last_post_at BIGINT DEFAULT 0, last_chat_at BIGINT DEFAULT 0, last_bet_at BIGINT DEFAULT 0,
  next_post_at BIGINT DEFAULT 0, next_chat_at BIGINT DEFAULT 0, next_bet_at BIGINT DEFAULT 0,
  language VARCHAR(8) DEFAULT 'en'
);
CREATE TABLE IF NOT EXISTS lottery_rounds (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, round_id VARCHAR(32) UNIQUE,
  product_id VARCHAR(16), status VARCHAR(16), total_sold INT DEFAULT 0,
  created_at BIGINT, finished_at BIGINT NULL, winners_json TEXT NULL,
  KEY idx_product(product_id), KEY idx_status(status)
);
CREATE TABLE IF NOT EXISTS lottery_entries (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, round_id VARCHAR(32), uid VARCHAR(16),
  start_num INT, end_num INT, amount INT, created_at BIGINT,
  KEY idx_round(round_id), KEY idx_uid(uid)
);
CREATE TABLE IF NOT EXISTS lottery_comments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, product_id VARCHAR(16), uid VARCHAR(16),
  content VARCHAR(500), created_at BIGINT, KEY idx_product(product_id)
);
CREATE TABLE IF NOT EXISTS charity_projects (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, project_id VARCHAR(16) UNIQUE,
  uid VARCHAR(16), name VARCHAR(100), gender VARCHAR(16), photo TEXT,
  country VARCHAR(100), city VARCHAR(100), help_type VARCHAR(200),
  reason TEXT, target_amount BIGINT, goal_amount BIGINT, raised BIGINT DEFAULT 0,
  proof TEXT, status VARCHAR(16) DEFAULT 'active',
  support_votes INT DEFAULT 0, oppose_votes INT DEFAULT 0,
  comment_count INT DEFAULT 0, donor_count INT DEFAULT 0,
  created_at BIGINT, settled_at BIGINT NULL,
  KEY idx_status(status), KEY idx_raised(raised), KEY idx_support(support_votes)
);
CREATE TABLE IF NOT EXISTS charity_donations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, donation_id VARCHAR(16) UNIQUE,
  project_id VARCHAR(16), uid VARCHAR(16), amount BIGINT,
  status VARCHAR(16) DEFAULT 'frozen', created_at BIGINT,
  KEY idx_project(project_id), KEY idx_uid(uid)
);
CREATE TABLE IF NOT EXISTS charity_votes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, vote_id VARCHAR(16) UNIQUE,
  uid VARCHAR(16), project_id VARCHAR(16), support TINYINT DEFAULT 1,
  created_at BIGINT, UNIQUE KEY uid_project(uid, project_id)
);
CREATE TABLE IF NOT EXISTS charity_comments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, comment_id VARCHAR(16) UNIQUE,
  project_id VARCHAR(16), uid VARCHAR(16), content VARCHAR(1024),
  donor_amount BIGINT DEFAULT 0, created_at BIGINT,
  KEY idx_project(project_id)
);
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
    catch { throw new Error('MySQL requires mysql2 dependency (npm i mysql2), Railway build installs it automatically'); }
    const e = this.env;
    const opts = { supportBigNumbers: true, bigNumberStrings: false, connectionLimit: 10, enableKeepAlive: true };
    const url = e.DATABASE_URL || e.MYSQL_URL || e.MYSQL_PRIVATE_URL || e.MYSQL_PUBLIC_URL;
    if (url) {
      this.pool = mysql.createPool(url, opts);
    } else {
      this.pool = mysql.createPool({
        ...opts,
        host: e.MYSQLHOST || e.MYSQL_HOST || '127.0.0.1',
        port: Number(e.MYSQLPORT || e.MYSQL_PORT || 3306),
        user: e.MYSQLUSER || e.MYSQL_USER || 'root',
        password: e.MYSQLPASSWORD || e.MYSQL_PASSWORD || e.MYSQL_ROOT_PASSWORD || '',
        database: e.MYSQLDATABASE || e.MYSQL_DATABASE || 'railway',
      });
    }
    for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) {
      await this.pool.query(stmt);
    }
    // Legacy DB idempotent migration: add later columns (DB error if column exists, ignore)
    for (const alter of [
      'ALTER TABLE users ADD COLUMN banned TINYINT DEFAULT 0',
      'ALTER TABLE withdraws ADD COLUMN created_at BIGINT DEFAULT 0',
      'ALTER TABLE npcs ADD COLUMN language VARCHAR(8) DEFAULT \'en\'',
      'ALTER TABLE npcs ADD COLUMN last_bet_at BIGINT DEFAULT 0',
      'ALTER TABLE npcs ADD COLUMN next_bet_at BIGINT DEFAULT 0',
      'ALTER TABLE npcs ADD COLUMN last_post_at BIGINT DEFAULT 0',
      'ALTER TABLE npcs ADD COLUMN next_post_at BIGINT DEFAULT 0',
      'ALTER TABLE npcs ADD COLUMN last_chat_at BIGINT DEFAULT 0',
      'ALTER TABLE npcs ADD COLUMN next_chat_at BIGINT DEFAULT 0',
      'ALTER TABLE npcs ADD COLUMN enabled TINYINT DEFAULT 1',
    ]) {
      try { await this.pool.query(alter); } catch { /* column already exists */ }
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

  _userRow(r) { return r && { uid: r.uid, wallet: r.wallet, inviterUid: r.inviter_uid, insSwitch: !!r.ins_switch, banned: !!r.banned, createdAt: Number(r.created_at) }; }
  _acctRow(r) { return r && { available: B(r.available), frozen: B(r.frozen), premium: B(r.premium), lossAccum: B(r.loss_accum) }; }
  _roundRow(r) {
    if (!r) return null;
    let result = null;
    if (r.result_json) {
      try {
        result = JSON.parse(r.result_json);
        // Backward compat: old rows stored BigInt as inner6 string (e.g. "4000000"), convert to coin units
        for (const k of ['total', 'fee', 'feeIns', 'feePlat', 'pot', 'dust', 'referralTotal']) {
          if (typeof result[k] === 'string' && !isNaN(Number(result[k]))) result[k] = Number(result[k]) / 1e6;
        }
      } catch { result = null; }
    }
    return { roundId: r.round_id, startAt: Number(r.start_at), lockAt: Number(r.lock_at), settleAt: Number(r.settle_at),
      state: r.state, redTotal: B(r.red_total), greenTotal: B(r.green_total), sumPick: r.sum_pick, result };
  }

  async createUser(d) {
    const exist = await this.getUserByWallet(d.wallet);
    if (exist) throw new GameError(Codes.ALREADY_EXISTS, 'This wallet already registered');
    const id = await this.nextId('user', 'U');
    await this.exec('INSERT INTO users(uid,wallet,inviter_uid,ins_switch,created_at) VALUES(?,?,?,?,?)',
      [id, d.wallet, d.inviterUid, 0, d.createdAt || 0]);
    await this.exec('INSERT INTO accounts(uid,available,frozen,premium,loss_accum) VALUES(?,0,0,0,0)', [id]);
    return this.getUser(id);
  }
  async getUserByWallet(w) { const r = await this.exec('SELECT * FROM users WHERE wallet=? LIMIT 1', [w]); return this._userRow(r[0]); }
  async getUser(uid) { const r = await this.exec('SELECT * FROM users WHERE uid=? LIMIT 1', [uid]); if (!r[0]) throw new GameError(Codes.NOT_FOUND, 'User not found'); return this._userRow(r[0]); }
  async listUsers() { return (await this.exec('SELECT * FROM users ORDER BY id')).map((r) => this._userRow(r)); }
  async setUserSwitch(uid, on) { await this.exec('UPDATE users SET ins_switch=? WHERE uid=?', [on ? 1 : 0, uid]); return on; }
  async setBanned(uid, banned) {
    await this.getUser(uid);
    await this.exec('UPDATE users SET banned=? WHERE uid=?', [banned ? 1 : 0, uid]);
    return banned;
  }

  async getAccount(uid) {
    const forUpdate = this.tx.getStore() ? ' FOR UPDATE' : '';
    const r = await this.exec(`SELECT * FROM accounts WHERE uid=?${forUpdate}`, [uid]);
    if (!r[0]) throw new GameError(Codes.NOT_FOUND, 'Account not found');
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
  async countDirectInvitees(uid) {
    const r = await this.exec('SELECT COUNT(*) c FROM users WHERE inviter_uid=?', [uid]);
    return Number(r[0].c);
  }
  async countTotalDownline(uid) {
    // Recursive CTE to count all generations of downline
    const r = await this.exec(`
      WITH RECURSIVE downline AS (
        SELECT uid FROM users WHERE inviter_uid=?
        UNION ALL
        SELECT u.uid FROM users u INNER JOIN downline d ON u.inviter_uid=d.uid
      )
      SELECT COUNT(*) c FROM downline
    `, [uid]);
    return Number(r[0].c);
  }
  async saveRoom(room) {
    await this.exec(`INSERT INTO voice_rooms(room_id,type,name,host_uid,balance,per_minute,created_at,last_active_at,empty_since,guest_uid,description,destroyed)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE
      name=VALUES(name), balance=VALUES(balance), last_active_at=VALUES(last_active_at),
      empty_since=VALUES(empty_since), guest_uid=VALUES(guest_uid), description=VALUES(description), destroyed=VALUES(destroyed)`,
      [room.roomId, room.type, room.name, room.hostUid, String(room.balance), String(room.perMinute),
       room.createdAt, room.lastActiveAt, room.emptySince, room.guestUid, room.description || '', room.destroyed ? 1 : 0]);
  }
  async loadRooms() {
    const rows = await this.exec('SELECT * FROM voice_rooms WHERE destroyed=0');
    return rows.map((r) => ({
      roomId: r.room_id, type: r.type, name: r.name, hostUid: r.host_uid,
      balance: BigInt(r.balance), perMinute: BigInt(r.per_minute),
      createdAt: Number(r.created_at), lastActiveAt: Number(r.last_active_at),
      emptySince: r.empty_since ? Number(r.empty_since) : null,
      guestUid: r.guest_uid, description: r.description || '',
    }));
  }
  async deleteRoom(roomId) {
    await this.exec('UPDATE voice_rooms SET destroyed=1 WHERE room_id=?', [roomId]);
  }
  async addFlow(uid, bizType, amount, ref = {}) {
    const id = await this.nextId('flow', 'F');
    await this.exec('INSERT INTO flows(flow_id,uid,biz_type,amount,ref_json,at) VALUES(?,?,?,?,?,?)', [id, uid, bizType, amount, ref && Object.keys(ref).length ? jstr(ref) : null, ref.at ?? Date.now()]);
    // Keep only latest 64 flows per user
    await this.exec('DELETE FROM flows WHERE uid=? AND id NOT IN (SELECT id FROM (SELECT id FROM flows WHERE uid=? ORDER BY id DESC LIMIT 64) tmp)', [uid, uid]);
    return id;
  }
  async listFlows(uid, limit = 64) {
    return (await this.exec('SELECT * FROM flows WHERE uid=? ORDER BY id DESC LIMIT ?', [uid, limit])).map((r) => ({ id: r.flow_id, uid: r.uid, bizType: r.biz_type, amount: B(r.amount), ref: r.ref_json ? JSON.parse(r.ref_json) : {}, at: Number(r.at) }));
  }
  async insertWithdraw(w) { await this.exec('INSERT INTO withdraws(withdraw_id,uid,amount,fee,arrive,to_wallet,state,txhash,created_at) VALUES(?,?,?,?,?,?,?,?,?)', [w.withdrawId, w.uid, w.amount, w.fee, w.arrive, w.toWallet, w.state, w.txhash, w.at || Date.now()]); }
  async findWithdraw(id) { const r = await this.exec('SELECT * FROM withdraws WHERE withdraw_id=? LIMIT 1', [id]); return r[0] && { withdrawId: r.withdraw_id, uid: r.uid, amount: B(r.amount), fee: B(r.fee), arrive: B(r.arrive), toWallet: r.to_wallet, state: r.state, txhash: r.txhash }; }
  async updateWithdraw(id, p = {}) {
    const sets = [], vals = [];
    if (p.state) { sets.push('state=?'); vals.push(p.state); }
    if ('txhash' in p) { sets.push('txhash=?'); vals.push(p.txhash); }
    if (sets.length) { vals.push(id); await this.exec(`UPDATE withdraws SET ${sets.join(',')} WHERE withdraw_id=?`, vals); }
  }
  async listStalePending(uid, staleMs = 120000) {
    return (await this.exec("SELECT * FROM withdraws WHERE uid=? AND state='pending' AND txhash IS NULL AND (created_at = 0 OR created_at < ?)", [uid, Date.now() - (staleMs ?? 120000)]))
      .map((r) => ({ withdrawId: r.withdraw_id, uid: r.uid, amount: B(r.amount), fee: B(r.fee), arrive: B(r.arrive), toWallet: r.to_wallet, state: r.state, txhash: r.txhash }));
  }
  // broadcasted (has hash) but still pending: money was sent, for reconciliation confirmation
  async listBroadcastedPending(uid) {
    return (await this.exec("SELECT * FROM withdraws WHERE uid=? AND state='pending' AND txhash IS NOT NULL", [uid]))
      .map((r) => ({ withdrawId: r.withdraw_id, uid: r.uid, amount: B(r.amount), fee: B(r.fee), arrive: B(r.arrive), toWallet: r.to_wallet, state: r.state, txhash: r.txhash }));
  }

  // -------- BBS posts / replies (join with sender wallet) --------
  async addPost(p) { await this.exec('INSERT INTO posts(post_id,uid,content,at) VALUES(?,?,?,?)', [p.postId, p.uid, p.content, p.at]); }
  async listPosts(limit = 100000) {
    return (await this.exec('SELECT p.post_id post_id,p.uid uid,p.content content,p.at at,u.wallet wallet FROM posts p LEFT JOIN users u ON u.uid=p.uid ORDER BY p.id DESC LIMIT ?', [limit]))
      .map((r) => ({ postId: r.post_id, uid: r.uid, content: r.content, at: Number(r.at), wallet: r.wallet }));
  }
  async getPost(postId) { const r = await this.exec('SELECT * FROM posts WHERE post_id=? LIMIT 1', [postId]); return r[0] ? { postId: r[0].post_id, uid: r[0].uid, content: r[0].content, at: Number(r[0].at) } : null; }
  async addReply(r) { await this.exec('INSERT INTO replies(reply_id,post_id,uid,content,at) VALUES(?,?,?,?,?)', [r.replyId, r.postId, r.uid, r.content, r.at]); }
  async listRepliesAll() {
    return (await this.exec('SELECT r.reply_id reply_id,r.post_id post_id,r.uid uid,r.content content,r.at at,u.wallet wallet FROM replies r LEFT JOIN users u ON u.uid=r.uid ORDER BY r.id'))
      .map((r) => ({ replyId: r.reply_id, postId: r.post_id, uid: r.uid, content: r.content, at: Number(r.at), wallet: r.wallet }));
  }
  async deletePost(postId) {
    const r = await this.exec('DELETE FROM posts WHERE post_id=?', [postId]);
    await this.exec('DELETE FROM replies WHERE post_id=?', [postId]);
    return r.affectedRows > 0;
  }
  // Blocked words
  async seedBlockedWords(words = []) {
    for (const w of words) { const x = String(w || '').trim().toLowerCase(); if (x) { try { await this.exec('INSERT IGNORE INTO blocked_words(word) VALUES(?)', [x]); } catch { /* duplicate ignored */ } } }
    return this.listBlockedWords();
  }
  async addBlockedWord(w) {
    const x = String(w ?? '').trim().toLowerCase();
    if (x) { try { await this.exec('INSERT IGNORE INTO blocked_words(word) VALUES(?)', [x]); } catch { /* */ } }
    return this.listBlockedWords();
  }
  async removeBlockedWord(w) { await this.exec('DELETE FROM blocked_words WHERE word=?', [String(w ?? '').trim().toLowerCase()]); return this.listBlockedWords(); }
  async listBlockedWords() { return (await this.exec('SELECT word FROM blocked_words ORDER BY id')).map((r) => r.word); }

  // Whitelist (invite commission): wallet -> perMille
  async listWhitelist() { return (await this.exec('SELECT wallet, per_mille FROM whitelist ORDER BY id')).map((r) => ({ wallet: r.wallet, perMille: r.per_mille })); }
  async addWhitelist(wallet, perMille) {
    const w = String(wallet ?? '').trim().toLowerCase();
    const p = Number(perMille);
    if (!w || !Number.isFinite(p) || p < 0) throw new GameError(Codes.BAD_INPUT, 'Invalid wallet or rate');
    await this.exec('INSERT INTO whitelist(wallet, per_mille) VALUES(?,?) ON DUPLICATE KEY UPDATE per_mille=VALUES(per_mille)', [w, p]);
    return this.listWhitelist();
  }
  async removeWhitelist(wallet) { await this.exec('DELETE FROM whitelist WHERE wallet=?', [String(wallet ?? '').trim().toLowerCase()]); return this.listWhitelist(); }
  async getWhitelistRate(wallet) {
    const r = await this.exec('SELECT per_mille FROM whitelist WHERE wallet=? LIMIT 1', [String(wallet ?? '').trim().toLowerCase()]);
    return r.length > 0 ? r[0].per_mille : null;
  }

  // System announcement (single row, id=1)
  async getAnnouncement() {
    const r = await this.exec('SELECT content, at, uid, wallet FROM announcement WHERE id=1 LIMIT 1');
    return r.length > 0 && r[0].content ? { content: r[0].content, at: Number(r[0].at), uid: r[0].uid, wallet: r[0].wallet } : null;
  }
  async setAnnouncement(ann) {
    if (!ann) { await this.exec('DELETE FROM announcement WHERE id=1'); return null; }
    await this.exec('INSERT INTO announcement(id,content,at,uid,wallet) VALUES(1,?,?,?,?) ON DUPLICATE KEY UPDATE content=VALUES(content),at=VALUES(at),uid=VALUES(uid),wallet=VALUES(wallet)',
      [ann.content, ann.at || Date.now(), ann.uid || null, ann.wallet || null]);
    return this.getAnnouncement();
  }

  // On-chain credit tx idempotent dedup (tx_hash primary key, INSERT IGNORE prevents double credit)
  async isChainTxUsed(tx) {
    const r = await this.exec('SELECT 1 x FROM chain_txs WHERE tx_hash=? LIMIT 1', [String(tx ?? '').toLowerCase()]);
    return r.length > 0;
  }
  async markChainTxUsed(tx, uid, inner) {
    await this.exec('INSERT IGNORE INTO chain_txs(tx_hash,uid,amount,at) VALUES(?,?,?,?)',
      [String(tx ?? '').toLowerCase(), uid, BigInt(inner), Date.now()]);
    return true;
  }


  async totalInside() {
    const a = (await this.exec('SELECT COALESCE(SUM(available+frozen+premium),0) s FROM accounts'))[0].s;
    const l = await this.getLedger();
    return B(a) + l.insurancePool + l.platform + l.pendingWithdraw;
  }
  async totalSource() { const l = await this.getLedger(); return l.issued - l.withdrawn; }
  // -------- NPC bots (social-only, no betting) --------
  async insertNpc(n) {
    // Insert with minimal columns that exist in all DB versions; missing columns use DEFAULT
    await this.exec('INSERT INTO npcs(npc_id,uid,wallet,name,created_at) VALUES(?,?,?,?,?)',
      [n.npcId, n.uid, n.wallet, n.name, n.createdAt]);
    // Update optional fields via updateNpc (which only sets columns that exist in code)
    await this.updateNpc(n.npcId, { enabled: n.enabled, language: n.language, lastPostAt: n.lastPostAt || 0, lastChatAt: n.lastChatAt || 0, lastBetAt: n.lastBetAt || 0, nextPostAt: n.nextPostAt || 0, nextChatAt: n.nextChatAt || 0, nextBetAt: n.nextBetAt || 0 });
  }
  async listNpcs() {
    return (await this.exec('SELECT * FROM npcs ORDER BY id')).map((r) => ({
      npcId: r.npc_id, uid: r.uid, wallet: r.wallet, name: r.name,
      enabled: !!r.enabled, createdAt: Number(r.created_at),
      lastPostAt: Number(r.last_post_at), lastChatAt: Number(r.last_chat_at), lastBetAt: Number(r.last_bet_at || 0),
      nextPostAt: Number(r.next_post_at), nextChatAt: Number(r.next_chat_at), nextBetAt: Number(r.next_bet_at || 0),
      language: r.language || 'en',
    }));
  }
  async getNpc(npcId) {
    const r = await this.exec('SELECT * FROM npcs WHERE npc_id=? LIMIT 1', [npcId]);
    if (!r[0]) return null;
    return {
      npcId: r[0].npc_id, uid: r[0].uid, wallet: r[0].wallet, name: r[0].name,
      enabled: !!r[0].enabled, createdAt: Number(r[0].created_at),
      lastPostAt: Number(r[0].last_post_at), lastChatAt: Number(r[0].last_chat_at), lastBetAt: Number(r[0].last_bet_at || 0),
      nextPostAt: Number(r[0].next_post_at), nextChatAt: Number(r[0].next_chat_at), nextBetAt: Number(r[0].next_bet_at || 0),
      language: r[0].language || 'en',
    };
  }

  // -------- Charity relief projects --------
  _charityRow(r) {
    if (!r) return null;
    return {
      projectId: r.project_id, uid: r.uid, name: r.name, gender: r.gender, photo: r.photo,
      country: r.country, city: r.city || '', helpType: r.help_type, reason: r.reason,
      targetAmount: BigInt(r.target_amount), goalAmount: BigInt(r.goal_amount), raised: BigInt(r.raised),
      proof: r.proof || '', status: r.status,
      supportVotes: Number(r.support_votes), opposeVotes: Number(r.oppose_votes),
      commentCount: Number(r.comment_count), donorCount: Number(r.donor_count),
      createdAt: Number(r.created_at), settledAt: r.settled_at ? Number(r.settled_at) : null,
    };
  }
  async insertCharityProject(p) {
    await this.exec('INSERT INTO charity_projects(project_id,uid,name,gender,photo,country,city,help_type,reason,target_amount,goal_amount,raised,proof,status,support_votes,oppose_votes,comment_count,donor_count,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [p.projectId, p.uid, p.name, p.gender, p.photo, p.country, p.city, p.helpType, p.reason,
       p.targetAmount.toString(), p.goalAmount.toString(), p.raised.toString(), p.proof,
       p.status, p.supportVotes, p.opposeVotes, p.commentCount, p.donorCount, p.createdAt]);
  }
  async listCharityProjects(limit = 50, offset = 0) {
    const rows = await this.exec('SELECT * FROM charity_projects ORDER BY raised DESC, support_votes DESC, comment_count DESC LIMIT ? OFFSET ?', [limit, offset]);
    return rows.map(r => this._charityRow(r));
  }
  async getCharityProject(projectId) {
    const r = await this.exec('SELECT * FROM charity_projects WHERE project_id=? LIMIT 1', [projectId]);
    return this._charityRow(r[0]);
  }
  async getCharityProjectForUpdate(projectId) {
    const forUpdate = this.tx.getStore() ? ' FOR UPDATE' : '';
    const r = await this.exec(`SELECT * FROM charity_projects WHERE project_id=? LIMIT 1${forUpdate}`, [projectId]);
    return this._charityRow(r[0]);
  }
  async updateCharityProject(projectId, p = {}) {
    const col = { raised: 'raised', status: 'status', settledAt: 'settled_at', supportVotes: 'support_votes', opposeVotes: 'oppose_votes', commentCount: 'comment_count', donorCount: 'donor_count' };
    const sets = [], vals = [];
    for (const k of Object.keys(p)) {
      if (col[k]) {
        if (k === 'supportVotes' || k === 'opposeVotes' || k === 'commentCount' || k === 'donorCount') {
          sets.push(`${col[k]}=${col[k]}+?`);
          vals.push(p[k]);
        } else if (k === 'raised') {
          sets.push(`${col[k]}=?`);
          vals.push(p[k].toString());
        } else {
          sets.push(`${col[k]}=?`);
          vals.push(p[k]);
        }
      }
    }
    if (sets.length) await this.exec(`UPDATE charity_projects SET ${sets.join(',')} WHERE project_id=?`, [...vals, projectId]);
  }
  async addCharityDonation(d) {
    await this.exec('INSERT INTO charity_donations(donation_id,project_id,uid,amount,status,created_at) VALUES(?,?,?,?,?,?)',
      [d.donationId, d.projectId, d.uid, d.amount.toString(), d.status, d.createdAt]);
  }
  async listCharityDonations(projectId) {
    const rows = await this.exec('SELECT * FROM charity_donations WHERE project_id=?', [projectId]);
    return rows.map(r => ({ donationId: r.donation_id, projectId: r.project_id, uid: r.uid, amount: BigInt(r.amount), status: r.status, createdAt: Number(r.created_at) }));
  }
  async hasCharityDonation(uid, projectId) {
    const r = await this.exec('SELECT COUNT(*) as c FROM charity_donations WHERE uid=? AND project_id=?', [uid, projectId]);
    return r[0].c > 0;
  }
  async getCharityDonationTotal(uid, projectId) {
    const r = await this.exec('SELECT COALESCE(SUM(amount),0) as total FROM charity_donations WHERE uid=? AND project_id=? AND status IN (?,?)', [uid, projectId, 'frozen', 'won']);
    return BigInt(r[0].total);
  }
  async updateCharityDonation(donationId, p = {}) {
    const col = { status: 'status' };
    const sets = [], vals = [];
    for (const k of Object.keys(p)) {
      if (col[k]) { sets.push(`${col[k]}=?`); vals.push(p[k]); }
    }
    if (sets.length) await this.exec(`UPDATE charity_donations SET ${sets.join(',')} WHERE donation_id=?`, [...vals, donationId]);
  }
  async getCharityVote(uid, projectId) {
    const r = await this.exec('SELECT * FROM charity_votes WHERE uid=? AND project_id=? LIMIT 1', [uid, projectId]);
    return r[0] ? { voteId: r[0].vote_id, uid: r[0].uid, projectId: r[0].project_id, support: !!r[0].support, createdAt: Number(r[0].created_at) } : null;
  }
  async addCharityVote(v) {
    await this.exec('INSERT INTO charity_votes(vote_id,uid,project_id,support,created_at) VALUES(?,?,?,?,?)',
      [v.voteId, v.uid, v.projectId, v.support ? 1 : 0, v.createdAt]);
  }
  async addCharityComment(c) {
    await this.exec('INSERT INTO charity_comments(comment_id,project_id,uid,content,donor_amount,created_at) VALUES(?,?,?,?,?,?)',
      [c.commentId, c.projectId, c.uid, c.content, c.donorAmount.toString(), c.createdAt]);
  }
  async listCharityComments(projectId, limit = 50) {
    const rows = await this.exec('SELECT * FROM charity_comments WHERE project_id=? ORDER BY id DESC LIMIT ?', [projectId, limit]);
    return rows.map(r => ({ commentId: r.comment_id, projectId: r.project_id, uid: r.uid, content: r.content, donorAmount: BigInt(r.donor_amount), createdAt: Number(r.created_at) }));
  }
  async removeNpc(npcId) {
    await this.exec('DELETE FROM npcs WHERE npc_id=?', [npcId]);
    return true;
  }
  async updateNpc(npcId, p = {}) {
    const col = { lastPostAt: 'last_post_at', lastChatAt: 'last_chat_at', lastBetAt: 'last_bet_at', nextPostAt: 'next_post_at', nextChatAt: 'next_chat_at', nextBetAt: 'next_bet_at', enabled: 'enabled', language: 'language' };
    const sets = [], vals = [];
    for (const k of Object.keys(p)) {
      if (col[k]) { sets.push(`${col[k]}=?`); vals.push(k === 'enabled' ? (p[k] ? 1 : 0) : p[k]); }
    }
    if (sets.length) {
      vals.push(npcId);
      try { await this.exec(`UPDATE npcs SET ${sets.join(',')} WHERE npc_id=?`, vals); }
      catch (e) {
        // If column missing, try one-by-one to skip bad columns
        for (let i = 0; i < sets.length; i++) {
          try { await this.exec(`UPDATE npcs SET ${sets[i]} WHERE npc_id=?`, [vals[i], npcId]); }
          catch { /* column missing, skip */ }
        }
      }
    }
  }

  // -------- Admin wallets (stored in DB, first registered user becomes admin) --------
  async listAdmins() {
    return (await this.exec('SELECT wallet FROM admins')).map((r) => r.wallet.toLowerCase());
  }
  async addAdmin(wallet) {
    await this.exec('INSERT IGNORE INTO admins(wallet, created_at) VALUES(?,?)', [String(wallet).toLowerCase(), Date.now()]);
    return true;
  }
  async removeAdmin(wallet) {
    await this.exec('DELETE FROM admins WHERE wallet=?', [String(wallet).toLowerCase()]);
    return true;
  }
  async isAdminWallet(wallet) {
    if (!wallet) return false;
    const rows = await this.exec('SELECT id FROM admins WHERE wallet=? LIMIT 1', [String(wallet).toLowerCase()]);
    return rows.length > 0;
  }
  async userCount() {
    return (await this.exec('SELECT COUNT(*) c FROM users'))[0].c;
  }

  // -------- Lottery --------
  async lotteryCreateRound(productId, roundId) {
    await this.exec('INSERT INTO lottery_rounds (round_id, product_id, status, total_sold, created_at) VALUES (?, ?, ?, ?, ?)', [roundId, productId, 'selling', 0, Date.now()]);
    return { roundId, productId, status: 'selling', totalSold: 0, createdAt: Date.now(), finishedAt: null, winners: [] };
  }
  async lotteryGetActiveRound(productId) {
    const rows = await this.exec('SELECT * FROM lottery_rounds WHERE product_id = ? AND status = ? LIMIT 1', [productId, 'selling']);
    if (!rows.length) return null;
    const r = rows[0];
    return { roundId: r.round_id, productId: r.product_id, status: r.status, totalSold: r.total_sold, createdAt: r.created_at, finishedAt: r.finished_at, winners: r.winners_json ? JSON.parse(r.winners_json) : [] };
  }
  async lotteryUpdateRound(roundId, updates) {
    const sets = [], vals = [];
    if (updates.status !== undefined) { sets.push('status = ?'); vals.push(updates.status); }
    if (updates.totalSold !== undefined) { sets.push('total_sold = ?'); vals.push(updates.totalSold); }
    if (updates.finishedAt !== undefined) { sets.push('finished_at = ?'); vals.push(updates.finishedAt); }
    if (updates.winners !== undefined) { sets.push('winners_json = ?'); vals.push(JSON.stringify(updates.winners)); }
    if (sets.length) { vals.push(roundId); await this.exec(`UPDATE lottery_rounds SET ${sets.join(', ')} WHERE round_id = ?`, vals); }
  }
  async lotteryAddEntry(roundId, uid, startNum, endNum, amount) {
    await this.exec('INSERT INTO lottery_entries (round_id, uid, start_num, end_num, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)', [roundId, uid, startNum, endNum, amount, Date.now()]);
    return { roundId, uid, startNum, endNum, amount, createdAt: Date.now() };
  }
  async lotteryListEntries(roundId) {
    const rows = await this.exec('SELECT * FROM lottery_entries WHERE round_id = ?', [roundId]);
    return rows.map(e => ({ roundId: e.round_id, uid: e.uid, startNum: e.start_num, endNum: e.end_num, amount: e.amount, createdAt: e.created_at }));
  }
  async lotteryListMyNumbers(roundId, uid) {
    const rows = await this.exec('SELECT * FROM lottery_entries WHERE round_id = ? AND uid = ?', [roundId, uid]);
    return rows.map(e => ({ roundId: e.round_id, uid: e.uid, startNum: e.start_num, endNum: e.end_num, amount: e.amount, createdAt: e.created_at }));
  }
  async lotteryAddComment(productId, uid, content) {
    const result = await this.exec('INSERT INTO lottery_comments (product_id, uid, content, created_at) VALUES (?, ?, ?, ?)', [productId, uid, content, Math.floor(Date.now() / 1000)]);
    return { id: result.insertId, productId, uid, content, createdAt: Math.floor(Date.now() / 1000) };
  }
  async lotteryListComments(productId, limit = 50) {
    const rows = await this.exec('SELECT * FROM lottery_comments WHERE product_id = ? ORDER BY id DESC LIMIT ?', [productId, limit]);
    return rows.map(c => ({ id: c.id, productId: c.product_id, uid: c.uid, content: c.content, createdAt: c.created_at }));
  }
  async lotteryListHistory(productId, limit = 10) {
    const rows = await this.exec('SELECT * FROM lottery_rounds WHERE product_id = ? AND status = ? ORDER BY id DESC LIMIT ?', [productId, 'finished', limit]);
    return rows.map(r => ({ roundId: r.round_id, productId: r.product_id, totalSold: r.total_sold, winners: r.winners_json ? JSON.parse(r.winners_json) : [], finishedAt: r.finished_at }));
  }
  async lotteryCountFinished(productId) {
    const rows = await this.exec('SELECT COUNT(*) as cnt FROM lottery_rounds WHERE product_id = ? AND status = ?', [productId, 'finished']);
    return rows[0].cnt;
  }

  async assertBalanced(t = '') {
    const inside = await this.totalInside(), source = await this.totalSource();
    if (inside !== source) throw new GameError(Codes.LEDGER_UNBALANCED, `Ledger unbalanced[${t}]: delta=${inside - source}`);
  }
}
