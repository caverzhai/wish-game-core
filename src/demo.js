// =============================================================
// demo.js —— 端到端流程演示（虚拟秒推进，无需联网/数据库）
// 运行：node src/demo.js
// =============================================================
import { createApp } from './app.js';
import { toCoin } from './money.js';

const line = (s) => console.log(s);
const hr = () => console.log('—'.repeat(64));

async function showBalances(app, ids) {
  for (const id of ids) {
    const a = await app.store.getAccount(id);
    console.log(`${id}: 可用 ${toCoin(a.available)} | 在途冻结 ${toCoin(a.frozen)} | 保费 ${toCoin(a.premium)} | 累计亏损 ${toCoin(a.lossAccum)}`);
  }
}

async function run() {
  const app = await createApp();
  const { game, wallet, insurance, store } = app;

  hr(); line('① 注册：A 是邀请人，B/C 均通过 A 的邀请链接注册（关联钱包即注册）');
  const A = (await game.register('0xAAA', null, 1)).uid;
  const B = (await game.register('0xBBB', A, 1)).uid;
  const C = (await game.register('0xCCC', A, 1)).uid;
  await wallet.issue(A, 10); await wallet.issue(B, 400); await wallet.issue(C, 400);
  line('B 打开保险开关并预存保费 100 枚');
  await insurance.setSwitch(B, true);
  await insurance.depositPremium(B, 100_000000n);

  hr(); line('② 第 1 局：B 押绿 60(选0)，C 押红 60(选1)，选号和=1 为奇 => 红胜');
  await game.bet(B, 'green', 60, 0, 10);
  await game.bet(C, 'red', 60, 1, 20);
  const r1 = await game.settle(190);
  console.log('结算：', r1.winSide, '胜；总池', toCoin(r1.total), '抽水', toCoin(r1.fee),
    '(保池', toCoin(r1.feeIns), '/ 平台', toCoin(r1.feePlat), ')，胜方可分', toCoin(r1.pot), '尾差', toCoin(r1.dust));
  line('B 押错亏损 60（保险生效，累计亏损 L=60，不足 100 先保留）');
  await showBalances(app, [A, B, C]);

  hr(); line('③ 第 2 局：B 再押绿 50(选0)，C 押红 50(选1) => 红胜，B 累计亏损达 110，开出第 1 个赔付节点');
  await game.bet(B, 'green', 50, 0, 200);
  await game.bet(C, 'red', 50, 1, 210);
  const r2 = await game.settle(380);
  console.log('结算：', r2.winSide, '胜；本局返佣合计', toCoin(r2.referralTotal), '（节点在本局结算末尾才生成，档位自下一局起生效）');
  const bNodes = await store.listNodes({ uid: B });
  console.log('B 当前节点：', bNodes.map((n) => `${n.nodeId}(已发${n.periodN}期/已赔${toCoin(n.paidAmount)})`).join(', '));
  await showBalances(app, [A, B]);

  hr(); line('④ 6 小时定点赔付（UTC 3/9/15/21）：第 1、2 期在 168h 续命窗口内，正常发放');
  const p1 = await insurance.runPayoutBatch(21601);
  const p2 = await insurance.runPayoutBatch(43201);
  console.log('批次1：', p1.status, '发给用户', toCoin(p1.paidToUser));
  console.log('批次2：', p2.status, '发给用户', toCoin(p2.paidToUser));
  line('跳到第 29 批（超过 168h=28 批且无新节点）：当期充公、期号照走、后续保留');
  const p29 = await insurance.runPayoutBatch(29 * 21600 + 1);
  console.log('批次29：', p29.status, '；正常发放', toCoin(p29.paidToUser), '，充公', toCoin(p29.forfeited));

  hr(); line('⑤ B 继续产生新节点（再亏满 100），新节点为其全部老节点续命，下一批恢复发放');
  await game.bet(B, 'green', 60, 0, 626000); await game.bet(C, 'red', 60, 1, 626010); await game.settle(626180);
  await game.bet(B, 'green', 30, 0, 626200); await game.bet(C, 'red', 30, 1, 626210); await game.settle(626380);
  line('B 节点：');
  for (const n of await store.listNodes({ uid: B })) console.log('  ', n.nodeId, `已处置${n.periodN}期｜到账${toCoin(n.paidToUserAmount)}｜充公${toCoin(n.forfeitedAmount)}`, n.state);
  const p30 = await insurance.runPayoutBatch(30 * 21600 + 1);
  console.log('批次30（续命后）：', p30.status, '发给用户', toCoin(p30.paidToUser), '充公', toCoin(p30.forfeited));

  hr(); line('⑥ 流局演示：只有一方下注，开奖时原路全额退回，不抽水不扣费');
  await game.bet(C, 'red', 7, 3, 700000);
  const cancel = await game.settle(700180);
  console.log('结果：', cancel.state);

  hr(); line('⑦ 提现：C 主动发起，单笔 2-500 枚，固定 1 枚手续费归平台');
  const before = (await store.getAccount(C)).available;
  const wd = await wallet.withdraw(C, 100);
  console.log('提 100 枚：手续费', toCoin(wd.fee), '，实到在途', toCoin(wd.arrive));
  await wallet.confirmWithdraw(wd.withdrawId, '0xDEMO_TXHASH');
  console.log('链上确认成功，txhash=', wd.txhash);

  hr(); line('⑧ 总账与守恒校验');
  const L = await store.getLedger();
  console.log('保险池', toCoin(L.insurancePool), '| 平台', toCoin(L.platform),
    '| 提现在途', toCoin(L.pendingWithdraw), '| 累计发放', toCoin(L.issued), '| 累计提出', toCoin(L.withdrawn));
  await store.assertBalanced('demo结束');
  console.log('✅ 总账守恒校验通过：系统内 = 累计发放 - 累计提出 =', toCoin(await store.totalSource()));
  await showBalances(app, [A, B, C]);
}

run();
