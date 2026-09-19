import mysql from 'mysql2/promise';

// 创建demo数据库
const conn = await mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: 'ETOqQdOuwPGElZtqkkPbfRqKniqqalWV',
  port: 3307,
  multipleStatements: true
});

try {
  await conn.query('CREATE DATABASE IF NOT EXISTS railway_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');
  console.log('Demo database created: railway_demo');
  
  const [rows] = await conn.query('SHOW DATABASES LIKE "railway%"');
  console.log('Databases:', rows.map(r => Object.values(r)[0]));
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await conn.end();
}
