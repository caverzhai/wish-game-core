// =============================================================
// server.js - HTTP API + static frontend hosting + built-in auto settlement/payout scheduler
// Run: node src/server.js (port from PORT env, default 8080)
// BigInt amounts in responses converted to 'units' numbers for frontend
// =============================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { coin, SCALE, needTopUp } from './money.js';
import { Scheduler } from './Scheduler.js';
import { GameError, Codes } from './errors.js';
import { createWSServer } from './WSServer.js';
import { ROOM_CFG } from './VoiceRoomService.js';

const BUILD = '2.9.3'; // deploy version tag: visible in /health and frontend, for verifying online update

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const now = () => Math.floor(Date.now() / 1000);
const coinNum = (v) => Number(BigInt(v)) / Number(SCALE);
function jstr(obj) {
  return JSON.stringify(obj, (k, v) => (typeof v === 'bigint' ? coinNum(v) : v), 2);
}
function readBody(req) {
  return new Promise((resolve) => {
    let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
  });
}

const app = await createApp();
const { game, wallet, insurance, social, chain, store, cfg, voice, npc } = app;
const scheduler = new Scheduler(app);
setInterval(() => {
  scheduler.tick(now()).catch((e) => console.error('[tick]', e.message));
  npc.tick(now()).catch((e) => console.error('[npc-tick]', e.message));
}, 2000);

