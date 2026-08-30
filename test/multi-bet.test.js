// =============================================================
// multi-bet.test.js —— 同一用户在同一局可多次许愿（每次单独成笔、累加）
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { coin } from '../src/money.js';

test('同一用户同一局可连续两次许愿：两笔下注、池子累加、冻结累加', async () => {
  const app = await createApp();
  const U = (await app.game.register('0xm')).uid;
  await app.wallet.issueInner(U, coin(100), 'INIT');

  const b1 = await app.game.bet(U, 'red', 2, 3, 100); // 第一次，开局 start=100
  const b2 = await app.game.bet(U, 'red', 3, 4, 120); // 第二次，仍在同一局（150s 封盘前）
  assert.equal(b1.roundId, b2.roundId, '两笔属于同一局');

  const bets = await app.store.listBetsByRound(b1.roundId);
  assert.equal(bets.length, 2, '同一局保留两笔下注');
  const round = await app.store.findOpenRound();
  assert.equal(round.redTotal, coin(5), '红愿池累计 5 枚');
  assert.equal(round.sumPick, 7, '所选数字累计 3+4=7');
  const acc = await app.store.getAccount(U);
  assert.equal(acc.frozen, coin(5), '冻结累计 5 枚');
  assert.equal(acc.available, coin(95), '可用余额逐笔扣减到 95');
  assert.equal(await app.store.totalInside(), await app.store.totalSource());
});
