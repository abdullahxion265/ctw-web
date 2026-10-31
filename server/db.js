const mysql = require('mysql2');

const isProd = process.env.NODE_ENV === 'production';

// Production must be configured explicitly. The root/empty-password fallbacks exist for local dev only.
function required(name, devDefault) {
  const value = process.env[name];
  if (value) return value;
  if (isProd) {
    console.error(`[FATAL] ${name} is not set. Refusing to start in production without it.`);
    process.exit(1);
  }
  return devDefault;
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: required('DB_USER', 'root'),
  password: required('DB_PASSWORD', ''),
  database: required('DB_NAME', 'carterthetown'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const promisePool = pool.promise();

promisePool
  .getConnection()
  .then((conn) => {
    console.log('[DB] MySQL connected');
    conn.release();
  })
  .catch((err) => {
    console.error('[DB] Connection failed:', err.message);
    console.error('Check the DB_* environment variables and that MySQL is running.');
  });

module.exports = promisePool;
