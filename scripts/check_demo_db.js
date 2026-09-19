// Check demo database and test connection
import mysql from 'mysql2/promise';

const tunnelConfig = {
  host: '127.0.0.1',
  port: 3307,
  user: 'root',
  password: 'ETOqQdOuwPGElZtqkkPbfRqKniqqalWV',
  multipleStatements: true
};

async function main() {
  let conn;
  try {
    conn = await mysql.createConnection(tunnelConfig);
    console.log('Connected to MySQL via tunnel');
    
    // Check if demo database exists
    const [dbs] = await conn.query("SHOW DATABASES LIKE 'railway_demo'");
    console.log('Demo database exists:', dbs.length > 0);
    
    if (dbs.length > 0) {
      // Check tables in demo database
      const [tables] = await conn.query('SHOW TABLES FROM railway_demo');
      console.log('Tables in demo database:', tables.length);
      tables.forEach(t => console.log(' -', Object.values(t)[0]));
      
      // Check users count
      const [users] = await conn.query('SELECT COUNT(*) as count FROM railway_demo.users');
      console.log('Demo users count:', users[0].count);
    } else {
      console.log('Creating demo database...');
      await conn.query('CREATE DATABASE IF NOT EXISTS railway_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');
      console.log('Demo database created');
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (conn) await conn.end();
    process.exit(0);
  }
}

main();
