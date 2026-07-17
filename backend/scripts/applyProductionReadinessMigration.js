import { closePool, query } from '../config/db.js';

async function columnExists(tableName, columnName) {
  const rows = await query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function indexExists(tableName, indexName) {
  const rows = await query(
    `SELECT 1
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
     LIMIT 1`,
    [tableName, indexName]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(tableName, columnName, definition) {
  if (!(await columnExists(tableName, columnName))) {
    await query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    return true;
  }
  return false;
}

async function run() {
  await addColumnIfMissing('orders', 'promotion_id', 'INT NULL AFTER order_number');
  await addColumnIfMissing('orders', 'promotion_code_snapshot', 'VARCHAR(20) NULL AFTER promotion_id');
  await addColumnIfMissing('orders', 'promotion_name_snapshot', 'VARCHAR(150) NULL AFTER promotion_code_snapshot');
  await addColumnIfMissing('orders', 'promotion_discount', 'DECIMAL(15,0) NOT NULL DEFAULT 0 AFTER discount');
  await addColumnIfMissing('orders', 'idempotency_key', 'VARCHAR(64) NULL AFTER note');

  if (!(await indexExists('orders', 'uk_orders_user_idempotency'))) {
    await query('ALTER TABLE orders ADD UNIQUE KEY uk_orders_user_idempotency (user_id, idempotency_key)');
  }

  await addColumnIfMissing('order_items', 'purchased_quantity', 'INT NULL AFTER quantity');
  await addColumnIfMissing('order_items', 'gift_quantity', 'INT NOT NULL DEFAULT 0 AFTER purchased_quantity');
  await addColumnIfMissing('order_items', 'cost_price_snapshot', 'DECIMAL(15,0) NULL AFTER unit_price');

  const addedPurchasePaidAmount = await addColumnIfMissing(
    'purchase_orders',
    'paid_amount',
    'DECIMAL(15,0) NOT NULL DEFAULT 0 AFTER total_amount'
  );
  await addColumnIfMissing(
    'purchase_orders',
    'payment_status',
    "ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid' AFTER paid_amount"
  );
  await addColumnIfMissing(
    'purchase_orders',
    'payment_method',
    "ENUM('cash','transfer','other') NULL AFTER payment_status"
  );
  await addColumnIfMissing('purchase_orders', 'due_date', 'DATE NULL AFTER payment_method');
  await addColumnIfMissing('purchase_orders', 'paid_at', 'DATETIME NULL AFTER due_date');

  if (addedPurchasePaidAmount) {
    await query(
      `UPDATE purchase_orders
       SET paid_amount = CASE WHEN status = 'completed' THEN total_amount ELSE 0 END,
           payment_status = CASE WHEN status = 'completed' THEN 'paid' ELSE 'unpaid' END,
           payment_method = CASE WHEN status = 'completed' THEN 'other' ELSE NULL END,
           paid_at = CASE WHEN status = 'completed' THEN created_at ELSE NULL END`
    );
  }

  if (!(await indexExists('purchase_orders', 'idx_purchase_orders_payment_status'))) {
    await query('ALTER TABLE purchase_orders ADD INDEX idx_purchase_orders_payment_status (payment_status, due_date)');
  }

  await query('UPDATE order_items SET purchased_quantity = quantity WHERE purchased_quantity IS NULL');
  await query(
    `UPDATE order_items oi
     JOIN products p ON p.id = oi.product_id
     SET oi.cost_price_snapshot = COALESCE(oi.cost_price_snapshot, p.cost_price, 0)
     WHERE oi.cost_price_snapshot IS NULL`
  );

  const promotions = await query('SELECT id, data FROM promotions');
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  for (const row of promotions) {
    try {
      const data = JSON.parse(row.data || '{}');
      const status = data.endDate && data.endDate < today
        ? 'expired'
        : data.enabled === false
          ? 'inactive'
          : 'active';
      await query(
        `UPDATE promotions
         SET promotion_name = COALESCE(NULLIF(?, ''), promotion_name),
             start_date = COALESCE(?, start_date),
             end_date = COALESCE(?, end_date),
             status = ?
         WHERE id = ?`,
        [
          String(data.name || '').trim(),
          data.startDate ? `${data.startDate} 00:00:00` : null,
          data.endDate ? `${data.endDate} 23:59:59` : null,
          status,
          row.id
        ]
      );
    } catch {
      await query("UPDATE promotions SET status = 'inactive' WHERE id = ?", [row.id]);
    }
  }

  console.log('Production readiness migration applied');
  await closePool();
}

run().catch((error) => {
  console.error('Production readiness migration failed:', error.message);
  process.exitCode = 1;
  closePool().catch(() => {});
});
