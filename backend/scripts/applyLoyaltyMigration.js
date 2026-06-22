import { query } from '../config/db.js';

async function columnExists(table, column) {
  const rows = await query(
    'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
    [table, column]
  );
  return rows.length > 0;
}

async function run() {
  const hadLoyaltyPoints = await columnExists('customers', 'loyalty_points');
  if (!hadLoyaltyPoints) {
    await query('ALTER TABLE customers ADD COLUMN loyalty_points INT NOT NULL DEFAULT 0 AFTER address');
  }

  const orderColumns = [
    ['points_used', 'INT NOT NULL DEFAULT 0 AFTER discount'],
    ['points_discount_amount', 'DECIMAL(15,0) NOT NULL DEFAULT 0 AFTER points_used'],
    ['points_earned', 'INT NOT NULL DEFAULT 0 AFTER points_discount_amount']
  ];
  for (const [name, definition] of orderColumns) {
    if (!(await columnExists('orders', name))) {
      await query(`ALTER TABLE orders ADD COLUMN ${name} ${definition}`);
    }
  }

  if (!hadLoyaltyPoints) {
    await query(`
      UPDATE customers c
      LEFT JOIN (
        SELECT customer_id, FLOOR(SUM(total) / 10000) AS earned
        FROM orders
        WHERE status = 'completed' AND customer_id IS NOT NULL
        GROUP BY customer_id
      ) history ON history.customer_id = c.id
      SET c.loyalty_points = COALESCE(history.earned, 0)
    `);
  }

  const customers = await query('SELECT id, name, loyalty_points AS points FROM customers ORDER BY id');
  console.table(customers);
  console.log('Đã sẵn sàng dữ liệu điểm tích lũy.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
