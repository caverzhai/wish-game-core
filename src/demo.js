// =============================================================
// demo.js - end-to-end flow demo (virtual time advance, no network/db needed)
// Run: node src/demo.js
// =============================================================
import { createApp } from './app.js';
import { toCoin } from './money.js';

const line = (s) => console.log(s);
const hr = () => console.log('—'.repeat(64));

async function showBalances(app, ids) {
  for (const id of ids) {
    const a = await app.store.getAccount(id);
    console.log(`${id}: avail ${toCoin(a.available)} | frozen ${toCoin(a.frozen)} | premium ${toCoin(a.premium)} | lossAccum ${toCoin(a.lossAccum)}`);
  }
}

async function run() {
  const app = await createApp();
  const { game, wallet, insurance, store } = app;

  hr(); line('1. Register: A is inviter, B/C register via invite link of A (wallet link = register)');
  const A = (await game.register('0xAAA', null, 1)).uid;
  const B = (await game.register('0xBBB', A, 1)).uid;
  const C = (await game.register('0xCCC', A, 1)).uid;
  await wallet.issue(A, 10); await wallet.issue(B, 400); await wallet.issue(C, 400);
  line('B enables insurance and deposits 100 units premium');
  await insurance.setSwitch(B, true);
  await insurance.depositPremium(B, 100_000000n);

  hr(); line('2. Round 1: B bets green 60(pick 0), C bets red 60(pick 1), sum=1 odd => red wins');
  await game.bet(B, 'green', 60, 0, 10);
  await game.bet(C, 'red', 60, 1, 20);
  const r1 = await game.settle(190);
  console.log('Settlement: ', r1.winSide, 'wins; total pool', toCoin(r1.total), 'fee', toCoin(r1.fee),
    '(insPool', toCoin(r1.feeIns), '/ platform', toCoin(r1.feePlat), ')，winners share', toCoin(r1.pot), 'remainder', toCoin(r1.dust));
  line('B loses 60 (insurance active, lossAccum L=60, below 100 kept)');
  await showBalances(app, [A, B, C]);

  hr(); line('3. Round 2: B bets green 50(pick 0), C bets red 50(pick 1) => red wins, B loss reaches 110, creates 1st payout node');
  await game.bet(B, 'green', 50, 0, 200);
  await game.bet(C, 'red', 50, 1, 210);
  const r2 = await game.settle(380);
  console.log('Settlement: ', r2.winSide, 'wins; round commission total', toCoin(r2.referralTotal), '(node created at end of settlement, tier effective next round)');
  const bNodes = await store.listNodes({ uid: B });
  console.log('B current nodes:', bNodes.map((n) => `${n.nodeId}(paid${n.periodN}periods/paid${toCoin(n.paidAmount)})`).join(', '));
  await showBalances(app, [A, B]);

  hr(); line('4. 6h scheduled payout (UTC 3/9/15/21): periods 1,2 within 168h revive window, paid normally');
  const p1 = await insurance.runPayoutBatch(21601);
  const p2 = await insurance.runPayoutBatch(43201);
  console.log('Batch1：', p1.status, 'to user', toCoin(p1.paidToUser));
  console.log('Batch2：', p2.status, 'to user', toCoin(p2.paidToUser));
  line('Skip to batch 29 (beyond 168h=28 batches, no new node): current forfeited, period advances, future retained');
  const p29 = await insurance.runPayoutBatch(29 * 21600 + 1);
  console.log('Batch29：', p29.status, '; paid', toCoin(p29.paidToUser), ', forfeited', toCoin(p29.forfeited));

  hr(); line('5. B creates new node (another 100 loss), new node revives all old nodes, next batch resumes payout');
  await game.bet(B, 'green', 60, 0, 626000); await game.bet(C, 'red', 60, 1, 626010); await game.settle(626180);
  await game.bet(B, 'green', 30, 0, 626200); await game.bet(C, 'red', 30, 1, 626210); await game.settle(626380);
  line('B nodes:');
  for (const n of await store.listNodes({ uid: B })) console.log('  ', n.nodeId, `processed${n.periodN}periods | received${toCoin(n.paidToUserAmount)}| forfeited${toCoin(n.forfeitedAmount)}`, n.state);
  const p30 = await insurance.runPayoutBatch(30 * 21600 + 1);
  console.log('Batch30 (after revive): ', p30.status, 'to user', toCoin(p30.paidToUser), 'forfeited', toCoin(p30.forfeited));

  hr(); line('6. Cancelled round demo: only one side bets, full refund at settlement, no fees');
  await game.bet(C, 'red', 7, 3, 700000);
  const cancel = await game.settle(700180);
  console.log('Result: ', cancel.state);

  hr(); line('7. Withdrawal: C initiates, 2-500 units per tx, fixed 1 unit fee to platform');
  const before = (await store.getAccount(C)).available;
  const wd = await wallet.withdraw(C, 100);
  console.log('Withdraw 100: fee', toCoin(wd.fee), ', pending arrival', toCoin(wd.arrive));
  await wallet.confirmWithdraw(wd.withdrawId, '0xDEMO_TXHASH');
  console.log('On-chain confirmed, txhash=', wd.txhash);

  hr(); line('8. Ledger and conservation check');
  const L = await store.getLedger();
  console.log('insurancePool', toCoin(L.insurancePool), '| platform', toCoin(L.platform),
    '| pendingWithdraw', toCoin(L.pendingWithdraw), '| totalIssued', toCoin(L.issued), '| totalWithdrawn', toCoin(L.withdrawn));
  await store.assertBalanced('demo-end');
  console.log('[OK] Ledger conservation passed: inside = totalIssued - totalWithdrawn =', toCoin(await store.totalSource()));
  await showBalances(app, [A, B, C]);
}

run();
