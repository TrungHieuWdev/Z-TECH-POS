import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateChangePassword,
  validateCreateOrder,
  validateEmployee,
  validateLogin,
  validateStockQuantity
} from '../middleware/validate.js';

function runMiddleware(middleware, body) {
  let statusCode = 200;
  let payload;
  let nextCalled = false;

  const req = { body };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    }
  };
  const next = () => {
    nextCalled = true;
  };

  middleware(req, res, next);
  return { statusCode, payload, nextCalled };
}

test('auth validation accepts a valid login payload', () => {
  const result = runMiddleware(validateLogin, { employeeCode: 'NV001', password: 'secret123' });
  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, 200);
});

test('auth validation rejects weak password changes', () => {
  const result = runMiddleware(validateChangePassword, {
    currentPassword: 'old-password',
    newPassword: '123',
    confirmPassword: '123'
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(result.payload.message, /Mật khẩu/);
});

test('order validation rejects empty carts', () => {
  const result = runMiddleware(validateCreateOrder, {
    items: [],
    payment_method: 'cash'
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(result.payload.message, /Đơn hàng/);
});

test('order validation accepts a valid order payload', () => {
  const result = runMiddleware(validateCreateOrder, {
    items: [{ product_id: 1, quantity: 2 }],
    promotion_discount: 0,
    points_used: 0,
    payment_method: 'transfer'
  });
  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, 200);
});

test('inventory validation rejects negative quantity', () => {
  const result = runMiddleware(validateStockQuantity, {
    product_id: 1,
    quantity: -1
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(result.payload.message, /tồn kho/);
});

test('inventory validation accepts valid stock quantity', () => {
  const result = runMiddleware(validateStockQuantity, {
    product_id: 1,
    quantity: 5
  });
  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, 200);
});

test('employee validation accepts staff roles', () => {
  for (const role of ['employee', 'cashier', 'warehouse']) {
    const result = runMiddleware(validateEmployee, {
      name: 'Nhân viên thử nghiệm',
      phone: '0901234567',
      role,
      status: 'active'
    });

    assert.equal(result.nextCalled, true, `role ${role} should be accepted`);
  }
});

test('employee validation rejects an invalid email when one is supplied', () => {
  const result = runMiddleware(validateEmployee, {
    name: 'Nhân viên thử nghiệm',
    email: 'email-khong-hop-le',
    phone: '0901234567',
    role: 'cashier',
    status: 'active'
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(result.payload.message, /Email/);
});

test('employee validation rejects manager and owner roles', () => {
  for (const role of ['manager', 'owner', 'admin']) {
    const result = runMiddleware(validateEmployee, {
      name: 'Tài khoản không phải nhân viên',
      email: 'account@ztech.local',
      phone: '0901234567',
      role,
      status: 'active'
    });

    assert.equal(result.nextCalled, false, `role ${role} should be rejected`);
    assert.equal(result.statusCode, 400);
    assert.match(result.payload.message, /Vai trò/);
  }
});
