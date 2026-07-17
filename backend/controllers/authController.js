import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { getJwtExpiresIn, getJwtSecret } from '../config/auth.js';
import { hasActiveShift } from '../services/shiftService.js';

function normalizeEmployeeCode(value = '') {
  return String(value).trim().toUpperCase();
}

function normalizeEmail(value = '') {
  return String(value).trim().toLowerCase();
}

export async function login(req, res) {
  try {
    const rawIdentifier = req.body.employeeCode ?? req.body.email ?? req.body.identifier;
    const employeeCode = normalizeEmployeeCode(rawIdentifier);
    const email = normalizeEmail(rawIdentifier);
    const password = String(req.body.password || '');

    if (!employeeCode || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập mã nhân viên và mật khẩu' });
    }

    const users = await query(
      `SELECT id, name, email, employee_code, password, role, status
       FROM users
       WHERE employee_code = ? OR email = ?
       LIMIT 1`,
      [employeeCode, email]
    );
    const user = users[0];

    if (!user) {
      return res.status(401).json({ message: 'Mật khẩu hoặc mã đăng nhập bạn nhập bị sai' });
    }

    if (String(user.status || 'active').toLowerCase() !== 'active') {
      return res.status(403).json({ message: 'Tài khoản nhân viên đang bị khóa' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Mật khẩu hoặc mã đăng nhập bạn nhập bị sai' });
    }

    const fullAccess = ['owner', 'manager', 'admin'].includes(String(user.role || '').toLowerCase());
    if (!fullAccess && !(await hasActiveShift(user))) {
      return res.status(403).json({ message: 'Quản lý cần mở và bắt đầu ca làm trước khi nhân viên đăng nhập' });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      employeeCode: user.employee_code || employeeCode,
      role: user.role
    };

    const token = jwt.sign(
      safeUser,
      getJwtSecret(),
      { expiresIn: getJwtExpiresIn() }
    );

    await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]).catch(() => {});

    res.json({ token, user: safeUser });
  } catch (error) {
    if (error.code === 'ER_BAD_FIELD_ERROR' && String(error.message || '').includes('employee_code')) {
      return res.status(500).json({
        message: 'Thiếu cột employee_code trong bảng users',
        error: 'Hãy cập nhật database/schema.sql và thêm cột employee_code vào MySQL'
      });
    }

    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      return res.status(500).json({
        message: 'Không kết nối được MySQL',
        error: 'Kiểm tra DB_USER và DB_PASSWORD trong backend/.env'
      });
    }

    res.status(500).json({ message: 'Không thể đăng nhập', error: error.message });
  }
}

export async function getMe(req, res) {
  try {
    const rows = await query(
      `SELECT id, name, email, employee_code, role, last_login_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [req.user.id]
    );
    const user = rows[0];

    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      employeeCode: user.employee_code,
      role: user.role,
      lastLoginAt: user.last_login_at || null
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải thông tin tài khoản', error: error.message });
  }
}

export async function changePassword(req, res) {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    const confirmPassword = String(req.body.confirmPassword || '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin mật khẩu' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 8 ký tự' });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ message: 'Mật khẩu mới phải khác mật khẩu hiện tại' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Xác nhận mật khẩu mới không trùng khớp' });
    }

    const rows = await query('SELECT id, password FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Không thể đổi mật khẩu', error: error.message });
  }
}
