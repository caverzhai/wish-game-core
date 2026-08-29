// =============================================================
// Scheduler.js —— 定时任务调度（生产用 XXL-Job / BullMQ / cron，单点 leader 锁）
// 这里用「可虚拟推进」的方式实现，便于测试 150/180 秒与每 6h、168h、25 天逻辑
// =============================================================
import { batchSeqAt } from './engine-payout.js';

export class Scheduler {
  constructor(app) {
    this.app = app;
    this.lastPayoutSeq = null; // 已执行到的赔付批次序号
  }

  /** 把系统时间推进到 nowSec：自动结算到期局，并补齐期间所有 6h 赔付批次（不漏期） */
  tick(nowSec) {
    const { game, insurance, cfg } = this.app;
    const result = { settled: [], payouts: [] };

    // 1) 结算所有已到 180s 的局
    let guard = 0;
    // eslint-disable-next-line no-constant-condition
    while (guard++ < 1000) {
      const r = game._findOpenRound();
      if (!r || nowSec < r.settleAt) break;
      result.settled.push(game.settle(nowSec));
    }

    // 2) 6h 定点赔付：逐批补齐（顺延/幂等都在服务内处理）
    const targetSeq = batchSeqAt(nowSec, cfg);
    if (this.lastPayoutSeq === null) {
      this.lastPayoutSeq = targetSeq; // 首次对齐，不补发历史
    } else {
      for (let seq = this.lastPayoutSeq + 1; seq <= targetSeq; seq++) {
        const atSec = seq * cfg.payoutEverySec + 1; // 落在该批次内
        result.payouts.push(insurance.runPayoutBatch(atSec));
      }
      this.lastPayoutSeq = targetSeq;
    }
    return result;
  }
}
