const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function getKpiPercentChange(current, previous) {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  const currentValue = number(current);
  const previousValue = number(previous);

  if (previousValue === 0) return null;
  const percentage = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
  return Number(Math.max(-100, Math.min(100, percentage)).toFixed(1));
}

export function normalizeSalesMetrics(orderRow = {}, itemRow = {}) {
  const netRevenue = number(orderRow.net_revenue);
  const completedOrders = number(orderRow.completed_orders);
  const productsSold = number(itemRow.products_sold);
  const missingCostProductCount = number(itemRow.missing_cost_product_count);
  const knownCostOfGoodsSold = productsSold === 0
    ? 0
    : itemRow.cost_of_goods_sold === null || itemRow.cost_of_goods_sold === undefined
      ? null
      : Math.round(number(itemRow.cost_of_goods_sold));
  const knownCostNetRevenue = productsSold === 0
    ? 0
    : itemRow.known_cost_net_revenue === null || itemRow.known_cost_net_revenue === undefined
      ? null
      : Math.round(number(itemRow.known_cost_net_revenue));
  const provisionalGrossProfit = knownCostOfGoodsSold === null || knownCostNetRevenue === null
    ? null
    : Math.round(knownCostNetRevenue - knownCostOfGoodsSold);

  return {
    netRevenue,
    completedOrders,
    averageOrderValue: completedOrders > 0 ? netRevenue / completedOrders : 0,
    productsSold,
    knownCostOfGoodsSold,
    costOfGoodsSold: missingCostProductCount > 0 ? null : knownCostOfGoodsSold,
    knownCostNetRevenue,
    provisionalGrossProfit,
    grossProfit: knownCostOfGoodsSold === null || missingCostProductCount > 0
      ? null
      : Math.round(netRevenue - knownCostOfGoodsSold),
    missingCostProductCount
  };
}

function shiftDate(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function resolveDashboardRanges({ period = 'today', dateFrom = '', dateTo = '', today }) {
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  let startDate;
  let endDate;

  if (validDate(dateFrom) && validDate(dateTo) && dateFrom <= dateTo) {
    startDate = dateFrom;
    endDate = dateTo;
  } else if (period === 'yesterday') {
    startDate = shiftDate(today, -1);
    endDate = startDate;
  } else {
    const days = { '7days': 7, '14days': 14, '30days': 30, '90days': 90 }[period] || 1;
    endDate = today;
    startDate = shiftDate(today, -(days - 1));
  }

  const dayCount = Math.round((new Date(`${endDate}T00:00:00Z`) - new Date(`${startDate}T00:00:00Z`)) / 86400000) + 1;
  const previousEndDate = shiftDate(startDate, -1);
  const previousStartDate = shiftDate(previousEndDate, -(dayCount - 1));

  return { startDate, endDate, previousStartDate, previousEndDate, dayCount };
}

// Pure business-rule counterpart used by regression tests. Production uses the
// equivalent aggregate SQL in dashboardController/revenueReportRepository.
export function aggregateCostAtSaleFixtures(orders = []) {
  const completed = orders.filter((order) => order.status === 'completed');
  let netRevenue = 0;
  let knownCostNetRevenue = 0;
  let knownCostOfGoodsSold = 0;
  let productsSold = 0;
  const missingProducts = new Set();

  completed.forEach((order) => {
    const subtotal = order.items.reduce((sum, item) => sum + number(item.unitPrice) * number(item.quantity), 0);
    const deductions = number(order.discount) + number(order.refund);
    order.items.forEach((item) => {
      const lineRevenue = number(item.unitPrice) * number(item.quantity);
      const lineNetRevenue = lineRevenue - (subtotal > 0 ? lineRevenue / subtotal * deductions : 0);
      const soldQuantity = Math.max(number(item.quantity) - number(item.returnedQuantity), 0);
      productsSold += soldQuantity;
      netRevenue += lineNetRevenue;
      if (soldQuantity > 0 && number(item.costAtSale) > 0) {
        knownCostOfGoodsSold += soldQuantity * number(item.costAtSale);
        knownCostNetRevenue += lineNetRevenue;
      } else if (soldQuantity > 0) {
        missingProducts.add(item.productId);
      }
    });
  });

  return normalizeSalesMetrics(
    { net_revenue: Math.round(netRevenue), completed_orders: completed.length },
    {
      products_sold: productsSold,
      cost_of_goods_sold: Math.round(knownCostOfGoodsSold),
      known_cost_net_revenue: Math.round(knownCostNetRevenue),
      missing_cost_product_count: missingProducts.size
    }
  );
}
