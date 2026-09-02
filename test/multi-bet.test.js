// =============================================================
// multi-bet.test.js - same user can bet multiple times in same round (each bet separate, accumulated)
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { coin } from '../src/money.js';

test('Same user can bet twice consecutively in same round: two bets, pool accumulated, frozen accumulated', async () => {
  const app = await createApp();
  const U = (await app.game.register('0xm')).uid;
  await app.wallet.issueInner(U, coin(100), 'INIT');

  const b1 = await app.game.bet(U, 'red', 2, 3, 100); // first bet, round starts start=100
  const b2 = await app.game.bet(U, 'red', 3, 4, 120); // second bet, still same round (before 150s lock)
  assert.equal(b1.roundId, b2.roundId, 'both bets in same round');

  const bets = await app.store.listBetsByRound(b1.roundId);
  assert.equal(bets.length, 2, 'same round keeps two bets');
  const round = await app.store.findOpenRound();
  assert.equal(round.redTotal, coin(5), 'red pool total 5 units');
  assert.equal(round.sumPick, 7, 'picked numbers total 3+4=7');
  const acc = await app.store.getAccount(U);
  assert.equal(acc.frozen, coin(5), 'frozen total 5 units');
  assert.equal(acc.available, coin(95), 'available deducted per bet to 95');
  assert.equal(await app.store.totalInside(), await app.store.totalSource());
});
