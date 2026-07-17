import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { getJwtSecret } from '../config/auth.js';

dotenv.config();
let connection;

before(async () => {
  connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pos_accessories'
  });
});
after(async () => connection?.end());

test('auth token round-trip keeps the authenticated user identity', () => {
  const jwtSecret = getJwtSecret();
  const token = jwt.sign({ id: 123, role: 'admin' }, jwtSecret, { expiresIn: '1m' });
  assert.deepEqual(jwt.verify(token, jwtSecret).id, 123);
});

test('business migration created all required tables and columns', async () => {
  const required = ['roles','brands','suppliers','purchase_orders','purchase_order_items','payments','warranties','warranty_claims','promotions','promotion_products','promotion_categories','shift_store','system_activity_logs','ai_report_analysis_results'];
  const [tables] = await connection.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
  const names = new Set(tables.map((row) => row.TABLE_NAME));
  assert.deepEqual(required.filter((name) => !names.has(name)), []);
  const [typeRows] = await connection.query("SHOW COLUMNS FROM inventory_logs LIKE 'type'");
  assert.match(typeRows[0].Type, /IMPORT.*SALE.*ADJUSTMENT.*RETURN.*WARRANTY.*CANCEL_ORDER/);
  const [purchaseOrderColumns] = await connection.query('SHOW COLUMNS FROM purchase_orders');
  const purchaseOrderColumnNames = new Set(purchaseOrderColumns.map((column) => column.Field));
  for (const requiredColumn of ['paid_amount', 'payment_status', 'payment_method', 'due_date', 'paid_at']) {
    assert.ok(purchaseOrderColumnNames.has(requiredColumn), `missing purchase_orders.${requiredColumn}`);
  }
});

test('old AI restock log table was replaced by AI report result storage', async () => {
  const [oldTables] = await connection.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_restock_suggestion_logs'"
  );
  assert.equal(oldTables.length, 0);

  const [columns] = await connection.query('SHOW COLUMNS FROM ai_report_analysis_results');
  const names = new Set(columns.map((column) => column.Field));
  for (const required of ['analysis_key', 'filters_json', 'result_json', 'executive_summary', 'health_score', 'provider', 'model', 'analyzed_at']) {
    assert.ok(names.has(required), `missing ${required}`);
  }
});

test('order sale inventory and payment changes roll back atomically', async () => {
  await connection.beginTransaction();
  try {
    const [users] = await connection.query('SELECT id FROM users LIMIT 1');
    const [products] = await connection.query('SELECT id,stock_quantity FROM products LIMIT 1 FOR UPDATE');
    assert.ok(users[0] && products[0]);
    const [order] = await connection.query(`INSERT INTO orders
      (customer_id,user_id,order_number,subtotal,discount,total,payment_method,status)
      VALUES (NULL,?,CONCAT('T-',LEFT(REPLACE(UUID(),'-',''),16)),1000,0,1000,'cash','completed')`, [users[0].id]);
    await connection.query(`INSERT INTO payments (order_id,payment_method,amount,paid_amount,change_amount,status,paid_at)
      VALUES (?,'cash',1000,1000,0,'completed',NOW())`, [order.insertId]);
    await connection.query('UPDATE products SET stock_quantity=stock_quantity-1 WHERE id=?', [products[0].id]);
    await connection.query(`INSERT INTO inventory_logs
      (product_id,user_id,type,quantity,before_quantity,after_quantity,reference_type,reference_id)
      VALUES (?,?,'SALE',1,?,?,'ORDER',?)`, [products[0].id, users[0].id, products[0].stock_quantity, products[0].stock_quantity - 1, order.insertId]);
    const [payments] = await connection.query('SELECT id FROM payments WHERE order_id=?', [order.insertId]);
    assert.equal(payments.length, 1);
  } finally { await connection.rollback(); }
});

test('inventory import transaction stores before and after quantities', async () => {
  await connection.beginTransaction();
  try {
    const [users] = await connection.query('SELECT id FROM users LIMIT 1');
    const [products] = await connection.query('SELECT id,stock_quantity FROM products LIMIT 1 FOR UPDATE');
    const before = Number(products[0].stock_quantity); const afterQuantity = before + 2;
    const [log] = await connection.query(`INSERT INTO inventory_logs
      (product_id,user_id,type,quantity,before_quantity,after_quantity,reference_type)
      VALUES (?,?,'IMPORT',2,?,?,'TEST')`, [products[0].id, users[0].id, before, afterQuantity]);
    const [rows] = await connection.query('SELECT before_quantity,after_quantity FROM inventory_logs WHERE id=?', [log.insertId]);
    assert.deepEqual([rows[0].before_quantity, rows[0].after_quantity], [before, afterQuantity]);
  } finally { await connection.rollback(); }
});

test('promotion can be persisted without overwriting existing data', async () => {
  await connection.beginTransaction();
  try {
    const code = `TEST${Date.now()}`.slice(0, 20);
    await connection.query("INSERT INTO promotions (code,promotion_name,data,status) VALUES (?,?,'{}','draft')", [code, 'Integration test']);
    const [rows] = await connection.query('SELECT promotion_name FROM promotions WHERE code=?', [code]);
    assert.equal(rows[0].promotion_name, 'Integration test');
  } finally { await connection.rollback(); }
});
