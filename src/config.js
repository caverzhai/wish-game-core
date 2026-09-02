// =============================================================
// config.js - global rule parameters (single source of truth, all configurable in admin panel, do not hardcode in logic)
// Amount unit: units
// =============================================================
import { coin, toInner } from './money.js';

export const DEFAULT_CONFIG = {
  // Betting and number picking
  betMin: coin(1),
  betMax: coin(99),          // single bet 1-99 units (integer)
  pickMin: 0,
  pickMax: 9,                // pick 0-9 (0 counts as even)
  allowBothSides: true,      // allow both sides and multiple bets in same round

  // Round timing (seconds)
  lockAfterSec: 150,         // lock 150s after first bet starts round
  settleAfterSec: 180,       // settle at 180s

  // Global fee 2.5%
  feeNum: 25n, feeDen: 1000n,
  feeInsNum: 20n, feeInsDen: 100n, // 20% of fee goes to insurance pool (remaining 80% to platform)

  // Insurance (optional)
  insWinCutNum: 10n, insWinCutDen: 100n, // active insurance winners: 10% of actual winnings goes to insurance pool
  premiumMin: coin(20),      // premium balance >=20 units: insurance active, nodes can be created
  nodeThreshold: coin(100),  // cumulative loss per 100 units
  nodePremium: coin(20),     // 20 units premium deducted per node creation, goes to insurance pool
  nodeTotal: coin(100),      // each node releases total 100 units
  periodStep: toInner('0.019801'), // per-period increment base (units)

  // Scheduled payout every 6h (UTC 3/9/15/21)
  payoutEverySec: 6 * 3600,
  surviveWindowBatches: 28,  // 168 hours = 28 payout batches

  // Invite commission: distinct direct invitees with nodes -> commission rate (per mille)
  // 1 person 0.1% / 5 0.2% / 10 0.3% / 20 0.4% / 50+ 0.5%
  referralTiers: [
    { min: 50, perMille: 5 },
    { min: 20, perMille: 4 },
    { min: 10, perMille: 3 },
    { min: 5, perMille: 2 },
    { min: 1, perMille: 1 },
  ],
  referralDen: 1000n,

  // Withdrawal: user-initiated
  withdrawMin: coin(2),      // min 2 units (withdrawing 1 with 1 fee is pointless)
  withdrawMax: coin(500),    // max 500 units per withdrawal
  withdrawFee: coin(1),      // fixed 1 unit fee per withdrawal, to platform (not insurance pool)
};

/** Returns commission per-mille rate by distinct direct invitees with nodes */
export function referralPerMille(cfg, nodeInviteeCount) {
  for (const t of cfg.referralTiers) {
    if (nodeInviteeCount >= t.min) return BigInt(t.perMille);
  }
  return 0n;
}
