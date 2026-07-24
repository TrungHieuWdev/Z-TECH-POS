import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/auth.js';
import { query } from '../config/db.js';
import { isAdministratorRole, normalizeRole } from '../utils/roles.js';
import { getAccessToken } from '../security/sessionTokens.js';

export default async function auth(req, res, next) {
  const token = getAccessToken(req);

  if (!token) {
    return res.status(401).json({ message: 'Phiên đăng nhập không tồn tại' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    const rows = await query(
      `SELECT id, name, email, employee_code, role, status, token_version
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [payload.id]
    );
    const user = rows[0];
    if (!user || String(user.status || 'active').toLowerCase() !== 'active') {
      return res.status(401).json({ message: 'Tài khoản đã bị khóa hoặc không còn tồn tại' });
    }
    if (Number(payload.tokenVersion || 0) !== Number(user.token_version || 0)) {
      return res.status(401).json({ message: 'Phiên đăng nhập đã bị thu hồi' });
    }
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      employeeCode: user.employee_code,
      role: normalizeRole(user.role)
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
  return isAdministratorRole(user?.role);
}

export function requireFullAccess(req, res, next) {
  if (hasFullAccess(req.user)) {
    return next();
  }

  return res.status(403).json({ message: 'Bạn không có quyền thực hiện thao tác này' });
}
