export const ADMIN_ROLE = 'admin';

const LEGACY_ADMIN_ROLES = new Set(['admin', 'owner', 'manager']);

export function normalizeRole(role) {
  const roleKey = String(role || '').trim().toLowerCase();
  return LEGACY_ADMIN_ROLES.has(roleKey) ? ADMIN_ROLE : roleKey;
}

export function isAdministratorRole(role) {
  return normalizeRole(role) === ADMIN_ROLE;
}
