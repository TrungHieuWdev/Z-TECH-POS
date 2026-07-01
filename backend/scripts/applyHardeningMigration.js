import { query } from '../config/db.js';

async function columnExists(tableName, columnName) {
  const rows = await query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1",
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(tableName, columnName, definition) {
  if (!(await columnExists(tableName, columnName))) {
    await query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function run() {
  await addColumnIfMissing('users', 'phone', 'VARCHAR(20) NULL AFTER email');
  await addColumnIfMissing('users', 'status', "ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER role");
  await addColumnIfMissing('users', 'note', 'TEXT NULL AFTER status');
  await addColumnIfMissing('users', 'last_login_at', 'DATETIME NULL AFTER note');
  await query("ALTER TABLE users MODIFY role ENUM('owner', 'manager', 'employee', 'admin', 'cashier', 'warehouse') DEFAULT 'employee'");

  await addColumnIfMissing('orders', 'vat_rate', 'DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER points_earned');
  await addColumnIfMissing('orders', 'vat_amount', 'DECIMAL(15,0) NOT NULL DEFAULT 0 AFTER vat_rate');

  await addColumnIfMissing('order_items', 'warranty_enabled_snapshot', 'BOOLEAN NULL AFTER subtotal');
  await addColumnIfMissing('order_items', 'warranty_period_days_snapshot', 'INT NULL AFTER warranty_enabled_snapshot');
  await addColumnIfMissing('order_items', 'warranty_type_snapshot', 'VARCHAR(30) NULL AFTER warranty_period_days_snapshot');
  await addColumnIfMissing('order_items', 'warranty_conditions_snapshot', 'TEXT NULL AFTER warranty_type_snapshot');
  await addColumnIfMissing('order_items', 'warranty_exclusions_snapshot', 'TEXT NULL AFTER warranty_conditions_snapshot');
  await addColumnIfMissing('order_items', 'warranty_note_snapshot', 'TEXT NULL AFTER warranty_exclusions_snapshot');
  await addColumnIfMissing('order_items', 'public_token', 'CHAR(36) UNIQUE AFTER warranty_note_snapshot');

  await query("ALTER TABLE device_models MODIFY family ENUM('apple','samsung','vivo','oppo','xiaomi','generic') NOT NULL");
  await query(
    `INSERT INTO device_models (family, name, series, notes)
     VALUES ('generic', 'Phụ kiện chung', 'Dùng chung', 'Không thuộc hãng hoặc model máy cụ thể')
     ON DUPLICATE KEY UPDATE family = 'generic', series = 'Dùng chung'`
  );

  await query(
    `CREATE TABLE IF NOT EXISTS promotions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(20) UNIQUE NOT NULL,
      data LONGTEXT NOT NULL,
      created_by INT NULL,
      updated_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (updated_by) REFERENCES users(id)
    )`
  );

  console.log('Hardening migration applied');
}

run().catch((error) => {
  console.error('Hardening migration failed:', error.message);
  process.exit(1);
});
