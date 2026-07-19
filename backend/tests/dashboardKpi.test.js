import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateCostAtSaleFixtures, getKpiPercentChange, normalizeSalesMetrics, resolveDashboardRanges } from '../utils/dashboardKpi.js';

test('Dashboard không công bố giá vốn và lợi nhuận đầy đủ khi còn thiếu giá vốn', () => {
  const metrics = normalizeSalesMetrics(
    { net_revenue: 850000, completed_orders: 2 },
    { products_sold: 5, cost_of_goods_sold: 300000, known_cost_net_revenue: 700000, missing_cost_product_count: 1 }
  );

  assert.equal(metrics.netRevenue, 850000);
  assert.equal(metrics.averageOrderValue, 425000);
  assert.equal(metrics.knownCostOfGoodsSold, 300000);
  assert.equal(metrics.costOfGoodsSold, null);
  assert.equal(metrics.grossProfit, null);
  assert.equal(metrics.provisionalGrossProfit, 400000);
  assert.equal(metrics.missingCostProductCount, 1);
});

for (const [period, expected] of [
  ['today', ['2026-07-18', '2026-07-18', '2026-07-17', '2026-07-17']],
  ['yesterday', ['2026-07-17', '2026-07-17', '2026-07-16', '2026-07-16']],
  ['7days', ['2026-07-12', '2026-07-18', '2026-07-05', '2026-07-11']],
  ['14days', ['2026-07-05', '2026-07-18', '2026-06-21', '2026-07-04']],
  ['30days', ['2026-06-19', '2026-07-18', '2026-05-20', '2026-06-18']],
  ['90days', ['2026-04-20', '2026-07-18', '2026-01-20', '2026-04-19']]
]) {
  test(`Dashboard tạo đúng khoảng hiện tại và kỳ trước cho ${period}`, () => {
    const range = resolveDashboardRanges({ period, today: '2026-07-18' });
    assert.deepEqual(
      [range.startDate, range.endDate, range.previousStartDate, range.previousEndDate],
      expected
    );
  });
}

test('Dashboard tạo kỳ trước cùng số ngày cho khoảng tùy chỉnh', () => {
  assert.deepEqual(
    resolveDashboardRanges({ dateFrom: '2026-07-03', dateTo: '2026-07-08', today: '2026-07-18' }),
    {
      startDate: '2026-07-03', endDate: '2026-07-08',
      previousStartDate: '2026-06-27', previousEndDate: '2026-07-02', dayCount: 6
    }
  );
});

test('cost_at_sale tính đúng nhiều sản phẩm, số lượng lớn hơn 1, giảm giá và hoàn trả', () => {
  const metrics = aggregateCostAtSaleFixtures([
    {
      status: 'completed', discount: 30000, refund: 20000,
      items: [
        { productId: 1, quantity: 3, returnedQuantity: 1, unitPrice: 100000, costAtSale: 40000 },
        { productId: 2, quantity: 2, returnedQuantity: 0, unitPrice: 200000, costAtSale: 120000 }
      ]
    },
    {
      status: 'cancelled', discount: 0, refund: 0,
      items: [{ productId: 3, quantity: 10, unitPrice: 500000, costAtSale: 100000 }]
    }
  ]);

  assert.equal(metrics.completedOrders, 1);
  assert.equal(metrics.productsSold, 4);
  assert.equal(metrics.netRevenue, 650000);
  assert.equal(metrics.costOfGoodsSold, 320000);
  assert.equal(metrics.grossProfit, 330000);
});

test('cost_at_sale null không bị coi là 0', () => {
  const metrics = aggregateCostAtSaleFixtures([{
    status: 'completed', discount: 0, refund: 0,
    items: [
      { productId: 1, quantity: 1, unitPrice: 100000, costAtSale: 40000 },
      { productId: 2, quantity: 1, unitPrice: 200000, costAtSale: null }
    ]
  }]);

  assert.equal(metrics.missingCostProductCount, 1);
  assert.equal(metrics.costOfGoodsSold, null);
  assert.equal(metrics.grossProfit, null);
  assert.equal(metrics.provisionalGrossProfit, 60000);
});

test('Dashboard trả null khi kỳ trước không phát sinh', () => {
  assert.equal(getKpiPercentChange(500000, 0), null);
  assert.equal(getKpiPercentChange(0, 0), null);
});

test('Dashboard tính phần trăm theo đúng công thức kỳ trước', () => {
  assert.equal(getKpiPercentChange(120, 100), 20);
  assert.equal(getKpiPercentChange(75, 100), -25);
  assert.equal(getKpiPercentChange(350, 100), 100);
  assert.equal(getKpiPercentChange(0, 100), -100);
});
