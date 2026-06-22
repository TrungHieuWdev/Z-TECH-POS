import { query, withTransaction } from '../config/db.js';
import { randomUUID } from 'node:crypto';
import { hasFullAccess } from '../middleware/auth.js';

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

async function buildOrderNumber(db = query) {
  const rows = await db(`
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
      promotion_discount = 0,
      points_used = 0,
      payment_method = 'cash',
      note = ''
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Đơn hàng cần có ít nhất một sản phẩm' });
    }

    const createdOrder = await withTransaction(async (db) => {
      const orderItems = [];
      let subtotal = 0;

      for (const item of items) {
        const productId = item.product_id;
        const quantity = Math.floor(Number(item.quantity));
        if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
          const error = new Error('Sản phẩm hoặc số lượng không hợp lệ');
          error.status = 400;
          throw error;
        }

        const products = await db(
          'SELECT id, name, price, stock_quantity, warranty_enabled, warranty_period_days, warranty_type, warranty_conditions, warranty_exclusions, warranty_note FROM products WHERE id = ? AND is_active = 1 FOR UPDATE',
          [productId]
        );
        const product = products[0];
        if (!product) {
          const error = new Error(`Không tìm thấy sản phẩm ID ${productId}`);
          error.status = 404;
          throw error;
        }
        if (Number(product.stock_quantity) < quantity) {
          const error = new Error(`Sản phẩm ${product.name} không đủ tồn kho`);
          error.status = 400;
          throw error;
        }

        const unitPrice = Number(product.price);
        const lineTotal = unitPrice * quantity;
        subtotal += lineTotal;
        orderItems.push({ ...product, product_id: product.id, quantity, unit_price: unitPrice, subtotal: lineTotal });
      }

      const promotionDiscount = Math.min(Math.max(Number(promotion_discount) || 0, 0), subtotal);
      const amountAfterPromotion = Math.max(subtotal - promotionDiscount, 0);
      const requestedPoints = Math.floor(Math.max(Number(points_used) || 0, 0));
      let availablePoints = 0;

      if (customer_id) {
        const customers = await db('SELECT id, loyalty_points FROM customers WHERE id = ? FOR UPDATE', [customer_id]);
        if (!customers[0]) {
          const error = new Error('Không tìm thấy khách hàng thành viên');
          error.status = 400;
          throw error;
        }
        availablePoints = Number(customers[0].loyalty_points || 0);
      } else if (requestedPoints > 0) {
        const error = new Error('Chỉ khách hàng thành viên mới được sử dụng điểm');
        error.status = 400;
        throw error;
      }

      const maxRedeemPoints = Math.floor(Math.min(availablePoints, amountAfterPromotion * 0.2 / 1000));
      if (requestedPoints > maxRedeemPoints) {
        const error = new Error(`Chỉ có thể sử dụng tối đa ${maxRedeemPoints} điểm`);
        error.status = 400;
        throw error;
      }

      const pointsDiscountAmount = requestedPoints * 1000;
      const afterPoints = Math.max(amountAfterPromotion - pointsDiscountAmount, 0);
      const total = afterPoints;
      const earnedPoints = customer_id ? Math.floor(total / 10000) : 0;
      const totalDiscount = promotionDiscount + pointsDiscountAmount;
      const orderNumber = await buildOrderNumber(db);

      const orderResult = await db(
        `INSERT INTO orders
          (customer_id, user_id, order_number, subtotal, discount, points_used, points_discount_amount, points_earned, total, payment_method, status, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
        [customer_id || null, req.user.id, orderNumber, subtotal, totalDiscount, requestedPoints, pointsDiscountAmount, earnedPoints, total, payment_method, note]
      );

      for (const item of orderItems) {
        await db(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal, warranty_enabled_snapshot, warranty_period_days_snapshot, warranty_type_snapshot, warranty_conditions_snapshot, warranty_exclusions_snapshot, warranty_note_snapshot, public_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [orderResult.insertId, item.product_id, item.quantity, item.unit_price, item.subtotal, item.warranty_enabled, item.warranty_period_days, item.warranty_type, item.warranty_conditions, item.warranty_exclusions, item.warranty_note, randomUUID()]
        );
        await db('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [item.quantity, item.product_id]);
      }

      if (customer_id) {
        await db(
          'UPDATE customers SET loyalty_points = loyalty_points - ? + ? WHERE id = ? AND loyalty_points >= ?',
          [requestedPoints, earnedPoints, customer_id, requestedPoints]
        );
      }

      const created = await db('SELECT * FROM orders WHERE id = ?', [orderResult.insertId]);
      return created[0];
    });

    res.status(201).json(createdOrder);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Không thể tạo đơn hàng', error: error.message });
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

    if (!hasFullAccess(req.user)) {
      sql += ' AND o.user_id = ?';
      params.push(req.user.id);
    }

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
    const ownerFilter = hasFullAccess(req.user) ? '' : ' AND o.user_id = ?';
    const ownerParams = hasFullAccess(req.user) ? [req.params.id] : [req.params.id, req.user.id];
    const orders = await query(
      `SELECT o.*, c.name AS customer_name, u.name AS cashier_name
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = ?${ownerFilter}`,
      ownerParams
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

    if (status === 'cancelled') {
      const result = await withTransaction(async (db) => {
        const orders = await db('SELECT * FROM orders WHERE id = ? FOR UPDATE', [req.params.id]);
        const order = orders[0];
        if (!order) return { affectedRows: 0 };

        if (order.status === 'completed') {
          const items = await db('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [order.id]);
          for (const item of items) {
            await db('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [item.quantity, item.product_id]);
          }
          if (order.customer_id) {
            await db(
              'UPDATE customers SET loyalty_points = GREATEST(loyalty_points + ? - ?, 0) WHERE id = ?',
              [order.points_used, order.points_earned, order.customer_id]
            );
          }
        }

        return db(
          "UPDATE orders SET status = 'cancelled', payment_method = COALESCE(?, payment_method), note = ? WHERE id = ?",
          [payment_method || null, note, order.id]
        );
      });

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
      }
      const updated = await query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
      return res.json(updated[0]);
    }

    const result = await query(
      'UPDATE orders SET payment_method = COALESCE(?, payment_method), note = ? WHERE id = ?',
      [payment_method || null, note, req.params.id]
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
    const result = await withTransaction(async (db) => {
      const orders = await db('SELECT * FROM orders WHERE id = ? FOR UPDATE', [req.params.id]);
      const order = orders[0];
      if (!order) return { affectedRows: 0 };
      if (order.status === 'cancelled') return { affectedRows: 1 };

      const items = await db('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [order.id]);
      for (const item of items) {
        await db('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [item.quantity, item.product_id]);
      }
      if (order.customer_id) {
        await db(
          'UPDATE customers SET loyalty_points = GREATEST(loyalty_points + ? - ?, 0) WHERE id = ?',
          [order.points_used, order.points_earned, order.customer_id]
        );
      }
      return db("UPDATE orders SET status = 'cancelled' WHERE id = ?", [order.id]);
    });

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    res.json({ message: 'Đã hủy đơn hàng' });
  } catch (error) {
    res.status(500).json({ message: 'Không thể hủy đơn hàng', error: error.message });
  }
}
