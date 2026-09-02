// =============================================================
// core.test.js - node --test (zero-dependency built-in test framework, all async)
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { coin, toInner } from '../src/money.js';
import { referralPerMille } from '../src/config.js';
import { nextDue } from '../src/engine-payout.js';

const HOUR = 3600;
const PAY_EVERY = 6 * HOUR;
const mk = () => createApp();

async function twoSidedGame() {
  const app = await mk();
  const { game, wallet } = app;
  const A = (await game.register('0xA', null, 1)).uid;
  const B = (await game.register('0xB', null, 1)).uid;
  await wallet.issue(A, 100);
  await wallet.issue(B, 100);
  return { app, A, B };
}

test('Fixed amount: 0.019801 units = 19801 min units', () => {
  assert.equal(toInner('0.019801'), 19801n);
  assert.equal(coin(1), 1_000_000n);
});

test('Odd=>red wins: 2.5% fee (0.5% insPool/2.0% platform), winners split 97.5%, ledger conserved', async () => {
  const { app, A, B } = await twoSidedGame();
  const { game, store } = app;
  await game.bet(A, 'red', 60, 1, 10);
  await game.bet(B, 'green', 60, 0, 20);
  const r = await game.settle(190);
  assert.equal(r.winSide, 'red');
  assert.equal(r.total, coin(120));
  assert.equal(r.fee, coin(3));
  assert.equal(r.feeIns, toInner('0.6'));
  assert.equal(r.feePlat, toInner('2.4'));
  assert.equal(r.pot, coin(117));
  assert.equal((await store.getAccount(A)).available, coin(157));
  assert.equal((await store.getAccount(B)).available, coin(40));
  assert.equal((await store.getLedger()).insurancePool, toInner('0.6'));
  assert.equal((await store.getLedger()).platform, toInner('2.4'));
  assert.equal(await store.totalInside(), await store.totalSource());
});

test('Cancelled round: only one side bets, full refund, no fees', async () => {
  const app = await mk();
  const U = (await app.game.register('0xC')).uid;
  await app.wallet.issue(U, 100);
  await app.game.bet(U, 'red', 7, 1, 10);
  const r = await app.game.settle(190);
  assert.equal(r.state, 'cancelled');
  assert.equal((await app.store.getAccount(U)).available, coin(100));
  assert.equal((await app.store.getAccount(U)).frozen, 0n);
  assert.equal((await app.store.getLedger()).insurancePool, 0n);
  assert.equal((await app.store.getLedger()).platform, 0n);
});

test('Active insurance winner: 10% of actual winnings goes to insurance pool', async () => {
  const app = await mk();
  const A = (await app.game.register('0xA')).uid, B = (await app.game.register('0xB')).uid;
  await app.wallet.issue(A, 200); await app.wallet.issue(B, 100);
  await app.insurance.setSwitch(A, true);
  await app.insurance.depositPremium(A, coin(30));
  await app.game.bet(A, 'red', 60, 1, 10);
  await app.game.bet(B, 'green', 60, 0, 20);
  await app.game.settle(190);
  assert.equal((await app.store.getAccount(A)).available, toInner('215.3'));
  assert.equal((await app.store.getAccount(A)).premium, coin(30));
  assert.equal((await app.store.getLedger()).insurancePool, toInner('12.3'));
  assert.equal((await app.store.getLedger()).platform, toInner('2.4'));
  assert.equal(await app.store.totalInside(), await app.store.totalSource());
});

test('Both sides allowed: winning side splits, losing side counts loss, still conserved', async () => {
  const app = await mk();
  const A = (await app.game.register('0xA')).uid, B = (await app.game.register('0xB')).uid;
  await app.wallet.issue(A, 200); await app.wallet.issue(B, 100);
  await app.game.bet(A, 'red', 50, 1, 10);
  await app.game.bet(A, 'green', 50, 0, 11);
  await app.game.bet(B, 'green', 50, 0, 12);
  await app.game.settle(190);
  assert.equal((await app.store.getAccount(A)).available, toInner('246.25'));
  assert.equal((await app.store.getAccount(B)).available, coin(50));
  assert.equal((await app.store.getLedger()).insurancePool, toInner('0.75'));
  assert.equal((await app.store.getLedger()).platform, toInner('3'));
  assert.equal(await app.store.totalInside(), await app.store.totalSource());
});

test('Q5: premium 50/loss 230 -> 2 nodes, remaining premium 10, remainder zeroed', async () => {
  const app = await mk();
  const U = (await app.game.register('0xU')).uid;
  await app.wallet.issue(U, 300);
  await app.insurance.setSwitch(U, true);
  await app.insurance.depositPremium(U, coin(50));
  await app.insurance.accrueLossInternal(U, coin(230), 10);
  assert.equal((await app.store.listNodes({})).length, 2);
  assert.equal((await app.store.getAccount(U)).premium, coin(10));
  assert.equal((await app.store.getAccount(U)).lossAccum, 0n);
  assert.equal(await app.store.totalInside(), await app.store.totalSource());
});

test('Q5: premium 100/loss 230 -> 2 nodes, remaining premium 60, remainder 30 kept', async () => {
  const app = await mk();
  const U = (await app.game.register('0xU')).uid;
  await app.wallet.issue(U, 300);
  await app.insurance.setSwitch(U, true);
  await app.insurance.depositPremium(U, coin(100));
  await app.insurance.accrueLossInternal(U, coin(230), 10);
  assert.equal((await app.store.listNodes({})).length, 2);
  assert.equal((await app.store.getAccount(U)).premium, coin(60));
  assert.equal((await app.store.getAccount(U)).lossAccum, coin(30));
  assert.equal(await app.store.totalInside(), await app.store.totalSource());
});

