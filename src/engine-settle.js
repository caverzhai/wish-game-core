// =============================================================
// engine-settle.js —— 对局结算纯函数（无副作用，便于单测）
// 规则：选号之和为奇=>红胜，为偶=>绿胜；总池抽 2.5% 后胜方按投入占比分
// =============================================================
import { mulDivFloor } from './money.js';
import { referralPerMille } from './config.js';

/**
 * @param bets  [{uid, side:'red'|'green', amount:bigint, pick:number}]
 * @param ctx   { insActiveByUid:Map, nodeInviteeCountByUid:Map(邀请人->其名下节点人数) }
 * @param cfg   全局配置
 * @returns 结算计划（由 GameService 落账）
 */
export function planSettlement(bets, ctx, cfg) {
  // —— 按用户、按池聚合 ——
  const byUser = new Map(); // uid -> {red, green}
  let redTotal = 0n, greenTotal = 0n, sumPick = 0;
  for (const b of bets) {
    if (!byUser.has(b.uid)) byUser.set(b.uid, { red: 0n, green: 0n });
    const u = byUser.get(b.uid);
    u[b.side] += b.amount;
    sumPick += b.pick;
    if (b.side === 'red') redTotal += b.amount; else greenTotal += b.amount;
  }
  const total = redTotal + greenTotal;
  const totals = { redTotal, greenTotal, total, sumPick };

  // —— 任一方为空：流局，全额退回、不抽水、不扣任何费用 ——
  if (redTotal === 0n || greenTotal === 0n) {
    const refunds = new Map();
    for (const [uid, u] of byUser) refunds.set(uid, u.red + u.green);
    return { status: 'cancelled', totals, refunds };
  }

  const winSide = sumPick % 2 === 1 ? 'red' : 'green'; // 奇红偶绿
  const winTotal = winSide === 'red' ? redTotal : greenTotal;

  // —— 抽水拆分：2.5% = 20% 入保险池 + 80% 入平台 ——
  const fee = mulDivFloor(total, cfg.feeNum, cfg.feeDen);
  const feeIns = mulDivFloor(fee, cfg.feeInsNum, cfg.feeInsDen);
  const feePlat = fee - feeIns;
  const pot = total - fee; // 胜方可分

  // —— 胜方按占比分（整数截断，尾差最后统一归保险池）——
  const users = [];
  let allocated = 0n;
  for (const [uid, u] of byUser) {
    const winStake = winSide === 'red' ? u.red : u.green;
    const loseStake = winSide === 'red' ? u.green : u.red;
    const winRaw = winStake > 0n ? mulDivFloor(pot, winStake, winTotal) : 0n;
    allocated += winRaw;
    users.push({ uid, winStake, loseStake, totalStake: u.red + u.green, winRaw, insCut: 0n, winCredit: 0n });
  }
  const dust = pot - allocated; // 分奖尾差（>=0），归保险池，保证绝不多分

  // —— 保险 10%（仅保险生效者）；同时准备邀请返佣 ——
  const referral = [];
  for (const row of users) {
    const meta = ctx.insActiveByUid.get(row.uid);
    const insActive = !!(meta && meta.insActive);
    if (row.winRaw > 0n && insActive) {
      row.insCut = mulDivFloor(row.winRaw, cfg.insWinCutNum, cfg.insWinCutDen);
    }
    row.winCredit = row.winRaw - row.insCut;

    const inviterUid = meta?.inviterUid ?? null;
    if (inviterUid && row.totalStake > 0n) {
      const cnt = ctx.nodeInviteeCountByUid.get(inviterUid) ?? 0;
      const perMille = referralPerMille(cfg, cnt);
      const reward = perMille > 0n ? mulDivFloor(row.totalStake, perMille, cfg.referralDen) : 0n;
      referral.push({ inviterUid, fromUid: row.uid, stake: row.totalStake, perMille, reward });
    }
  }

  return {
    status: 'settled',
    totals: { ...totals, winSide, winTotal, fee, feeIns, feePlat, pot, dust },
    users,
    referral,
  };
}
