// =============================================================
// core.test.js —— node --test（零依赖内置测试框架）
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { coin, toInner } from '../src/money.js';
import { referralPerMille } from '../src/config.js';
import { nextDue } from '../src/engine-payout.js';

const HOUR = 3600;
const PAY_EVERY = 6 * HOUR;

function twoSidedGame() {
  const app = createApp();
  const { game, wallet } = app;
  const A = game.register('0xA').uid;
  const B = game.register('0xB').uid;
  wallet.issue(A, 100);
  wallet.issue(B, 100);
  return { app, A, B };
}

test('定点金额：0.019801 枚 = 19801 最小单位', () => {
  assert.equal(toInner('0.019801'), 19801n);
  assert.equal(coin(1), 1_000_000n);
});

test('奇=>红胜：抽 2.5%（0.5%保池/2.0%平台），胜方分 97.5%，总账守恒', () => {
  const { app, A, B } = twoSidedGame();
  const { game, store } = app;
  game.bet(A, 'red', 60, 1, 10);
  game.bet(B, 'green', 60, 0, 20);
  const r = game.settle(190);
  assert.equal(r.winSide, 'red');
  assert.equal(r.total, coin(120));
  assert.equal(r.fee, coin(3));
  assert.equal(r.feeIns, toInner('0.6'));
  assert.equal(r.feePlat, toInner('2.4'));
  assert.equal(r.pot, coin(117));
  assert.equal(store.account(A).available, coin(157)); // 100-60+117
  assert.equal(store.account(B).available, coin(40));  // 输 60
  assert.equal(store.ledger.insurancePool, toInner('0.6'));
  assert.equal(store.ledger.platform, toInner('2.4'));
  assert.equal(store.totalInside(), store.totalSource());
});

test('流局：仅一方下注，原路全额退回，不抽水不扣费', () => {
  const app = createApp();
  const U = app.game.register('0xC').uid;
  app.wallet.issue(U, 100);
  app.game.bet(U, 'red', 7, 1, 10);
  const r = app.game.settle(190);
  assert.equal(r.state, 'cancelled');
  assert.equal(app.store.account(U).available, coin(100));
  assert.equal(app.store.account(U).frozen, 0n);
  assert.equal(app.store.ledger.insurancePool, 0n);
  assert.equal(app.store.ledger.platform, 0n);
});

test('保险生效的赢家：中奖实分再扣 10% 入保险池', () => {
  const app = createApp();
  const A = app.game.register('0xA').uid, B = app.game.register('0xB').uid;
  app.wallet.issue(A, 200); app.wallet.issue(B, 100);
  app.insurance.setSwitch(A, true);
  app.insurance.depositPremium(A, coin(30));
  app.game.bet(A, 'red', 60, 1, 10);
  app.game.bet(B, 'green', 60, 0, 20);
  app.game.settle(190);
  // winRaw=117 枚，10%=11.7 枚（内部精确到 6 位小数），实得 105.3
  assert.equal(app.store.account(A).available, toInner('215.3')); // 200-30-60+105.3
  assert.equal(app.store.account(A).premium, coin(30));
  assert.equal(app.store.ledger.insurancePool, toInner('12.3')); // 0.6 + 11.7
  assert.equal(app.store.ledger.platform, toInner('2.4'));
  assert.equal(app.store.totalInside(), app.store.totalSource());
});

test('允许双边下注：胜方部分分奖、负方部分计损，依然守恒', () => {
  const app = createApp();
  const A = app.game.register('0xA').uid, B = app.game.register('0xB').uid;
  app.wallet.issue(A, 200); app.wallet.issue(B, 100);
  app.game.bet(A, 'red', 50, 1, 10);
  app.game.bet(A, 'green', 50, 0, 11);
  app.game.bet(B, 'green', 50, 0, 12); // 选号和=1 奇 => 红胜
  app.game.settle(190);
  // total150 抽3.75，pot146.25 由唯一红方 A 全得
  assert.equal(app.store.account(A).available, toInner('246.25')); // 200-100+146.25
  assert.equal(app.store.account(B).available, coin(50));
  assert.equal(app.store.ledger.insurancePool, toInner('0.75'));
  assert.equal(app.store.ledger.platform, toInner('3'));
  assert.equal(app.store.totalInside(), app.store.totalSource());
});

test('Q5：保费50/累计亏230 -> 2节点、余保费10、零头清零', () => {
  const app = createApp();
  const U = app.game.register('0xU').uid;
  app.wallet.issue(U, 300);
  app.insurance.setSwitch(U, true);
  app.insurance.depositPremium(U, coin(50));
  app.insurance.accrueLossInternal(U, coin(230), 10);
  assert.equal(app.store.nodes.length, 2);
  assert.equal(app.store.account(U).premium, coin(10));
  assert.equal(app.store.account(U).lossAccum, 0n); // 保费<20，零头清零
  assert.equal(app.store.totalInside(), app.store.totalSource());
});

test('Q5：保费100/累计亏230 -> 2节点、余保费60、零头30保留', () => {
  const app = createApp();
  const U = app.game.register('0xU').uid;
  app.wallet.issue(U, 300);
  app.insurance.setSwitch(U, true);
  app.insurance.depositPremium(U, coin(100));
  app.insurance.accrueLossInternal(U, coin(230), 10);
  assert.equal(app.store.nodes.length, 2);
  assert.equal(app.store.account(U).premium, coin(60));
  assert.equal(app.store.account(U).lossAccum, coin(30));
  assert.equal(app.store.totalInside(), app.store.totalSource());
});

