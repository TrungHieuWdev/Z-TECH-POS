import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const requestedMigration = process.argv[2] || 'migration_add_pos_business_tables.sql';
const migrationPath = path.resolve(scriptDirectory, '../../database', requestedMigration);
const databaseDirectory = path.resolve(scriptDirectory, '../../database');

if (!migrationPath.startsWith(`${databaseDirectory}${path.sep}`)) {
  throw new Error('Migration path must stay inside the database directory.');
}

function parseStatements(sql) {
  const statements = [];
  let delimiter = ';';
  let buffer = '';

  for (const line of sql.split(/\r?\n/)) {
    const delimiterMatch = line.trim().match(/^DELIMITER\s+(.+)$/i);
    if (delimiterMatch) {
      delimiter = delimiterMatch[1];
      continue;
    }

    buffer += `${line}\n`;
    if (buffer.trimEnd().endsWith(delimiter)) {
      const statement = buffer.trimEnd().slice(0, -delimiter.length).trim();
      if (statement) statements.push(statement);
      buffer = '';
    }
  }

  if (buffer.trim()) statements.push(buffer.trim());
  return statements;
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pos_accessories',
  charset: 'utf8mb4'
});

try {
  const sql = await fs.readFile(migrationPath, 'utf8');
  const statements = parseStatements(sql);

  for (const statement of statements) {
    await connection.query(statement);
  }

  console.log(`Migration completed: ${statements.length} statements applied to ${process.env.DB_NAME || 'pos_accessories'}.`);
} finally {
  await connection.end();
}
