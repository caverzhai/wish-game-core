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
import { generateNonce, consumeNonce, buildSignMessage, verifySignature, signJwt, verifyJwt, extractToken } from './auth.js';
import { setupRoutes } from './routes.js';

const BUILD = '2.39.0'; // deploy version tag: visible in /health and frontend, for verifying online update

// In-memory log buffer for debugging
const LOG_BUFFER = [];
const MAX_LOGS = 200;
const origLog = console.log;
console.log = function(...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  LOG_BUFFER.push({ t: Date.now(), msg });
  if (LOG_BUFFER.length > MAX_LOGS) LOG_BUFFER.shift();
  origLog.apply(console, args);
};
const origError = console.error;
console.error = function(...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  LOG_BUFFER.push({ t: Date.now(), msg: 'ERROR: ' + msg });
  if (LOG_BUFFER.length > MAX_LOGS) LOG_BUFFER.shift();
  origError.apply(console, args);
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon' };
// #11 Rate limiter: in-memory sliding window by IP
const RATE_LIMIT = new Map(); // ip -> { count, windowStart }
const RATE_WINDOW_MS = 60000; // 1 minute
const RATE_MAX = 120; // 120 requests per minute per IP
function checkRateLimit(req) {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let entry = RATE_LIMIT.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    entry = { count: 0, windowStart: now };
    RATE_LIMIT.set(ip, entry);
  }
  entry.count++;
  if (entry.count > RATE_MAX) return false;
  // Cleanup old entries periodically
  if (RATE_LIMIT.size > 10000) {
    for (const [k, v] of RATE_LIMIT) {
      if (now - v.windowStart > RATE_WINDOW_MS * 2) RATE_LIMIT.delete(k);
    }
  }
  return true;
}

// #15 XSS escape helper
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
function sanitizeUserInput(obj) {
  if (typeof obj === 'string') return escapeHtml(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeUserInput);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj)) out[k] = sanitizeUserInput(obj[k]);
    return out;
  }
  return obj;
}

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

// Determine mode: real (default) or demo
const IS_DEMO_MODE = process.env.DEMO_MODE === 'true' || process.env.DEMO_MODE === '1';
const DB_NAME = IS_DEMO_MODE ? 'railway_demo' : null;

// Create single app instance based on mode
const app = await createApp(undefined, process.env, DB_NAME);

// Demo mode overrides: faster cycles for demonstration
if (IS_DEMO_MODE) {
  app.cfg.payoutEverySec = 20 * 60; // 20 minutes insurance release
  app.cfg.settleAfterSec = 60; // 1 minute wish settlement
  console.log('[demo] Running in DEMO mode with database: railway_demo');
  console.log('[config] Demo payoutEverySec:', app.cfg.payoutEverySec, '(' + (app.cfg.payoutEverySec / 60) + ' minutes)');
  console.log('[config] Demo settleAfterSec:', app.cfg.settleAfterSec, 'seconds');
} else {
  console.log('[real] Running in REAL mode with default database');
  console.log('[config] Real payoutEverySec:', app.cfg.payoutEverySec, '(' + (app.cfg.payoutEverySec / 3600) + ' hours)');
  console.log('[config] Real settleAfterSec:', app.cfg.settleAfterSec, 'seconds');
}

// Setup routes
const routes = setupRoutes(app, BUILD, IS_DEMO_MODE);

// Scheduler
const scheduler = new Scheduler(app);
let tickRunning = false;
let lastAutoBackupDate = null;
setInterval(() => {
  if (tickRunning) return;
  tickRunning = true;
  Promise.all([
    scheduler.tick(now()).catch((e) => console.error('[tick]', e.message)),
    // Auto backup check (once per day, real instance only)
    (async () => {
      if (IS_DEMO_MODE) return; // Skip auto backup in demo mode
      try {
        const today = new Date().toISOString().slice(0, 10);
        if (lastAutoBackupDate !== today) {
          lastAutoBackupDate = today;
          console.log('[auto-backup] Starting daily backup...');
          const result = await app.backup.autoBackupDaily();
          console.log('[auto-backup] Completed:', JSON.stringify(result));
        }
      } catch (e) {
        console.error('[auto-backup] Error:', e.message);
      }
    })(),
    app.npc.tick(now()).catch((e) => console.error('[npc-tick]', e.message)),
  ]).finally(() => { tickRunning = false; });
}, 10000);




