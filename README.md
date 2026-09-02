# Three-Minute Wish Pool · Core Backend (wish-game-core)

A runnable full-stack for centralized web gameplay: web frontend + round settlement, insurance nodes with 6-hour payouts, invite commissions, withdrawals, ledger conservation, supports both memory and MySQL storage.
All amounts are uniformly in **'units'**, no token names appear; air-coins serve only as game chips, transferable only, no swap.

- **Zero third-party dependencies in memory mode** (persistence only needs `mysql2`), Node.js >= 18 (built-in `node:test`)
- All amounts use **6-decimal fixed-point BigInt integer** arithmetic, no floats, no precision/overflow issues
- Every settlement runs **ledger conservation check**, imbalance triggers rollback (memory uses transaction snapshots, MySQL uses `BEGIN/COMMIT/ROLLBACK` + row locks)
- Same service hosts **web interface** (`public/`) and JSON API; built-in timer auto-settles and scheduled payouts

## Run

```bash
npm test     # unit tests: payout/cancelled/insurance 10%/both sides/Q5 nodes/100 periods/lapse revive/postpone/commission/withdrawal/conservation
npm run demo # end-to-end flow demo (virtual clock, prints each step and conservation result)
npm start    # start service (default 8080): open / for web interface, /health for status
```

## Directory Structure

```
src/
  money.js             fixed-point amounts: units <-> 1e-6 BigInt, ratio math, formatting
  config.js            all rule parameters (single source of truth, admin-configurable) + invite tiers
  errors.js            business error codes
  store.js             in-memory store (async, same interface), with ledger accounts, conservation check, transaction snapshots
  store-mysql.js       MySQL persistent store (auto tables/transactions/row locks), activated by MYSQL* env vars
  engine-settle.js     settlement pure function: cancelled round check/fee split/winners proportional split (remainder to insurance pool)/insurance 10%/commission plan
  engine-payout.js     100-period release pure math + batch index (168h=28 batches revive)
  GameService.js       register/bet/lock/settle/history (per-round state machine)
  InsuranceService.js  insurance switch/premium/Q5 node creation/6h payout (revive/current forfeit/postpone freeze/last period top-up)
  WalletService.js     issuance (deposit credit)/withdrawal (2-500, fee 1 to platform)/on-chain success/fail writeback
  Scheduler.js         scheduled tick: auto-settle expired rounds, run 6h payout batches
  app.js               assembly (choose memory/MySQL by env vars); server.js HTTP + static hosting; demo.js demo
public/                vanilla web frontend (index.html / app.js / style.css, no build step)
test/core.test.js      unit tests
```

## Rules -> Code Mapping

| Rule | Implementation |
|---|---|
| Single bet 1-99 units integer, pick 0-9 (0 as even), multiple bets and both sides allowed | `GameService.bet` parameter validation |
| First bet starts round, 150s lock, 180s settle | `GameService.bet/settle`, `config.lockAfterSec/settleAfterSec` |
| Either side empty -> cancelled round full refund, no fees | `engine-settle.planSettlement` cancelled branch |
| Sum odd -> red wins, even -> green wins; total pool 2.5% fee | `planSettlement` (feeNum/feeDen) |
| 20% of fee to insurance pool, 80% to platform | `feeInsNum/feeInsDen`, settlement posting |
| Winners split 97.5% by pool ratio, integer truncation remainder to insurance pool | `mulDivFloor` + `dust` |
| Insurance optional: active = switch on AND premium>=20; winner actual winnings minus 10% | `InsuranceService.isActive`, settlement insCut |
| Q5: loss only adds, every 100 with premium>=20 creates node deducting 20; premium<20 remainder zeroed | `accrueLossInternal` |
| 100 periods: 0.019801*n, period 100 tops up to exactly 100 | `engine-payout.nextDue` (test verifies total=100) |
| 6h scheduled payout; new node within 168h(28 batches) revives all, else current forfeit, period advances, future retained, revive resumes | `runPayoutBatch` + `isAlive` |
| Insurance pool insufficient for batch -> whole batch postponed, does not consume 168h window | `runPayoutBatch` deferred branch |
| Invite: node direct invitee count determines tier 0.1%-0.5%, by bet flow, platform pays, effective going forward only | `config.referralTiers`, settlement referral |
| User-initiated withdrawal, 2-500 units, fee 1 to platform, on-chain result writeback | `WalletService` |

**Ledger conservation** (strong check after every settlement/payout):
```
Sum(available+frozen+premium) + insurancePool + platform + pendingWithdraw = totalIssued - totalWithdrawn
```

## HTTP API (amount inputs are integer units)

`POST /login` (wallet link = register/login), `POST /register`, `POST /faucet` (demo units),
`POST /insurance/switch`, `POST /insurance/deposit`, `POST /issue`,
`POST /bet`, `POST /settle`, `GET /round/current`, `GET /round/:id`, `GET /recent`,
`POST /payout`, `POST /withdraw`, `POST /withdraw/confirm`, `GET /user/:uid`, `GET /ledger`, `GET /health`.
Amounts in responses are uniformly 'units' numbers; during a round `/round/current` returns only anonymous bet count, no individual stakes or picks.

## Production Integration Points

1. **Persistence (implemented)**: `src/store-mysql.js` same interface as MemoryStore, transactions `BEGIN/COMMIT/ROLLBACK` + row locks, amount columns `BIGINT` (stores 1e-6), Railway `MYSQL*` vars auto-activate and create tables.
2. **On-chain deposits/withdrawals**: third-party ERC20 (18 decimals). Deposits via per-user independent addresses, idempotent by `txhash+logIndex`, N-block confirmation credit, excess beyond 6 decimals truncated; withdrawals via hot wallet queue, record txhash, retry on failure, in-site 6-decimal x10^12 lossless conversion to on-chain 18 decimals.
3. **Scheduled tasks**: replace `Scheduler.tick` with cron (UTC 3/9/15/21) + single-instance leader lock, guarantees idempotency no double-payout.
4. **Fairness self-proof (optional)**: distribute all pick hashes at lock, reveal details after settlement, allows players to verify no post-hoc tampering.
5. **Risk control**: signature login nonce against replay, hot wallet isolation, withdrawal limits and alerts.
