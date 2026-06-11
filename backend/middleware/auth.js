import jwt from 'jsonwebtoken';

const fullAccessRoles = new Set(['admin', 'owner', 'manager']);

export default function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Phiên đăng nhập không tồn tại' });
  }

  const token = authHeader.slice('Bearer '.length).trim();

  if (!token) {
    return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'pos_secret_key_2024');
    next();
  } catch (error) {
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
