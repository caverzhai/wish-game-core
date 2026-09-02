// =============================================================
// Scheduler.js - async tick: auto-settle expired rounds + run 6h payouts
// No auto new round: after settlement, a new round starts only on first bet via GameService.bet
// Production: cron/queue + single-instance leader lock; single container: setInterval calling this tick
// =============================================================
import { batchSeqAt } from './engine-payout.js';

export class Scheduler {
  constructor(app) { this.app = app; this.lastPayoutSeq = null; }

  async tick(nowSec) {
    const { game, insurance, cfg } = this.app;
    const out = { settled: [], payouts: [] };

    // Auto-settle expired rounds (only existing & expired rounds, no auto-restart after)
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
