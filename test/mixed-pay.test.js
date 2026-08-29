// =============================================================
// mixed-pay.test.js —— 混合支付：站内余额精确用尽、链上补差、余额清零
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { coin, toInner, needTopUp } from '../src/money.js';

const mk = () => createApp();

test('needTopUp：站内不足时返回精确差额（含小数），足够时为0', () => {
  assert.equal(needTopUp(0n, coin(10)), coin(10));
  assert.equal(needTopUp(coin(10), coin(10)), 0n);
  assert.equal(needTopUp(coin(20), coin(10)), 0n);
  assert.equal(needTopUp(toInner('4.7'), coin(10)), toInner('5.3'));
  assert.equal(needTopUp(toInner('7.999999'), coin(10)), toInner('2.000001'));
});

test('混合支付：站内余额(含小数零头)被精确用尽、链上只补差额，下注后可用余额精确清零', async () => {
  const cases = [['5', 10], ['5.3', 10], ['7.999999', 10], ['0.000001', 1], ['0', 99]];
  for (const [start, total] of cases) {
    const app = await mk();
    const U = (await app.game.register('0xM' + start)).uid;
    const init = toInner(start);
    if (init > 0n) await app.wallet.issueInner(U, init, 'INIT');            // 初始站内余额（可能带小数/为0）
    const acc0 = await app.store.getAccount(U);
    const need = needTopUp(acc0.available, coin(total));                    // 与 /bet/onchain 路由完全相同的补差计算
    if (need > 0n) await app.wallet.issueInner(U, need, 'CHAIN_DEPOSIT');   // 链上差额精确入账
    await app.game.bet(U, 'red', total, 1, 10);                            // 冻结全额
    const after = await app.store.getAccount(U);
    assert.equal(after.available, 0n, `start=${start} 应精确清零，实剩 ${after.available}`);
    assert.equal(after.frozen, coin(total), `start=${start} 冻结应=${coin(total)}`);
    assert.equal(await app.store.totalInside(), await app.store.totalSource(), `start=${start} 守恒`);
  }
});

test('混合支付：站内余额足够则不补链上，下注后仅扣下注额、剩余保留', async () => {
  const app = await mk();
  const U = (await app.game.register('0xN')).uid;
  await app.wallet.issueInner(U, toInner('15.25'), 'INIT');
  const need = needTopUp((await app.store.getAccount(U)).available, coin(10));
  assert.equal(need, 0n);
  await app.game.bet(U, 'green', 10, 2, 10);
  const after = await app.store.getAccount(U);
  assert.equal(after.available, toInner('5.25'));
  assert.equal(after.frozen, coin(10));
  assert.equal(await app.store.totalInside(), await app.store.totalSource());
});
