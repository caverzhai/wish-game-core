// =============================================================
// engine-payout.js - insurance node 100-period payout pure math + batch index (timeline)
// Period amount = 0.019801 * n; period 100 tops up to exactly 100 units per node
// =============================================================

/** Next pending payout for a node; periodN=periods paid (0..99), returns null when fully paid */
export function nextDue(node, cfg) {
  const n = node.periodN + 1;
  if (n > 100) return null;
  if (n < 100) return cfg.periodStep * BigInt(n);
  return cfg.nodeTotal - node.paidAmount; // Period 100 tops up to exactly 100 units
}

/** Global payout batch index for a timestamp (seconds): one batch per 6h */
export function batchSeqAt(tsSec, cfg) {
  return Math.floor(tsSec / cfg.payoutEverySec);
}

/**
 * Revive check: current batch index - user's newest node batch index <= 28 (=168h)
 * Postponement does not advance successful batch, so it naturally does not consume the 168h window (frozen).
 */
export function isAlive(userNewestNodeSeq, currentSeq, cfg) {
  if (userNewestNodeSeq == null) return false;
  return currentSeq - userNewestNodeSeq <= cfg.surviveWindowBatches;
}
