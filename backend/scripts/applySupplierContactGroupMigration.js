import { query } from '../config/db.js';

async function addColumnIfMissing(column, definition) {
  const rows = await query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'suppliers' AND COLUMN_NAME = ?`,
    [column]
  );
  if (!rows.length) await query(`ALTER TABLE suppliers ADD COLUMN ${definition}`);
}

try {
  await addColumnIfMissing('supplier_group', 'supplier_group VARCHAR(100) NULL AFTER supplier_name');
  await addColumnIfMissing('contact_name', 'contact_name VARCHAR(100) NULL AFTER supplier_group');
  console.log('Supplier contact/group migration applied');
  process.exit(0);
} catch (error) {
  console.error('Supplier contact/group migration failed:', error.message);
  process.exit(1);
}
