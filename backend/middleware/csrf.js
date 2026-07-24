import { verifyCsrf } from '../security/sessionTokens.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/mfa/verify-login']);

export default function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method) || EXEMPT_PATHS.has(req.path)) return next();
  if (verifyCsrf(req)) return next();
  return res.status(403).json({ message: 'Yêu cầu bảo mật CSRF không hợp lệ, vui lòng tải lại trang' });
}
