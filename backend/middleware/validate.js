const PAYMENT_METHODS = new Set(['cash', 'card', 'transfer']);
const ORDER_STATUS = new Set(['completed', 'cancelled']);

function isPositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
}

function isNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

function badRequest(res, message) {
  return res.status(400).json({ message });
}

export function validateLogin(req, res, next) {
  const identifier = String(req.body.employeeCode ?? req.body.email ?? req.body.identifier ?? '').trim();
  const password = String(req.body.password || '');

  if (!identifier || !password) {
    return badRequest(res, 'Vui lòng nhập mã nhân viên/email và mật khẩu');
  }

  if (identifier.length > 100 || password.length > 128) {
    return badRequest(res, 'Thông tin đăng nhập không hợp lệ');
  }

  next();
}

export function validateChangePassword(req, res, next) {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  const confirmPassword = String(req.body.confirmPassword || '');

  if (!currentPassword || !newPassword || !confirmPassword) {
    return badRequest(res, 'Vui lòng nhập đầy đủ thông tin mật khẩu');
  }

  if (newPassword.length < 8 || newPassword.length > 128) {
    return badRequest(res, 'Mật khẩu mới phải có từ 8 đến 128 ký tự');
  }

  if (newPassword === currentPassword) {
    return badRequest(res, 'Mật khẩu mới phải khác mật khẩu hiện tại');
  }

  if (newPassword !== confirmPassword) {
    return badRequest(res, 'Xác nhận mật khẩu mới không trùng khớp');
  }

  next();
}

export function validateCreateOrder(req, res, next) {
  const { customer_id, items, promotion_discount = 0, points_used = 0, payment_method = 'cash', paid_amount = null } = req.body;

  if (customer_id !== undefined && customer_id !== null && customer_id !== '' && !isPositiveInteger(customer_id)) {
    return badRequest(res, 'Khách hàng không hợp lệ');
  }

  if (!Array.isArray(items) || items.length === 0) {
    return badRequest(res, 'Đơn hàng cần có ít nhất một sản phẩm');
  }

  if (items.length > 200) {
    return badRequest(res, 'Đơn hàng vượt quá số dòng sản phẩm cho phép');
  }

  for (const item of items) {
    if (!isPositiveInteger(item?.product_id) || !isPositiveInteger(item?.quantity)) {
      return badRequest(res, 'Sản phẩm hoặc số lượng không hợp lệ');
    }
  }

  if (!isNonNegativeNumber(promotion_discount) || !isNonNegativeNumber(points_used)) {
    return badRequest(res, 'Giảm giá hoặc điểm sử dụng không hợp lệ');
  }

  if (!PAYMENT_METHODS.has(String(payment_method))) {
    return badRequest(res, 'Phương thức thanh toán không hợp lệ');
  }
  if (paid_amount != null && !isNonNegativeNumber(paid_amount)) return badRequest(res, 'Số tiền thanh toán không hợp lệ');

  next();
}

export function validateUpdateOrder(req, res, next) {
  const { status, payment_method } = req.body;

  if (status && !ORDER_STATUS.has(String(status))) {
    return badRequest(res, 'Trạng thái đơn hàng không hợp lệ');
  }

  if (payment_method && !PAYMENT_METHODS.has(String(payment_method))) {
    return badRequest(res, 'Phương thức thanh toán không hợp lệ');
  }

  next();
}

export function validateStockQuantity(req, res, next) {
  const quantity = Number(req.body.quantity);

  if (!isPositiveInteger(req.body.product_id)) {
    return badRequest(res, 'Sản phẩm không hợp lệ');
  }

  if (!Number.isFinite(quantity) || quantity < 0) {
    return badRequest(res, 'Số lượng tồn kho không hợp lệ');
  }

  next();
}

