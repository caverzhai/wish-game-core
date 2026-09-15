// =============================================================
// Scheduler.js - async tick: auto-settle expired rounds + run 6h payouts
// No auto new round: after settlement, a new round starts only on first bet via GameService.bet
// Production: cron/queue + single-instance leader lock; single container: setInterval calling this tick
// =============================================================
import { batchSeqAt } from './engine-payout.js';

export class Scheduler {
  constructor(app) { this.app = app; this.lastPayoutSeq = null; }

  async tick(nowSec) {
    const { game, insurance, cfg, task } = this.app;
    const out = { settled: [], payouts: [], taskReleases: [] };

    // Auto-settle expired rounds (only existing & expired rounds, no auto-restart after)
    let guard = 0;
    while (guard++ < 1000) {
      const r = await this.app.store.findOpenRound();
      if (!r || nowSec < r.settleAt) break;
      out.settled.push(await game.settle(nowSec));
    }

    // Auto-release task payments (delivered > 15 days)
    try {
      const allDelivered = await this.app.store.listTaskJobs(100, 0, 'delivered');
      const overdueJobs = allDelivered.filter(j => j.autoReleaseAt && j.autoReleaseAt <= nowSec);
      for (const job of overdueJobs) {
        try {
          const res = await task.autoRelease(job.jobId);
          if (res) out.taskReleases.push(res);
        } catch (e) { console.log('[scheduler] task auto-release error:', e.message); }
      }
    } catch (e) { console.log('[scheduler] task release scan error:', e.message); }

    const targetSeq = batchSeqAt(nowSec, cfg);
    if (this.lastPayoutSeq === null) {
      // Initialize from database: find the last paid or deferred batch seq
      try {
        const hasMethod = typeof this.app.store.listPayoutBatches === 'function';
        console.log('[scheduler] init: listPayoutBatches exists=' + hasMethod);
        const lastBatch = hasMethod ? await this.app.store.listPayoutBatches(1) : [];
        console.log('[scheduler] init: lastBatch seq=' + (lastBatch && lastBatch[0] ? lastBatch[0].seq : 'null'));
        if (lastBatch && lastBatch[0]) {
          this.lastPayoutSeq = Number(lastBatch[0].seq);
        } else {
          this.lastPayoutSeq = targetSeq - 1;
        }
        console.log('[scheduler] init: lastPayoutSeq=' + this.lastPayoutSeq + ' targetSeq=' + targetSeq);
      } catch (e) {
        console.log('[scheduler] init lastPayoutSeq error:', e.message);
        this.lastPayoutSeq = targetSeq - 1;
      }
    }
    for (let seq = this.lastPayoutSeq + 1; seq <= targetSeq; seq++) {
      try {
        console.log('[scheduler] running payout batch seq=' + seq);
        const result = await insurance.runPayoutBatch(seq * cfg.payoutEverySec + 1);
        console.log('[scheduler] payout batch seq=' + seq + ' status=' + result.status + ' paidToUser=' + (result.paidToUser ? result.paidToUser.toString() : 'n/a'));
        out.payouts.push(result);
        this.lastPayoutSeq = seq;
      } catch (e) {
        console.log('[scheduler] payout batch error seq=' + seq + ':', e.message);
        // Do NOT advance lastPayoutSeq on error - retry next tick
        break;
      }
    }
    return out;
  }
}
