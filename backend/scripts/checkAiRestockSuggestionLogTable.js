import { query } from '../config/db.js';

const columns = await query(`
  SELECT COLUMN_NAME
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ai_restock_suggestion_logs'
  ORDER BY ORDINAL_POSITION
`);

console.log(`ai_restock_suggestion_logs columns: ${columns.map((row) => row.COLUMN_NAME).join(', ')}`);
process.exit(0);
