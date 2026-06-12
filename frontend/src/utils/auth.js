export function saveAuth(user, token, remember = false) {
  const primaryStorage = remember ? localStorage : sessionStorage;
  const secondaryStorage = remember ? sessionStorage : localStorage;

  primaryStorage.setItem('token', token);
  primaryStorage.setItem('user', JSON.stringify(user));
  secondaryStorage.removeItem('token');
  secondaryStorage.removeItem('user');
}

export function getToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

export function getUser() {
  const rawUser = localStorage.getItem('user') || sessionStorage.getItem('user');
  return rawUser ? JSON.parse(rawUser) : null;
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
  if (!user) return false;
  if (isFullAccessRole(user.role)) return true;

  return ['/pos', '/orders', '/products', '/inventory', '/customers', '/shifts'].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  window.location.href = '/login';
}
