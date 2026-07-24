import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { getJwtSecret } from '../config/auth.js';

const ACCESS_COOKIE = 'ztech_access';
const REFRESH_COOKIE = 'ztech_refresh';
const CSRF_COOKIE = 'ztech_csrf';
const ACCESS_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 15 * 60);
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return ['', ''];
    return [
      decodeURIComponent(part.slice(0, separator).trim()),
      decodeURIComponent(part.slice(separator + 1).trim())
    ];
  }).filter(([key]) => key));
}

function cookieOptions({ httpOnly = true, maxAge, path = '/' } = {}) {
  const production = process.env.NODE_ENV === 'production';
  return [
    `${path ? `Path=${path}` : ''}`,
    'SameSite=Strict',
    httpOnly ? 'HttpOnly' : '',
    production ? 'Secure' : '',
    Number.isFinite(maxAge) ? `Max-Age=${Math.max(0, Math.floor(maxAge))}` : ''
  ].filter(Boolean).join('; ');
}

function appendCookie(res, name, value, options) {
  const serialized = `${name}=${encodeURIComponent(value)}; ${cookieOptions(options)}`;
  const current = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', current ? [...(Array.isArray(current) ? current : [current]), serialized] : serialized);
}

export function readCookie(req, name) {
  return parseCookies(req.headers.cookie)[name] || '';
}

export function hashToken(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export function createOpaqueToken() {
  return crypto.randomBytes(48).toString('base64url');
}

export function getAccessToken(req) {
  const cookieToken = readCookie(req, ACCESS_COOKIE);
  if (cookieToken) return cookieToken;
  const authorization = String(req.headers.authorization || '');
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

export async function issueSession({ user, req, res, remember = false }) {
  const refreshToken = createOpaqueToken();
  const csrfToken = createOpaqueToken();
  const lifetimeDays = remember ? Math.max(REFRESH_TTL_DAYS, 30) : REFRESH_TTL_DAYS;
  const expiresAt = new Date(Date.now() + lifetimeDays * 86400000);
  const result = await query(
    `INSERT INTO auth_sessions
      (user_id, refresh_token_hash, csrf_token_hash, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      hashToken(refreshToken),
      hashToken(csrfToken),
      String(req.get('user-agent') || '').slice(0, 255),
      String(req.ip || req.socket?.remoteAddress || '').slice(0, 64),
      expiresAt
    ]
  );
  const accessToken = jwt.sign(
    { ...user, tokenVersion: Number(user.tokenVersion || 0), sessionId: result.insertId },
    getJwtSecret(),
    { expiresIn: ACCESS_TTL_SECONDS }
  );

  appendCookie(res, ACCESS_COOKIE, accessToken, { maxAge: ACCESS_TTL_SECONDS });
  appendCookie(res, REFRESH_COOKIE, refreshToken, { maxAge: lifetimeDays * 86400, path: '/api/auth' });
  appendCookie(res, CSRF_COOKIE, csrfToken, { httpOnly: false, maxAge: lifetimeDays * 86400 });
  return { csrfToken, expiresIn: ACCESS_TTL_SECONDS };
}

export async function rotateSession({ req, res }) {
  const refreshToken = readCookie(req, REFRESH_COOKIE);
  if (!refreshToken) return null;
  const rows = await query(
    `SELECT s.id AS session_id, s.user_id, s.expires_at, s.revoked_at,
            u.name, u.email, u.employee_code, u.role, u.status, u.token_version
     FROM auth_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.refresh_token_hash = ?
     LIMIT 1`,
    [hashToken(refreshToken)]
  );
  const row = rows[0];
  if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now() || row.status !== 'active') {
    return null;
  }

  const nextRefresh = createOpaqueToken();
  const nextCsrf = createOpaqueToken();
  const rotation = await query(
    `UPDATE auth_sessions
     SET refresh_token_hash = ?, csrf_token_hash = ?, last_used_at = NOW()
     WHERE id = ? AND refresh_token_hash = ? AND revoked_at IS NULL`,
    [hashToken(nextRefresh), hashToken(nextCsrf), row.session_id, hashToken(refreshToken)]
  );
  if (rotation.affectedRows !== 1) return null;
  const safeUser = {
    id: row.user_id,
    name: row.name,
    email: row.email,
    employeeCode: row.employee_code,
    role: row.role
  };
  const accessToken = jwt.sign(
    { ...safeUser, tokenVersion: Number(row.token_version || 0), sessionId: row.session_id },
    getJwtSecret(),
    { expiresIn: ACCESS_TTL_SECONDS }
  );
  appendCookie(res, ACCESS_COOKIE, accessToken, { maxAge: ACCESS_TTL_SECONDS });
  appendCookie(res, REFRESH_COOKIE, nextRefresh, { maxAge: REFRESH_TTL_DAYS * 86400, path: '/api/auth' });
  appendCookie(res, CSRF_COOKIE, nextCsrf, { httpOnly: false, maxAge: REFRESH_TTL_DAYS * 86400 });
  return { user: safeUser, csrfToken: nextCsrf, expiresIn: ACCESS_TTL_SECONDS };
}

export async function revokeCurrentSession(req) {
  const refreshToken = readCookie(req, REFRESH_COOKIE);
  if (refreshToken) {
    await query(
      'UPDATE auth_sessions SET revoked_at = NOW() WHERE refresh_token_hash = ? AND revoked_at IS NULL',
      [hashToken(refreshToken)]
    );
  }
}

export function clearSessionCookies(res) {
  appendCookie(res, ACCESS_COOKIE, '', { maxAge: 0 });
  appendCookie(res, REFRESH_COOKIE, '', { maxAge: 0, path: '/api/auth' });
  appendCookie(res, CSRF_COOKIE, '', { httpOnly: false, maxAge: 0 });
}

export function verifyCsrf(req) {
  const cookieValue = readCookie(req, CSRF_COOKIE);
  const headerValue = String(req.get('x-csrf-token') || '');
  if (!cookieValue || !headerValue) return false;
  const cookieBuffer = Buffer.from(cookieValue);
  const headerBuffer = Buffer.from(headerValue);
  return cookieBuffer.length === headerBuffer.length && crypto.timingSafeEqual(cookieBuffer, headerBuffer);
}
