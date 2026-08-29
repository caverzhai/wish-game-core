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
const { game, wallet, insurance, social, chain, store, cfg } = app;
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
route('POST', '/faucet', (b) => wallet.issue(b.uid, Number(b.amount ?? 100), 'FAUCET'));
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
// —— 对局（站内余额模式）——
route('POST', '/issue', (b) => wallet.issue(b.uid, Number(b.amount)));
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
  if (needInner > 0n) {
    if (!b.txHash) throw new GameError(Codes.BAD_INPUT, '站内余额不足，需要链上钱包补齐，但缺少交易哈希');
    const u = await store.getUser(b.uid);
    await chain.verifyIncoming({ txHash: b.txHash, fromAddress: u.wallet, expectInner: needInner }); // 链上实转必须恰为差额
    await wallet.issueInner(b.uid, needInner, 'CHAIN_DEPOSIT'); // 差额入账，此刻可用余额恰为 total
  }
  return await game.bet(b.uid, b.side, total, pick, now()); // 冻结全额后，原站内余额被精确用尽 → 清零
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
route('POST', '/withdraw/reap', (b) => wallet.reapUnbroadcast(b.uid));
route('POST', '/withdraw', async (b) => {
  await assertNotBanned(b.uid);
  if (chain.canPayout) await wallet.reapUnbroadcast(b.uid); // 先把上笔未广播成功的在途单退回，避免钱卡住
  const wd = await wallet.withdraw(b.uid, Number(b.amount));
  if (chain.canPayout) {
    try {
      const pay = await chain.payout(wd.toWallet, wd.arrive);
      const done = await wallet.confirmWithdraw(wd.withdrawId, pay.txHash);
      return { ...done, paid: true };
    } catch (e) {
      if (e.broadcast) {
        // 交易已广播、只是回执超时：钱可能已出，保留在途(pending)，凭哈希对账，绝不自动退款
        return { ...wd, paid: false, broadcast: true, txHash: e.txHash, payoutError: e.message };
      }
      // 广播前就失败（RPC 不通 / gas 不足 / 代币不足）：钱没出，自动退回冻结余额，用户可稍后重试
      const refunded = await wallet.failWithdraw(wd.withdrawId);
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
route('GET', '/ledger', async () => { await store.assertBalanced('api'); return { ...(await store.getLedger()), storeKind: store.kind, balanced: true }; });
route('GET', '/health', () => ({ ok: true, service: 'wish-game', store: store.kind, chain: chain.enabled, ts: now() }));

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (routes.some((r) => (typeof r.p === 'string' ? r.p === url.pathname : r.p.test(url.pathname)))) {
      const body = req.method === 'POST' ? await readBody(req) : {};
      for (const r of routes) {
        const match = typeof r.p === 'string' ? (r.p === url.pathname ? [] : null) : url.pathname.match(r.p);
        if (r.method === req.method && match) {
          const out = await r.h(body, match);
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

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log(`wish-game listening 0.0.0.0:${PORT} store=${store.kind} chain=${chain.enabled}`));
