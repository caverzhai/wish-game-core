# 部署到 GitHub → Railway 指南

本项目零第三方依赖，Railway 用 Nixpacks 识别 `package.json` 后执行 `npm start`，
已内置 `railway.json`（启动命令、健康检查 `/health`）、`.nvmrc`(Node 20)，端口自动用平台注入的 `PORT` 并绑定 `0.0.0.0`。

## 一、推送本地仓库到 GitHub

### 方式 A：网页建仓 + 命令行推送（无需装额外工具）
1. 在 GitHub 网页右上角 **New repository**，名字如 `wish-game-core`，**不要**勾选 README/gitignore（保持空仓库）。
2. 在项目目录执行（把 `<你的仓库地址>` 换成 GitHub 给的 URL）：
```bash
git init -b main
git add .
git commit -m "feat: 3分钟愿望实现核心后端（对局/保险/返佣/提现/守恒）"
git remote add origin <你的仓库地址>      # 例如 https://github.com/你/wish-game-core.git
git push -u origin main
```
首次 push 会弹出系统登录窗口，用 GitHub 账号授权一次即可。

### 方式 B：安装 GitHub CLI（可选，命令行直接建仓）
```bash
winget install --id GitHub.cli        # 安装后重开终端
gh auth login                         # 按提示浏览器登录
git init -b main && git add . && git commit -m "init"
gh repo create wish-game-core --source=. --private --push
```

> 修改提交身份（当前为占位身份）：
> `git config user.name "你的名字" && git config user.email "你的邮箱"` 后
> `git commit --amend --reset-author --no-edit`

## 二、在 Railway 部署（连 GitHub，push 即自动部署）
1. 打开 https://railway.com 用 GitHub 登录；
2. **New Project → Deploy from GitHub repo**，授权并选择 `wish-game-core`；
3. Railway 自动识别 Node、安装并运行 `npm start`（零依赖，无需 build 步骤）；
4. 服务卡片 **Settings → Networking → Generate Domain**，端口填平台变量 `$PORT`（或直接选服务端口），得到公网网址；
5. 浏览器访问 `https://你的域名/health` 返回 `{"ok":true,...}` 即成功；`/recent` 看对局、`/ledger` 看总账。

之后每次 `git push`，Railway 都会自动重新部署。

### 用 Railway CLI 直接部署（不连 GitHub 也可）
```bash
npm i -g @railway/cli
railway login
railway init        # 建项目
railway up          # 直接上传当前目录部署
railway domain      # 生成公网域名
```

## 三、重要说明
- **当前为内存仓储**：容器重启 / 重新部署后数据会清空，仅用于演示与逻辑验证。
  正式留存数据需接数据库（Railway 可一键添加 MySQL/Postgres），届时新增一个与
  `src/store.js` 同接口的持久化仓储即可，领域层代码不用改。
- 本服务无需任何环境变量即可启动；规则数值集中在 `src/config.js`。
- 本地验证：`npm test`（14 用例）、`npm run demo`（端到端）、`npm start`（本地起服务）。
