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
const coinNum = (v) => Number(BigInt(v)) / Number(SCALE); // BigInt(最小单位) -> 枚数值
function jstr(obj) {
  return JSON.stringify(obj, (k, v) => (typeof v === 'bigint' ? coinNum(v) : v), 2);
}
function readBody(req) {
  return new Promise((resolve) => {
    let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
  });
}

const app = await createApp();
const { game, wallet, insurance, store, cfg } = app;
const scheduler = new Scheduler(app);
// 内置定时：每 2 秒推进（自动结算到期局 + UTC 定点赔付），单容器自洽
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
route('POST', '/faucet', (b) => wallet.issue(b.uid, Number(b.amount ?? 100), 'FAUCET')); // 演示领枚
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
// —— 对局 ——
route('POST', '/issue', (b) => wallet.issue(b.uid, Number(b.amount)));
route('POST', '/bet', (b) => game.bet(b.uid, b.side, Number(b.amount), Number(b.pick), now()));
route('POST', '/settle', (b) => game.settle(b.atSec ?? now()));
route('POST', '/payout', (b) => insurance.runPayoutBatch(b.atSec ?? now()));
route('GET', '/round/current', () => game.currentRound());
route('GET', /^\/round\/(.+)$/, (b, m) => game.roundDetail(m[1]));
route('GET', '/recent', () => game.recentRounds(100));
// —— 提现 ——
route('POST', '/withdraw', (b) => wallet.withdraw(b.uid, Number(b.amount)));
route('POST', '/withdraw/confirm', (b) => wallet.confirmWithdraw(b.withdrawId, b.txhash));
// —— 系统 ——
route('GET', '/ledger', async () => { await store.assertBalanced('api'); return { ...(await store.getLedger()), storeKind: store.kind, balanced: true }; });
route('GET', '/health', () => ({ ok: true, service: 'wish-game', store: store.kind, ts: now() }));

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    // API
    if (url.pathname.startsWith('/') && routes.some((r) => (typeof r.p === 'string' ? r.p === url.pathname : r.p.test(url.pathname)))) {
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
    // 静态前端
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
server.listen(PORT, '0.0.0.0', () => console.log(`wish-game listening 0.0.0.0:${PORT} store=${store.kind}`));
