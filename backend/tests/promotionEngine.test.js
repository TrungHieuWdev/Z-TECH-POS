import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePromotion,
  normalizeOrderItems
} from '../services/promotionEngine.js';

const product = {
  id: 48,
  name: 'Kính cường lực',
  price: 69000,
  category_id: 1,
  category_name: 'Phụ kiện Apple',
  device_family: 'apple'
};

const activeBogo = {
  id: 42,
  code: 'KM2025',
  name: 'Chào năm mới',
  enabled: true,
  startDate: '2026-07-17',
  endDate: '2099-12-31',
  promotionType: 'buy_x_get_y',
  buyProductId: 48,
  buyQuantity: 1,
  giftProductId: 48,
  giftQuantity: 1,
  minOrder: 0,
  maxOrder: 0,
  scope: 'Theo dòng thiết bị',
  deviceFamily: 'apple'
};

test('gộp dòng sản phẩm trùng trước khi kiểm tra tồn kho', () => {
  assert.deepEqual(normalizeOrderItems([
    { product_id: 48, quantity: 2, purchased_quantity: 1, gift_quantity: 1 },
    { product_id: 48, quantity: 1, purchased_quantity: 1, gift_quantity: 0 }
  ]), [{
    product_id: 48,
    quantity: 3,
    purchased_quantity: 2,
    gift_quantity: 1
  }]);
});

test('mua và tặng cùng sản phẩm vẫn tách đúng số lượng và tiền giảm', () => {
  const items = normalizeOrderItems([
    { product_id: 48, quantity: 2, purchased_quantity: 1, gift_quantity: 1 }
  ]);
  const result = calculatePromotion({
    promotion: activeBogo,
    items,
    products: new Map([[48, product]]),
    subtotal: 138000,
    purchasedSubtotal: 69000,
    customerId: null
  });

  assert.equal(result.discount, 69000);
  assert.equal(result.promotion.code, 'KM2025');
});

test('backend từ chối số quà lớn hơn điều kiện mua', () => {
  const items = normalizeOrderItems([
    { product_id: 48, quantity: 3, purchased_quantity: 1, gift_quantity: 2 }
  ]);

  assert.throws(() => calculatePromotion({
    promotion: activeBogo,
    items,
    products: new Map([[48, product]]),
    subtotal: 207000,
    purchasedSubtotal: 69000,
    customerId: null
  }), /không đúng điều kiện/);
});

test('backend từ chối quà tặng khi không có khuyến mãi', () => {
  const items = normalizeOrderItems([
    { product_id: 48, quantity: 2, purchased_quantity: 1, gift_quantity: 1 }
  ]);

  assert.throws(() => calculatePromotion({
    promotion: null,
    items,
    products: new Map([[48, product]]),
    subtotal: 138000,
    purchasedSubtotal: 69000,
    customerId: null
  }), /chưa áp dụng khuyến mãi/);
});

