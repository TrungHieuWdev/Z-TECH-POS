import * as repository from '../repositories/revenueReportRepository.js';
import { calculateRevenueMetrics, fillDailySeries, money, percentChange, previousPeriod } from '../utils/revenueReportMath.js';
import { analyzePosWithGemini } from './geminiRevenueAnalysisService.js';

function metricChanges(current, previous) {
  return Object.fromEntries(
    ['netRevenue', 'grossProfit', 'completedOrders', 'averageOrderValue', 'discount', 'refunds']
      .map((key) => [key, percentChange(current[key], previous[key])])
  );
}

function normalizeCategories(rows) {
  const items = rows.map((row) => ({
    categoryId: row.category_id,
    name: row.name,
    soldQuantity: Number(row.sold_quantity || 0),
    netRevenue: money(row.net_revenue)
  }));
  const total = items.reduce((sum, item) => sum + item.netRevenue, 0);
  return items.map((item) => ({ ...item, percentage: total > 0 ? Number((item.netRevenue / total * 100).toFixed(1)) : 0 }));
}

function normalizeHourly(rows) {
  const map = new Map(rows.map((row) => [Number(row.hour), row]));
  if (!rows.length) return [];
  const start = Math.min(...map.keys());
  const end = Math.max(...map.keys());
  return Array.from({ length: end - start + 1 }, (_, index) => {
    const hour = start + index;
    const row = map.get(hour) || {};
    return { hour, netRevenue: money(row.net_revenue), completedOrders: Number(row.completed_orders || 0) };
  });
}

function groupTrend(rows, from, to) {
  const days = Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000) + 1;
  const grouping = days <= 45 ? 'day' : days <= 180 ? 'week' : 'month';
  const groups = new Map();
  fillDailySeries(rows, from, to).forEach((row) => {
    let key = row.date;
    if (grouping === 'week') {
      const date = new Date(`${row.date}T00:00:00Z`);
      const weekday = (date.getUTCDay() + 6) % 7;
      date.setUTCDate(date.getUTCDate() - weekday);
      key = date.toISOString().slice(0, 10);
    } else if (grouping === 'month') key = row.date.slice(0, 7);
    const existing = groups.get(key) || { label: key, netRevenue: 0, grossProfit: 0 };
    existing.netRevenue += row.netRevenue;
    existing.grossProfit += row.grossProfit;
    groups.set(key, existing);
  });
  return { grouping, points: [...groups.values()] };
}

export async function getSummary(filters) {
  const previous = previousPeriod(filters.from, filters.to);
  const [currentRow, previousRow, filterOptions] = await Promise.all([
    repository.getAggregate(filters),
    filters.compare ? repository.getAggregate(filters, previous) : Promise.resolve({}),
    repository.getFilterOptions()
  ]);
  const current = calculateRevenueMetrics(currentRow);
  const previousMetrics = calculateRevenueMetrics(previousRow);
  return {
    range: { from: filters.from, to: filters.to, previousFrom: previous.from, previousTo: previous.to },
    metrics: { ...current, changes: filters.compare ? metricChanges(current, previousMetrics) : {} },
    comparison: filters.compare ? previousMetrics : null,
    filterOptions,
    notes: {
      tax: 'Doanh thu báo cáo không bao gồm VAT vì schema lưu VAT riêng trong vat_amount.',
      cost: 'Giá vốn dùng cost_price hiện tại do order_items chưa lưu snapshot giá vốn lúc bán.',
      refunds: 'Chỉ trừ giao dịch hoàn tiền riêng (payment_method=refund); hóa đơn cancelled bị loại khỏi doanh thu và không bị trừ lần hai.'
    }
  };
}

export async function getTrend(filters) {
  const rows = await repository.getDaily(filters);
  return groupTrend(rows, filters.from, filters.to);
}

export async function getCategories(filters) {
  return { items: normalizeCategories(await repository.getCategories(filters)) };
}

export async function getPaymentMethods(filters) {
  const rows = await repository.getPaymentMethods(filters);
  const total = rows.reduce((sum, row) => sum + money(row.amount), 0);
  return { items: rows.map((row) => ({
    paymentMethod: row.payment_method,
    amount: money(row.amount),
    percentage: total > 0 ? Number((money(row.amount) / total * 100).toFixed(1)) : 0
  })).filter((item) => item.amount > 0) };
}

export async function getHourly(filters) {
  const items = normalizeHourly(await repository.getHourly(filters));
  const peak = [...items].sort((a, b) => b.netRevenue - a.netRevenue)[0] || null;
  return { items, peakHour: peak?.netRevenue > 0 ? peak.hour : null };
}

