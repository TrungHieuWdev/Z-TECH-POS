const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
  '12345678',
  '123456789',
  'admin123',
  'password',
  'password123',
  'qwerty123'
]);

export function validatePasswordPolicy(password, employeeCode = '') {
  const value = String(password || '');
  const normalizedValue = value.toLowerCase();
  const normalizedEmployeeCode = String(employeeCode || '').trim().toLowerCase();

  if (value.length < MIN_PASSWORD_LENGTH || value.length > MAX_PASSWORD_LENGTH) {
    return `Mật khẩu phải có từ ${MIN_PASSWORD_LENGTH} đến ${MAX_PASSWORD_LENGTH} ký tự`;
  }

  if (COMMON_PASSWORDS.has(normalizedValue)) {
    return 'Mật khẩu quá phổ biến, vui lòng chọn mật khẩu khác';
  }

  if (normalizedEmployeeCode && normalizedValue === normalizedEmployeeCode) {
    return 'Mật khẩu không được trùng mã nhân viên';
  }

  const characterGroups = [
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value)
  ].filter(Boolean).length;

  if (characterGroups < 3) {
    return 'Mật khẩu phải có ít nhất 3 nhóm: chữ thường, chữ hoa, số hoặc ký tự đặc biệt';
  }

  return '';
}
