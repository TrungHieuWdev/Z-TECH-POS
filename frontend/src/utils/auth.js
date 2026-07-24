import { canAccessRoute } from './permissions';
import { readJsonStorage } from './storage';

const isUserRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

export function saveAuth(user, _token, remember = false) {
  const primaryStorage = remember ? localStorage : sessionStorage;
  const secondaryStorage = remember ? sessionStorage : localStorage;

  primaryStorage.setItem('user', JSON.stringify(user));
  secondaryStorage.removeItem('user');
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
}

export function getToken() {
  for (const storage of [localStorage, sessionStorage]) {
    const user = readJsonStorage(storage, 'user', null, isUserRecord);
    if (user) return 'http-only-cookie-session';
  }
  return null;
}

export function getUser() {
  for (const storage of [localStorage, sessionStorage]) {
    const user = readJsonStorage(storage, 'user', null, isUserRecord);
    if (user) return user;
  }
  return null;
}

export function isFullAccessRole(role) {
  return ['admin', 'owner', 'manager'].includes(String(role || '').toLowerCase());
}

export function getRoleLabel(role) {
  const roleKey = String(role || '').toLowerCase();

  if (isFullAccessRole(roleKey)) return 'Quản trị viên';
  if (['cashier', 'employee', 'staff'].includes(roleKey)) return 'Nhân viên';

  return role || 'Nhân viên';
}

export function canAccessPath(pathname, user = getUser()) {
  return Boolean(user && canAccessRoute(pathname, user.role));
}

export function logout() {
  const csrfCookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('ztech_csrf='))
    ?.split('=')
    .slice(1)
    .join('=') || '';
  fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: csrfCookie ? { 'X-CSRF-Token': decodeURIComponent(csrfCookie) } : {}
  }).catch(() => {});
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  window.location.href = '/login';
}
