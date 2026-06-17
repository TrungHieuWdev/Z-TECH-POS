export function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

export function isVietnamPhone(value) {
  return /^(03|05|07|08|09)\d{8}$/.test(String(value || '').trim());
}

export const vietnamPhoneMessage = 'Số điện thoại Việt Nam phải gồm 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09';
