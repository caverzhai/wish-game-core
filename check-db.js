import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQLHOST,
    port: process.env.MYSQLPORT,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
  });

  console.log('=== Database State ===');
  
  const [ledger] = await conn.query('SELECT * FROM ledger LIMIT 1');
  console.log('Ledger:', JSON.stringify(ledger[0], null, 2));
  
  const [nodeStates] = await conn.query('SELECT state, COUNT(*) cnt, SUM(period_n) total_periods, SUM(paid_amount) total_paid FROM insurance_nodes GROUP BY state');
  console.log('\nNodes by state:', JSON.stringify(nodeStates, null, 2));
  
  const [batchCount] = await conn.query('SELECT COUNT(*) total, COUNT(DISTINCT seq) unique_seqs FROM payout_batches');
  console.log('\nPayout batches:', JSON.stringify(batchCount[0], null, 2));
  
  const [dupes] = await conn.query('SELECT seq, COUNT(*) cnt FROM payout_batches GROUP BY seq HAVING cnt > 1 ORDER BY cnt DESC LIMIT 10');
  console.log('\nDuplicate seqs (top 10):', JSON.stringify(dupes, null, 2));
  
  const [recent] = await conn.query('SELECT * FROM payout_batches ORDER BY id DESC LIMIT 5');
  console.log('\nRecent batches:', JSON.stringify(recent, null, 2));
  
  await conn.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
