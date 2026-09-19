import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: 'ETOqQdOuwPGElZtqkkPbfRqKniqqalWV',
  database: 'railway',
  port: 3307
});

// 1. 查看users表索引
const [indexes] = await conn.query("SHOW INDEX FROM users");
console.log('Users table indexes:');
indexes.forEach(idx => {
  console.log(`  - ${idx.Key_name} (${idx.Column_name}), unique: ${idx.Non_unique === 0}`);
});

// 2. 查看建表语句
const [createTable] = await conn.query("SHOW CREATE TABLE users");
console.log('\nCreate table statement:');
console.log(createTable[0]['Create Table']);

await conn.end();