test('100-period release totals exactly 100 units (last period tops up, no remainder)', async () => {
  const cfg = (await mk()).cfg;
  const node = { periodN: 0, paidAmount: 0n };
  let total = 0n, first = null, last = null;
  while (true) {
    const d = nextDue(node, cfg);
    if (d == null) break;
    if (first === null) first = d;
    last = d;
    total += d; node.periodN++; node.paidAmount += d;
  }
  assert.equal(first, 19801n);
  assert.equal(node.periodN, 100);
  assert.equal(total, coin(100));
  assert.ok(last > 19801n * 99n);
});

test('Lapsed insurance only forfeits current period, period advances; new node revives and resumes payout', async () => {
  const app = await mk();
  const B = (await app.game.register('0xB')).uid;
  await app.wallet.issue(B, 500);
  await app.insurance.setSwitch(B, true);
  await app.insurance.depositPremium(B, coin(100));
  await app.insurance.accrueLossInternal(B, coin(100), 10);
  const findN1 = async () => (await app.store.listNodes({ uid: B }))[0];

  const p1 = await app.insurance.runPayoutBatch(1 * PAY_EVERY + 1);
  assert.equal(p1.status, 'paid');
  assert.equal((await findN1()).periodN, 1);
  const availAfterP1 = (await app.store.getAccount(B)).available;

  const poolBefore29 = (await app.store.getLedger()).insurancePool;
  const p29 = await app.insurance.runPayoutBatch(29 * PAY_EVERY + 1);
  assert.equal(p29.forfeited, 19801n * 2n);
  assert.equal((await app.store.getLedger()).insurancePool, poolBefore29);
  assert.equal((await app.store.getAccount(B)).available, availAfterP1);
  assert.equal((await findN1()).periodN, 2);

  await app.insurance.accrueLossInternal(B, coin(100), 29 * PAY_EVERY + 100);
  const p30 = await app.insurance.runPayoutBatch(30 * PAY_EVERY + 1);
  assert.equal(p30.paidToUser, 19801n * 3n + 19801n);
  assert.equal((await findN1()).periodN, 3);
  assert.equal(await app.store.totalInside(), await app.store.totalSource());
});

test('Insurance pool insufficient for batch -> whole batch postponed, period not advanced', async () => {
  const app = await mk();
  const U = (await app.game.register('0xU')).uid;
  await app.store.insertNode({ nodeId: 'NX', uid: U, total: coin(100), periodN: 0, paidAmount: 0n, paidToUserAmount: 0n, forfeitedAmount: 0n, state: 'active', createdAtSec: 1, batchSeq: 0 });
  const r = await app.insurance.runPayoutBatch(1 * PAY_EVERY + 1);
  assert.equal(r.status, 'deferred');
  assert.equal((await app.store.listNodes({}))[0].periodN, 0);
});

test('Invite tier: node direct invitee count -> per-mille rate', async () => {
  const cfg = (await mk()).cfg;
  const cases = [[0, 0], [1, 1], [4, 1], [5, 2], [9, 2], [10, 3], [19, 3], [20, 4], [49, 4], [50, 5], [99, 5]];
  for (const [n, bp] of cases) assert.equal(referralPerMille(cfg, n), BigInt(bp));
});

test('Invite commission: after invitee creates node, their bets return 0.1% to inviter (platform pays)', async () => {
  const app = await mk();
  const A = (await app.game.register('0xA')).uid;
  const B = (await app.game.register('0xB', A)).uid;
  const D = (await app.game.register('0xD')).uid;
  await app.wallet.issue(B, 200); await app.wallet.issue(D, 200);
  await app.insurance.setSwitch(B, true);
  await app.insurance.depositPremium(B, coin(40));
  await app.insurance.accrueLossInternal(B, coin(100), 10);
  await app.game.bet(B, 'red', 99, 1, 100);
  await app.game.bet(D, 'green', 99, 0, 110);
  await app.game.settle(300);
  assert.equal((await app.store.getAccount(A)).available, toInner('0.099'));
  assert.equal(await app.store.totalInside(), await app.store.totalSource());
});

test('Withdrawal: 2-500 units, fee 1 to platform; out-of-range errors; success/fail writeback conserved', async () => {
  const app = await mk();
  const U = (await app.game.register('0xU')).uid, V = (await app.game.register('0xV')).uid;
  await app.wallet.issue(U, 10); await app.wallet.issue(V, 10);
  await assert.rejects(() => app.wallet.withdraw(U, 1), /2-500/);
  await assert.rejects(() => app.wallet.withdraw(U, 501), /2-500/);
  const wd = await app.wallet.withdraw(U, 2);
  assert.equal(wd.fee, coin(1));
  assert.equal(wd.arrive, coin(1));
  assert.equal((await app.store.getAccount(U)).available, coin(8));
  await app.wallet.confirmWithdraw(wd.withdrawId, '0xTX');
  assert.equal((await app.store.getLedger()).withdrawn, coin(1));
  assert.equal(await app.store.totalInside(), await app.store.totalSource());

  const wd2 = await app.wallet.withdraw(V, 5);
  await app.wallet.failWithdraw(wd2.withdrawId);
  assert.equal((await app.store.getAccount(V)).available, coin(10));
  assert.equal((await app.store.getLedger()).platform, coin(1));
  assert.equal(await app.store.totalInside(), await app.store.totalSource());
});

test('No bets after lock; no settle before 180s', async () => {
  const { app, A } = await twoSidedGame();
  await app.game.bet(A, 'red', 10, 1, 10);
  await assert.rejects(app.game.bet(A, 'red', 10, 1, 160), /locked/);
  await assert.rejects(app.game.settle(170), /settlement/);
});
