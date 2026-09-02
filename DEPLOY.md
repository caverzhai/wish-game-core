# Deploy to GitHub → Railway Guide

A single Node service serves both the **web frontend** and **HTTP API**; runs with zero external dependencies in memory mode,
and automatically switches to MySQL persistence when Railway MySQL is attached (built-in, env vars activate it, tables auto-created on first start).
Built-in `railway.json` (start command, health check `/health`), `.nvmrc` (Node 20), port from platform-injected `PORT` bound to `0.0.0.0`.

## 1. Push to GitHub

```bash
git init -b main
git add .
git commit -m "feat: rounds/insurance/commissions/withdrawals + web frontend + MySQL persistence"
git remote add origin https://github.com/caverzhai/wish-game-core.git
git push -u origin main
```
> Commit identity placeholders can be changed: `git config user.name "Your Name" && git config user.email "your@email.com"`.

## 2. Deploy on Railway (connect GitHub, push auto-deploys)
1. Log in to https://railway.com with GitHub;
2. **New Project → Deploy from GitHub repo**, select `wish-game-core`;
3. Railway automatically runs `npm install` (installs mysql2, harmless in memory mode) and `npm start`;
4. Service **Settings → Networking → Generate Domain**, get the public URL;
5. Open the domain root `/` for the **web interface**; `/health` returns `{"ok":true,"store":"memory"|"mysql"}`.

After every `git push`, Railway auto-redeploys.

## 3. Attach MySQL Persistence (data survives restarts, recommended)
1. In the same Railway project **New → Database → Add MySQL**;
2. Open the web service → **Variables → Add Variable → Add Reference**, select the newly added MySQL,
   Railway auto-injects `MYSQLHOST / MYSQLPORT / MYSQLUSER / MYSQLPASSWORD / MYSQLDATABASE`
   (code also supports `DATABASE_URL / MYSQL_URL / MYSQL_PUBLIC_URL`);
3. Trigger a redeploy; startup log shows `store=mysql` and `/health` returns `"store":"mysql"` means success, **tables auto-created on first start**;
4. Without these variables, falls back to memory mode (cleared on restart, demo only).

## 4. Pages and APIs
- Web: `/` (rounds/history/insurance/invite/assets & withdrawals five tabs, all amounts in 'units').
- Main APIs (JSON):
  - `POST /login {wallet,inviterUid?}` wallet link = register/login; `POST /register`
  - `POST /faucet {uid,amount?}` demo units (default 100); `POST /issue {uid,amount}` admin credit
  - `GET  /user/:uid` account/nodes/invite/ledger aggregate; `GET /round/current`, `GET /round/:id`, `GET /recent`
  - `POST /bet {uid,side,amount,pick}`; `POST /settle` (usually auto by built-in timer)
  - `POST /insurance/switch`, `POST /insurance/deposit`; `POST /payout` (usually auto)
  - `POST /withdraw {uid,amount}`, `POST /withdraw/confirm`; `GET /ledger`, `GET /health`
- Built-in timer: service auto-settles expired rounds every 2 seconds, and runs insurance payouts at UTC 3/9/15/21, no extra cron needed for single container.

## 5. Local Verification
```bash
npm test       # unit/conservation tests
npm run demo   # end-to-end virtual clock demo
npm start      # start local service, open http://localhost:8080
```
Rule values are centralized in `src/config.js`; amounts internally are 6-decimal fixed-point integers (BigInt), APIs and pages uniformly display in 'units'.
