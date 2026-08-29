// =============================================================
// Scheduler.js —— 定时推进（async）：自动结算到期局 + 补齐 6h 赔付
// 不自动开新局：一局结算后，直到出现第一笔许愿才由 GameService.bet 开新局
// 生产用 cron/队列 + 单实例 leader 锁；单容器内 setInterval 调用本 tick 即可
// =============================================================
import { batchSeqAt } from './engine-payout.js';

export class Scheduler {
  constructor(app) { this.app = app; this.lastPayoutSeq = null; }

  async tick(nowSec) {
    const { game, insurance, cfg } = this.app;
    const out = { settled: [], payouts: [] };

    // 到期局自动结算（只结算当前存在且到期的局，结算后不续开）
    let guard = 0;
    while (guard++ < 1000) {
      const r = await this.app.store.findOpenRound();
      if (!r || nowSec < r.settleAt) break;
      out.settled.push(await game.settle(nowSec));
    }

    const targetSeq = batchSeqAt(nowSec, cfg);
    if (this.lastPayoutSeq === null) this.lastPayoutSeq = targetSeq;
    else {
      for (let seq = this.lastPayoutSeq + 1; seq <= targetSeq; seq++) {
        out.payouts.push(await insurance.runPayoutBatch(seq * cfg.payoutEverySec + 1));
      }
      this.lastPayoutSeq = targetSeq;
    }
    return out;
  }
}
