import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePurchasePayment } from '../services/purchaseOrderPaymentService.js';

test('purchase payment derives paid status and zero debt', () => {
  const result = normalizePurchasePayment({
    totalAmount: 1_000_000,
    paidAmount: 1_000_000,
    paymentMethod: 'transfer',
    dueDate: '2026-08-01'
  });

  assert.deepEqual(result, {
    totalAmount: 1_000_000,
    paidAmount: 1_000_000,
    debtAmount: 0,
    paymentStatus: 'paid',
    paymentMethod: 'transfer',
    dueDate: null
  });
});

test('purchase payment derives partial debt and preserves due date', () => {
  const result = normalizePurchasePayment({
    totalAmount: 1_000_000,
    paidAmount: 400_000,
    paymentMethod: 'cash',
    dueDate: '2026-08-01'
  });

  assert.equal(result.paymentStatus, 'partial');
  assert.equal(result.debtAmount, 600_000);
  assert.equal(result.dueDate, '2026-08-01');
});

test('purchase payment defaults legacy requests to fully paid', () => {
  const result = normalizePurchasePayment({ totalAmount: 250_000 });
  assert.equal(result.paidAmount, 250_000);
  assert.equal(result.paymentStatus, 'paid');
  assert.equal(result.paymentMethod, 'other');
});

test('purchase payment rejects overpayment', () => {
  assert.throws(
    () => normalizePurchasePayment({ totalAmount: 100_000, paidAmount: 100_001, paymentMethod: 'cash' }),
    /từ 0 đến tổng tiền/
  );
});
