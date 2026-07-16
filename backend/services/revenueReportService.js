import * as repository from '../repositories/revenueReportRepository.js';
import { calculateRevenueMetrics, fillDailySeries, fillHourlySeries, money, percentChange, previousPeriod } from '../utils/revenueReportMath.js';
import { analyzePosWithGemini } from './geminiRevenueAnalysisService.js';
import { getRestockSnapshot } from './restockForecastService.js';
import {
  deleteAiReportAnalysisById,
  getAiReportAnalysisById,
  listAiReportAnalyses,
  saveAiReportAnalysis
} from '../repositories/aiReportAnalysisRepository.js';

function metricChanges(current, previous) {
  return Object.fromEntries(
    ['netRevenue', 'cost', 'grossProfit', 'completedOrders', 'averageOrderValue', 'discount', 'refunds']
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

function getBusinessDateTime() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour)
  };
}

export async function getSummary(filters) {
  const previous = previousPeriod(filters.from, filters.to);
  const [currentRow, previousRow, filterOptions, availability] = await Promise.all([
    repository.getAggregate(filters),
    filters.compare ? repository.getAggregate(filters, previous) : Promise.resolve({}),
    repository.getFilterOptions(),
    repository.getDataAvailability()
  ]);
  const current = calculateRevenueMetrics(currentRow);
  const previousMetrics = calculateRevenueMetrics(previousRow);
  return {
    range: { from: filters.from, to: filters.to, previousFrom: previous.from, previousTo: previous.to },
    metrics: { ...current, changes: filters.compare ? metricChanges(current, previousMetrics) : {} },
    comparison: filters.compare ? previousMetrics : null,
    filterOptions,
    dataAvailability: {
      availableFrom: availability.available_from || null,
      availableTo: availability.available_to || null
    },
    notes: {
      tax: 'Doanh thu báo cáo không bao gồm VAT vì schema lưu VAT riêng trong vat_amount.',
      cost: 'Giá vốn dùng cost_price hiện tại do order_items chưa lưu snapshot giá vốn lúc bán.',
      refunds: 'Chỉ trừ giao dịch hoàn tiền riêng (payment_method=refund); hóa đơn cancelled bị loại khỏi doanh thu và không bị trừ lần hai.'
    }
  };
}

export async function getTrend(filters) {
  if (filters.from === filters.to) {
    const businessNow = getBusinessDateTime();
    const endHour = filters.to === businessNow.date ? businessNow.hour : 23;
    return {
      grouping: 'hour',
      points: fillHourlySeries(await repository.getHourlyTrend(filters), endHour)
    };
  }

  const rows = await repository.getDaily(filters);
  return groupTrend(rows, filters.from, filters.to);
}

export async function getCategories(filters) {
  return { items: normalizeCategories(await repository.getCategories(filters)) };
}

export async function getPaymentMethods(filters) {
  const rows = await repository.getPaymentMethods(filters);
  const totalTransactions = rows.reduce((sum, row) => sum + Number(row.transaction_count || 0), 0);
  return { items: rows.map((row) => ({
    paymentMethod: row.payment_method,
    amount: money(row.amount),
    transactionCount: Number(row.transaction_count || 0),
    percentage: totalTransactions > 0 ? Number((Number(row.transaction_count || 0) / totalTransactions * 100).toFixed(1)) : 0
  })).filter((item) => item.transactionCount > 0) };
}

export async function getHourly(filters) {
  const items = normalizeHourly(await repository.getHourly(filters));
  const peak = [...items].sort((a, b) => b.netRevenue - a.netRevenue)[0] || null;
  return { items, peakHour: peak?.netRevenue > 0 ? peak.hour : null };
}

export async function getStockAlerts(filters) {
  return getRestockSnapshot({ categoryId: filters.categoryId, targetDays: 30, limit: 8 });
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

function buildAiCharts({ trend, categories, topProducts, includeRevenueTrend = true }) {
  const charts = [];
  if (includeRevenueTrend && (trend?.points || []).some((item) => item.netRevenue || item.grossProfit)) {
    charts.push({
      id: 'ai_business_trend',
      title: 'Diễn biến doanh thu và lợi nhuận',
      type: 'line',
      valueFormat: 'currency',
      labels: trend.points.map((item) => item.label),
      datasets: [
        { label: 'Doanh thu thuần', data: trend.points.map((item) => item.netRevenue), color: '#74B8E0' },
        { label: 'Lợi nhuận gộp', data: trend.points.map((item) => item.grossProfit), color: '#14a88f' }
      ]
    });
  }

  const categoryItems = (categories || []).filter((item) => item.netRevenue > 0).slice(0, 6);
  if (categoryItems.length) {
    charts.push({
      id: 'ai_category_mix',
      title: 'Tỷ trọng doanh thu theo danh mục',
      type: 'doughnut',
      valueFormat: 'currency',
      labels: categoryItems.map((item) => item.name),
      datasets: [{ label: 'Doanh thu', data: categoryItems.map((item) => item.netRevenue) }]
    });
  }

  const productItems = (topProducts || []).filter((item) => item.netRevenue > 0).slice(0, 5);
  if (productItems.length) {
    charts.push({
      id: 'ai_top_products',
      title: 'Sản phẩm tạo doanh thu cao nhất',
      type: 'bar',
      orientation: 'horizontal',
      valueFormat: 'currency',
      labels: productItems.map((item) => item.name),
      datasets: [{ label: 'Doanh thu thuần', data: productItems.map((item) => item.netRevenue), color: '#8255e8' }]
    });
  }
  return charts;
}

export async function getProducts(filters, options) {
  const result = await repository.getProducts(filters, options);
  return {
    items: result.rows.map(normalizeProduct),
    pagination: { page: filters.page, limit: filters.limit, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / filters.limit)) }
  };
}

