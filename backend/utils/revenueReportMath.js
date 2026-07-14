export const money = (value) => Math.round(Number(value || 0));

export function percentChange(current, previous) {
  const currentValue = money(current);
  const previousValue = money(previous);
  if (previousValue === 0) return currentValue === 0 ? 0 : 100;
  return Number((((currentValue - previousValue) / Math.abs(previousValue)) * 100).toFixed(1));
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
  const cost = money(row.cost);
  const netRevenue = grossRevenue - discount - refunds;
  const grossProfit = netRevenue - cost;
  return {
    grossRevenue, discount, refunds, netRevenue, cost, grossProfit,
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
      grossProfit: money(row.grossProfit ?? row.gross_profit)
    });
  }
  return result;
}
