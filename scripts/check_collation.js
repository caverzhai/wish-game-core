import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: 'ETOqQdOuwPGElZtqkkPbfRqKniqqalWV',
  database: 'railway',
  port: 3307
});

// 1. 检查表排序规则
const [tableStatus] = await conn.query("SHOW TABLE STATUS WHERE Name='users'");
console.log('Table collation:', tableStatus[0].Collation);

// 2. 检查wallet字段排序规则
const [cols] = await conn.query("SHOW FULL COLUMNS FROM users WHERE Field='wallet'");
console.log('Wallet column collation:', cols[0].Collation);

// 3. 测试大小写是否区分
const [test1] = await conn.query("SELECT COUNT(*) as cnt FROM users WHERE wallet='0x78a35fc4205b5010299e7d96637c8bc2e4017af7'");
const [test2] = await conn.query("SELECT COUNT(*) as cnt FROM users WHERE wallet='0x78A35FC4205B5010299E7D96637C8BC2E4017AF7'");
console.log('Lowercase match count:', test1[0].cnt);
console.log('Uppercase match count:', test2[0].cnt);

// 4. 查看总用户数
const [total] = await conn.query('SELECT COUNT(*) as cnt FROM users');
console.log('Total users:', total[0].cnt);

await conn.end();
