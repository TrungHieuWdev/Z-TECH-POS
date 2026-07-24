import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

dotenv.config();

const MAGIC = Buffer.from('ZTECHDB1');
const keyHex = String(process.env.BACKUP_ENCRYPTION_KEY || '');
if (!/^[a-fA-F0-9]{64}$/.test(keyHex)) {
  throw new Error('BACKUP_ENCRYPTION_KEY phải là 64 ký tự hex (32 byte)');
}

const backupDirectory = path.resolve(process.env.BACKUP_DIR || './backups');
fs.mkdirSync(backupDirectory, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputPath = path.join(backupDirectory, `pos-${stamp}.sql.enc`);
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv);
const output = fs.createWriteStream(outputPath, { flags: 'wx', mode: 0o600 });
output.write(MAGIC);
output.write(iv);

const args = [
  '--single-transaction',
  '--quick',
  '--routines',
  '--triggers',
  '--set-gtid-purged=OFF',
  '-h', process.env.DB_HOST || 'localhost',
  '-P', String(process.env.DB_PORT || 3306),
  '-u', process.env.DB_USER || '',
  process.env.DB_NAME || ''
];
const dump = spawn(process.env.MYSQLDUMP_BIN || 'mysqldump', args, {
  env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || '' },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true
});
let stderr = '';
dump.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
dump.stdout.pipe(cipher).pipe(output, { end: false });

dump.on('error', (error) => {
  output.destroy();
  fs.rmSync(outputPath, { force: true });
  throw error;
});
dump.on('close', (code) => {
  if (code !== 0) {
    output.destroy();
    fs.rmSync(outputPath, { force: true });
    throw new Error(`mysqldump thất bại: ${stderr.trim() || `exit ${code}`}`);
  }
});
cipher.on('end', () => {
  output.end(cipher.getAuthTag());
});
output.on('finish', () => {
  console.log(`Backup mã hóa đã tạo: ${outputPath}`);
});

