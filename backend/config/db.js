import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'node:fs';

dotenv.config();

const databaseUrl = String(process.env.DATABASE_URL || process.env.MYSQL_URI || '').trim();
let urlConfig = {};
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  urlConfig = {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, ''))
  };
}

const inlineCa = String(process.env.DB_SSL_CA || '').replace(/\\n/g, '\n').trim();
const sslEnabled = databaseUrl
  ? !['false', '0'].includes(String(process.env.DB_SSL || 'true').toLowerCase())
  : String(process.env.DB_SSL || '').toLowerCase() === 'true';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pos_accessories',
  charset: 'utf8mb4',
  ...urlConfig,
  ...(sslEnabled
    ? {
        ssl: {
          rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false',
          ...(inlineCa
            ? { ca: inlineCa }
            : process.env.DB_SSL_CA_FILE
              ? { ca: fs.readFileSync(process.env.DB_SSL_CA_FILE, 'utf8') }
              : {})
        }
      }
    : {})
};

const pool = mysql.createPool({
  ...dbConfig,
  // MySQL TIMESTAMP values and report boundaries are interpreted consistently
  // in the store's business timezone (Asia/Ho_Chi_Minh = UTC+07:00).
  timezone: '+07:00',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || (process.env.VERCEL ? 3 : 10)),
  maxIdle: Number(process.env.DB_MAX_IDLE || (process.env.VERCEL ? 2 : 10)),
  idleTimeout: Number(process.env.DB_IDLE_TIMEOUT_MS || 60000),
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  queueLimit: Number(process.env.DB_QUEUE_LIMIT || 100)
});

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function withTransaction(callback) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const transactionQuery = async (sql, params = []) => {
      const [rows] = await connection.execute(sql, params);
      return rows;
    };
    const result = await callback(transactionQuery);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function closePool() {
  await pool.end();
}
