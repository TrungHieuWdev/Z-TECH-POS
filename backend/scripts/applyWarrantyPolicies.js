import { query } from '../config/db.js';
import { getDefaultWarrantyPolicy } from '../utils/warrantyPolicy.js';

const warrantyColumns = [
  ['warranty_enabled', 'BOOLEAN DEFAULT FALSE'],
  ['warranty_period_days', 'INT DEFAULT 0'],
  ["warranty_type", "ENUM('replace', 'repair', 'manufacturer', 'initial_exchange', 'none') DEFAULT 'none'"],
  ['warranty_conditions', 'TEXT'],
  ['warranty_exclusions', 'TEXT'],
  ['warranty_note', 'TEXT']
];

async function columnExists(columnName) {
  const rows = await query(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'products'
       AND COLUMN_NAME = ?`,
    [columnName]
  );

  return Number(rows[0]?.count || 0) > 0;
}

async function ensureWarrantyColumns() {
  for (const [columnName, definition] of warrantyColumns) {
    if (await columnExists(columnName)) {
      continue;
    }

    await query(`ALTER TABLE products ADD COLUMN ${columnName} ${definition}`);
    console.log(`Added products.${columnName}`);
  }
}

async function applyPolicies() {
  const products = await query(`
    SELECT p.id, p.name, p.warranty_note, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = 1
  `);

  let updated = 0;

  for (const product of products) {
    const policy = getDefaultWarrantyPolicy(product);

    await query(
      `UPDATE products
       SET warranty_enabled = ?,
           warranty_period_days = ?,
           warranty_type = ?,
           warranty_conditions = ?,
           warranty_exclusions = ?,
           warranty_note = ?
       WHERE id = ?`,
      [
        policy.warranty_enabled,
        policy.warranty_period_days,
        policy.warranty_type,
        policy.warranty_conditions,
        policy.warranty_exclusions,
        policy.warranty_note,
        product.id
      ]
    );

    updated += 1;
  }

  console.log(`Applied warranty policies to ${updated} products.`);
  console.log('Note: map "Miếng dán PPF / Miếng dán lưng" separately from "Phụ kiện tiện ích" when refining categories.');
}

try {
  await ensureWarrantyColumns();
  await applyPolicies();
  process.exit(0);
} catch (error) {
  console.error('Cannot apply warranty policies:', error);
  process.exit(1);
}
