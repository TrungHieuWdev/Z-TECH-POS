export const money = (value) => Math.round(Number(value || 0));

export function percentChange(current, previous) {
  if (current == null || previous == null) return null;
  const currentValue = money(current);
  const previousValue = money(previous);
  if (previousValue === 0) return null;
  const percentage = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
  return Number(Math.max(-100, Math.min(100, percentage)).toFixed(1));
}

export function previousPeriod(from, to) {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const days = Math.round((end - start) / 86400000) + 1;
  const previousTo = new Date(start);
  previousTo.setUTCDate(previousTo.getUTCDate() - 1);
  const previousFrom = new Date(previousTo);
  previousFrom.setUTCDate(previousFrom.getUTCDate() - days + 1);
  return {
    from: previousFrom.toISOString().slice(0, 10),
    to: previousTo.toISOString().slice(0, 10)
  };
}

export function calculateRevenueMetrics(row = {}) {
  const grossRevenue = money(row.grossRevenue ?? row.gross_revenue);
  const discount = money(row.discount);
  const refunds = money(row.refunds);
  const missingCostProductCount = Number(row.missingCostProductCount ?? row.missing_cost_product_count ?? 0);
  const missingCostLineCount = Number(row.missingCostLineCount ?? row.missing_cost_line_count ?? 0);
  const costDataComplete = missingCostLineCount === 0;
  const cost = costDataComplete && row.cost != null ? money(row.cost) : null;
  const knownCost = money(row.knownCost ?? row.known_cost);
  const netRevenue = grossRevenue - discount - refunds;
  const grossProfit = cost == null ? null : netRevenue - cost;
  return {
    grossRevenue, discount, refunds, netRevenue, cost, knownCost, grossProfit,
    costDataComplete, missingCostProductCount, missingCostLineCount,
    productsSold: Number(row.productsSold ?? row.products_sold ?? 0),
    costRatio: cost != null && netRevenue > 0 ? Number((cost / netRevenue * 100).toFixed(1)) : null,
    grossMargin: grossProfit != null && netRevenue > 0 ? Number((grossProfit / netRevenue * 100).toFixed(1)) : null,
    completedOrders: Number(row.completedOrders ?? row.completed_orders ?? 0),
    averageOrderValue: Number(row.completedOrders ?? row.completed_orders ?? 0) > 0
      ? money(netRevenue / Number(row.completedOrders ?? row.completed_orders)) : 0
  };
}

// Pure counterpart of the SQL aggregation, kept small so business formulas can
// be regression-tested without requiring a seeded database.
export function aggregateOrderFixtures(orders = []) {
  const completed = orders.filter((order) => order.status === 'completed');
  return calculateRevenueMetrics(completed.reduce((totals, order) => ({
    grossRevenue: totals.grossRevenue + money(order.grossRevenue),
    discount: totals.discount + money(order.discount),
    refunds: totals.refunds + money(order.refunds),
    cost: totals.cost + money(order.cost),
    completedOrders: totals.completedOrders + 1
  }), { grossRevenue: 0, discount: 0, refunds: 0, cost: 0, completedOrders: 0 }));
}

export function groupTransactionsByHour(rows = []) {
  const hours = new Map();
  rows.forEach((row) => {
    const hour = Number(row.hour);
    hours.set(hour, money(hours.get(hour)) + money(row.netRevenue));
  });
  return [...hours.entries()].sort((a, b) => a[0] - b[0]).map(([hour, netRevenue]) => ({ hour, netRevenue }));
}

export function fillDailySeries(rows, from, to) {
  const byDate = new Map((rows || []).map((row) => [row.date, row]));
  const result = [];
  const end = new Date(`${to}T00:00:00Z`);
  for (let date = new Date(`${from}T00:00:00Z`); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    const key = date.toISOString().slice(0, 10);
    const row = byDate.get(key) || {};
    result.push({
      date: key,
      netRevenue: money(row.netRevenue ?? row.net_revenue),
      grossProfit: (row.grossProfit ?? row.gross_profit) == null && byDate.has(key)
        ? null : money(row.grossProfit ?? row.gross_profit)
    });
  }
  return result;
}

export function fillHourlySeries(rows = [], endHour = 23) {
  const lastHour = Math.max(0, Math.min(23, Number(endHour) || 0));
  const byHour = new Map(rows.map((row) => [Number(row.hour), row]));

  return Array.from({ length: lastHour + 1 }, (_, hour) => {
    const row = byHour.get(hour) || {};
    return {
      label: `${String(hour).padStart(2, '0')}:00`,
      netRevenue: money(row.netRevenue ?? row.net_revenue),
      grossProfit: (row.grossProfit ?? row.gross_profit) == null && byHour.has(hour)
        ? null : money(row.grossProfit ?? row.gross_profit)
    };
  });
}
