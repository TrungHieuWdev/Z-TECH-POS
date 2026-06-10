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

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  window.location.href = '/login';
}
