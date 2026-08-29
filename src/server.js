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
import { coin, SCALE } from './money.js';
import { referralPerMille } from './config.js';
import { Scheduler } from './Scheduler.js';

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

const routes = [];
const route = (method, p, h) => routes.push({ method, p, h });

// —— 账号 ——
route('POST', '/login', async (b) => {
  const ex = await store.getUserByWallet(b.wallet);
  if (ex) return ex;
  return await game.register(b.wallet, b.inviterUid ?? null, now());
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
    user, account, nodes,
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
route('POST', '/bet', (b) => game.bet(b.uid, b.side, Number(b.amount), Number(b.pick), now()));
// —— 对局（混合支付）：站内余额优先，不足部分由链上钱包转入补齐 ——
// totalAmount=许愿总额；chainAmount=本次链上实转的差额（=总额-站内可用余额），可为 0
route('POST', '/bet/onchain', async (b) => {
  const total = Number(b.totalAmount ?? b.amount), chainAmount = Number(b.chainAmount ?? total), pick = Number(b.pick);
  if (!Number.isInteger(chainAmount) || chainAmount < 0 || chainAmount > total) throw new Error('链上补差额不合法');
  const u = await store.getUser(b.uid);
  if (chainAmount > 0) {
    await chain.verifyIncoming({ txHash: b.txHash, fromAddress: u.wallet, expectInner: coin(chainAmount) });
    await wallet.issue(b.uid, chainAmount, 'CHAIN_DEPOSIT'); // 差额转入平台钱包，作为站内资产来源
  }
  return await game.bet(b.uid, b.side, total, pick, now()); // bet 会冻结全额（站内余额 + 刚入账差额）
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
// —— 链配置（公开，不含私钥）——
route('GET', '/chain/config', () => chain.publicConfig());
// —— 提现：配置了代付私钥则自动链上打款，否则生成待处理单 ——
route('POST', '/withdraw/reap', (b) => wallet.reapUnbroadcast(b.uid));
route('POST', '/withdraw', async (b) => {
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
      res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
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
