import { query } from '../config/db.js';
import { randomUUID } from 'node:crypto';

let warrantySnapshotReady = false;
async function ensureWarrantySnapshotColumns() {
  if (warrantySnapshotReady) return;
  const columns = [
    ['warranty_enabled_snapshot', 'BOOLEAN NULL'], ['warranty_period_days_snapshot', 'INT NULL'],
    ['warranty_type_snapshot', "VARCHAR(30) NULL"], ['warranty_conditions_snapshot', 'TEXT NULL'],
    ['warranty_exclusions_snapshot', 'TEXT NULL'], ['warranty_note_snapshot', 'TEXT NULL'],
    ['public_token', 'CHAR(36) NULL UNIQUE']
  ];
  for (const [name, definition] of columns) {
    const found = await query("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items' AND COLUMN_NAME = ?", [name]);
    if (!found.length) await query(`ALTER TABLE order_items ADD COLUMN ${name} ${definition}`);
  }
  await query(`UPDATE order_items oi JOIN products p ON p.id = oi.product_id SET oi.warranty_enabled_snapshot = p.warranty_enabled, oi.warranty_period_days_snapshot = p.warranty_period_days, oi.warranty_type_snapshot = p.warranty_type, oi.warranty_conditions_snapshot = p.warranty_conditions, oi.warranty_exclusions_snapshot = p.warranty_exclusions, oi.warranty_note_snapshot = p.warranty_note WHERE oi.warranty_enabled_snapshot IS NULL`);
  warrantySnapshotReady = true;
}

async function buildOrderNumber() {
  const rows = await query(`
    SELECT
      DATE_FORMAT(NOW(), '%Y%m%d') AS date_part,
      COALESCE(MAX(CAST(SUBSTRING_INDEX(order_number, '-', -1) AS UNSIGNED)), 0) AS max_number
    FROM orders
    WHERE order_number LIKE CONCAT('ORD-', DATE_FORMAT(NOW(), '%Y%m%d'), '-%')
  `);
  const datePart = rows[0].date_part;
  const nextNumber = Number(rows[0].max_number || 0) + 1;

  return `ORD-${datePart}-${String(nextNumber).padStart(4, '0')}`;
}

export async function create(req, res) {
  try {
    await ensureWarrantySnapshotColumns();
    const {
      customer_id = null,
      items = [],
      discount = 0,
      vat_percent = 0,
      payment_method = 'cash',
      note = ''
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Đơn hàng cần có ít nhất một sản phẩm' });
    }

    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const productId = item.product_id;
      const quantity = Number(item.quantity);

      if (!productId || quantity <= 0) {
        return res.status(400).json({ message: 'Sản phẩm hoặc số lượng không hợp lệ' });
      }

      const products = await query(
        'SELECT id, name, price, stock_quantity, warranty_enabled, warranty_period_days, warranty_type, warranty_conditions, warranty_exclusions, warranty_note FROM products WHERE id = ? AND is_active = 1',
        [productId]
      );
      const product = products[0];

      if (!product) {
        return res.status(404).json({ message: `Không tìm thấy sản phẩm ID ${productId}` });
      }

      if (Number(product.stock_quantity) < quantity) {
        return res.status(400).json({ message: `Sản phẩm ${product.name} không đủ tồn kho` });
      }

      const unitPrice = Number(product.price);
      const lineTotal = unitPrice * quantity;
      subtotal += lineTotal;
      orderItems.push({ ...product, product_id: product.id, quantity, unit_price: unitPrice, subtotal: lineTotal });
    }

    const discountValue = Math.max(Number(discount) || 0, 0);
    const vatPercentValue = Math.max(Number(vat_percent) || 0, 0);
    const taxableTotal = Math.max(subtotal - discountValue, 0);
    const vatAmount = Math.round((taxableTotal * vatPercentValue) / 100);
    const total = taxableTotal + vatAmount;
    const orderNumber = await buildOrderNumber();

    const orderResult = await query(
      `INSERT INTO orders
        (customer_id, user_id, order_number, subtotal, discount, total, payment_method, status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
      [customer_id || null, req.user.id, orderNumber, subtotal, discountValue, total, payment_method, note]
    );

    for (const item of orderItems) {
      await query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal, warranty_enabled_snapshot, warranty_period_days_snapshot, warranty_type_snapshot, warranty_conditions_snapshot, warranty_exclusions_snapshot, warranty_note_snapshot, public_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderResult.insertId, item.product_id, item.quantity, item.unit_price, item.subtotal, item.warranty_enabled, item.warranty_period_days, item.warranty_type, item.warranty_conditions, item.warranty_exclusions, item.warranty_note, randomUUID()]
      );

      await query(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    const created = await query('SELECT * FROM orders WHERE id = ?', [orderResult.insertId]);
    res.status(201).json(created[0]);
  } catch (error) {
    res.status(500).json({ message: 'Không thể tạo đơn hàng', error: error.message });
  }
}

export async function getAll(req, res) {
  try {
    const { date_from, date_to } = req.query;
    const params = [];
    let sql = `
      SELECT o.*, c.name AS customer_name, u.name AS cashier_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE 1 = 1
    `;

    if (date_from) {
      sql += ' AND DATE(o.created_at) >= ?';
      params.push(date_from);
    }

    if (date_to) {
      sql += ' AND DATE(o.created_at) <= ?';
      params.push(date_to);
    }

    sql += ' ORDER BY o.created_at DESC';

    const orders = await query(sql, params);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy đơn hàng', error: error.message });
  }
}

export async function getById(req, res) {
  try {
    const orders = await query(
      `SELECT o.*, c.name AS customer_name, u.name AS cashier_name
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`,
      [req.params.id]
    );

    if (!orders[0]) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const items = await query(
      `SELECT oi.*, p.name AS product_name
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [req.params.id]
    );

    res.json({ ...orders[0], items });
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy chi tiết đơn hàng', error: error.message });
  }
}

export async function update(req, res) {
  try {
    const { status, payment_method, note = '' } = req.body;
    const allowedStatus = ['completed', 'cancelled'];

    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({ message: 'Trạng thái đơn hàng không hợp lệ' });
    }

    const result = await query(
      'UPDATE orders SET status = COALESCE(?, status), payment_method = COALESCE(?, payment_method), note = ? WHERE id = ?',
      [status || null, payment_method || null, note, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const updated = await query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ message: 'Không thể cập nhật đơn hàng', error: error.message });
  }
}

export async function remove(req, res) {
  try {
    const result = await query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    res.json({ message: 'Đã hủy đơn hàng' });
  } catch (error) {
    res.status(500).json({ message: 'Không thể hủy đơn hàng', error: error.message });
  }
}
