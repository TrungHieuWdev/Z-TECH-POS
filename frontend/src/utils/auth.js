import { canAccessRoute } from './permissions';
import { readJsonStorage } from './storage';

const isUserRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

export function saveAuth(user, token, remember = false) {
  const primaryStorage = remember ? localStorage : sessionStorage;
  const secondaryStorage = remember ? sessionStorage : localStorage;

  primaryStorage.setItem('token', token);
  primaryStorage.setItem('user', JSON.stringify(user));
  secondaryStorage.removeItem('token');
  secondaryStorage.removeItem('user');
}

export function getToken() {
  for (const storage of [localStorage, sessionStorage]) {
    const token = storage.getItem('token');
    if (!token) continue;
    const user = readJsonStorage(storage, 'user', null, isUserRecord);
    if (user) return token;
    storage.removeItem('token');
  }
  return null;
}

export function getUser() {
  for (const storage of [localStorage, sessionStorage]) {
    if (!storage.getItem('token')) continue;
    const user = readJsonStorage(storage, 'user', null, isUserRecord);
    if (user) return user;
    storage.removeItem('token');
  }
  return null;
}

export function isFullAccessRole(role) {
  return ['admin', 'owner', 'manager'].includes(String(role || '').toLowerCase());
}

export function getRoleLabel(role) {
  const roleKey = String(role || '').toLowerCase();

  if (roleKey === 'owner' || roleKey === 'admin') return 'Chủ cửa hàng';
  if (roleKey === 'manager') return 'Quản lý';
  if (['cashier', 'employee', 'staff'].includes(roleKey)) return 'Nhân viên';

  return role || 'Nhân viên';
}

export function canAccessPath(pathname, user = getUser()) {
  return Boolean(user && canAccessRoute(pathname, user.role));
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  window.location.href = '/login';
}