// BBS moderation: admin wallets (ADMIN_WALLETS env, comma-separated) + initial blocked words
const ADMIN_WALLETS = new Set((process.env.ADMIN_WALLETS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
// Cache admin wallets from DB, refresh every 30s
let _adminCache = { wallets: new Set(), updatedAt: 0 };
async function isAdminWallet(w) {
  if (!w) return false;
  const lw = String(w).toLowerCase();
  if (ADMIN_WALLETS.has(lw)) return true;
  const now = Date.now();
  if (now - _adminCache.updatedAt > 30000) {
    try {
      const dbAdmins = await store.listAdmins();
      _adminCache.wallets = new Set(dbAdmins);
      _adminCache.updatedAt = now;
    } catch { /* store may not have listAdmins yet */ }
  }
  return _adminCache.wallets.has(lw);
}
async function requireAdmin(uid) {
  const u = await store.getUser(uid);
  if (!(await isAdminWallet(u.wallet))) throw new GameError(Codes.FORBIDDEN, 'Admin privileges required');
  return u;
}
async function assertNotBanned(uid) {
  const u = await store.getUser(uid);
  if (u.banned) throw new GameError(Codes.BANNED, 'Account banned');
  return u;
}
// BBS_BLOCKED_WORDS env (comma-separated) loaded idempotently, admins can add/remove dynamically in-site
if (typeof store.seedBlockedWords === 'function') {
  store.seedBlockedWords((process.env.BBS_BLOCKED_WORDS || '').split(',').map((s) => s.trim()).filter(Boolean)).catch((e) => console.error('[seedWords]', e.message));
}

const routes = [];
const route = (method, p, h) => routes.push({ method, p, h });

// Account
route('POST', '/login', async (b) => {
  const ex = await store.getUserByWallet(b.wallet);
  const u = ex || await game.register(b.wallet, b.inviterUid ?? null, now());
  // Auto-promote first registered user to admin
  if (!ex) {
    try {
      const count = await store.userCount();
      if (count <= 1) {
        await store.addAdmin(u.wallet);
        _adminCache.updatedAt = 0; // force cache refresh
        console.log('[admin] first user auto-promoted:', u.wallet);
      }
    } catch (e) { console.error('[admin] auto-promote failed:', e.message); }
  }
  return { ...u, isAdmin: await isAdminWallet(u.wallet) };
});
route('POST', '/register', async (b) => {
  const u = await game.register(b.wallet, b.inviterUid ?? null, now());
  try {
    const count = await store.userCount();
    if (count <= 1) {
      await store.addAdmin(u.wallet);
      _adminCache.updatedAt = 0;
      console.log('[admin] first user auto-promoted:', u.wallet);
    }
  } catch (e) { console.error('[admin] auto-promote failed:', e.message); }
  return u;
});
route('GET', /^\/user\/(.+)$/, async (b, m) => {
  const uid = m[1];
  const user = await store.getUser(uid);
  const account = await store.getAccount(uid);
  const nodes = await store.listNodes({ uid });
  const referral = await store.referralSummary(uid);
  const flows = await store.listFlows(uid, 50);
  const whitelistRate = await store.getWhitelistRate(user.wallet);
  const directCount = await store.countDirectInvitees(uid);
  const downlineTotal = await store.countTotalDownline(uid);
  return {
    user, account, nodes, isAdmin: await isAdminWallet(user.wallet),
    invite: {
      code: uid,
      isWhitelisted: whitelistRate !== null,
      perMille: whitelistRate !== null ? whitelistRate : 1, // normal users fixed 0.1% = 1 per mille
      rewardTotal: referral.total,
      rewardedInvitees: referral.activeInvitees,
      directCount,
      downlineTotal,
    },
    flows,
  };
});
// Insurance
route('POST', '/insurance/switch', (b) => insurance.setSwitch(b.uid, !!b.on));
route('POST', '/insurance/deposit', (b) => insurance.depositPremium(b.uid, coin(Number(b.amount))));
route('GET', '/insurance/pool', () => insurance.poolPublic());
// Premium on-chain top-up: in-site balance first and fully used, wallet covers rest, then available->premium
route('POST', '/insurance/deposit/onchain', async (b) => {
  await assertNotBanned(b.uid);
  const total = Number(b.totalAmount ?? b.amount);
  if (!Number.isInteger(total) || total <= 0) throw new GameError(Codes.BAD_INPUT, 'Premium must be a positive integer (units)');
  const totalInner = coin(total);
  const acc = await store.getAccount(b.uid);
  const needInner = needTopUp(acc.available, totalInner);
  const txKey = String(b.txHash || '').toLowerCase();
  if (needInner > 0n) {
    if (!txKey) throw new GameError(Codes.BAD_INPUT, 'In-site balance insufficient, on-chain wallet top-up required, but tx hash missing');
    if (!(await store.isChainTxUsed(txKey))) {
      const u = await store.getUser(b.uid);
      await chain.verifyIncoming({ txHash: b.txHash, fromAddress: u.wallet, expectInner: needInner });
      await wallet.issueInner(b.uid, needInner, 'CHAIN_DEPOSIT');
      await store.markChainTxUsed(txKey, b.uid, needInner);
    }
  }
  return await insurance.depositPremium(b.uid, totalInner);
});
// Insurance off: withdraw premium back to available balance (no amount = all)
route('POST', '/insurance/premium/withdraw', async (b) => {
  await assertNotBanned(b.uid);
  return await insurance.withdrawPremium(b.uid, b.amount == null ? null : coin(Number(b.amount)));
});
// Rounds
route('POST', '/bet', async (b) => { await assertNotBanned(b.uid); return game.bet(b.uid, b.side, Number(b.amount), Number(b.pick), now()); });
// Round (mixed payment): in-site balance first and fully used, on-chain wallet covers rest, balance zeroed exactly
// totalAmount=bet total (integer units); top-up delta needInner recalculated from backend in-site available (6-decimal, allows decimals),
// on-chain must transfer exactly needInner, then freeze full amount after credit, avoids frontend rounding residue/overcharge.
route('POST', '/bet/onchain', async (b) => {
  await assertNotBanned(b.uid);
  const total = Number(b.totalAmount ?? b.amount), pick = Number(b.pick);
  if (!Number.isInteger(total) || total < 1 || total > 99) throw new GameError(Codes.BAD_INPUT, 'Bet amount must be a positive integer 1-99 (units)');
  const totalInner = coin(total);
  const acc = await store.getAccount(b.uid);
  const needInner = needTopUp(acc.available, totalInner); // actual shortfall (internal min unit, precise to 6 decimals)
  const txKey = String(b.txHash || '').toLowerCase();
  if (needInner > 0n) {
    if (!txKey) throw new GameError(Codes.BAD_INPUT, 'In-site balance insufficient, on-chain wallet top-up required, but tx hash missing');
    if (await store.isChainTxUsed(txKey)) return { dup: true, msg: 'This on-chain tx already used, cannot bet again' }; // idempotent fallback: same tx never double-bets
    const u = await store.getUser(b.uid);
    await chain.verifyIncoming({ txHash: b.txHash, fromAddress: u.wallet, expectInner: needInner }); // on-chain actual transfer must equal delta exactly
    await wallet.issueInner(b.uid, needInner, 'CHAIN_DEPOSIT'); // delta credited first (separate tx, even if bet fails later, money stays in balance, not lost)
    await store.markChainTxUsed(txKey, b.uid, needInner);       // register only after successful credit, idempotent dedup
  }
  return await game.bet(b.uid, b.side, total, pick, now()); // after freezing full amount, original in-site balance fully used -> zeroed
});
// Missing-order recovery: when on-chain paid but bet failed, credit actual on-chain amount to in-site balance by txHash, idempotent
route('POST', '/wallet/credit', async (b) => {
  await assertNotBanned(b.uid);
  const txKey = String(b.txHash || '').toLowerCase();
  if (!txKey.startsWith('0x')) throw new GameError(Codes.BAD_INPUT, 'Invalid transaction hash format');
  if (await store.isChainTxUsed(txKey)) { // already credited: idempotent return current balance, frontend can safely clear pending record
    const a = await store.getAccount(b.uid);
    return { already: true, credited: 0, available: a.available };
  }
  const u = await store.getUser(b.uid);
  const hit = await chain.verifyIncoming({ txHash: b.txHash, fromAddress: u.wallet }); // no fixed amount check, use actual received
  const inner = BigInt(hit.inner);
  if (inner <= 0n) throw new GameError(Codes.BAD_INPUT, 'This tx has no valid amount transferred to platform wallet');
  await wallet.issueInner(b.uid, inner, 'CHAIN_DEPOSIT');
  await store.markChainTxUsed(txKey, b.uid, inner);
  const a = await store.getAccount(b.uid);
  return { already: false, credited: inner, available: a.available, txHash: b.txHash };
});
route('POST', '/settle', (b) => game.settle(b.atSec ?? now()));
route('POST', '/payout', (b) => insurance.runPayoutBatch(b.atSec ?? now()));
route('GET', '/round/current', () => game.currentRound());
route('GET', /^\/round\/(.+)$/, (b, m) => game.roundDetail(m[1]));
route('GET', '/recent', () => game.recentRounds(100));
// —— BBS ——
route('POST', '/bbs/post', (b) => social.post(b.uid, b.content));
route('POST', '/bbs/reply', (b) => social.reply(b.uid, b.postId, b.content));
route('GET', '/bbs/list', () => social.list());
// System announcement (admin-published, long text 8192 bytes, does not consume BBS quota)
route('GET', '/announcement', () => social.getAnnouncement());
route('POST', '/announcement', async (b) => { await requireAdmin(b.uid); return social.setAnnouncement(b.uid, b.content); });
// Voice rooms
route('GET', '/voice/rooms', () => voice.listRooms());
route('GET', /^\/voice\/room\/(.+)$/, (b, m) => voice.getRoomDetail(m[1]));
route('POST', '/voice/create', async (b) => {
  await assertNotBanned(b.uid);
  return voice.createRoom(b.uid, b.type, b.name, coin(Number(b.amount)), b.description);
});
route('POST', '/voice/edit-description', async (b) => {
  await assertNotBanned(b.uid);
  return voice.editDescription(b.roomId, b.uid, b.description);
});
route('POST', '/voice/recharge', async (b) => {
  await assertNotBanned(b.uid);
  return voice.recharge(b.roomId, b.uid, coin(Number(b.amount)));
});
route('POST', '/voice/dissolve', async (b) => {
  await assertNotBanned(b.uid);
  await voice.dissolve(b.roomId, b.uid);
  if (voice._broadcastClosed) voice._broadcastClosed(b.roomId);
  return { dissolved: true };
});
// Upload voice/image (base64), returns filename, frontend accesses via /voice/media/:file
route('POST', '/voice/upload', async (b) => {
  await assertNotBanned(b.uid);
  const mime = String(b.mime || '');
  const ext = mime.includes('webm') ? 'webm' : mime.includes('ogg') ? 'ogg' : mime.includes('mp3') ? 'mp3' : mime.includes('png') ? 'png' : mime.includes('gif') ? 'gif' : 'jpg';
  const buf = Buffer.from(String(b.data || ''), 'base64');
  if (buf.length > 2 * 1024 * 1024) throw new GameError(Codes.BAD_INPUT, 'File too large (max 2MB)');
  const file = voice.saveMedia(buf, ext);
  return { file, mime, size: buf.length };
});
route('GET', /^\/voice\/media\/(.+)$/, (b, m, req, res) => {
  const fp = voice.getMediaPath(m[1]);
  if (!fs.existsSync(fp)) throw new GameError(Codes.NOT_FOUND, 'File not found');
  const ext = path.extname(fp).toLowerCase();
  const ct = { '.webm': 'audio/webm', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.png': 'image/png', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }[ext] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': ct, 'Cache-Control': 'public, max-age=3600' });
  res.end(fs.readFileSync(fp));
  return { __raw: true };
});
// BBS moderation (only admin wallets in ADMIN_WALLETS can operate)
route('GET', '/admin/words', () => store.listBlockedWords());
route('POST', '/admin/word/add', async (b) => { await requireAdmin(b.uid); return { words: await store.addBlockedWord(b.word) }; });
route('POST', '/admin/word/remove', async (b) => { await requireAdmin(b.uid); return { words: await store.removeBlockedWord(b.word) }; });
route('POST', '/admin/post/delete', async (b) => { await requireAdmin(b.uid); return social.deletePost(b.uid, b.postId); });
route('POST', '/admin/user/ban', async (b) => { await requireAdmin(b.uid); return { targetUid: b.targetUid, banned: await store.setBanned(b.targetUid, b.banned !== false) }; });
route('POST', '/admin/user/unban', async (b) => { await requireAdmin(b.uid); return { targetUid: b.targetUid, banned: await store.setBanned(b.targetUid, false) }; });
// Whitelist (invite commission) management
route('GET', '/admin/whitelist', async (b) => { await requireAdmin(b.uid); return { list: await store.listWhitelist() }; });
route('POST', '/admin/whitelist/add', async (b) => { await requireAdmin(b.uid); return { list: await store.addWhitelist(b.wallet, b.perMille) }; });
route('POST', '/admin/whitelist/remove', async (b) => { await requireAdmin(b.uid); return { list: await store.removeWhitelist(b.wallet) }; });
// NPC bot management (social-only bots, no betting)
route('GET', '/admin/npcs', async (b) => { await requireAdmin(b.uid); return { list: await npc.listNpcs() }; });
route('POST', '/admin/npc/add', async (b) => { await requireAdmin(b.uid); return { npc: await npc.addNpc(b.name, b.wallet, b.language) }; });
route('POST', '/admin/npc/remove', async (b) => { await requireAdmin(b.uid); return { removed: await npc.removeNpc(b.npcId) }; });
route('POST', '/admin/npc/recharge', async (b) => { await requireAdmin(b.uid); return await npc.rechargeNpc(b.npcId, b.amount); });
// Chain config (public, no private key)
route('GET', '/chain/config', () => chain.publicConfig());
// Withdrawal: auto on-chain payout if payout key configured, otherwise create pending order
route('POST', '/withdraw/reap', async (b) => { await wallet.reconcileBroadcasted(b.uid).catch(() => {}); return await wallet.reapUnbroadcast(b.uid); });
route('POST', '/withdraw', async (b) => {
  await assertNotBanned(b.uid);
  if (chain.canPayout) {
    try { await wallet.reconcileBroadcasted(b.uid); } catch { /* reconcile broadcasted orders, non-blocking */ }
    try { await wallet.reapUnbroadcast(b.uid); } catch { /* recover unbroadcast leftover orders, never blocks this withdrawal */ }
  }
  const wd = await wallet.withdraw(b.uid, Number(b.amount));
  if (chain.canPayout) {
    try {
      const pay = await chain.payout(wd.toWallet, wd.arrive, async (hash) => {
        try { await store.updateWithdraw(wd.withdrawId, { txhash: hash }); } catch { /* logging failure non-blocking */ }
      });
      const done = await wallet.confirmWithdraw(wd.withdrawId, pay.txHash);
      return { ...done, paid: true };
    } catch (e) {
      if (e.broadcast) {
        // tx broadcasted but receipt timeout: money may have left, keep pending, reconcile by hash, never auto-refund
        return { ...wd, paid: false, broadcast: true, txHash: e.txHash, payoutError: e.message };
      }
      // pre-broadcast failure (RPC down / insufficient gas / insufficient tokens): money not sent, auto-refund frozen balance, user can retry later
      let refunded = wd;
      try { refunded = await wallet.failWithdraw(wd.withdrawId); }
      catch (re) { /* already paid/refunded etc: on idempotent conflict no second error, defer to on-chain and original order state */ }
      return { ...refunded, paid: false, payoutError: e.message };
    }
  }
  return wd;
});
route('POST', '/withdraw/confirm', (b) => wallet.confirmWithdraw(b.withdrawId, b.txhash));
route('POST', '/withdraw/fail', (b) => wallet.failWithdraw(b.withdrawId));
// Admin overview (operational status, no sensitive info)
route('GET', '/admin/overview', async () => {
  const users = await store.listUsers();
  const rounds = await store.listRecentRounds(100000);
  const posts = await store.listPosts(100000);
  return { chain: chain.publicConfig(), ledger: await store.getLedger(), counts: { users: users.length, rounds: rounds.length, posts: posts.length } };
});
// System
route('GET', '/ledger', async () => {
  const inside = (await store.totalInside()) + voice.totalRoomBalance();
  const source = await store.totalSource();
  return { ...(await store.getLedger()), roomBalance: voice.totalRoomBalance(), storeKind: store.kind, balanced: inside === source, diff: inside - source };
});
route('GET', '/health', () => ({ ok: true, service: 'wish-game', build: BUILD, store: store.kind, chain: chain.enabled, ts: now() }));
// Debug: NPC activity status
route('GET', '/debug/npc', async () => {
  const npcs = await npc.listNpcs();
  const nowTs = now();
  return {
    now: nowTs,
    npcCount: npcs.length,
    rooms: (await voice.listRooms()).map(r => ({ id: r.roomId, name: r.name, type: r.type, members: r.memberCount })),
    npcs: npcs.map(n => ({
      id: n.npcId, uid: n.uid, wallet: n.wallet, lang: n.language,
      bal: n.balance,
      chatDue: n.nextChatAt <= nowTs, chatNextIn: Math.max(0, n.nextChatAt - nowTs),
      postDue: n.nextPostAt <= nowTs, postNextIn: Math.max(0, n.nextPostAt - nowTs),
      betDue: n.nextBetAt <= nowTs, betNextIn: Math.max(0, n.nextBetAt - nowTs),
      lastChat: n.lastChatAt, lastPost: n.lastPostAt, lastBet: n.lastBetAt,
    })),
  };
});


const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (routes.some((r) => (typeof r.p === 'string' ? r.p === url.pathname : r.p.test(url.pathname)))) {
      const body = req.method === 'POST' ? await readBody(req) : Object.fromEntries(url.searchParams.entries());
      for (const r of routes) {
        const match = typeof r.p === 'string' ? (r.p === url.pathname ? [] : null) : url.pathname.match(r.p);
        if (r.method === req.method && match) {
          const out = await r.h(body, match, req, res);
          if (out && out.__raw) return; // media routes write response themselves
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
          return res.end(jstr(out));
        }
      }
    }
    let file = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    const fp = path.join(PUBLIC_DIR, file);
    if (fp.startsWith(PUBLIC_DIR) && fs.existsSync(fp) && fs.statSync(fp).isFile()) {
      res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-cache, must-revalidate' });
      return res.end(fs.readFileSync(fp));
    }
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' }).end(jstr({ error: 'not found' }));
  } catch (e) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(jstr({ error: e.name, code: e.code ?? null, message: e.message }));
  }
});