export function imageUploadFilter(req, file, callback) {
  const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

  if (!allowedMimeTypes.has(file.mimetype)) {
    return callback(new Error('Chỉ cho phép upload file ảnh JPG, PNG, WEBP hoặc GIF'));
  }

  callback(null, true);
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^(03|05|07|08|09)\d{8}$/;
const validText = (value, max) => typeof value === 'string' && value.trim().length <= max;
const validOptionalText = (value, max) => value == null || validText(value, max);

export function validateCustomer(req, res, next) {
  const { name, phone = '', email = '', address = '' } = req.body;
  if (!validText(name, 100) || name.trim().length < 2) return badRequest(res, 'Tên khách hàng không hợp lệ');
  if (!phone || !phonePattern.test(String(phone))) return badRequest(res, 'Số điện thoại là bắt buộc và phải hợp lệ');
  if (email && (!validText(email, 100) || !emailPattern.test(email))) return badRequest(res, 'Email không hợp lệ');
  if (!validText(address, 500)) return badRequest(res, 'Địa chỉ quá dài');
  next();
}

export function validateSupplier(req, res, next) {
  const { supplier_code, supplier_name, supplier_group = '', contact_name = '', phone = '', email = '', address = '', status = 'active' } = req.body;
  if (!/^[A-Z0-9_-]{2,30}$/i.test(String(supplier_code || ''))) return badRequest(res, 'Mã nhà cung cấp không hợp lệ');
  if (!validText(supplier_name, 150) || supplier_name.trim().length < 2) return badRequest(res, 'Tên nhà cung cấp không hợp lệ');
  if (!validOptionalText(supplier_group, 100)) return badRequest(res, 'Nhóm cung cấp quá dài');
  if (!validText(contact_name, 100) || contact_name.trim().length < 2) return badRequest(res, 'Tên người liên hệ là bắt buộc và phải từ 2 đến 100 ký tự');
  if (!phonePattern.test(String(phone || '').trim())) return badRequest(res, 'Số điện thoại Việt Nam phải gồm 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09');
  if (!validText(email, 100) || !emailPattern.test(email.trim())) return badRequest(res, 'Email là bắt buộc và phải hợp lệ');
  if (!validText(address, 500) || address.trim().length < 2) return badRequest(res, 'Địa chỉ là bắt buộc và phải từ 2 đến 500 ký tự');
  if (!['active', 'paused', 'inactive'].includes(status)) return badRequest(res, 'Trạng thái không hợp lệ');
  next();
}

export function validatePurchaseOrder(req, res, next) {
  if (!isPositiveInteger(req.body.supplier_id)) return badRequest(res, 'Nhà cung cấp không hợp lệ');
  if (!Array.isArray(req.body.items) || !req.body.items.length || req.body.items.length > 200) return badRequest(res, 'Phiếu nhập cần từ 1 đến 200 sản phẩm');
  for (const item of req.body.items) {
    if (!isPositiveInteger(item.product_id) || !isPositiveInteger(item.quantity) || !isNonNegativeNumber(item.import_price)) return badRequest(res, 'Chi tiết nhập hàng không hợp lệ');
  }
  next();
}

export function validatePromotion(req, res, next) {
  if (!/^[A-Z0-9_-]{3,20}$/.test(String(req.body.code || '').trim().toUpperCase())) return badRequest(res, 'Mã khuyến mãi không hợp lệ');
  if (!validText(req.body.name, 150) || !req.body.name.trim()) return badRequest(res, 'Tên khuyến mãi là bắt buộc');
  next();
}

export function validateSettings(req, res, next) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return badRequest(res, 'Cài đặt không hợp lệ');
  if (JSON.stringify(req.body).length > 50000) return badRequest(res, 'Dữ liệu cài đặt quá lớn');
  next();
}

export function validateWarrantyClaim(req, res, next) {
  if (!validText(req.body.issue_description, 2000) || req.body.issue_description.trim().length < 3) return badRequest(res, 'Mô tả lỗi không hợp lệ');
  next();
}

export function validateProduct(req, res, next) {
  const body = req.body || {};
  if (!validText(body.name, 200) || body.name.trim().length < 2) return badRequest(res, 'Tên sản phẩm không hợp lệ');
  if (!isPositiveInteger(body.category_id) || !isPositiveInteger(body.device_model_id)) return badRequest(res, 'Danh mục hoặc dòng máy không hợp lệ');
  if (!isNonNegativeNumber(body.price) || (body.cost_price !== '' && body.cost_price != null && !isNonNegativeNumber(body.cost_price))) return badRequest(res, 'Giá sản phẩm không hợp lệ');
  if (body.stock_quantity != null && !isNonNegativeNumber(body.stock_quantity)) return badRequest(res, 'Tồn kho không hợp lệ');
  next();
}

export function validateEmployee(req, res, next) {
  const { name, email, phone = '', role = 'employee', status = 'active' } = req.body || {};
  if (!validText(name, 100) || name.trim().length < 2) return badRequest(res, 'Tên nhân viên không hợp lệ');
  if (!emailPattern.test(String(email || ''))) return badRequest(res, 'Email không hợp lệ');
  if (phone && !phonePattern.test(String(phone))) return badRequest(res, 'Số điện thoại không hợp lệ');
  if (!['owner','manager','employee','admin','cashier','warehouse'].includes(role)) return badRequest(res, 'Vai trò không hợp lệ');
  if (!['active','inactive'].includes(status)) return badRequest(res, 'Trạng thái không hợp lệ');
  next();
}
