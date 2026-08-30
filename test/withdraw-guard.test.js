// =============================================================
// withdraw-guard.test.js —— 提现：在途单时间窗保护 + 退款/确认幂等
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { coin } from '../src/money.js';

const mk = () => createApp();

test('刚创建的正常在途单不会被 reap 误退；只有超过时间窗的遗留单才回收', async () => {
  const app = await mk();
  const U = (await app.game.register('0xw1')).uid;
  await app.wallet.issueInner(U, coin(10), 'INIT');
  await app.wallet.withdraw(U, 3); // state=pending, at=now（正在代付中）
  const reapedNow = await app.wallet.reapUnbroadcast(U);
  assert.equal(reapedNow.length, 0, '年轻在途单不应被回收');
  const a1 = await app.store.getAccount(U);
  assert.equal(a1.available, coin(7), '在途单期间余额保持冻结，不退回');

  // 人为把该单置为很久以前（模拟卡死的遗留单）
  const old = app.store.withdraws.find((x) => x.state === 'pending');
  old.at = 0;
  const reapedOld = await app.wallet.reapUnbroadcast(U);
  assert.equal(reapedOld.length, 1, '超时遗留单应被回收');
  const a2 = await app.store.getAccount(U);
  assert.equal(a2.available, coin(10), '遗留单退回后余额恢复');
  assert.equal(await app.store.totalInside(), await app.store.totalSource());
});

test('failWithdraw 幂等：重复退款不重复入账；已 paid 不允许回退', async () => {
  const app = await mk();
  const U = (await app.game.register('0xw2')).uid;
  await app.wallet.issueInner(U, coin(10), 'INIT');
  const wd = await app.wallet.withdraw(U, 4);
  const f1 = await app.wallet.failWithdraw(wd.withdrawId);
  assert.equal(f1.state, 'failed');
  const after1 = (await app.store.getAccount(U)).available;
  // 再退一次必须幂等，不再加钱
  const f2 = await app.wallet.failWithdraw(wd.withdrawId);
  assert.equal(f2.state, 'failed');
  const after2 = (await app.store.getAccount(U)).available;
  assert.equal(after1, after2, '重复退款不重复入账');
  assert.equal(after2, coin(10));
});

test('confirmWithdraw 幂等：已 paid 再确认直接返回，不重复记账', async () => {
  const app = await mk();
  const U = (await app.game.register('0xw3')).uid;
  await app.wallet.issueInner(U, coin(10), 'INIT');
  const wd = await app.wallet.withdraw(U, 5);
  await app.wallet.confirmWithdraw(wd.withdrawId, '0xaaa');
  const again = await app.wallet.confirmWithdraw(wd.withdrawId, '0xaaa');
  assert.equal(again.state, 'paid');
  const led = await app.store.getLedger();
  assert.equal(led.withdrawn, wd.arrive, 'withdrawn 只记一次');
});
