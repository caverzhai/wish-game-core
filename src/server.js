// =============================================================
// server.js —— HTTP API + 静态前端托管 + 内置自动结算/赔付调度
// 运行：node src/server.js  （端口取平台 PORT，默认 8080）
// 响应中的 BigInt 金额统一转成「枚」数值返回前端
// =============================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { coin, SCALE, needTopUp } from './money.js';
import { referralPerMille } from './config.js';
import { Scheduler } from './Scheduler.js';
import { GameError, Codes } from './errors.js';
import { createWSServer } from './WSServer.js';
import { ROOM_CFG } from './VoiceRoomService.js';

const BUILD = '2.3.3'; // 部署版本标记：/health 与前端可见，用于核对线上是否更新

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
const { game, wallet, insurance, social, chain, store, cfg, voice } = app;
const scheduler = new Scheduler(app);
setInterval(() => { scheduler.tick(now()).catch((e) => console.error('[tick]', e.message)); }, 2000);

// —— BBS 治理：管理员钱包（环境变量 ADMIN_WALLETS，逗号分隔）+ 初始屏蔽词 ——
const ADMIN_WALLETS = new Set((process.env.ADMIN_WALLETS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
const isAdminWallet = (w) => !!w && ADMIN_WALLETS.has(String(w).toLowerCase());
async function requireAdmin(uid) {
  const u = await store.getUser(uid);
  if (!isAdminWallet(u.wallet)) throw new GameError(Codes.FORBIDDEN, '需要管理员权限');
  return u;
}
async function assertNotBanned(uid) {
  const u = await store.getUser(uid);
  if (u.banned) throw new GameError(Codes.BANNED, '账号已被封禁');
  return u;
}
// 环境变量 BBS_BLOCKED_WORDS（逗号分隔）幂等灌入，后续可由管理员在站内动态增删
if (typeof store.seedBlockedWords === 'function') {
  store.seedBlockedWords((process.env.BBS_BLOCKED_WORDS || '').split(',').map((s) => s.trim()).filter(Boolean)).catch((e) => console.error('[seedWords]', e.message));
}

const routes = [];
const route = (method, p, h) => routes.push({ method, p, h });

// —— 账号 ——
route('POST', '/login', async (b) => {
  const ex = await store.getUserByWallet(b.wallet);
  const u = ex || await game.register(b.wallet, b.inviterUid ?? null, now());
  return { ...u, isAdmin: isAdminWallet(u.wallet) };
});
route('POST', '/register', (b) => game.register(b.wallet, b.inviterUid ?? null, now()));
route('GET', /^\/user\/(.+)$/, async (b, m) => {
  const uid = m[1];
  const user = await store.getUser(uid);
  const account = await store.getAccount(uid);
  const nodes = await store.listNodes({ uid });
  const nodeInviteeCount = await insurance.countDistinctNodeInvitees(uid);
  const referral = await store.referralSummary(uid);
  const flows = await store.listFlows(uid, 50);
  return {
    user, account, nodes, isAdmin: isAdminWallet(user.wallet),
    invite: { code: uid, perMille: Number(referralPerMille(cfg, nodeInviteeCount)), nodeInviteeCount, rewardTotal: referral.total, rewardedInvitees: referral.activeInvitees },
    flows,
  };
});
// —— 保险 ——
route('POST', '/insurance/switch', (b) => insurance.setSwitch(b.uid, !!b.on));
route('POST', '/insurance/deposit', (b) => insurance.depositPremium(b.uid, coin(Number(b.amount))));
route('GET', '/insurance/pool', () => insurance.poolPublic());
// 保费链上补差：站内余额优先并精确用尽，不足由钱包补，随后 available->premium
route('POST', '/insurance/deposit/onchain', async (b) => {
  await assertNotBanned(b.uid);
  const total = Number(b.totalAmount ?? b.amount);
  if (!Number.isInteger(total) || total <= 0) throw new GameError(Codes.BAD_INPUT, '保费必须为正整数（枚）');
  const totalInner = coin(total);
  const acc = await store.getAccount(b.uid);
  const needInner = needTopUp(acc.available, totalInner);
  const txKey = String(b.txHash || '').toLowerCase();
  if (needInner > 0n) {
    if (!txKey) throw new GameError(Codes.BAD_INPUT, '站内余额不足，需要链上钱包补齐，但缺少交易哈希');
    if (!(await store.isChainTxUsed(txKey))) {
      const u = await store.getUser(b.uid);
      await chain.verifyIncoming({ txHash: b.txHash, fromAddress: u.wallet, expectInner: needInner });
      await wallet.issueInner(b.uid, needInner, 'CHAIN_DEPOSIT');
      await store.markChainTxUsed(txKey, b.uid, needInner);
    }
  }
  return await insurance.depositPremium(b.uid, totalInner);
});
// 保险关闭状态下，把保费提回可用余额（amount 不传=全部）
route('POST', '/insurance/premium/withdraw', async (b) => {
  await assertNotBanned(b.uid);
  return await insurance.withdrawPremium(b.uid, b.amount == null ? null : coin(Number(b.amount)));
});
// —— 对局 ——
route('POST', '/bet', async (b) => { await assertNotBanned(b.uid); return game.bet(b.uid, b.side, Number(b.amount), Number(b.pick), now()); });
// —— 对局（混合支付）：站内余额优先并「精确用尽」，不足部分由链上钱包补齐，余额精确清零 ——
// totalAmount=许愿总额（整数枚）；以后端站内可用余额为准重算补差额 needInner（6位定点，允许小数），
// 链上必须恰好转入 needInner，入账后再冻结全额，避免前端取整导致余额残留/多扣。
route('POST', '/bet/onchain', async (b) => {
  await assertNotBanned(b.uid);
  const total = Number(b.totalAmount ?? b.amount), pick = Number(b.pick);
  if (!Number.isInteger(total) || total < 1 || total > 99) throw new GameError(Codes.BAD_INPUT, '许愿金必须为 1-99 的正整数（枚）');
  const totalInner = coin(total);
  const acc = await store.getAccount(b.uid);
  const needInner = needTopUp(acc.available, totalInner); // 真正还差多少（内部最小单位，精确到 6 位小数）
  const txKey = String(b.txHash || '').toLowerCase();
  if (needInner > 0n) {
    if (!txKey) throw new GameError(Codes.BAD_INPUT, '站内余额不足，需要链上钱包补齐，但缺少交易哈希');
    if (await store.isChainTxUsed(txKey)) return { dup: true, msg: '该链上交易已使用，不能重复许愿' }; // 幂等兜底：同一笔交易绝不下第二次注
    const u = await store.getUser(b.uid);
    await chain.verifyIncoming({ txHash: b.txHash, fromAddress: u.wallet, expectInner: needInner }); // 链上实转必须恰为差额
    await wallet.issueInner(b.uid, needInner, 'CHAIN_DEPOSIT'); // 差额先入账（独立事务，即使随后下注失败，钱也留在余额，不丢）
    await store.markChainTxUsed(txKey, b.uid, needInner);       // 入账成功才登记，幂等防重
  }
  return await game.bet(b.uid, b.side, total, pick, now()); // 冻结全额后，原站内余额被精确用尽 → 清零
});
// —— 掉单补录：链上已支付但下注未成功时，凭 txHash 把「链上实收金额」补入站内余额，幂等 ——
route('POST', '/wallet/credit', async (b) => {
  await assertNotBanned(b.uid);
  const txKey = String(b.txHash || '').toLowerCase();
  if (!txKey.startsWith('0x')) throw new GameError(Codes.BAD_INPUT, '交易哈希格式不正确');
  if (await store.isChainTxUsed(txKey)) { // 已入账：幂等返回当前余额，前端可安全清掉待补记录
    const a = await store.getAccount(b.uid);
    return { already: true, credited: 0, available: a.available };
  }
  const u = await store.getUser(b.uid);
  const hit = await chain.verifyIncoming({ txHash: b.txHash, fromAddress: u.wallet }); // 不校验固定金额，按实收
  const inner = BigInt(hit.inner);
  if (inner <= 0n) throw new GameError(Codes.BAD_INPUT, '该交易没有转入平台钱包的有效金额');
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
// —— 语音房 ——
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
// 上传语音/图片（base64），返回文件名，前端通过 /voice/media/:file 访问
route('POST', '/voice/upload', async (b) => {
  await assertNotBanned(b.uid);
  const mime = String(b.mime || '');
  const ext = mime.includes('webm') ? 'webm' : mime.includes('ogg') ? 'ogg' : mime.includes('mp3') ? 'mp3' : mime.includes('png') ? 'png' : mime.includes('gif') ? 'gif' : 'jpg';
  const buf = Buffer.from(String(b.data || ''), 'base64');
  if (buf.length > 2 * 1024 * 1024) throw new GameError(Codes.BAD_INPUT, '文件过大（上限2MB）');
  const file = voice.saveMedia(buf, ext);
  return { file, mime, size: buf.length };
});
route('GET', /^\/voice\/media\/(.+)$/, (b, m, req, res) => {
  const fp = voice.getMediaPath(m[1]);
  if (!fs.existsSync(fp)) throw new GameError(Codes.NOT_FOUND, '文件不存在');
  const ext = path.extname(fp).toLowerCase();
  const ct = { '.webm': 'audio/webm', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.png': 'image/png', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }[ext] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': ct, 'Cache-Control': 'public, max-age=3600' });
  res.end(fs.readFileSync(fp));
  return { __raw: true };
});
// —— BBS 治理（仅 ADMIN_WALLETS 中的管理员钱包可操作）——
route('GET', '/admin/words', () => store.listBlockedWords());
route('POST', '/admin/word/add', async (b) => { await requireAdmin(b.uid); return { words: await store.addBlockedWord(b.word) }; });
route('POST', '/admin/word/remove', async (b) => { await requireAdmin(b.uid); return { words: await store.removeBlockedWord(b.word) }; });
route('POST', '/admin/post/delete', async (b) => { await requireAdmin(b.uid); return social.deletePost(b.uid, b.postId); });
route('POST', '/admin/user/ban', async (b) => { await requireAdmin(b.uid); return { targetUid: b.targetUid, banned: await store.setBanned(b.targetUid, b.banned !== false) }; });
route('POST', '/admin/user/unban', async (b) => { await requireAdmin(b.uid); return { targetUid: b.targetUid, banned: await store.setBanned(b.targetUid, false) }; });
// —— 链配置（公开，不含私钥）——
route('GET', '/chain/config', () => chain.publicConfig());
// —— 提现：配置了代付私钥则自动链上打款，否则生成待处理单 ——
route('POST', '/withdraw/reap', async (b) => { await wallet.reconcileBroadcasted(b.uid).catch(() => {}); return await wallet.reapUnbroadcast(b.uid); });
route('POST', '/withdraw', async (b) => {
  await assertNotBanned(b.uid);
  if (chain.canPayout) {
    try { await wallet.reconcileBroadcasted(b.uid); } catch { /* 已广播单对账补确认，不阻断 */ }
    try { await wallet.reapUnbroadcast(b.uid); } catch { /* 未广播遗留单回收，绝不阻断本次提现 */ }
  }
  const wd = await wallet.withdraw(b.uid, Number(b.amount));
  if (chain.canPayout) {
    try {
      const pay = await chain.payout(wd.toWallet, wd.arrive, async (hash) => {
        try { await store.updateWithdraw(wd.withdrawId, { txhash: hash }); } catch { /* 留痕失败不阻断 */ }
      });
      const done = await wallet.confirmWithdraw(wd.withdrawId, pay.txHash);
      return { ...done, paid: true };
    } catch (e) {
      if (e.broadcast) {
        // 交易已广播、只是回执超时：钱可能已出，保留在途(pending)，凭哈希对账，绝不自动退款
        return { ...wd, paid: false, broadcast: true, txHash: e.txHash, payoutError: e.message };
      }
      // 广播前就失败（RPC 不通 / gas 不足 / 代币不足）：钱没出，自动退回冻结余额，用户可稍后重试
      let refunded = wd;
      try { refunded = await wallet.failWithdraw(wd.withdrawId); }
      catch (re) { /* 已打款/已退款等：幂等冲突时不再抛二次错误，以链上与原单状态为准 */ }
      return { ...refunded, paid: false, payoutError: e.message };
    }
  }
  return wd;
});
route('POST', '/withdraw/confirm', (b) => wallet.confirmWithdraw(b.withdrawId, b.txhash));
route('POST', '/withdraw/fail', (b) => wallet.failWithdraw(b.withdrawId));
// —— 后台总览（运营状态，不含任何敏感信息）——
route('GET', '/admin/overview', async () => {
  const users = await store.listUsers();
  const rounds = await store.listRecentRounds(100000);
  const posts = await store.listPosts(100000);
  return { chain: chain.publicConfig(), ledger: await store.getLedger(), counts: { users: users.length, rounds: rounds.length, posts: posts.length } };
});
// —— 系统 ——
route('GET', '/ledger', async () => {
  const inside = (await store.totalInside()) + voice.totalRoomBalance();
  const source = await store.totalSource();
  return { ...(await store.getLedger()), roomBalance: voice.totalRoomBalance(), storeKind: store.kind, balanced: inside === source, diff: inside - source };
});
route('GET', '/health', () => ({ ok: true, service: 'wish-game', build: BUILD, store: store.kind, chain: chain.enabled, ts: now() }));

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (routes.some((r) => (typeof r.p === 'string' ? r.p === url.pathname : r.p.test(url.pathname)))) {
      const body = req.method === 'POST' ? await readBody(req) : {};
      for (const r of routes) {
        const match = typeof r.p === 'string' ? (r.p === url.pathname ? [] : null) : url.pathname.match(r.p);
        if (r.method === req.method && match) {
          const out = await r.h(body, match, req, res);
          if (out && out.__raw) return; // 媒体等路由自行写响应
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

// —— 语音房 WebSocket + 每分钟扣费 ——
const wss = createWSServer(server, voice);
setInterval(async () => {
  try {
    const destroyed = await voice.tick();
    for (const rid of destroyed) if (voice._broadcastClosed) voice._broadcastClosed(rid);
  } catch (e) { console.error('[voice-tick]', e.message); }
}, 60000);

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log(`wish-game listening 0.0.0.0:${PORT} store=${store.kind} chain=${chain.enabled}`));
