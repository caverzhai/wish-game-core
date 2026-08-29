// =============================================================
// engine-payout.js —— 保险节点 100 期释放的纯计算 + 批次序号（时间轴）
// 期额 = 0.019801 * n；第 100 期补差，使每节点正好释放 100 枚
// =============================================================

/** 节点下一期待赔额；periodN=已发期数(0..99)，返回 null 表示已发完 */
export function nextDue(node, cfg) {
  const n = node.periodN + 1;
  if (n > 100) return null;
  if (n < 100) return cfg.periodStep * BigInt(n);
  return cfg.nodeTotal - node.paidAmount; // 第 100 期补差到整 100 枚
}

/** 时间戳(秒)对应的全局赔付批次序号：每 6h 一批 */
export function batchSeqAt(tsSec, cfg) {
  return Math.floor(tsSec / cfg.payoutEverySec);
}

/**
 * 续命判定：当前批次序号 - 用户「最新节点」所在批次序号 <= 28（=168h）
 * 顺延不推进成功批次，因此顺延天然不消耗 168h 窗口（冻结）。
 */
export function isAlive(userNewestNodeSeq, currentSeq, cfg) {
  if (userNewestNodeSeq == null) return false;
  return currentSeq - userNewestNodeSeq <= cfg.surviveWindowBatches;
}
