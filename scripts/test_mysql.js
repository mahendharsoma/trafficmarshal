const fs = require('fs');
const { URL } = require('url');
const mysql = require('mysql2/promise');

function readEnv() {
  try {
    const content = fs.readFileSync('.env.local', 'utf8');
    const m = content.match(/^MYSQL_URL=(.+)$/m);
    if (!m) return null;
    return m[1].trim();
  } catch (e) {
    return null;
  }
}

async function main() {
  const mysqlUrl = readEnv();
  if (!mysqlUrl) {
    console.error('MYSQL_URL not found in .env.local');
    process.exit(2);
  }

  let u;
  try {
    u = new URL(mysqlUrl);
  } catch (e) {
    console.error('Failed to parse MYSQL_URL:', e.message);
    process.exit(2);
  }

  const config = {
    host: u.hostname,
    port: u.port || 3306,
    user: u.username || 'root',
    password: u.password || '',
    database: (u.pathname || '').replace(/^\//, ''),
    connectTimeout: 5000
  };

  console.log('Attempting MySQL connection to', `${config.user}@${config.host}:${config.port}/${config.database}`);

  try {
    const conn = await mysql.createConnection(config);
    const [rows] = await conn.query('SELECT 1+1 AS v');
    console.log('Test query result:', rows);
    await conn.end();
    console.log('Connection successful');
    process.exit(0);
  } catch (err) {
    console.error('Connection failed:', err.message || err);
    process.exit(1);
  }
}

main();
