import { query } from '../config/db.js';

const requiredTables = [
  'roles', 'brands', 'suppliers', 'purchase_orders', 'purchase_order_items',
  'payments', 'warranties', 'warranty_claims', 'promotions',
  'promotion_products', 'promotion_categories', 'shift_store', 'system_activity_logs'
];

const expectedColumns = {
  products: ['brand_id', 'max_stock'],
  users: ['role_id'],
  inventory_logs: ['before_quantity', 'after_quantity', 'reference_type', 'reference_id', 'type']
};

const tables = await query(
  'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
);
const tableNames = new Set(tables.map((row) => row.TABLE_NAME));
const missingTables = requiredTables.filter((table) => !tableNames.has(table));

const columns = await query(
  `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
   FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('products', 'users', 'inventory_logs')`
);
const columnKeys = new Set(columns.map((row) => `${row.TABLE_NAME}.${row.COLUMN_NAME}`));
const missingColumns = Object.entries(expectedColumns).flatMap(([table, names]) =>
  names.filter((name) => !columnKeys.has(`${table}.${name}`)).map((name) => `${table}.${name}`)
);
const inventoryType = columns.find(
  (row) => row.TABLE_NAME === 'inventory_logs' && row.COLUMN_NAME === 'type'
);

console.log(`Required tables: ${requiredTables.length - missingTables.length}/${requiredTables.length}`);
console.log(`Required columns: ${8 - missingColumns.length}/8`);
console.log(`inventory_logs.type: ${inventoryType?.COLUMN_TYPE || 'missing'}`);

if (missingTables.length || missingColumns.length) {
  if (missingTables.length) console.error(`Missing tables: ${missingTables.join(', ')}`);
  if (missingColumns.length) console.error(`Missing columns: ${missingColumns.join(', ')}`);
  process.exit(1);
}

process.exit(0);
