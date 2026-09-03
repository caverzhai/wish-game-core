// =============================================================
// engine-settle.js - round settlement pure function (no side effects, easy to unit test)
// Rule: sum of picks odd => red wins, even => green wins; 2.5% fee then winners split by stake ratio
// Invite commission (v2.3.7): normal users 0.1% direct only; whitelisted users admin-set rate all depths,
//   whitelist-to-whitelist pays rate difference (upstream - downstream, min 0)
// =============================================================
import { mulDivFloor } from './money.js';

/**
 * @param bets  [{uid, side:'red'|'green', amount:bigint, pick:number}]
 * @param ctx   { insActiveByUid:Map, inviterByUid:Map(uid->inviterUid|null), whitelistByUid:Map(uid->perMille bigint) }
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

  // Either side empty: cancelled round, full refund, no fees, no commission
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

  // Insurance 10% (only active insurance users); multi-level invite commission
  const referral = [];
  for (const row of users) {
    const meta = ctx.insActiveByUid.get(row.uid);
    const insActive = !!(meta && meta.insActive);
    if (row.winRaw > 0n && insActive) {
      row.insCut = mulDivFloor(row.winRaw, cfg.insWinCutNum, cfg.insWinCutDen);
    }
    row.winCredit = row.winRaw - row.insCut;

    // Walk up the invite chain for multi-level commission
    if (row.totalStake > 0n) {
      let current = row.uid;
      let depth = 0;
      const visited = new Set(); // cycle guard
      while (current && ctx.inviterByUid.has(current)) {
        const inviter = ctx.inviterByUid.get(current);
        if (!inviter || visited.has(inviter)) break;
        visited.add(inviter);
        depth += 1;
        const inviterRate = ctx.whitelistByUid.get(inviter); // undefined => normal user
        if (inviterRate === undefined) {
          // Normal user: only direct (depth 1), fixed 0.1%
          if (depth === 1) {
            const reward = mulDivFloor(row.totalStake, cfg.referralNormalPerMille, cfg.referralDen);
            if (reward > 0n) referral.push({ inviterUid: inviter, fromUid: row.uid, stake: row.totalStake, perMille: cfg.referralNormalPerMille, reward, depth });
          }
        } else {
          // Whitelisted user: all depths; if immediate downstream (current) is also whitelisted, pay rate difference
          const currentRate = ctx.whitelistByUid.get(current);
          const effectiveRate = currentRate !== undefined
            ? (inviterRate > currentRate ? inviterRate - currentRate : 0n)
            : inviterRate;
          if (effectiveRate > 0n) {
            const reward = mulDivFloor(row.totalStake, effectiveRate, cfg.referralDen);
            if (reward > 0n) referral.push({ inviterUid: inviter, fromUid: row.uid, stake: row.totalStake, perMille: effectiveRate, reward, depth });
          }
        }
        current = inviter;
      }
    }
  }

  return {
    status: 'settled',
    totals: { ...totals, winSide, winTotal, fee, feeIns, feePlat, pot, dust },
    users,
    referral,
  };
}