function normalizeProduct(row) {
  return {
    productId: row.product_id, sku: row.sku, name: row.name, categoryName: row.category_name,
    soldQuantity: Number(row.sold_quantity || 0), grossRevenue: money(row.gross_revenue),
    discount: money(row.discount), refunds: money(row.refunds), netRevenue: money(row.net_revenue),
    cost: money(row.cost), grossProfit: money(row.gross_profit),
    margin: Number(Number(row.margin || 0).toFixed(1)), returnedQuantity: Number(row.returned_quantity || 0)
  };
}

export async function getProducts(filters, options) {
  const result = await repository.getProducts(filters, options);
  return {
    items: result.rows.map(normalizeProduct),
    pagination: { page: filters.page, limit: filters.limit, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / filters.limit)) }
  };
}

export async function getAiAnalysis(filters) {
  const previous = previousPeriod(filters.from, filters.to);
  const historyFrom = new Date(`${filters.to}T00:00:00Z`);
  historyFrom.setUTCDate(historyFrom.getUTCDate() - 364);
  const aiProductFilters = { ...filters, page: 1, limit: 20, search: '', sortBy: 'netRevenue', sortOrder: 'desc' };
  const [currentRow, previousRow, categoryRows, previousCategoryRows, hourlyRows, paymentRows, selectedDailyRows, historyRows, productResult, posOverview] = await Promise.all([
    repository.getAggregate(filters), repository.getAggregate(filters, previous), repository.getCategories(filters),
    repository.getCategories(filters, previous), repository.getHourly(filters), repository.getPaymentMethods(filters),
    repository.getDaily(filters), repository.getDaily(filters, { from: historyFrom.toISOString().slice(0, 10), to: filters.to }),
    repository.getProducts(aiProductFilters), repository.getPosOverview(filters)
  ]);
  const current = calculateRevenueMetrics(currentRow);
  const previousMetrics = calculateRevenueMetrics(previousRow);
  const categories = normalizeCategories(categoryRows);
  const previousCategories = normalizeCategories(previousCategoryRows);
  const hourly = normalizeHourly(hourlyRows);
  const paymentTotal = paymentRows.reduce((sum, row) => sum + money(row.amount), 0);
  const payments = paymentRows.map((row) => ({
    paymentMethod: row.payment_method,
    amount: money(row.amount),
    percentage: paymentTotal > 0 ? Number((money(row.amount) / paymentTotal * 100).toFixed(1)) : 0
  })).filter((item) => item.amount > 0);
  const snapshot = {
    range: { from: filters.from, to: filters.to, previousFrom: previous.from, previousTo: previous.to },
    activeFilters: {
      categoryId: filters.categoryId, employeeId: filters.employeeId,
      paymentMethod: filters.paymentMethod || null, orderStatus: filters.orderStatus
    },
    summary: { ...current, changes: metricChanges(current, previousMetrics) },
    previousSummary: previousMetrics,
    selectedTrend: fillDailySeries(selectedDailyRows, filters.from, filters.to),
    dailyHistory: historyRows.map((row) => ({ date: row.date, netRevenue: money(row.net_revenue), grossProfit: money(row.gross_profit) })),
    categories,
    previousCategories,
    paymentMethods: payments,
    hourly,
    topProducts: productResult.rows.slice(0, 20).map(normalizeProduct),
    operations: {
      inventory: Object.fromEntries(Object.entries(posOverview.inventory).map(([key, value]) => [key, money(value)])),
      inventoryRisks: posOverview.inventoryRisks.map((item) => ({
        productId: item.product_id, productName: item.name, stock: Number(item.stock_quantity || 0),
        minimumStock: Number(item.min_stock || 0), soldInPeriod: Number(item.sold_quantity || 0)
      })),
      employeePerformance: posOverview.employees.map((item) => ({
        employee: `NV-${item.user_id}`, completedOrders: Number(item.completed_orders || 0), netRevenue: money(item.net_revenue)
      })),
      customers: Object.fromEntries(Object.entries(posOverview.customers).map(([key, value]) => [key, Number(value || 0)])),
      purchases: Object.fromEntries(Object.entries(posOverview.purchases).map(([key, value]) => [key, money(value)])),
      promotions: Object.fromEntries(Object.entries(posOverview.promotions).map(([key, value]) => [key, Number(value || 0)])),
      orderStatuses: posOverview.orderStatuses.map((item) => ({ status: item.status, total: Number(item.total || 0) }))
    },
    schemaNotes: [
      'Doanh thu không gồm VAT vì vat_amount lưu riêng.',
      'Giá vốn lịch sử dùng products.cost_price hiện tại vì order_items chưa có cost snapshot.',
      'POS chưa có dữ liệu hoàn trả từng dòng sản phẩm.'
    ]
  };
  const analysis = await analyzePosWithGemini(snapshot);
  return { ...analysis, snapshotScope: 'aggregated-and-anonymized' };
}

export async function getExportRows(filters) {
  return (await getProducts(filters, { exportAll: true })).items;
}
