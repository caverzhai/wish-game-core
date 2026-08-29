# 部署到 GitHub → Railway 指南

同一 Node 服务同时提供**网页前端**和 **HTTP API**；内存模式零外部依赖即可跑，
接入 Railway MySQL 后自动切换为持久化（代码已内置，注入环境变量即生效、首次启动自动建表）。
已内置 `railway.json`（启动命令、健康检查 `/health`）、`.nvmrc`(Node 20)，端口用平台注入的 `PORT` 并绑定 `0.0.0.0`。

## 一、推送到 GitHub

```bash
git init -b main
git add .
git commit -m "feat: 对局/保险/返佣/提现 + 网页前端 + MySQL 持久化"
git remote add origin https://github.com/caverzhai/wish-game-core.git
git push -u origin main
```
> 提交身份占位可改：`git config user.name "名字" && git config user.email "邮箱"`。

## 二、在 Railway 部署（连 GitHub，push 即自动部署）
1. https://railway.com 用 GitHub 登录；
2. **New Project → Deploy from GitHub repo**，选择 `wish-game-core`；
3. Railway 自动 `npm install`（会装 mysql2，内存模式用不到也无妨）并 `npm start`；
4. 服务 **Settings → Networking → Generate Domain**，得到公网网址；
5. 直接打开域名根路径 `/` 就是**网页界面**；`/health` 返回 `{"ok":true,"store":"memory"|"mysql"}`。

之后每次 `git push`，Railway 自动重新部署。

## 三、接入 MySQL 持久化（数据不随重启清空，推荐）
1. 同一 Railway 项目内 **New → Database → Add MySQL**；
2. 点开 Web 服务 → **Variables → Add Variable → Add Reference**，选中刚加的 MySQL，
   Railway 会自动注入 `MYSQLHOST / MYSQLPORT / MYSQLUSER / MYSQLPASSWORD / MYSQLDATABASE`
   （代码同时兼容 `DATABASE_URL / MYSQL_URL / MYSQL_PUBLIC_URL`）；
3. 触发一次重新部署；启动日志出现 `store=mysql`、`/health` 返回 `"store":"mysql"` 即成功，**首次启动自动建表**；
4. 不配置上述变量时自动回退内存模式（重启清空，仅演示用）。

## 四、页面与接口
- 网页：`/`（对局/历史/保险/邀请/资产提现五个标签，金额单位统一「枚」）。
- 主要 API（JSON）：
  - `POST /login {wallet,inviterUid?}` 关联钱包即注册/登录；`POST /register`
  - `POST /faucet {uid,amount?}` 演示领枚（默认 100）；`POST /issue {uid,amount}` 管理员入账
  - `GET  /user/:uid` 账户/节点/邀请/流水聚合；`GET /round/current`、`GET /round/:id`、`GET /recent`
  - `POST /bet {uid,side,amount,pick}`；`POST /settle`（一般由内置定时器自动完成）
  - `POST /insurance/switch`、`POST /insurance/deposit`；`POST /payout`（一般自动）
  - `POST /withdraw {uid,amount}`、`POST /withdraw/confirm`；`GET /ledger`、`GET /health`
- 内置定时器：服务每 2 秒自动结算到期局，并在 UTC 3/9/15/21 点自动执行保险赔付，单容器无需额外 cron。

## 五、本地验证
```bash
npm test       # 14 个单元/守恒用例
npm run demo   # 端到端虚拟时钟演示
npm start      # 本地起服务，打开 http://localhost:8080
```
规则数值集中在 `src/config.js`；金额内部为 6 位定点整数（BigInt），接口与页面统一以「枚」展示。