test('100 期释放总额恰好 100 枚（末期补差，无尾差）', () => {
  const cfg = createApp().cfg;
  const node = { periodN: 0, paidAmount: 0n };
  let total = 0n, first = null, last = null;
  while (true) {
    const d = nextDue(node, cfg);
    if (d == null) break;
    if (first === null) first = d;
    last = d;
    total += d; node.periodN++; node.paidAmount += d;
  }
  assert.equal(first, 19801n);                 // 第1期 0.019801
  assert.equal(node.periodN, 100);
  assert.equal(total, coin(100));              // 正好 100 枚
  assert.ok(last > 19801n * 99n);              // 末期补差
});

test('断保只充公当期、期号照走；再开新节点续命后恢复发放', () => {
  const app = createApp();
  const B = app.game.register('0xB').uid;
  app.wallet.issue(B, 500);
  app.insurance.setSwitch(B, true);
  app.insurance.depositPremium(B, coin(100));
  app.insurance.accrueLossInternal(B, coin(100), 10); // N1, batchSeq=0
  const N1 = app.store.nodes[0];

  const p1 = app.insurance.runPayoutBatch(1 * PAY_EVERY + 1); // seq1 存活
  assert.equal(p1.status, 'paid');
  assert.equal(N1.periodN, 1);
  const availAfterP1 = app.store.account(B).available;

  const poolBefore29 = app.store.ledger.insurancePool;
  const p29 = app.insurance.runPayoutBatch(29 * PAY_EVERY + 1); // 29-0>28 断保
  assert.equal(p29.forfeited, 19801n * 2n); // 当期充公
  assert.equal(app.store.ledger.insurancePool, poolBefore29); // 充公不出账
  assert.equal(app.store.account(B).available, availAfterP1); // 用户不到账
  assert.equal(N1.periodN, 2); // 期号照走

  app.insurance.accrueLossInternal(B, coin(100), 29 * PAY_EVERY + 100); // N2, seq29 续命
  const p30 = app.insurance.runPayoutBatch(30 * PAY_EVERY + 1);
  assert.equal(p30.paidToUser, 19801n * 3n + 19801n); // N1第3期 + N2第1期
  assert.equal(N1.periodN, 3);
  assert.equal(app.store.totalInside(), app.store.totalSource());
});

test('保险池不足本次应赔 -> 整批顺延，不推进期号', () => {
  const app = createApp();
  app.store.ledger.insurancePool = 0n;
  app.store.nodes.push({ nodeId: 'NX', uid: null, periodN: 0, paidAmount: 0n, state: 'active', batchSeq: 0 });
  // 无用户、无余额：应判为延，而不是发钱
  const r = app.insurance.runPayoutBatch(1 * PAY_EVERY + 1);
  assert.equal(r.status, 'deferred');
  assert.equal(app.store.nodes[0].periodN, 0);
});

test('邀请档位：节点直邀人数 -> 千分率', () => {
  const cfg = createApp().cfg;
  const cases = [[0, 0], [1, 1], [4, 1], [5, 2], [9, 2], [10, 3], [19, 3], [20, 4], [49, 4], [50, 5], [99, 5]];
  for (const [n, bp] of cases) assert.equal(referralPerMille(cfg, n), BigInt(bp));
});

test('邀请返佣：被邀人产生节点后，其下注按 0.1% 返给邀请人（平台列支）', () => {
  const app = createApp();
  const A = app.game.register('0xA').uid;
  const B = app.game.register('0xB', A).uid;
  const D = app.game.register('0xD').uid;
  app.wallet.issue(B, 200); app.wallet.issue(D, 200);
  app.insurance.setSwitch(B, true);
  app.insurance.depositPremium(B, coin(40));
  app.insurance.accrueLossInternal(B, coin(100), 10); // B 有节点 -> A 档位 1
  app.game.bet(B, 'red', 99, 1, 100);
  app.game.bet(D, 'green', 99, 0, 110);
  app.game.settle(300);
  assert.equal(app.store.account(A).available, toInner('0.099')); // 99*0.1%
  assert.equal(app.store.totalInside(), app.store.totalSource());
});

test('提现：2-500 枚、费 1 归平台；越界报错；成功/失败回写守恒', () => {
  const app = createApp();
  const U = app.game.register('0xU').uid, V = app.game.register('0xV').uid;
  app.wallet.issue(U, 10); app.wallet.issue(V, 10);
  assert.throws(() => app.wallet.withdraw(U, 1), /2-500/);
  assert.throws(() => app.wallet.withdraw(U, 501), /2-500/);
  const wd = app.wallet.withdraw(U, 2);
  assert.equal(wd.fee, coin(1));
  assert.equal(wd.arrive, coin(1));
  assert.equal(app.store.account(U).available, coin(8));
  app.wallet.confirmWithdraw(wd.withdrawId, '0xTX');
  assert.equal(app.store.ledger.withdrawn, coin(1));
  assert.equal(app.store.totalInside(), app.store.totalSource());

  const wd2 = app.wallet.withdraw(V, 5);
  app.wallet.failWithdraw(wd2.withdrawId); // 链上失败，本金+手续费全退
  assert.equal(app.store.account(V).available, coin(10));
  assert.equal(app.store.ledger.platform, coin(1)); // U 那笔手续费仍在
  assert.equal(app.store.totalInside(), app.store.totalSource());
});

test('封盘后不可下注；未到 180 秒不可开奖', () => {
  const { app, A } = twoSidedGame();
  app.game.bet(A, 'red', 10, 1, 10);
  assert.throws(() => app.game.bet(A, 'red', 10, 1, 160), /封盘/); // >=150
  assert.throws(() => app.game.settle(170), /开奖时间/);
});
