import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

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
      return res.status(401).json({ message: 'Mã nhân viên hoặc mật khẩu không đúng' });
    }

    if (String(user.status || 'active').toLowerCase() !== 'active') {
      return res.status(403).json({ message: 'Tài khoản nhân viên đang bị khóa' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Mã nhân viên hoặc mật khẩu không đúng' });
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
      process.env.JWT_SECRET || 'pos_secret_key_2024',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
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
  res.json(req.user);
}
