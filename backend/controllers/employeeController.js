import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';

const VALID_ROLES = new Set(['owner', 'manager', 'employee', 'admin', 'cashier', 'warehouse']);
const VALID_STATUSES = new Set(['active', 'inactive']);

function normalizeEmployeeCode(value = '') {
  return String(value).trim().toUpperCase();
}

function normalizeRole(value = '') {
  const role = String(value).trim().toLowerCase();
  return VALID_ROLES.has(role) ? role : 'cashier';
}

function normalizeStatus(value = '') {
  const status = String(value).trim().toLowerCase();
  return VALID_STATUSES.has(status) ? status : 'active';
}

function mapEmployee(row) {
  return {
    id: row.id,
    code: row.employee_code,
    name: row.name,
    phone: row.phone || '',
    role: row.role,
    status: row.status || 'active',
    createdAt: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : '',
    lastLoginAt: row.last_login_at ? formatDateTimeForClient(row.last_login_at) : '',
    note: row.note || ''
  };
}

function formatDateTimeForClient(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function ensureEmployeeSchema() {
  await query('ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL AFTER email').catch(ignoreDuplicateColumn);
  await query("ALTER TABLE users ADD COLUMN status ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER role").catch(ignoreDuplicateColumn);
  await query('ALTER TABLE users ADD COLUMN note TEXT NULL AFTER status').catch(ignoreDuplicateColumn);
  await query('ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL AFTER note').catch(ignoreDuplicateColumn);
  await query(
    "ALTER TABLE users MODIFY role ENUM('owner', 'manager', 'employee', 'admin', 'cashier', 'warehouse') DEFAULT 'employee'"
  );
}

function ignoreDuplicateColumn(error) {
  if (error.code !== 'ER_DUP_FIELDNAME') {
    throw error;
  }
}

export async function getAllEmployees(req, res) {
  try {
    await ensureEmployeeSchema();

    const rows = await query(
      `SELECT id, employee_code, name, phone, role, status, note, created_at, last_login_at
       FROM users
       WHERE role IN ('cashier', 'employee', 'warehouse')
       ORDER BY created_at DESC, id DESC`
    );

    res.json(rows.map(mapEmployee));
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy danh sách nhân viên', error: error.message });
  }
}

export async function getEmployeeRevenue(req, res) {
  try {
    const employeeId = Number(req.query.employeeId);
    const saleDate = String(req.query.date || new Date().toISOString().slice(0, 10)).slice(0, 10);

    if (!employeeId) {
      return res.status(400).json({ message: 'Vui lòng chọn nhân viên' });
    }

    const [employee] = await query(
      `SELECT id, employee_code, name
       FROM users
       WHERE id = ? AND role IN ('cashier', 'employee', 'warehouse')`,
      [employeeId]
    );

    if (!employee) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }

    const orders = await query(
      `SELECT
         o.id,
         o.order_number,
         o.payment_method,
         o.total,
         o.created_at,
         COALESCE(c.name, 'Khách lẻ') AS customer_name
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.user_id = ?
         AND o.status = 'completed'
         AND DATE(o.created_at) = ?
       ORDER BY o.created_at DESC`,
      [employeeId, saleDate]
    );

    const products = await query(
      `SELECT
         p.id,
         p.name,
         SUM(oi.quantity) AS quantity,
         COALESCE(SUM(oi.subtotal), 0) AS revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN products p ON oi.product_id = p.id
       WHERE o.user_id = ?
         AND o.status = 'completed'
         AND DATE(o.created_at) = ?
       GROUP BY p.id, p.name
       ORDER BY revenue DESC, quantity DESC`,
      [employeeId, saleDate]
    );

    res.json({
      employee: {
        id: employee.id,
        code: employee.employee_code,
        name: employee.name
      },
      date: saleDate,
      summary: {
        revenue: orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
        orders: orders.length,
        productsSold: products.reduce((sum, product) => sum + Number(product.quantity || 0), 0)
      },
      orders: orders.map((order) => ({ ...order, total: Number(order.total || 0) })),
      products: products.map((product) => ({
        ...product,
        quantity: Number(product.quantity || 0),
        revenue: Number(product.revenue || 0)
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy doanh thu nhân viên', error: error.message });
  }
}

export async function createEmployee(req, res) {
  try {
    await ensureEmployeeSchema();

    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();
    const password = String(req.body.password || '').trim();
    const role = normalizeRole(req.body.role);
    const status = normalizeStatus(req.body.status);
    const note = String(req.body.note || '').trim();

    if (!name || !phone || !password) {
      return res.status(400).json({ message: 'Họ tên, số điện thoại và mật khẩu là bắt buộc' });
    }

    const [{ nextCode }] = await query(
      `SELECT CONCAT('NV', LPAD(COALESCE(MAX(CAST(SUBSTRING(employee_code, 3) AS UNSIGNED)), 0) + 1, 3, '0')) AS nextCode
       FROM users
       WHERE employee_code LIKE 'NV%'`
    );

    const employeeCode = normalizeEmployeeCode(nextCode || 'NV001');
    const email = `${employeeCode.toLowerCase()}@ztech.local`;
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (name, employee_code, email, phone, password, role, status, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, employeeCode, email, phone, hashedPassword, role, status, note, req.body.createdAt || new Date()]
    );

    const [created] = await query(
      `SELECT id, employee_code, name, phone, role, status, note, created_at, last_login_at
       FROM users
       WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json(mapEmployee(created));
  } catch (error) {
    res.status(500).json({ message: 'Không thể tạo nhân viên', error: error.message });
  }
}

export async function updateEmployee(req, res) {
  try {
    await ensureEmployeeSchema();

    const employeeId = Number(req.params.id);
    const rows = await query('SELECT * FROM users WHERE id = ?', [employeeId]);
    const current = rows[0];

    if (!current) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }

    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();
    const password = String(req.body.password || '').trim();
    const role = normalizeRole(req.body.role || current.role);
    const status = normalizeStatus(req.body.status || current.status);
    const note = String(req.body.note || '').trim();
    const createdAt = req.body.createdAt || current.created_at;
    const lastLoginAt = req.body.lastLoginAt || current.last_login_at || null;

    if (!name || !phone) {
      return res.status(400).json({ message: 'Họ tên và số điện thoại là bắt buộc' });
    }

    let hashedPassword = current.password;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    await query(
      `UPDATE users
       SET name = ?, phone = ?, password = ?, role = ?, status = ?, note = ?, created_at = ?, last_login_at = ?
       WHERE id = ?`,
      [name, phone, hashedPassword, role, status, note, createdAt, lastLoginAt || null, employeeId]
    );

    const [updated] = await query(
      `SELECT id, employee_code, name, phone, role, status, note, created_at, last_login_at
       FROM users
       WHERE id = ?`,
      [employeeId]
    );

    res.json(mapEmployee(updated));
  } catch (error) {
    res.status(500).json({ message: 'Không thể cập nhật nhân viên', error: error.message });
  }
}

export async function resetEmployeePassword(req, res) {
  try {
    await ensureEmployeeSchema();

    const employeeId = Number(req.params.id);
    const rows = await query('SELECT id, employee_code FROM users WHERE id = ?', [employeeId]);
    const employee = rows[0];

    if (!employee) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }

    const nextPassword = String(req.body.password || '').trim();
    if (nextPassword.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    const hashedPassword = await bcrypt.hash(nextPassword, 10);

    await query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, employeeId]);

    res.json({ message: 'Đã đổi mật khẩu', code: employee.employee_code });
  } catch (error) {
    res.status(500).json({ message: 'Không thể đặt lại mật khẩu', error: error.message });
  }
}

export async function toggleEmployeeStatus(req, res) {
  try {
    await ensureEmployeeSchema();

    const employeeId = Number(req.params.id);
    const rows = await query('SELECT id, status FROM users WHERE id = ?', [employeeId]);
    const employee = rows[0];

    if (!employee) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }

    const nextStatus = employee.status === 'active' ? 'inactive' : 'active';
    await query('UPDATE users SET status = ? WHERE id = ?', [nextStatus, employeeId]);

    res.json({ message: 'Đã cập nhật trạng thái', status: nextStatus });
  } catch (error) {
    res.status(500).json({ message: 'Không thể cập nhật trạng thái nhân viên', error: error.message });
  }
}

export async function deleteEmployee(req, res) {
  try {
    await ensureEmployeeSchema();

    const employeeId = Number(req.params.id);
    const rows = await query(
      "SELECT id, employee_code FROM users WHERE id = ? AND role IN ('cashier', 'employee', 'warehouse')",
      [employeeId]
    );
    const employee = rows[0];

    if (!employee) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }

    await query('DELETE FROM users WHERE id = ?', [employeeId]);
    res.json({ message: 'Đã xóa nhân viên', code: employee.employee_code });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(409).json({
        message: 'Không thể xóa nhân viên đã phát sinh đơn hàng hoặc lịch sử kho. Hãy khóa tài khoản để giữ nguyên dữ liệu.'
      });
    }

    res.status(500).json({ message: 'Không thể xóa nhân viên', error: error.message });
  }
}