export async function getAiAnalysis(filters, { requestedBy = null } = {}) {
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
  const analysisTrend = groupTrend(selectedDailyRows, filters.from, filters.to);
  const paymentTotal = paymentRows.reduce((sum, row) => sum + money(row.amount), 0);
  const payments = paymentRows.map((row) => ({
    paymentMethod: row.payment_method,
    amount: money(row.amount),
    percentage: paymentTotal > 0 ? Number((money(row.amount) / paymentTotal * 100).toFixed(1)) : 0
  })).filter((item) => item.amount > 0);
  const snapshot = {
    range: {
      from: filters.from,
      to: filters.to,
      previousFrom: filters.compare ? previous.from : null,
      previousTo: filters.compare ? previous.to : null
    },
    activeFilters: {
      categoryId: filters.categoryId, employeeId: filters.employeeId,
      paymentMethod: filters.paymentMethod || null, orderStatus: filters.orderStatus,
      comparePreviousPeriod: filters.compare
    },
    summary: filters.compare ? { ...current, changes: metricChanges(current, previousMetrics) } : current,
    previousSummary: filters.compare ? previousMetrics : null,
    selectedTrend: fillDailySeries(selectedDailyRows, filters.from, filters.to),
    dailyHistory: historyRows.map((row) => ({ date: row.date, netRevenue: money(row.net_revenue), grossProfit: money(row.gross_profit) })),
    categories,
    previousCategories: filters.compare ? previousCategories : [],
    paymentMethods: payments,
    hourly,
    topProducts: productResult.rows.slice(0, 20).map(normalizeProduct),
    operations: {
      inventory: Object.fromEntries(Object.entries(posOverview.inventory).map(([key, value]) => [key, money(value)])),
      inventoryRisks: posOverview.inventoryRisks.map((item) => ({
        productId: item.product_id, productName: item.name, stock: Number(item.stock_quantity || 0),
        minimumStock: Number(item.min_stock || 0), soldInPeriod: Number(item.sold_quantity || 0)
      })),
      restockCandidates: posOverview.inventoryRisks
        .filter((item) => Number(item.stock_quantity || 0) <= Number(item.min_stock || 0))
        .map((item) => ({
          productId: item.product_id, productName: item.name,
          stock: Number(item.stock_quantity || 0), minimumStock: Number(item.min_stock || 0),
          soldInPeriod: Number(item.sold_quantity || 0)
        })),
      slowMovingProducts: posOverview.slowMovingProducts.map((item) => ({
        productId: item.product_id, productName: item.name,
        stock: Number(item.stock_quantity || 0), minimumStock: Number(item.min_stock || 0),
        lastSoldAt: item.last_sold_at
      })),
      slowMovingCount: Number(posOverview.slowMovingCount || 0),
      crossSellWindowDays: 90,
      crossSellPairs: posOverview.crossSellPairs.map((item) => ({
        firstProductId: item.first_product_id, firstProductName: item.first_product_name,
        secondProductId: item.second_product_id, secondProductName: item.second_product_name,
        pairedOrders: Number(item.paired_orders || 0)
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
  const result = {
    ...analysis,
    charts: buildAiCharts({
      trend: analysisTrend,
      categories,
      topProducts: snapshot.topProducts,
      includeRevenueTrend: filters.from !== filters.to
    }),
    snapshotScope: 'aggregated-and-anonymized'
  };
  await saveAiReportAnalysis({ requestedBy, filters, result });
  return result;
}

export async function getAiAnalysisHistory({ page, limit, search }) {
  const history = await listAiReportAnalyses({ page, limit, search });
  return {
    items: history.items,
    pagination: {
      page,
      limit,
      total: history.total,
      totalPages: Math.max(1, Math.ceil(history.total / limit))
    }
  };
}

export async function getAiAnalysisHistoryItem(id) {
  const item = await getAiReportAnalysisById(id);
  if (!item) {
    throw Object.assign(new Error('Không tìm thấy lịch sử phân tích AI'), { status: 404 });
  }
  return item;
}

export async function deleteAiAnalysisHistoryItem(id) {
  const affectedRows = await deleteAiReportAnalysisById(id);
  if (!affectedRows) {
    throw Object.assign(new Error('Không tìm thấy lịch sử phân tích AI'), { status: 404 });
  }
  return { message: 'Đã xóa lịch sử phân tích AI' };
}

export async function getExcelExportData(filters) {
  const [summary, trend, categories, payments, products, stockAlerts] = await Promise.all([
    getSummary(filters),
    getTrend(filters),
    getCategories(filters),
    getPaymentMethods(filters),
    getProducts(filters, { exportAll: true }),
    getRestockSnapshot({ categoryId: filters.categoryId, targetDays: 30, limit: 100 })
  ]);

  return {
    summary,
    trend,
    categories: categories.items,
    payments: payments.items,
    products: products.items,
    stockAlerts: stockAlerts.suggestions
  };
}

export async function getExportRows(filters) {
  return (await getProducts(filters, { exportAll: true })).items;
}
