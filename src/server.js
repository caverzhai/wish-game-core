// =============================================================
// server.js —— 零依赖 HTTP 接口（演示/联调用，生产换成 Nest/Express + MySQL）
// 运行：node src/server.js  （默认 8080）
// 金额入参一律为「整数枚」；返回 bigint 以字符串给出，另附枚文本
// =============================================================
import http from 'node:http';
import { createApp } from './app.js';
import { coin, toCoin } from './money.js';

const app = createApp();
const now = () => Math.floor(Date.now() / 1000);

// bigint 安全序列化
function jstr(obj) {
  return JSON.stringify(obj, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
  });
}

const routes = [];
const route = (method, path, handler) => routes.push({ method, path, handler });

// —— 账号 ——
route('POST', '/register', (b) => app.game.register(b.wallet, b.inviterUid ?? null, now()));
route('GET', /^\/user\/(.+)$/, (b, m) => {
  const uid = m[1];
  return { user: app.store.getUser(uid), account: app.store.account(uid),
    nodes: app.store.nodes.filter((n) => n.uid === uid) };
});
// —— 保险 ——
route('POST', '/insurance/switch', (b) => ({ active: app.insurance.setSwitch(b.uid, !!b.on) }));
route('POST', '/insurance/deposit', (b) => ({ premium: app.insurance.depositPremium(b.uid, coin(Number(b.amount))) }));
// —— 发放（管理员/充值入账，演示用）——
route('POST', '/issue', (b) => ({ available: app.wallet.issue(b.uid, Number(b.amount)) }));
// —— 对局 ——
route('POST', '/bet', (b) => app.game.bet(b.uid, b.side, Number(b.amount), Number(b.pick), now()));
route('POST', '/settle', () => { const r = app.game._findOpenRound(); return app.game.settle(now()); });
route('GET', '/round/current', () => app.game.currentRound());
route('GET', /^\/round\/(.+)$/, (b, m) => app.game.roundDetail(m[1]));
route('GET', '/recent', () => app.game.recentRounds(100));
// —— 赔付（cron 到 UTC 3/9/15/21 点调用）——
route('POST', '/payout', () => app.insurance.runPayoutBatch(now()));
// —— 提现 ——
route('POST', '/withdraw', (b) => app.wallet.withdraw(b.uid, Number(b.amount)));
route('POST', '/withdraw/confirm', (b) => app.wallet.confirmWithdraw(b.withdrawId, b.txhash));
// —— 总账 ——
route('GET', '/ledger', () => { app.store.assertBalanced('api'); return { ...app.store.ledger, balanced: true }; });
route('GET', '/health', () => ({ ok: true, service: 'wish-game', ts: now() }));
route('GET', '/', () => ({ service: 'wish-game', health: '/health', recent: '/recent' }));

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    const body = req.method === 'POST' ? await readBody(req) : {};
    for (const r of routes) {
      const match = typeof r.path === 'string' ? (r.path === url.pathname ? [] : null) : url.pathname.match(r.path);
      if (r.method === req.method && match) {
        const out = await r.path instanceof RegExp ? r.handler(body, match) : r.handler(body, match);
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        return res.end(jstr(out));
      }
    }
    res.writeHead(404).end('not found');
  } catch (e) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(jstr({ error: e.name, code: e.code ?? null, message: e.message }));
  }
});

const PORT = process.env.PORT || 8080; // Railway/云平台注入 PORT
const HOST = '0.0.0.0';               // 必须绑 0.0.0.0，容器外才可访问
server.listen(PORT, HOST, () => console.log(`wish-game api listening on http://0.0.0.0:${PORT}（金额单位：枚）`));
