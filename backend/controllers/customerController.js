import { query } from '../config/db.js';

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function isVietnamPhone(value) {
  return /^(03|05|07|08|09)\d{8}$/.test(String(value || '').trim());
}

function getCustomerPayload(body) {
  const phone = normalizePhone(body.phone);

  return {
    name: String(body.name || '').trim(),
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
        FLOOR(COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total ELSE 0 END), 0) / 10000) AS points
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

export async function getById(req, res) {
  try {
    const customers = await query(
      `SELECT
        c.*,
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total ELSE 0 END), 0) AS total_spent,
        COUNT(CASE WHEN o.status = 'completed' THEN o.id END) AS order_count,
        FLOOR(COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total ELSE 0 END), 0) / 10000) AS points
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

    if (!name) {
      return res.status(400).json({ message: 'Tên khách hàng là bắt buộc' });
    }

    if (!isVietnamPhone(phone)) {
      return res.status(400).json({ message: 'Số điện thoại Việt Nam phải gồm 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09' });
    }

    const result = await query(
      'INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)',
      [name, phone, email, address]
    );
    const created = await query('SELECT * FROM customers WHERE id = ?', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (error) {
    res.status(500).json({ message: 'Không thể tạo khách hàng', error: error.message });
  }
}

export async function update(req, res) {
  try {
    const { name, phone, email, address } = getCustomerPayload(req.body);

    if (!name) {
      return res.status(400).json({ message: 'Tên khách hàng là bắt buộc' });
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

    const updated = await query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
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
