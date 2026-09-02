// =============================================================
// mixed-pay.test.js - mixed payment: in-site balance fully used, on-chain top-up, balance zeroed
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { coin, toInner, needTopUp } from '../src/money.js';

const mk = () => createApp();

test('needTopUp: returns precise delta (with decimals) when insufficient, 0 when sufficient', () => {
  assert.equal(needTopUp(0n, coin(10)), coin(10));
  assert.equal(needTopUp(coin(10), coin(10)), 0n);
  assert.equal(needTopUp(coin(20), coin(10)), 0n);
  assert.equal(needTopUp(toInner('4.7'), coin(10)), toInner('5.3'));
  assert.equal(needTopUp(toInner('7.999999'), coin(10)), toInner('2.000001'));
});

test('Mixed payment: in-site balance (with decimal remainder) fully used, on-chain only tops delta, available balance zeroed exactly after bet', async () => {
  const cases = [['5', 10], ['5.3', 10], ['7.999999', 10], ['0.000001', 1], ['0', 99]];
  for (const [start, total] of cases) {
    const app = await mk();
    const U = (await app.game.register('0xM' + start)).uid;
    const init = toInner(start);
    if (init > 0n) await app.wallet.issueInner(U, init, 'INIT');            // initial in-site balance (may have decimals/be 0)
    const acc0 = await app.store.getAccount(U);
    const need = needTopUp(acc0.available, coin(total));                    // same delta calc as /bet/onchain route
    if (need > 0n) await app.wallet.issueInner(U, need, 'CHAIN_DEPOSIT');   // on-chain delta credited precisely
    await app.game.bet(U, 'red', total, 1, 10);                            // freeze full amount
    const after = await app.store.getAccount(U);
    assert.equal(after.available, 0n, `start=${start} should be zeroed, actual  ${after.available}`);
    assert.equal(after.frozen, coin(total), `start=${start} frozen should=${coin(total)}`);
    assert.equal(await app.store.totalInside(), await app.store.totalSource(), `start=${start} conserved`);
  }
});

test('Mixed payment: sufficient in-site balance means no on-chain top-up, only bet amount deducted, remainder kept', async () => {
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

test('On-chain missing-order recovery idempotent: same txHash credited once, duplicate returns already and balance not doubled', async () => {
  const app = await mk();
  const U = (await app.game.register('0xC')).uid;
  app.chain.verifyIncoming = async () => ({ inner: toInner('4.7') }); // stub: on-chain actual received 4.7 units
  const tx = '0xabc';
  // same orchestration as /wallet/credit route: idempotent return if credited, else verify->credit->register
  const creditOnce = async () => {
    if (await app.store.isChainTxUsed(tx)) return 'already';
    const hit = await app.chain.verifyIncoming({ txHash: tx });
    await app.wallet.issueInner(U, hit.inner, 'CHAIN_DEPOSIT');
    await app.store.markChainTxUsed(tx, U, hit.inner);
    return 'credited';
  };
  assert.equal(await creditOnce(), 'credited');
  assert.equal((await app.store.getAccount(U)).available, toInner('4.7'));
  assert.equal(await creditOnce(), 'already');
  assert.equal((await app.store.getAccount(U)).available, toInner('4.7')); // no double credit
  assert.equal(await app.store.totalInside(), await app.store.totalSource());
});

test('Premium withdrawal: rejected when insurance on, allowed when off, user ledger conserved', async () => {
  const app = await mk();
  const U = (await app.game.register('0xP')).uid;
  await app.wallet.issueInner(U, coin(50), 'INIT');
  await app.insurance.depositPremium(U, coin(30)); // available 20 / premium 30
  await app.insurance.setSwitch(U, true);
  await assert.rejects(() => app.insurance.withdrawPremium(U), /turn off/);
  await app.insurance.setSwitch(U, false);
  await app.insurance.withdrawPremium(U); // empty = withdraw all
  const a = await app.store.getAccount(U);
  assert.equal(a.premium, 0n);
  assert.equal(a.available, coin(50));
  assert.equal(await app.store.totalInside(), await app.store.totalSource());
});

