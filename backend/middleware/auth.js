import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/auth.js';
import { query } from '../config/db.js';

const fullAccessRoles = new Set(['admin', 'owner', 'manager']);

export default async function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Phiên đăng nhập không tồn tại' });
  }

  const token = authHeader.slice('Bearer '.length).trim();

  if (!token) {
    return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    const rows = await query(
      `SELECT id, name, email, employee_code, role, status
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [payload.id]
    );
    const user = rows[0];
    if (!user || String(user.status || 'active').toLowerCase() !== 'active') {
      return res.status(401).json({ message: 'Tài khoản đã bị khóa hoặc không còn tồn tại' });
    }
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      employeeCode: user.employee_code,
      role: user.role
    };
    next();
  } catch (error) {
    if (!['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return next(error);
    }
    return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ' });
  }
}

export function hasFullAccess(user) {
  return fullAccessRoles.has(String(user?.role || '').toLowerCase());
}

export function requireFullAccess(req, res, next) {
  if (hasFullAccess(req.user)) {
    return next();
  }

  return res.status(403).json({ message: 'Bạn không có quyền thực hiện thao tác này' });
}
