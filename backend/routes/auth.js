import express from 'express';
import auth from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import {
  changePassword,
  disableMfa,
  enableMfa,
  getMe,
  login,
  logout,
  refreshSession,
  setupMfa,
  verifyMfaLogin
} from '../controllers/authController.js';
import { validateChangePassword, validateLogin } from '../middleware/validate.js';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Đăng nhập sai hoặc quá nhanh quá nhiều lần, vui lòng thử lại sau' }
});

router.post('/login', loginLimiter, validateLogin, login);
router.post('/mfa/verify-login', loginLimiter, verifyMfaLogin);
router.post('/refresh', refreshSession);
router.post('/logout', logout);
router.get('/me', auth, getMe);
router.put('/change-password', auth, validateChangePassword, changePassword);
router.post('/mfa/setup', auth, setupMfa);
router.post('/mfa/enable', auth, enableMfa);
router.post('/mfa/disable', auth, disableMfa);

export default router;
