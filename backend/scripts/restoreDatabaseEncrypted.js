import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

dotenv.config();

const MAGIC = Buffer.from('ZTECHDB1');
const inputPath = process.argv[2];
const keyHex = String(process.env.BACKUP_ENCRYPTION_KEY || '');
if (!inputPath || !fs.existsSync(inputPath)) throw new Error('Cần truyền đường dẫn file .sql.enc hợp lệ');
if (!/^[a-fA-F0-9]{64}$/.test(keyHex)) throw new Error('BACKUP_ENCRYPTION_KEY không hợp lệ');

const descriptor = fs.openSync(inputPath, 'r');
const stat = fs.fstatSync(descriptor);
if (stat.size < MAGIC.length + 12 + 16) throw new Error('File backup quá ngắn');
const header = Buffer.alloc(MAGIC.length + 12);
fs.readSync(descriptor, header, 0, header.length, 0);
if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Định dạng backup không hợp lệ');
const tag = Buffer.alloc(16);
fs.readSync(descriptor, tag, 0, tag.length, stat.size - tag.length);
fs.closeSync(descriptor);

const decipher = crypto.createDecipheriv(
  'aes-256-gcm',
  Buffer.from(keyHex, 'hex'),
  header.subarray(MAGIC.length)
);
decipher.setAuthTag(tag);
const mysql = spawn(process.env.MYSQL_BIN || 'mysql', [
  '-h', process.env.DB_HOST || 'localhost',
  '-P', String(process.env.DB_PORT || 3306),
  '-u', process.env.DB_USER || '',
  process.env.DB_NAME || ''
], {
  env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || '' },
  stdio: ['pipe', 'inherit', 'inherit'],
  windowsHide: true
});

fs.createReadStream(inputPath, {
  start: header.length,
  end: stat.size - tag.length - 1
}).pipe(decipher).pipe(mysql.stdin);
mysql.on('close', (code) => {
  if (code !== 0) process.exitCode = code;
  else console.log('Khôi phục database hoàn tất');
});

