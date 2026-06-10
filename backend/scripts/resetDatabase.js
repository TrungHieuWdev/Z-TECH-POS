import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(backendRoot, '..');

dotenv.config({ path: path.join(backendRoot, '.env') });

const dbName = process.env.DB_NAME || 'pos_accessories';
const escapedDbName = dbName.replace(/`/g, '``');

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  charset: 'utf8mb4',
  multipleStatements: true
});

try {
  const schemaSql = await fs.readFile(path.join(projectRoot, 'database', 'schema.sql'), 'utf8');
  const seedSql = await fs.readFile(path.join(projectRoot, 'database', 'seed.sql'), 'utf8');

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${escapedDbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await connection.query(`USE \`${escapedDbName}\``);
  await connection.query(schemaSql);
  await connection.query(seedSql);

  console.log(`Reset database "${dbName}" thành công.`);
} finally {
  await connection.end();
}
