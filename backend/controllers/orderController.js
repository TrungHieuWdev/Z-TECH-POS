import { query } from '../config/db.js';

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
    const { customer_id = null, items = [], discount = 0, payment_method = 'cash', note = '' } = req.body;

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
        'SELECT id, name, price, stock_quantity FROM products WHERE id = ? AND is_active = 1',
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
      orderItems.push({ product_id: product.id, quantity, unit_price: unitPrice, subtotal: lineTotal });
    }

    const discountValue = Math.max(Number(discount) || 0, 0);
    const total = Math.max(subtotal - discountValue, 0);
    const orderNumber = await buildOrderNumber();

    const orderResult = await query(
      `INSERT INTO orders
        (customer_id, user_id, order_number, subtotal, discount, total, payment_method, status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
      [customer_id || null, req.user.id, orderNumber, subtotal, discountValue, total, payment_method, note]
    );

    for (const item of orderItems) {
      await query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)',
        [orderResult.insertId, item.product_id, item.quantity, item.unit_price, item.subtotal]
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
