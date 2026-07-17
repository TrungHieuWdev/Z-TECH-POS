import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';

const VALID_ROLES = new Set(['employee', 'cashier', 'warehouse']);
const VALID_STATUSES = new Set(['active', 'inactive']);

async function ensureEmployeeSchema() {
  return true;
}

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

function canManageEmployee(requester, employee) {
  if (!employee || Number(requester?.id) === Number(employee.id)) return false;
  return true;
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

export async function getAllEmployees(req, res) {
  try {
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
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    const legacyDate = String(req.query.date || '').slice(0, 10);
    const from = String(req.query.from || legacyDate || today).slice(0, 10);
    const to = String(req.query.to || legacyDate || today).slice(0, 10);
    const status = String(req.query.status || 'all');
    const paymentMethod = String(req.query.paymentMethod || 'all');
    const search = String(req.query.search || '').trim().slice(0, 100);
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (!employeeId) {
      return res.status(400).json({ message: 'Vui lòng chọn nhân viên' });
    }
    if (!datePattern.test(from) || !datePattern.test(to) || from > to) {
      return res.status(400).json({ message: 'Khoảng ngày bán không hợp lệ' });
    }
    if (!['all', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Trạng thái hóa đơn không hợp lệ' });
    }
    if (!['all', 'cash', 'card', 'transfer'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Phương thức thanh toán không hợp lệ' });
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

    const where = [
      'o.user_id = ?',
      'DATE(o.created_at) >= ?',
      'DATE(o.created_at) <= ?'
    ];
    const params = [employeeId, from, to];

    if (status !== 'all') {
      where.push('o.status = ?');
      params.push(status);
    }
    if (paymentMethod !== 'all') {
      where.push('o.payment_method = ?');
      params.push(paymentMethod);
    }
    if (search) {
      const pattern = `%${search}%`;
      where.push(`(
        o.order_number LIKE ?
        OR COALESCE(c.name, '') LIKE ?
        OR EXISTS (
          SELECT 1
          FROM order_items search_item
          JOIN products search_product ON search_product.id = search_item.product_id
          WHERE search_item.order_id = o.id AND search_product.name LIKE ?
        )
      )`);
      params.push(pattern, pattern, pattern);
    }

    const whereSql = where.join(' AND ');
    const [summaryRows, countRows, orders, products] = await Promise.all([
      query(
        `SELECT
           COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total ELSE 0 END), 0) AS revenue,
           SUM(CASE WHEN o.status = 'completed' THEN 1 ELSE 0 END) AS completed_orders,
           SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
           COALESCE(SUM(CASE WHEN o.status = 'completed' THEN (
             SELECT COALESCE(SUM(summary_item.quantity), 0)
             FROM order_items summary_item
             WHERE summary_item.order_id = o.id
           ) ELSE 0 END), 0) AS products_sold,
           COALESCE(AVG(CASE WHEN o.status = 'completed' THEN o.total END), 0) AS average_order_value
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         WHERE ${whereSql}`,
        params
      ),
      query(
        `SELECT COUNT(*) AS total
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         WHERE ${whereSql}`,
        params
      ),
      query(
      `SELECT
         o.id,
         o.order_number,
         o.payment_method,
         o.status,
         o.subtotal,
         o.discount,
         o.vat_amount,
         o.total,
         o.note,
         DATE_FORMAT(o.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
         COALESCE(c.name, 'Khách thường') AS customer_name,
         (SELECT COALESCE(SUM(list_item.quantity), 0) FROM order_items list_item WHERE list_item.order_id = o.id) AS item_quantity
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE ${whereSql}
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
        params
      ),
      query(
      `SELECT
         p.id,
         p.sku,
         p.name,
         SUM(oi.quantity) AS quantity,
         COALESCE(SUM(oi.subtotal), 0) AS revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       LEFT JOIN customers c ON o.customer_id = c.id
       JOIN products p ON oi.product_id = p.id
       WHERE ${whereSql}
         AND o.status = 'completed'
       GROUP BY p.id, p.sku, p.name
       ORDER BY revenue DESC, quantity DESC`,
        params
      )
    ]);

    const summary = summaryRows[0] || {};
    const total = Number(countRows[0]?.total || 0);

    res.json({
      employee: {
        id: employee.id,
        code: employee.employee_code,
        name: employee.name
      },
      date: from === to ? from : null,
      range: { from, to },
      filters: { status, paymentMethod, search },
      summary: {
        revenue: Number(summary.revenue || 0),
        orders: Number(summary.completed_orders || 0),
        completedOrders: Number(summary.completed_orders || 0),
        cancelledOrders: Number(summary.cancelled_orders || 0),
        productsSold: Number(summary.products_sold || 0),
        averageOrderValue: Number(summary.average_order_value || 0)
      },
      orders: orders.map((order) => ({
        ...order,
        subtotal: Number(order.subtotal || 0),
        discount: Number(order.discount || 0),
        vat_amount: Number(order.vat_amount || 0),
        total: Number(order.total || 0),
        item_quantity: Number(order.item_quantity || 0)
      })),
      products: products.map((product) => ({
        ...product,
        quantity: Number(product.quantity || 0),
        revenue: Number(product.revenue || 0)
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
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
    if (password.length < 8) {
      return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 8 ký tự' });
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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [name, employeeCode, email, phone, hashedPassword, role, status, note]
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
    const rows = await query(
      "SELECT * FROM users WHERE id = ? AND role IN ('cashier', 'employee', 'warehouse')",
      [employeeId]
    );
    const current = rows[0];

    if (!current) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }
    if (!canManageEmployee(req.user, current)) {
      return res.status(403).json({ message: 'Bạn không có quyền sửa tài khoản này' });
    }

    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();
    const password = String(req.body.password || '').trim();
    const role = normalizeRole(req.body.role || current.role);
    const status = normalizeStatus(req.body.status || current.status);
    const note = String(req.body.note || '').trim();
    if (!name || !phone) {
      return res.status(400).json({ message: 'Họ tên và số điện thoại là bắt buộc' });
    }

    let hashedPassword = current.password;
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 8 ký tự' });
      }
      hashedPassword = await bcrypt.hash(password, 10);
    }

    await query(
      `UPDATE users
       SET name = ?, phone = ?, password = ?, role = ?, status = ?, note = ?
       WHERE id = ?`,
      [name, phone, hashedPassword, role, status, note, employeeId]
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
    const rows = await query(
      "SELECT id, employee_code, role FROM users WHERE id = ? AND role IN ('cashier', 'employee', 'warehouse')",
      [employeeId]
    );
    const employee = rows[0];

    if (!employee) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }
    if (!canManageEmployee(req.user, employee)) {
      return res.status(403).json({ message: 'Bạn không có quyền đổi mật khẩu tài khoản này' });
    }

    const nextPassword = String(req.body.password || '').trim();
    if (nextPassword.length < 8) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 8 ký tự' });
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
    const rows = await query(
      "SELECT id, status, role FROM users WHERE id = ? AND role IN ('cashier', 'employee', 'warehouse')",
      [employeeId]
    );
    const employee = rows[0];

    if (!employee) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }
    if (!canManageEmployee(req.user, employee)) {
      return res.status(403).json({ message: 'Bạn không có quyền khóa hoặc mở tài khoản này' });
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
      "SELECT id, employee_code, role FROM users WHERE id = ? AND role IN ('cashier', 'employee', 'warehouse')",
      [employeeId]
    );
    const employee = rows[0];

    if (!employee) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }
    if (!canManageEmployee(req.user, employee)) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa tài khoản này' });
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
