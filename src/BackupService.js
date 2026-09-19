// =============================================================
// BackupService.js - Database backup and restore
// =============================================================

const BACKUP_TABLES = [
  'users', 'accounts', 'ledger', 'seq',
  'rounds', 'bets', 'nodes', 'node_logs', 'payout_batches',
  'flows', 'withdraws', 'posts', 'replies',
  'blocked_words', 'whitelist', 'regional_agents', 'admins',
  'announcement', 'chain_txs', 'voice_rooms', 'npcs',
  'lottery_rounds', 'lottery_entries', 'lottery_comments',
  'charity_projects', 'charity_donations', 'charity_votes', 'charity_comments',
  'task_jobs', 'task_applications', 'task_messages', 'task_deliveries',
  'task_disputes', 'task_votes', 'task_reviews',
  'referral_logs', 'backups'
];

export class BackupService {
  constructor(store) { this.store = store; }

  async createBackup(name = null, type = 'manual', retainDays = null) {
    const s = this.store;
    const backupId = await s.nextId('backup', 'BK');
    const now = Date.now();
    const data = {};
    let totalSize = 0;
    let tableCount = 0;

    for (const table of BACKUP_TABLES) {
      try {
        const rows = await s.getTableData(table);
        data[table] = rows;
        totalSize += JSON.stringify(rows).length;
        tableCount++;
      } catch (e) {
        console.log(`[backup] skip table ${table}: ${e.message}`);
      }
    }

    const jsonData = JSON.stringify(data);
    const expiresAt = retainDays ? now + retainDays * 86400000 : null;

    await s.createBackup({
      backupId,
      name: name || `Backup ${new Date(now).toISOString().slice(0, 19).replace('T', ' ')}`,
      type,
      data: jsonData,
      size: jsonData.length,
      tableCount,
      createdAt: now,
      expiresAt
    });

    console.log(`[backup] created ${backupId}, tables=${tableCount}, size=${(jsonData.length/1024).toFixed(1)}KB`);
    return { backupId, tableCount, size: jsonData.length, createdAt: now };
  }

  async listBackups(limit = 20) {
    return await this.store.listBackups(limit);
  }

  async restoreBackup(backupId) {
    const s = this.store;
    const backup = await s.getBackup(backupId);
    if (!backup) throw new Error('Backup not found');

    const data = JSON.parse(backup.data);
    let restoredTables = 0;

    for (const table of Object.keys(data)) {
      if (table === 'backups') continue; // Don't restore backups table
      try {
        await s.clearTable(table);
        const rows = data[table];
        if (rows && rows.length > 0) {
          await s.insertRows(table, rows);
        }
        restoredTables++;
        console.log(`[restore] table ${table}: ${rows ? rows.length : 0} rows`);
      } catch (e) {
        console.log(`[restore] skip table ${table}: ${e.message}`);
      }
    }

    console.log(`[restore] completed ${backupId}, tables=${restoredTables}`);
    return { backupId, restoredTables, restoredAt: Date.now() };
  }

  async deleteBackup(backupId) {
    return await this.store.deleteBackup(backupId);
  }

  async autoBackupDaily() {
    // Cleanup expired backups first
    await this.store.cleanupExpiredBackups();
    // Create daily auto backup, retain 7 days
    return await this.createBackup('Daily Auto Backup', 'auto', 7);
  }
}