const server = http.createServer(async (req, res) => {
  // #19 Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  // #11 Rate limit check
  if (!checkRateLimit(req)) {
    res.writeHead(429, { 'content-type': 'application/json; charset=utf-8' });
    return res.end(jstr({ error: 'RateLimit', message: 'Too many requests, please slow down' }));
  }
  const url = new URL(req.url, 'http://localhost');
  const routePath = url.pathname;
  try {
    if (routes.some((r) => (typeof r.p === 'string' ? r.p === routePath : r.p.test(routePath)))) {
      const body = req.method === 'POST' ? await readBody(req) : Object.fromEntries(url.searchParams.entries());
      for (const r of routes) {
        const match = typeof r.p === 'string' ? (r.p === routePath ? [] : null) : routePath.match(r.p);
        if (r.method === req.method && match) {
          const out = await r.h(body, match, req, res);
          if (out && out.__raw) return; // media routes write response themselves
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
          return res.end(jstr(out));
        }
      }
    }
    let staticPath = url.pathname;
    let file = staticPath === '/' ? 'index.html' : staticPath.replace(/^\/+/, '');
    const fp = path.join(PUBLIC_DIR, file);
    if (fp.startsWith(PUBLIC_DIR) && fs.existsSync(fp) && fs.statSync(fp).isFile()) {
      let fileContent = fs.readFileSync(fp);
      // Demo mode: inject DEMO_MODE flag into index.html
      if (IS_DEMO_MODE && file === 'index.html') {
        fileContent = fileContent.toString().replace('<head>', '<head><script>window.DEMO_MODE = true;</script>');
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-cache, must-revalidate' });
      return res.end(fileContent);
    }
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' }).end(jstr({ error: 'not found' }));
  } catch (e) {
    // #18 Don't leak internal error details
    const isGameError = e instanceof GameError;
    const status = isGameError ? (e.code === Codes.FORBIDDEN ? 403 : e.code === Codes.UNAUTHORIZED ? 401 : e.code === Codes.BANNED ? 403 : 400) : 500;
    const message = isGameError ? e.message : 'Internal server error';
    if (!isGameError) console.error('[server-error]', e.message, e.stack);
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(jstr({ error: isGameError ? 'GameError' : 'ServerError', code: e.code ?? null, message }));
  }
});

// Voice room WebSocket + per-minute billing
const wss = createWSServer(server, app.voice);
setInterval(async () => {
  try {
    const destroyed = await app.voice.tick();
    for (const rid of destroyed) if (app.voice._broadcastClosed) app.voice._broadcastClosed(rid);
    await app.voice.flushPersistence();
  } catch (e) { console.error('[voice-tick]', e.message); }
}, 60000);

// Startup repair: force-cancel stuck rounds and fix ledger imbalance (caused by rolled-back NPC version)
(async () => {
  try {
    // Migration: add region fields to users table if not exist
    try {
      const cols = await app.store.pool.query("SHOW COLUMNS FROM users LIKE 'country'");
      if (cols[0].length === 0) {
        await app.store.pool.query('ALTER TABLE users ADD COLUMN country VARCHAR(100) NULL, ADD COLUMN region VARCHAR(200) NULL, ADD COLUMN city VARCHAR(200) NULL');
        console.log('[migration] added country/region/city columns to users table');
      }
    } catch (e) { console.error('[migration] region fields:', e.message); }
    const nowS = now();
    const [stuck] = await app.store.pool.query("SELECT round_id FROM rounds WHERE state IN ('active','locked') AND settle_at < ?", [nowS - 60]);
    for (const row of stuck) {
      try {
        await app.game.settle(nowS); // settle will handle refund/cancellation properly
        console.log('[startup-repair] settled stuck round', row.round_id);
      } catch (e) {
        console.error('[startup-repair] failed to settle round', row.round_id, e.message);
      }
    }
    const inside = await app.store.totalInside();
    const l = await app.store.getLedger();
    const source = l.issued - l.withdrawn;
    const delta = inside - source;
    if (delta !== 0n) {
      await app.store.pool.query('UPDATE ledger SET issued=issued+? WHERE id=1', [delta.toString()]);
      console.log('[startup-repair] ledger fixed, delta=', delta.toString());
    }
  // Assign languages and initial funding to existing NPCs (created before v2.5.0)
  try {
    const npcs = await app.store.listNpcs();
    const langs = ['en', 'zh-TW', 'ja', 'ar', 'id', 'ko', 'ru', 'hi', 'ur'];
    const COIN = 1000000n;
    const START_BAL = 100n * COIN;
    let langIdx = 0, funded = 0;
    for (const n of npcs) {
      if (!n.language || n.language === 'en') {
        await app.store.updateNpc(n.npcId, { language: langs[langIdx % langs.length] });
        langIdx++;
      }
      // Set initial bet time if not set
      if (!n.nextBetAt || n.nextBetAt === 0) {
        const nextBet = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1800) + 1800;
        await app.store.updateNpc(n.npcId, { nextBetAt: nextBet });
      }
      // Fund with 100 coins if balance is 0 (from platform account)
      try {
        const acc = await app.store.getAccount(n.uid);
        if (acc.available < START_BAL / 2n) {
          await app.store.transaction(async () => {
            await app.store.applyLedger({ plat: -START_BAL });
            await app.store.applyAccount(n.uid, { avail: START_BAL });
            await app.store.addFlow(n.uid, 'NPC_FUND', START_BAL, { note: 'startup repair initial funding' });
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
        const u = await app.store.getUser(n.uid);
        if (u && (u.wallet.startsWith('NPC_') || u.wallet.startsWith('NPC-') || n.wallet.startsWith('NPC_'))) {
          const newWallet = gen0x();
          await app.store.exec('UPDATE users SET wallet = ? WHERE uid = ?', [newWallet, n.uid]);
          await app.store.exec('UPDATE npcs SET wallet = ? WHERE npc_id = ?', [newWallet, n.npcId]);
          walletFixed++;
        }
      } catch { /* user may not exist */ }
    }
    if (walletFixed > 0) console.log('[startup-repair] converted', walletFixed, 'NPC wallets to 0x format');
  } catch (e) { console.error('[startup-repair npc-init]', e.message); }
  } catch (e) { console.error('[startup-repair]', e.message); }
})();

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log(`wish-game listening 0.0.0.0:${PORT} store=${app.store.kind} chain=${app.chain.enabled}`));