import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateOrderFixtures, fillDailySeries, fillHourlySeries, groupTransactionsByHour, percentChange, previousPeriod } from '../utils/revenueReportMath.js';
import {
  validateAiReportHistoryId,
  validateAiReportHistoryQuery,
  validateRevenueReportQuery
} from '../validation/revenueReportValidation.js';
import { requireFullAccess } from '../middleware/auth.js';

test('loại hóa đơn cancelled và tính doanh thu/lợi nhuận đúng', () => {
  const metrics = aggregateOrderFixtures([
    { status: 'completed', grossRevenue: 1000000, discount: 100000, refunds: 50000, cost: 400000 },
    { status: 'cancelled', grossRevenue: 9000000, discount: 0, refunds: 9000000, cost: 100000 }
  ]);
  assert.equal(metrics.completedOrders, 1);
  assert.equal(metrics.netRevenue, 850000);
  assert.equal(metrics.grossProfit, 450000);
});

test('giảm giá và hoàn trả chỉ bị trừ đúng một lần', () => {
  const metrics = aggregateOrderFixtures([
    { status: 'completed', grossRevenue: 500000, discount: 50000, refunds: 100000, cost: 200000 }
  ]);
  assert.equal(metrics.discount, 50000);
  assert.equal(metrics.refunds, 100000);
  assert.equal(metrics.netRevenue, 350000);
});

test('tính kỳ trước liền kề và phần trăm so sánh', () => {
  assert.deepEqual(previousPeriod('2026-07-08', '2026-07-14'), { from: '2026-07-01', to: '2026-07-07' });
  assert.equal(percentChange(120, 100), 20);
  assert.equal(percentChange(0, 0), 0);
});

test('điền nhóm ngày thiếu và nhóm doanh thu theo giờ', () => {
  const daily = fillDailySeries([{ date: '2026-07-01', netRevenue: 100 }], '2026-07-01', '2026-07-03');
  assert.deepEqual(daily.map((item) => item.netRevenue), [100, 0, 0]);
  assert.deepEqual(groupTransactionsByHour([{ hour: 9, netRevenue: 10 }, { hour: 9, netRevenue: 20 }, { hour: 10, netRevenue: 5 }]), [
    { hour: 9, netRevenue: 30 }, { hour: 10, netRevenue: 5 }
  ]);
});

test('biểu đồ trong ngày tăng khi có dữ liệu và trở về 0 ở giờ không có dữ liệu', () => {
  const hourly = fillHourlySeries([
    { hour: 14, net_revenue: 1200000, gross_profit: 850000 }
  ], 15);

  assert.deepEqual(hourly.slice(13), [
    { label: '13:00', netRevenue: 0, grossProfit: 0 },
    { label: '14:00', netRevenue: 1200000, grossProfit: 850000 },
    { label: '15:00', netRevenue: 0, grossProfit: 0 }
  ]);
});

test('validation từ chối query không hợp lệ', () => {
  assert.throws(() => validateRevenueReportQuery({ from: '2026-02-30', to: '2026-03-01' }), /không hợp lệ/);
  assert.throws(() => validateRevenueReportQuery({ from: '2026-01-01', to: '2026-01-02', sortBy: 'DROP TABLE' }), /sắp xếp/);
});

test('validation lịch sử AI chuẩn hóa phân trang và mã kết quả', () => {
  assert.deepEqual(validateAiReportHistoryQuery({ page: '2', limit: '5', search: ' Gemini ' }), {
    page: 2,
    limit: 5,
    search: 'Gemini'
  });
  assert.equal(validateAiReportHistoryId('12'), 12);
  assert.throws(() => validateAiReportHistoryQuery({ limit: 51 }), /Số dòng/);
  assert.throws(() => validateAiReportHistoryId('abc'), /Mã lịch sử/);
});

test('middleware từ chối người không có quyền báo cáo', () => {
  let statusCode;
  let body;
  const req = { user: { role: 'employee' } };
  const res = { status(code) { statusCode = code; return this; }, json(value) { body = value; return this; } };
  requireFullAccess(req, res, () => assert.fail('không được gọi next'));
  assert.equal(statusCode, 403);
  assert.ok(body.message);
});
