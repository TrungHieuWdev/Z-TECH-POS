const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SORT_FIELDS = new Set([
  'sku', 'name', 'categoryName', 'soldQuantity', 'grossRevenue',
  'discount', 'netRevenue', 'cost', 'grossProfit', 'margin', 'returnedQuantity'
]);
const PAYMENT_METHODS = new Set(['cash', 'card', 'transfer', 'e_wallet', 'other']);
const ORDER_STATUSES = new Set(['all', 'completed', 'cancelled']);

function localDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

function isRealDate(value) {
  if (!DATE_PATTERN.test(value || '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function positiveInteger(value, name, { optional = true, max = Number.MAX_SAFE_INTEGER } = {}) {
  if ((value === undefined || value === '') && optional) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw Object.assign(new Error(`${name} không hợp lệ`), { status: 400 });
  }
  return number;
}

function booleanValue(value, defaultValue = true) {
  if (value === undefined || value === '') return defaultValue;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  throw Object.assign(new Error('Giá trị so sánh không hợp lệ'), { status: 400 });
}

export function validateRevenueReportQuery(query = {}) {
  const today = localDate();
  const defaultFrom = new Date(`${today}T00:00:00+07:00`);
  defaultFrom.setDate(defaultFrom.getDate() - 6);
  const from = String(query.from || query.date_from || localDate(defaultFrom));
  const to = String(query.to || query.date_to || today);

  if (!isRealDate(from) || !isRealDate(to)) {
    throw Object.assign(new Error('Khoảng ngày báo cáo không hợp lệ'), { status: 400 });
  }
  if (from > to) {
    throw Object.assign(new Error('Ngày bắt đầu không được lớn hơn ngày kết thúc'), { status: 400 });
  }
  const span = Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000) + 1;
  if (span > 366) {
    throw Object.assign(new Error('Khoảng báo cáo tối đa là 366 ngày'), { status: 400 });
  }

  const paymentMethod = String(query.paymentMethod || '').trim();
  if (paymentMethod && !PAYMENT_METHODS.has(paymentMethod)) {
    throw Object.assign(new Error('Phương thức thanh toán không hợp lệ'), { status: 400 });
  }
  const orderStatus = String(query.orderStatus || 'all').trim();
  if (!ORDER_STATUSES.has(orderStatus)) {
    throw Object.assign(new Error('Trạng thái hóa đơn không hợp lệ'), { status: 400 });
  }
  const sortBy = String(query.sortBy || 'netRevenue');
  if (!SORT_FIELDS.has(sortBy)) {
    throw Object.assign(new Error('Cột sắp xếp không hợp lệ'), { status: 400 });
  }
  const sortOrder = String(query.sortOrder || 'desc').toLowerCase();
  if (!['asc', 'desc'].includes(sortOrder)) {
    throw Object.assign(new Error('Chiều sắp xếp không hợp lệ'), { status: 400 });
  }

  return {
    from,
    to,
    compare: booleanValue(query.compare, true),
    categoryId: positiveInteger(query.categoryId, 'Danh mục'),
    employeeId: positiveInteger(query.employeeId, 'Nhân viên'),
    paymentMethod,
    orderStatus,
    page: positiveInteger(query.page ?? 1, 'Trang', { optional: false, max: 100000 }),
    limit: positiveInteger(query.limit ?? 10, 'Số dòng mỗi trang', { optional: false, max: 100 }),
    sortBy,
    sortOrder,
    search: String(query.search || '').trim().slice(0, 100)
  };
}

