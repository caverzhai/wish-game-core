// =============================================================
// withdraw-guard.test.js - withdrawal: pending order time-window protection + refund/confirm idempotency
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { coin } from '../src/money.js';

const mk = () => createApp();

test('Fresh pending order not mistakenly refunded by reap; only stale orders beyond time window are recovered', async () => {
  const app = await mk();
  const U = (await app.game.register('0xw1')).uid;
  await app.wallet.issueInner(U, coin(10), 'INIT');
  await app.wallet.withdraw(U, 3); // state=pending, at=now (being paid out)
  const reapedNow = await app.wallet.reapUnbroadcast(U);
  assert.equal(reapedNow.length, 0, 'fresh pending order should not be recovered');
  const a1 = await app.store.getAccount(U);
  assert.equal(a1.available, coin(7), 'balance stays frozen during pending, not refunded');

  // manually set order to long ago (simulate stuck stale order)
  const old = app.store.withdraws.find((x) => x.state === 'pending');
  old.at = 0;
  const reapedOld = await app.wallet.reapUnbroadcast(U);
  assert.equal(reapedOld.length, 1, 'stale order should be recovered');
  const a2 = await app.store.getAccount(U);
  assert.equal(a2.available, coin(10), 'balance restored after stale order refund');
  assert.equal(await app.store.totalInside(), await app.store.totalSource());
});

test('failWithdraw idempotent: duplicate refund no double credit; paid cannot be reversed', async () => {
  const app = await mk();
  const U = (await app.game.register('0xw2')).uid;
  await app.wallet.issueInner(U, coin(10), 'INIT');
  const wd = await app.wallet.withdraw(U, 4);
  const f1 = await app.wallet.failWithdraw(wd.withdrawId);
  assert.equal(f1.state, 'failed');
  const after1 = (await app.store.getAccount(U)).available;
  // second refund must be idempotent, no extra money
  const f2 = await app.wallet.failWithdraw(wd.withdrawId);
  assert.equal(f2.state, 'failed');
  const after2 = (await app.store.getAccount(U)).available;
  assert.equal(after1, after2, 'duplicate refund no double credit');
  assert.equal(after2, coin(10));
});

test('confirmWithdraw idempotent: already paid confirm returns directly, no double posting', async () => {
  const app = await mk();
  const U = (await app.game.register('0xw3')).uid;
  await app.wallet.issueInner(U, coin(10), 'INIT');
  const wd = await app.wallet.withdraw(U, 5);
  await app.wallet.confirmWithdraw(wd.withdrawId, '0xaaa');
  const again = await app.wallet.confirmWithdraw(wd.withdrawId, '0xaaa');
  assert.equal(again.state, 'paid');
  const led = await app.store.getLedger();
  assert.equal(led.withdrawn, wd.arrive, 'withdrawn recorded once');
});

test('Broadcasted and logged (with txhash) pending order not recovered by reap, prevents double refund', async () => {
  const app = await mk();
  const U = (await app.game.register('0xw4')).uid;
  await app.wallet.issueInner(U, coin(10), 'INIT');
  const wd = await app.wallet.withdraw(U, 3); // pending
  // simulate payout broadcast success then immediately write hash to DB (even without receipt)
  await app.store.updateWithdraw(wd.withdrawId, { txhash: '0xbroadcasted' });
  // even beyond time window, must never be refunded as stale order
  const cur = app.store.withdraws.find((x) => x.withdrawId === wd.withdrawId);
  cur.at = 0;
  const reaped = await app.wallet.reapUnbroadcast(U);
  assert.equal(reaped.length, 0, 'broadcasted order not recovered');
  const a = await app.store.getAccount(U);
  assert.equal(a.available, coin(7), 'broadcasted order money stays pending, not refunded');
});

test('failWithdraw on paid/any terminal state throws no error (withdrawal flow not interrupted by dirty history orders)', async () => {
  const app = await mk();
  const U = (await app.game.register('0xw5')).uid;
  await app.wallet.issueInner(U, coin(10), 'INIT');
  const wd = await app.wallet.withdraw(U, 4);
  await app.wallet.confirmWithdraw(wd.withdrawId, '0xpaid'); // set paid
  const r = await app.wallet.failWithdraw(wd.withdrawId);    // fail again: no error
  assert.equal(r.state, 'paid', 'paid order stays paid, no double refund');
  const a = await app.store.getAccount(U);
  assert.equal(a.available, coin(6), 'no change after withdrawing 4');
});

test('reconcileBroadcasted: broadcasted order with hash but pending gets confirmed as paid (money arrived, no longer shows pending)', async () => {
  const app = await mk();
  const U = (await app.game.register('0xw6')).uid;
  await app.wallet.issueInner(U, coin(10), 'INIT');
  const wd = await app.wallet.withdraw(U, 3);
  await app.store.updateWithdraw(wd.withdrawId, { txhash: '0xbroadcast' }); // broadcasted logged, but receipt delayed no confirm
  await app.wallet.reconcileBroadcasted(U);
  const cur = await app.store.findWithdraw(wd.withdrawId);
  assert.equal(cur.state, 'paid', 'confirmed as paid');
  const led = await app.store.getLedger();
  assert.equal(led.withdrawn, wd.arrive, 'pending converted to paid');
  assert.equal(await app.store.totalInside(), await app.store.totalSource());
});
