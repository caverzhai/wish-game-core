// =============================================================
// RecoveryService.js - Emergency insurance data rollback
// =============================================================
export class RecoveryService {
  constructor(store) { this.store = store; }

  async rollbackInsurance() {
    const s = this.store;
    return await s.transaction(async () => {
      const report = { usersRolledBack: 0, totalRolledBack: 0, nodesReset: 0, batchesCleared: 0, logsCleared: 0, flowsCleared: 0 };

      // 1. Query all NODE_PAYOUT flows, group by uid
      const [payoutFlows] = await s.exec(
        "SELECT uid, SUM(amount) total FROM flows WHERE biz_type='NODE_PAYOUT' GROUP BY uid"
      );
      
      let totalRollback = 0n;
      for (const row of payoutFlows) {
        const amount = BigInt(row.total);
        if (amount <= 0n) continue;
        await s.applyAccount(row.uid, { avail: -amount });
        totalRollback += amount;
        report.usersRolledBack++;
      }
      report.totalRolledBack = totalRollback.toString();

      // 2. Return to insurance pool
      if (totalRollback > 0n) {
        await s.applyLedger({ ins: totalRollback });
      }

      // 3. Clear payout_batches
      const [batchResult] = await s.exec('DELETE FROM payout_batches');
      report.batchesCleared = batchResult.affectedRows;

      // 4. Clear node_logs
      const [logResult] = await s.exec('DELETE FROM node_logs');
      report.logsCleared = logResult.affectedRows;

      // 5. Reset all nodes
      const [nodeResult] = await s.exec(
        "UPDATE nodes SET period_n=0, paid_amount=0, paid_to_user=0, forfeited=0, state='active' WHERE state != 'active' OR period_n > 0"
      );
      report.nodesReset = nodeResult.affectedRows;

      // 6. Delete NODE_PAYOUT and NODE_FORFEIT flows
      const [flowResult] = await s.exec(
        "DELETE FROM flows WHERE biz_type IN ('NODE_PAYOUT', 'NODE_FORFEIT')"
      );
      report.flowsCleared = flowResult.affectedRows;

      console.log('[recovery] Insurance rollback complete:', JSON.stringify(report));
      return report;
    }, 'recovery-rollback');
  }
}
