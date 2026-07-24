import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { query } from '../config/db.js';
import { getJwtSecret } from '../config/auth.js';
import { hasActiveShift } from '../services/shiftService.js';
import { isAdministratorRole, normalizeRole } from '../utils/roles.js';
import { validatePasswordPolicy } from '../security/passwordPolicy.js';
import {
  clearSessionCookies,
  issueSession,
  revokeCurrentSession,
  rotateSession
} from '../security/sessionTokens.js';
import {
  buildTotpUri,
  createTotpSecret,
  decryptTotpSecret,
  encryptTotpSecret,
  verifyTotp
} from '../security/totp.js';

function normalizeEmployeeCode(value = '') {
  return String(value).trim().toUpperCase();
}

function normalizeEmail(value = '') {
  return String(value).trim().toLowerCase();
}

function createRecoveryCodes() {
  const codes = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex').toUpperCase());
  return {
    codes,
    hashes: codes.map((code) => crypto.createHash('sha256').update(code).digest('hex'))
  };
}

function recoveryCodeHash(code) {
  return crypto.createHash('sha256').update(String(code || '').replace(/[\s-]/g, '').toUpperCase()).digest('hex');
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
      `SELECT id, name, email, employee_code, password, role, status, token_version,
              failed_login_attempts, locked_until, mfa_enabled, mfa_secret_encrypted
       FROM users
       WHERE employee_code = ? OR email = ?
       LIMIT 1`,
      [employeeCode, email]
    );
    const user = users[0];

    if (!user) {
      return res.status(401).json({ message: 'Mật khẩu hoặc mã đăng nhập bạn nhập bị sai' });
    }

    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      return res.status(423).json({ message: 'Tài khoản tạm khóa do đăng nhập sai nhiều lần, vui lòng thử lại sau' });
    }

    if (String(user.status || 'active').toLowerCase() !== 'active') {
      return res.status(403).json({ message: 'Tài khoản nhân viên đang bị khóa' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      const attempts = Number(user.failed_login_attempts || 0) + 1;
      const lockMinutes = attempts >= 10 ? 30 : attempts >= 5 ? 5 : 0;
      await query(
        `UPDATE users
         SET failed_login_attempts = ?,
             last_failed_login_at = NOW(),
             locked_until = ${lockMinutes ? 'DATE_ADD(NOW(), INTERVAL ? MINUTE)' : 'NULL'}
         WHERE id = ?`,
        lockMinutes ? [attempts, lockMinutes, user.id] : [attempts, user.id]
      );
      return res.status(401).json({ message: 'Mật khẩu hoặc mã đăng nhập bạn nhập bị sai' });
    }

    const fullAccess = isAdministratorRole(user.role);
    if (!fullAccess && !(await hasActiveShift(user))) {
      return res.status(403).json({ message: 'Quản lý cần mở và bắt đầu ca làm trước khi nhân viên đăng nhập' });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      employeeCode: user.employee_code || employeeCode,
      role: normalizeRole(user.role)
    };

    if (user.mfa_enabled) {
      const challengeToken = jwt.sign(
        { mfaChallenge: true, id: user.id, remember: req.body.remember === true },
        getJwtSecret(),
        { expiresIn: '5m' }
      );
      return res.status(202).json({ mfaRequired: true, challengeToken });
    }

    const session = await issueSession({
      user: { ...safeUser, tokenVersion: Number(user.token_version || 0) },
      req,
      res,
      remember: req.body.remember === true
    });
    await query(
      `UPDATE users
       SET last_login_at = NOW(), failed_login_attempts = 0,
           locked_until = NULL, last_failed_login_at = NULL
       WHERE id = ?`,
      [user.id]
    ).catch(() => {});

    res.json({ user: safeUser, csrfToken: session.csrfToken, expiresIn: session.expiresIn });
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

export async function refreshSession(req, res) {
  try {
    const session = await rotateSession({ req, res });
    if (!session) {
      clearSessionCookies(res);
      return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn' });
    }
    return res.json(session);
  } catch (error) {
    return res.status(500).json({ message: 'Không thể làm mới phiên đăng nhập' });
  }
}

export async function logout(req, res) {
  try {
    await revokeCurrentSession(req);
  } finally {
    clearSessionCookies(res);
  }
  return res.json({ message: 'Đã đăng xuất' });
}

export async function getMe(req, res) {
  try {
    const rows = await query(
      `SELECT id, name, email, employee_code, role, last_login_at, mfa_enabled
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
      role: normalizeRole(user.role),
      mfaEnabled: Boolean(user.mfa_enabled),
      lastLoginAt: user.last_login_at || null
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải thông tin tài khoản', error: error.message });
  }
}

export async function verifyMfaLogin(req, res) {
  try {
    const challenge = jwt.verify(String(req.body.challengeToken || ''), getJwtSecret());
    if (!challenge.mfaChallenge || !challenge.id) throw new Error('invalid challenge');
    const rows = await query(
      `SELECT id, name, email, employee_code, role, status, token_version, mfa_enabled,
              mfa_secret_encrypted, mfa_recovery_codes_json
       FROM users WHERE id = ? LIMIT 1`,
      [challenge.id]
    );
    const user = rows[0];
    if (!user || user.status !== 'active' || !user.mfa_enabled || !user.mfa_secret_encrypted) {
      return res.status(401).json({ message: 'Yêu cầu xác thực hai lớp không hợp lệ' });
    }
    const totpValid = verifyTotp(decryptTotpSecret(user.mfa_secret_encrypted), req.body.code);
    const recoveryHashes = JSON.parse(user.mfa_recovery_codes_json || '[]');
    const suppliedRecoveryHash = recoveryCodeHash(req.body.code);
    const recoveryIndex = recoveryHashes.indexOf(suppliedRecoveryHash);
    if (!totpValid && recoveryIndex < 0) {
      return res.status(401).json({ message: 'Mã xác thực không đúng hoặc đã hết hạn' });
    }
    if (recoveryIndex >= 0) {
      recoveryHashes.splice(recoveryIndex, 1);
      await query(
        'UPDATE users SET mfa_recovery_codes_json = ? WHERE id = ?',
        [JSON.stringify(recoveryHashes), user.id]
      );
    }
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      employeeCode: user.employee_code,
      role: normalizeRole(user.role)
    };
    const session = await issueSession({
      user: { ...safeUser, tokenVersion: Number(user.token_version || 0) },
      req,
      res,
      remember: challenge.remember === true
    });
    await query(
      `UPDATE users SET last_login_at = NOW(), failed_login_attempts = 0,
       locked_until = NULL, last_failed_login_at = NULL WHERE id = ?`,
      [user.id]
    );
    return res.json({ user: safeUser, csrfToken: session.csrfToken, expiresIn: session.expiresIn });
  } catch {
    return res.status(401).json({ message: 'Yêu cầu xác thực hai lớp đã hết hạn' });
  }
}

export async function setupMfa(req, res) {
  try {
    const current = await query('SELECT mfa_enabled FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    if (current[0]?.mfa_enabled) {
      return res.status(409).json({ message: 'MFA đang được bật; hãy xác thực để tắt trước khi thiết lập lại' });
    }
    const secret = createTotpSecret();
    await query(
      'UPDATE users SET mfa_secret_encrypted = ?, mfa_enabled = FALSE WHERE id = ?',
      [encryptTotpSecret(secret), req.user.id]
    );
    const account = req.user.email || req.user.employeeCode || `user-${req.user.id}`;
    return res.json({ secret, otpauthUri: buildTotpUri(secret, account) });
  } catch {
    return res.status(500).json({ message: 'Không thể khởi tạo xác thực hai lớp' });
  }
}

export async function enableMfa(req, res) {
  try {
    const rows = await query('SELECT mfa_secret_encrypted FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const encrypted = rows[0]?.mfa_secret_encrypted;
    if (!encrypted || !verifyTotp(decryptTotpSecret(encrypted), req.body.code)) {
      return res.status(400).json({ message: 'Mã xác thực không đúng hoặc đã hết hạn' });
    }
    const recovery = createRecoveryCodes();
    await query(
      'UPDATE users SET mfa_enabled = TRUE, mfa_recovery_codes_json = ? WHERE id = ?',
      [JSON.stringify(recovery.hashes), req.user.id]
    );
    return res.json({ message: 'Đã bật xác thực hai lớp', recoveryCodes: recovery.codes });
  } catch {
    return res.status(500).json({ message: 'Không thể bật xác thực hai lớp' });
  }
}

export async function disableMfa(req, res) {
  try {
    const rows = await query('SELECT password, mfa_secret_encrypted FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const user = rows[0];
    const passwordValid = user && await bcrypt.compare(String(req.body.password || ''), user.password);
    const codeValid = user?.mfa_secret_encrypted
      && verifyTotp(decryptTotpSecret(user.mfa_secret_encrypted), req.body.code);
    if (!passwordValid || !codeValid) {
      return res.status(400).json({ message: 'Mật khẩu hoặc mã xác thực không đúng' });
    }
    await query(
      `UPDATE users
       SET mfa_enabled = FALSE, mfa_secret_encrypted = NULL, mfa_recovery_codes_json = NULL
       WHERE id = ?`,
      [req.user.id]
    );
    return res.json({ message: 'Đã tắt xác thực hai lớp' });
  } catch {
    return res.status(500).json({ message: 'Không thể tắt xác thực hai lớp' });
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
    const passwordPolicyError = validatePasswordPolicy(newPassword, req.user.employeeCode);
    if (passwordPolicyError) return res.status(400).json({ message: passwordPolicyError });
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
    await query(
      `UPDATE users
       SET password = ?,
           password_changed_at = NOW(),
           token_version = token_version + 1
       WHERE id = ?`,
      [hashedPassword, req.user.id]
    );
    await query(
      'UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
      [req.user.id]
    );
    clearSessionCookies(res);

    res.json({ message: 'Đổi mật khẩu thành công, vui lòng đăng nhập lại' });
  } catch (error) {
    res.status(500).json({ message: 'Không thể đổi mật khẩu', error: error.message });
  }
}
