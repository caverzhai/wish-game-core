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
  lockAfterSec: 170,         // lock 170s after first bet starts round (last 10s locked)
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

  // Invite commission (v3.0 - Member level system):
  // Valid invite = invitee has placed at least one bet
  // Member levels based on valid invite count:
  //   1-star: 3+ valid invites, 0.1% commission
  //   2-star: 20+ valid invites, 0.2% commission
  //   3-star: 100+ valid invites, 0.3% commission
  //   4-star: 300+ valid invites, 0.4% commission
  //   5-star: 1000+ valid invites, 0.5% commission
  // Higher level gets rate difference from lower-level downline (all depths)
  // Commission eligibility: inviter must have at least one WIN in last 24h
  //   If no win in 24h, commission paused; resumes 24h after next win
  referralDen: 1000n,
  memberLevels: [
    { level: 1, name: '1-Star', minInvites: 3, perMille: 1n },    // 0.1%
    { level: 2, name: '2-Star', minInvites: 20, perMille: 2n },   // 0.2%
    { level: 3, name: '3-Star', minInvites: 100, perMille: 3n },  // 0.3%
    { level: 4, name: '4-Star', minInvites: 300, perMille: 4n },  // 0.4%
    { level: 5, name: '5-Star', minInvites: 1000, perMille: 5n }, // 0.5%
  ],
  commissionActiveWindowSec: 24 * 3600, // 24 hours since last win

  // Withdrawal: user-initiated
  withdrawMin: coin(2),      // min 2 units (withdrawing 1 with 1 fee is pointless)
  withdrawMax: coin(500),    // max 500 units per withdrawal
  withdrawFee: coin(1),      // fixed 1 unit fee per withdrawal, to platform (not insurance pool)
};
