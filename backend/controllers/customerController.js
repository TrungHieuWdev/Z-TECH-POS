import { query } from '../config/db.js';

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function isVietnamPhone(value) {
  return /^(03|05|07|08|09)\d{8}$/.test(String(value || '').trim());
}

const customerNameMessage =
  'Ten khach hang phai tu 2-100 ky tu, chi gom chu cai, khoang trang va dau cham';

function normalizeCustomerName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function isValidCustomerName(value) {
  const name = normalizeCustomerName(value);

  if (name.length < 2 || name.length > 100) {
    return false;
  }

  return /^(?=.*\p{L})[\p{L} .]+$/u.test(name);
}

function getCustomerPayload(body) {
  const phone = normalizePhone(body.phone);

  return {
    name: normalizeCustomerName(body.name),
    phone,
    email: String(body.email || '').trim(),
    address: String(body.address || '').trim()
  };
}

export async function getAll(req, res) {
  try {
    const { search } = req.query;
    const params = [];
    let sql = `
      SELECT
        c.*,
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total ELSE 0 END), 0) AS total_spent,
        COUNT(CASE WHEN o.status = 'completed' THEN o.id END) AS order_count,
        MAX(CASE WHEN o.status = 'completed' THEN o.created_at END) AS last_purchase_at,
        c.loyalty_points AS points
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      WHERE 1 = 1
    `;

    if (search) {
      sql += ' AND (c.name LIKE ? OR c.phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' GROUP BY c.id ORDER BY c.created_at DESC';

    const customers = await query(sql, params);
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy khách hàng', error: error.message });
  }
}

export async function getDetails(req, res) {
  try {
    const customers = await query(
      `SELECT c.*, c.loyalty_points AS points,
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total ELSE 0 END), 0) AS total_spent,
        COUNT(CASE WHEN o.status = 'completed' THEN o.id END) AS order_count,
        MAX(CASE WHEN o.status = 'completed' THEN o.created_at END) AS last_purchase_at
       FROM customers c
       LEFT JOIN orders o ON o.customer_id = c.id
       WHERE c.id = ?
       GROUP BY c.id`,
      [req.params.id]
    );
    if (!customers[0]) return res.status(404).json({ message: 'Không tìm thấy khách hàng' });

    const orders = await query(
      `SELECT id, order_number, total, status, points_used, points_earned, payment_method, created_at
       FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 30`,
      [req.params.id]
    );
    const warranties = await query(
      `SELECT oi.id, o.order_number, o.created_at AS purchased_at, p.name AS product_name,
        COALESCE(oi.warranty_enabled_snapshot, p.warranty_enabled) AS warranty_enabled,
        COALESCE(oi.warranty_period_days_snapshot, p.warranty_period_days) AS warranty_period_days
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       WHERE o.customer_id = ?
         AND COALESCE(oi.warranty_enabled_snapshot, p.warranty_enabled) = 1
       ORDER BY o.created_at DESC LIMIT 30`,
      [req.params.id]
    );

    res.json({ customer: customers[0], orders, warranties });
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy chi tiết khách hàng', error: error.message });
  }
}

export async function getById(req, res) {
  try {
    const customers = await query(
      `SELECT
        c.*,
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total ELSE 0 END), 0) AS total_spent,
        COUNT(CASE WHEN o.status = 'completed' THEN o.id END) AS order_count,
        c.loyalty_points AS points
       FROM customers c
       LEFT JOIN orders o ON o.customer_id = c.id
       WHERE c.id = ?
       GROUP BY c.id`,
      [req.params.id]
    );

    if (!customers[0]) {
      return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
    }

    res.json(customers[0]);
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy khách hàng', error: error.message });
  }
}

export async function create(req, res) {
  try {
    const { name, phone, email, address } = getCustomerPayload(req.body);

    if (!isValidCustomerName(name)) {
      return res.status(400).json({ message: customerNameMessage });
    }

    if (!isVietnamPhone(phone)) {
      return res.status(400).json({ message: 'Số điện thoại Việt Nam phải gồm 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09' });
    }

    const result = await query(
      'INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)',
      [name, phone, email, address]
    );
    const created = await query('SELECT *, loyalty_points AS points FROM customers WHERE id = ?', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (error) {
    res.status(500).json({ message: 'Không thể tạo khách hàng', error: error.message });
  }
}

export async function update(req, res) {
  try {
    const { name, phone, email, address } = getCustomerPayload(req.body);

    if (!isValidCustomerName(name)) {
      return res.status(400).json({ message: customerNameMessage });
    }

    if (!isVietnamPhone(phone)) {
      return res.status(400).json({ message: 'Số điện thoại Việt Nam phải gồm 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09' });
    }

    const result = await query(
      'UPDATE customers SET name = ?, phone = ?, email = ?, address = ? WHERE id = ?',
      [name, phone, email, address, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
    }

    const updated = await query('SELECT *, loyalty_points AS points FROM customers WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ message: 'Không thể cập nhật khách hàng', error: error.message });
  }
}

export async function remove(req, res) {
  try {
    const result = await query('DELETE FROM customers WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
    }

    res.json({ message: 'Đã xóa khách hàng' });
  } catch (error) {
    res.status(400).json({ message: 'Không thể xóa khách hàng đã có đơn hàng', error: error.message });
  }
}
