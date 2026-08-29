# 3分钟愿望实现 · 核心后端（wish-game-core）

中心化网站玩法的**可运行全栈**：网页前端 + 对局结算、保险节点与 6 小时赔付、邀请返佣、提现、总账守恒，支持内存 / MySQL 两种仓储。
全站金额单位统一为 **「枚」**，不出现任何币名；空气币仅作欢乐豆，只可转账、不可闪兑。

- **内存模式零第三方依赖**（持久化仅需 `mysql2`），Node.js ≥ 18（内置 `node:test` 测试）
- 金额全程 **6 位定点 BigInt 整数**运算，禁用浮点，无精度/溢出问题
- 每笔结算都做**总账守恒校验**，不平即回滚（内存用事务快照，MySQL 用 `BEGIN/COMMIT/ROLLBACK` + 行锁）
- 同一服务托管**网页界面**（`public/`）与 JSON API；内置定时器自动结算、定点赔付

## 运行

```bash
npm test     # 14 个单元测试：分奖/流局/保险10%/双边/Q5节点/100期/断保续命/顺延/返佣/提现/守恒
npm run demo # 端到端流程演示（虚拟时钟，打印每一步与守恒结果）
npm start    # 启动服务（默认 8080）：浏览器打开 / 即网页界面，/health 看状态
```

## 目录结构

```
src/
  money.js             定点金额：枚 <-> 1e-6 BigInt、比例运算、格式化
  config.js            全部规则参数（单一事实源，可后台配置）+ 邀请档位
  errors.js            业务错误码
  store.js             内存仓储（async，同接口），含总账科目、守恒校验、事务快照
  store-mysql.js       MySQL 持久化仓储（自动建表/事务/行锁），注入 MYSQL* 环境变量即启用
  engine-settle.js     结算纯函数：流局判定/抽水拆分/胜方按比例分(尾差归保池)/保险10%/返佣计划
  engine-payout.js     100 期释放纯计算 + 批次序号(168h=28 批续命)
  GameService.js       注册/下注/封盘/结算/历史（每局状态机）
  InsuranceService.js  保险开关/保费/Q5 节点生成/6h 赔付(续命/当期充公/顺延冻结/末期补差)
  WalletService.js     发放(充值入账)/提现(2-500、费1归平台)/链上成功失败回写
  Scheduler.js         定时推进：自动结算到期局、补齐 6h 赔付批次
  app.js               装配（按环境变量选内存/MySQL）；server.js HTTP+静态托管；demo.js 演示
public/                纯原生网页前端（index.html / app.js / style.css，无构建步骤）
test/core.test.js      单元测试
```

## 规则 → 代码映射

| 规则 | 实现位置 |
|---|---|
| 单笔 1-99 枚正整数、选号 0-9（0 按偶）、可多笔可双边 | `GameService.bet` 参数校验 |
| 首笔开局、150s 封盘、180s 开奖 | `GameService.bet/settle`、`config.lockAfterSec/settleAfterSec` |
| 任一方为空→流局全退、不抽水不扣费 | `engine-settle.planSettlement` cancelled 分支 |
| 选号和奇→红胜、偶→绿胜；总池抽 2.5% | `planSettlement`（feeNum/feeDen） |
| 抽水 20% 入保险池、80% 入平台 | `feeInsNum/feeInsDen`、结算落账 |
| 胜方按池内占比分 97.5%，整除尾差归保险池 | `mulDivFloor` + `dust` |
| 保险可选：生效=开关开且保费≥20；赢家实分扣 10% | `InsuranceService.isActive`、结算 insCut |
| Q5：亏损只加不减，满100且保费≥20开节点扣20；保费<20零头清零 | `accrueLossInternal` |
| 100 期：0.019801×n，第100期补差到整100 | `engine-payout.nextDue`（测试验证总额=100） |
| 6h 定点赔付；168h(28批)内有新节点全续命，否则当期充公、期号照走、后续保留、再续命续领 | `runPayoutBatch` + `isAlive` |
| 保池不足本次应赔→整批顺延且不消耗 168h 窗口 | `runPayoutBatch` deferred 分支 |
| 邀请：节点直邀人数定档 0.1%-0.5%，按下注流水、平台列支、只向后生效 | `config.referralTiers`、结算 referral |
| 提现主动发起、2-500 枚、费1归平台、链上结果回写 | `WalletService` |

**总账守恒**（每次结算/赔付后强校验）：
```
Σ(可用+冻结+保费) + 保险池 + 平台 + 提现在途 = 累计发放 - 累计提出
```

## HTTP 接口（金额入参为整数枚）

`POST /login`（关联钱包即注册/登录）、`POST /register`、`POST /faucet`（演示领枚）、
`POST /insurance/switch`、`POST /insurance/deposit`、`POST /issue`、
`POST /bet`、`POST /settle`、`GET /round/current`、`GET /round/:id`、`GET /recent`、
`POST /payout`、`POST /withdraw`、`POST /withdraw/confirm`、`GET /user/:uid`、`GET /ledger`、`GET /health`。
响应中的金额统一为「枚」数值；过程中 `/round/current` 只回匿名笔数，不公开投入与选号。

## 生产化接入点

1. **持久化（已实现）**：`src/store-mysql.js` 与 `MemoryStore` 同接口，事务 `BEGIN/COMMIT/ROLLBACK` + 行锁，金额列 `BIGINT`（存 1e-6），Railway 注入 `MYSQL*` 变量即自动启用并建表。
2. **链上充提**：第三方 ERC20（18 位）。充值给每个用户独立充值地址、按 `txhash+logIndex` 幂等、N 块确认入账，超 6 位尾差截准；提币用热钱包队列、记录 txhash、失败重试，站内 6 位 ×10¹² 与链上 18 位无损换算。
3. **定时任务**：`Scheduler.tick` 换成 cron（UTC 3/9/15/21）+ 单实例 leader 锁，保证幂等不重发。
4. **公平自证（可选）**：封盘时下发全部选号哈希根，开奖后公开明细，供玩家核对无事后改单。
5. **风控**：签名登录 nonce 防重放、热钱包隔离、提币限额与告警。
