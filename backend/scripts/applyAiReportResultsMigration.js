import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDirectory, '..');
const migrationPath = path.resolve(backendRoot, '../database/migration_replace_ai_restock_with_report_results.sql');

dotenv.config({ path: path.join(backendRoot, '.env') });

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pos_accessories',
  charset: 'utf8mb4',
  multipleStatements: true
});

try {
  const sql = await fs.readFile(migrationPath, 'utf8');
  await connection.query(sql);
  console.log('Đã xóa bảng AI gợi ý nhập hàng và tạo bảng lưu kết quả AI phân tích báo cáo.');
} finally {
  await connection.end();
}
