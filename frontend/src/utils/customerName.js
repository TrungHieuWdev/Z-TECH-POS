export const customerNameMessage =
  'Ten khach hang phai tu 2-100 ky tu, chi gom chu cai, khoang trang va dau cham';

export function normalizeCustomerName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function isValidCustomerName(value) {
  const name = normalizeCustomerName(value);

  if (name.length < 2 || name.length > 100) {
    return false;
  }

  return /^(?=.*\p{L})[\p{L} .]+$/u.test(name);
}
