// =============================================================
// config.js —— 全局规则参数（单一事实源，均可在管理后台配置，勿写死在逻辑里）
// 金额单位：枚
// =============================================================
import { coin, toInner } from './money.js';

export const DEFAULT_CONFIG = {
  // —— 下注与选号 ——
  betMin: coin(1),
  betMax: coin(99),          // 单笔 1-99 枚（整数）
  pickMin: 0,
  pickMax: 9,                // 选号 0-9（0 按偶数）
  allowBothSides: true,      // 允许同一局红绿双边、多笔下注

  // —— 对局时间（秒）——
  lockAfterSec: 150,         // 首笔开局后 150 秒封盘
  settleAfterSec: 180,       // 180 秒开奖

  // —— 全局抽水 2.5% ——
  feeNum: 25n, feeDen: 1000n,
  feeInsNum: 20n, feeInsDen: 100n, // 抽水中 20% 进保险池（其余 80% 进平台）

  // —— 保险（可选）——
  insWinCutNum: 10n, insWinCutDen: 100n, // 保险生效的赢家：中奖实分再扣 10% 进保险池
  premiumMin: coin(20),      // 保费账户 >=20 枚，保险才生效、才能开节点
  nodeThreshold: coin(100),  // 累计亏损每满 100 枚
  nodePremium: coin(20),     // 每开 1 个节点扣 20 枚保费进保险池
  nodeTotal: coin(100),      // 每个节点共释放 100 枚
  periodStep: toInner('0.019801'), // 每期递增基数（枚）

  // —— 6 小时定点赔付 ——（UTC 0 时区 3/9/15/21 点）
  payoutEverySec: 6 * 3600,
  surviveWindowBatches: 28,  // 168 小时 = 28 个赔付批次

  // —— 邀请返佣：生成过节点的「去重直邀人数」-> 返佣千分率（‰）——
  // 1人0.1% / 5人0.2% / 10人0.3% / 20人0.4% / 50人及以上0.5%
  referralTiers: [
    { min: 50, perMille: 5 },
    { min: 20, perMille: 4 },
    { min: 10, perMille: 3 },
    { min: 5, perMille: 2 },
    { min: 1, perMille: 1 },
  ],
  referralDen: 1000n,

  // —— 提现：用户主动发起 ——
  withdrawMin: coin(2),      // 最少 2 枚（提 1 枚扣 1 枚手续费无意义）
  withdrawMax: coin(500),    // 单笔不超过 500 枚
  withdrawFee: coin(1),      // 每笔固定 1 枚手续费，归平台（不进保险池）
};

/** 按「生成过节点的去重直邀人数」返回返佣千分率 */
export function referralPerMille(cfg, nodeInviteeCount) {
  for (const t of cfg.referralTiers) {
    if (nodeInviteeCount >= t.min) return BigInt(t.perMille);
  }
  return 0n;
}
