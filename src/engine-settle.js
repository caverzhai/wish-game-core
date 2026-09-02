// =============================================================
// engine-settle.js - round settlement pure function (no side effects, easy to unit test)
// Rule: sum of picks odd => red wins, even => green wins; 2.5% fee then winners split by stake ratio
// =============================================================
import { mulDivFloor } from './money.js';
import { referralPerMille } from './config.js';

/**
 * @param bets  [{uid, side:'red'|'green', amount:bigint, pick:number}]
 * @param ctx   { insActiveByUid:Map, nodeInviteeCountByUid:Map(inviter -> node count under them) }
 * @param cfg   global config
 * @returns Settlement plan (posted by GameService)
 */
export function planSettlement(bets, ctx, cfg) {
  // Aggregate by user and pool
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

  // Either side empty: cancelled round, full refund, no fees
  if (redTotal === 0n || greenTotal === 0n) {
    const refunds = new Map();
    for (const [uid, u] of byUser) refunds.set(uid, u.red + u.green);
    return { status: 'cancelled', totals, refunds };
  }

  const winSide = sumPick % 2 === 1 ? 'red' : 'green'; // odd=red, even=green
  const winTotal = winSide === 'red' ? redTotal : greenTotal;

  // Fee split: 2.5% = 20% to insurance pool + 80% to platform
  const fee = mulDivFloor(total, cfg.feeNum, cfg.feeDen);
  const feeIns = mulDivFloor(fee, cfg.feeInsNum, cfg.feeInsDen);
  const feePlat = fee - feeIns;
  const pot = total - fee; // winners' share

  // Winners split by ratio (integer truncation, remainder goes to insurance pool)
  const users = [];
  let allocated = 0n;
  for (const [uid, u] of byUser) {
    const winStake = winSide === 'red' ? u.red : u.green;
    const loseStake = winSide === 'red' ? u.green : u.red;
    const winRaw = winStake > 0n ? mulDivFloor(pot, winStake, winTotal) : 0n;
    allocated += winRaw;
    users.push({ uid, winStake, loseStake, totalStake: u.red + u.green, winRaw, insCut: 0n, winCredit: 0n });
  }
  const dust = pot - allocated; // payout remainder (>=0), goes to insurance pool, guarantees never overpay

  // Insurance 10% (only active insurance users); prepare invite commission
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