// Voice room WebSocket + per-minute billing
const wss = createWSServer(server, voice);
setInterval(async () => {
  try {
    const destroyed = await voice.tick();
    for (const rid of destroyed) if (voice._broadcastClosed) voice._broadcastClosed(rid);
    await voice.flushPersistence();
  } catch (e) { console.error('[voice-tick]', e.message); }
}, 60000);

// Startup repair: force-cancel stuck rounds and fix ledger imbalance (caused by rolled-back NPC version)
(async () => {
  try {
    const nowS = now();
    const [stuck] = await store.pool.query("SELECT round_id FROM rounds WHERE state IN ('active','locked') AND settle_at < ?", [nowS - 60]);
    for (const row of stuck) {
      await store.pool.query("UPDATE rounds SET state='cancelled', result_json=? WHERE round_id=?", [JSON.stringify({ status: 'cancelled', reason: 'startup_repair' }), row.round_id]);
      console.log('[startup-repair] cancelled stuck round', row.round_id);
    }
    const inside = await store.totalInside();
    const l = await store.getLedger();
    const source = l.issued - l.withdrawn;
    const delta = inside - source;
    if (delta !== 0n) {
      await store.pool.query('UPDATE ledger SET issued=issued+? WHERE id=1', [delta.toString()]);
      console.log('[startup-repair] ledger fixed, delta=', delta.toString());
    }
  // Assign languages and initial funding to existing NPCs (created before v2.5.0)
  try {
    const npcs = await store.listNpcs();
    const langs = ['en', 'zh-TW', 'ja', 'ar', 'id', 'ko', 'ru', 'hi', 'ur'];
    const COIN = 1000000n;
    const START_BAL = 100n * COIN;
    let langIdx = 0, funded = 0;
    for (const n of npcs) {
      if (!n.language || n.language === 'en') {
        await store.updateNpc(n.npcId, { language: langs[langIdx % langs.length] });
        langIdx++;
      }
      // Set initial bet time if not set
      if (!n.nextBetAt || n.nextBetAt === 0) {
        const nextBet = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1800) + 1800;
        await store.updateNpc(n.npcId, { nextBetAt: nextBet });
      }
      // Fund with 100 coins if balance is 0 (from platform account)
      try {
        const acc = await store.getAccount(n.uid);
        if (acc.available < START_BAL / 2n) {
          await store.transaction(async () => {
            await store.applyLedger({ plat: -START_BAL });
            await store.applyAccount(n.uid, { avail: START_BAL });
            await store.addFlow(n.uid, 'NPC_FUND', START_BAL, { note: 'startup repair initial funding' });
          }, 'npc-startup-fund');
          funded++;
        }
      } catch { /* account may not exist, skip */ }
    }
    if (langIdx > 0) console.log('[startup-repair] assigned languages to', langIdx, 'NPCs');
    if (funded > 0) console.log('[startup-repair] funded', funded, 'NPCs with 100 coins each (REMINDER: add', funded * 100, 'coins to withdrawal wallet)');
    // Fix NPC wallet: convert NPC_xxx / NPC-xxx to random 0x address (pure wallet, no NPC prefix)
    let walletFixed = 0;
    const gen0x = () => '0x' + Array.from({length: 40}, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
    for (const n of npcs) {
      try {
        const u = await store.getUser(n.uid);
        if (u && (u.wallet.startsWith('NPC_') || u.wallet.startsWith('NPC-') || n.wallet.startsWith('NPC_'))) {
          const newWallet = gen0x();
          await store.exec('UPDATE users SET wallet = ? WHERE uid = ?', [newWallet, n.uid]);
          await store.exec('UPDATE npcs SET wallet = ? WHERE npc_id = ?', [newWallet, n.npcId]);
          walletFixed++;
        }
      } catch { /* user may not exist */ }
    }
    if (walletFixed > 0) console.log('[startup-repair] converted', walletFixed, 'NPC wallets to 0x format');
  } catch (e) { console.error('[startup-repair npc-init]', e.message); }
  } catch (e) { console.error('[startup-repair]', e.message); }
})();

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log(`wish-game listening 0.0.0.0:${PORT} store=${store.kind} chain=${chain.enabled}`));
