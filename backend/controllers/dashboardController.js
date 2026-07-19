import { query } from '../config/db.js';
import { listWarranties } from './warrantyController.js';
import { getKpiPercentChange, normalizeSalesMetrics, resolveDashboardRanges } from '../utils/dashboardKpi.js';

const toNumber = (value) => Number(value || 0);

async function getSalesMetrics(orderDateFilter, itemDateFilter) {
  const [orderRows, itemRows] = await Promise.all([
    query(
      `SELECT
         COALESCE(SUM(o.subtotal - COALESCE(o.discount, 0) - COALESCE(refunds.amount, 0)), 0) AS net_revenue,
         COUNT(*) AS completed_orders
       FROM orders o
       LEFT JOIN (
         SELECT order_id, SUM(amount) AS amount
         FROM payments
         WHERE payment_method = 'refund'
           AND status IN ('completed', 'refunded')
         GROUP BY order_id
       ) refunds ON refunds.order_id = o.id
       WHERE o.status = 'completed' AND ${orderDateFilter}`
    ),
    query(
      `SELECT
         COALESCE(SUM(GREATEST(oi.quantity - COALESCE(returned.quantity, 0), 0)), 0) AS products_sold,
         COALESCE(SUM(
           CASE
             WHEN NULLIF(oi.cost_at_sale, 0) > 0
             THEN GREATEST(oi.quantity - COALESCE(returned.quantity, 0), 0)
               * NULLIF(oi.cost_at_sale, 0)
           END
         ), NULL) AS cost_of_goods_sold,
         COALESCE(SUM(CASE
           WHEN NULLIF(oi.cost_at_sale, 0) > 0
           THEN oi.subtotal - CASE WHEN o.subtotal > 0
             THEN (oi.subtotal / o.subtotal) * (COALESCE(o.discount, 0) + COALESCE(refunds.amount, 0))
             ELSE 0 END
         END), NULL) AS known_cost_net_revenue,
         COUNT(DISTINCT CASE
           WHEN GREATEST(oi.quantity - COALESCE(returned.quantity, 0), 0) > 0
             AND (oi.cost_at_sale IS NULL OR oi.cost_at_sale <= 0)
           THEN oi.product_id
         END) AS missing_cost_product_count
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       LEFT JOIN (
         SELECT order_id, SUM(amount) AS amount
         FROM payments
         WHERE payment_method = 'refund'
           AND status IN ('completed', 'refunded')
         GROUP BY order_id
       ) refunds ON refunds.order_id = o.id
       LEFT JOIN (
         SELECT reference_id AS order_id, product_id, SUM(quantity) AS quantity
         FROM inventory_logs
         WHERE type = 'RETURN' AND reference_type = 'ORDER'
         GROUP BY reference_id, product_id
       ) returned ON returned.order_id = o.id AND returned.product_id = oi.product_id
       WHERE o.status = 'completed' AND ${itemDateFilter}`
    )
  ]);

  return normalizeSalesMetrics(orderRows[0], itemRows[0]);
}

function getCategorySharePeriod(value = 'today') {
  return ['today', 'yesterday', '7days', '14days', '30days', '90days'].includes(value) ? value : 'today';
}

function getSelectedDate(value) {
  const date = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';

  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? '' : date;
}

function getDaysUntil(dateValue) {
  const today = new Date();
  const target = new Date(dateValue);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

function getCategoryShareDateFilter(period = 'today') {
  switch (period) {
    case 'today':
      return 'AND DATE(o.created_at) = CURDATE()';
    case 'yesterday':
      return 'AND DATE(o.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
    case '7days':
      return 'AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND o.created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)';
    case '14days':
      return 'AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY) AND o.created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)';
    case '90days':
      return 'AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL 89 DAY) AND o.created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)';
    case '30days':
    default:
      return 'AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) AND o.created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)';
  }
}

function getPeriodFilters(value = 'today', alias = '', selectedDate = '', dateFrom = '', dateTo = '') {
  const period = getCategorySharePeriod(value);
  const column = `${alias}created_at`;
  const date = getSelectedDate(selectedDate);
  const from = getSelectedDate(dateFrom);
  const to = getSelectedDate(dateTo);
  if (from && to && from <= to) {
    return {
      current: `${column} >= '${from}' AND ${column} < DATE_ADD('${to}', INTERVAL 1 DAY)`,
      previous: `${column} >= DATE_SUB('${from}', INTERVAL (DATEDIFF('${to}', '${from}') + 1) DAY) AND ${column} < '${from}'`
    };
  }
  if (date) {
    return {
      current: `DATE(${column}) = '${date}'`,
      previous: `DATE(${column}) = DATE_SUB('${date}', INTERVAL 1 DAY)`
    };
  }
  if (period === 'today') return { current: `DATE(${column}) = CURDATE()`, previous: `DATE(${column}) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)` };
  if (period === 'yesterday') return { current: `DATE(${column}) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`, previous: `DATE(${column}) = DATE_SUB(CURDATE(), INTERVAL 2 DAY)` };
  if (period === '7days') return { current: `${column} >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND ${column} < DATE_ADD(CURDATE(), INTERVAL 1 DAY)`, previous: `${column} >= DATE_SUB(CURDATE(), INTERVAL 13 DAY) AND ${column} < DATE_SUB(CURDATE(), INTERVAL 6 DAY)` };
  if (period === '14days') return { current: `${column} >= DATE_SUB(CURDATE(), INTERVAL 13 DAY) AND ${column} < DATE_ADD(CURDATE(), INTERVAL 1 DAY)`, previous: `${column} >= DATE_SUB(CURDATE(), INTERVAL 27 DAY) AND ${column} < DATE_SUB(CURDATE(), INTERVAL 13 DAY)` };
  if (period === '90days') return { current: `${column} >= DATE_SUB(CURDATE(), INTERVAL 89 DAY) AND ${column} < DATE_ADD(CURDATE(), INTERVAL 1 DAY)`, previous: `${column} >= DATE_SUB(CURDATE(), INTERVAL 179 DAY) AND ${column} < DATE_SUB(CURDATE(), INTERVAL 89 DAY)` };
  return { current: `${column} >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) AND ${column} < DATE_ADD(CURDATE(), INTERVAL 1 DAY)`, previous: `${column} >= DATE_SUB(CURDATE(), INTERVAL 59 DAY) AND ${column} < DATE_SUB(CURDATE(), INTERVAL 29 DAY)` };
}

export async function getSummary(req, res) {
  try {
    const businessToday = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    const range = resolveDashboardRanges({
      period: req.query.period || 'today',
      dateFrom: req.query.date_from,
      dateTo: req.query.date_to,
      today: businessToday
    });
    const filters = getPeriodFilters(req.query.period || 'today', '', req.query.date, req.query.date_from, req.query.date_to);
    const itemFilters = getPeriodFilters(req.query.period || 'today', 'o.', req.query.date, req.query.date_from, req.query.date_to);
    const [
      currentMetrics,
      previousMetrics,
      monthRevenue,
      lowStock,
      paymentTotals
    ] = await Promise.all([
      getSalesMetrics(filters.current, itemFilters.current),
      getSalesMetrics(filters.previous, itemFilters.previous),
      query(
        `SELECT COALESCE(SUM(o.subtotal - COALESCE(o.discount, 0) - COALESCE(refunds.amount, 0)), 0) AS value
         FROM orders o
         LEFT JOIN (
           SELECT order_id, SUM(amount) AS amount
           FROM payments
           WHERE payment_method = 'refund'
             AND status IN ('completed', 'refunded')
           GROUP BY order_id
         ) refunds ON refunds.order_id = o.id
         WHERE o.status = 'completed'
           AND YEAR(o.created_at) = YEAR(CURDATE())
           AND MONTH(o.created_at) = MONTH(CURDATE())`
      ),
      query('SELECT COUNT(*) AS value FROM products WHERE is_active = 1 AND stock_quantity <= min_stock'),
      query(
        `SELECT
           SUM(CASE WHEN payment_method = 'cash' THEN 1 ELSE 0 END) AS cash_count,
           SUM(CASE WHEN payment_method = 'transfer' THEN 1 ELSE 0 END) AS transfer_count
         FROM orders
         WHERE status = 'completed' AND ${filters.current}`
      )
    ]);

    res.json({
      todayRevenue: currentMetrics.netRevenue,
      yesterdayRevenue: previousMetrics.netRevenue,
      monthRevenue: toNumber(monthRevenue[0].value),
      todayOrders: currentMetrics.completedOrders,
      yesterdayOrders: previousMetrics.completedOrders,
      averageOrderValue: currentMetrics.averageOrderValue,
      previousAverageOrderValue: previousMetrics.averageOrderValue,
      lowStockCount: toNumber(lowStock[0].value),
      productsSold: currentMetrics.productsSold,
      previousProductsSold: previousMetrics.productsSold,
      costOfGoodsSold: currentMetrics.costOfGoodsSold,
      previousCostOfGoodsSold: previousMetrics.costOfGoodsSold,
      knownCostOfGoodsSold: currentMetrics.knownCostOfGoodsSold,
      previousKnownCostOfGoodsSold: previousMetrics.knownCostOfGoodsSold,
      knownCostNetRevenue: currentMetrics.knownCostNetRevenue,
      previousKnownCostNetRevenue: previousMetrics.knownCostNetRevenue,
      grossProfit: currentMetrics.grossProfit,
      previousGrossProfit: previousMetrics.grossProfit,
      estimatedProfit: currentMetrics.missingCostProductCount > 0
        ? currentMetrics.provisionalGrossProfit
        : currentMetrics.grossProfit,
      previousEstimatedProfit: previousMetrics.missingCostProductCount > 0
        ? previousMetrics.provisionalGrossProfit
        : previousMetrics.grossProfit,
      missingCostProductCount: currentMetrics.missingCostProductCount,
      previousMissingCostProductCount: previousMetrics.missingCostProductCount,
      costDataComplete: currentMetrics.missingCostProductCount === 0,
      revenueGrowth: getKpiPercentChange(currentMetrics.netRevenue, previousMetrics.netRevenue),
      orderGrowth: getKpiPercentChange(currentMetrics.completedOrders, previousMetrics.completedOrders),
      averageOrderValueGrowth: getKpiPercentChange(currentMetrics.averageOrderValue, previousMetrics.averageOrderValue),
      productsSoldGrowth: getKpiPercentChange(currentMetrics.productsSold, previousMetrics.productsSold),
      estimatedProfitGrowth: currentMetrics.missingCostProductCount > 0 || previousMetrics.missingCostProductCount > 0
        ? null
        : getKpiPercentChange(currentMetrics.grossProfit, previousMetrics.grossProfit),
      range,
      paymentCashCount: toNumber(paymentTotals[0].cash_count),
      paymentTransferCount: toNumber(paymentTotals[0].transfer_count)
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy tổng quan', error: error.message });
  }
}

export async function getRevenueChart(req, res) {
  try {
    const period = getCategorySharePeriod(req.query.period || 'today');
    const selectedDate = getSelectedDate(req.query.date);
    const filters = getPeriodFilters(period, '', selectedDate, req.query.date_from, req.query.date_to);
    const rangeFrom = getSelectedDate(req.query.date_from);
    const rangeTo = getSelectedDate(req.query.date_to);
    const isSingleDayRange = rangeFrom && rangeTo && rangeFrom === rangeTo;
    const bucketExpression = period === 'today' || period === 'yesterday' || selectedDate || isSingleDayRange
      ? 'HOUR(created_at)'
      : "DATE_FORMAT(created_at, '%Y-%m-%d')";

    const rows = await query(
      `SELECT ${bucketExpression} AS bucket,
         COALESCE(SUM(o.subtotal - COALESCE(o.discount, 0) - COALESCE(refunds.amount, 0)), 0) AS revenue
       FROM orders o
       LEFT JOIN (
         SELECT order_id, SUM(amount) AS amount
         FROM payments
         WHERE payment_method = 'refund'
           AND status IN ('completed', 'refunded')
         GROUP BY order_id
       ) refunds ON refunds.order_id = o.id
       WHERE o.status = 'completed'
         AND ${filters.current}
       GROUP BY ${bucketExpression}
       ORDER BY ${bucketExpression}`
    );

    res.json(rows.map((row) => ({
      bucket: row.bucket,
      revenue: toNumber(row.revenue)
    })));
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy biểu đồ doanh thu', error: error.message });
  }
}

export async function getTopProducts(req, res) {
  try {
    const filters = getPeriodFilters(req.query.period || 'today', 'o.', req.query.date, req.query.date_from, req.query.date_to);
    const rows = await query(
      `SELECT
         p.id AS product_id,
         p.name,
         COALESCE(c.name, 'Chưa phân loại') AS category_name,
         MAX(p.price) AS price,
         SUM(oi.quantity) AS quantity,
         SUM(oi.subtotal) AS revenue
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN orders o ON oi.order_id = o.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE o.status = 'completed'
         AND ${filters.current}
       GROUP BY p.id, p.name, c.name
       ORDER BY revenue DESC
       LIMIT 5`
    );

    res.json(rows.map((row) => ({
      ...row,
      price: toNumber(row.price),
      quantity: toNumber(row.quantity),
      revenue: toNumber(row.revenue)
    })));
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy sản phẩm bán chạy', error: error.message });
  }
}

export async function getLowStock(req, res) {
  try {
    const rows = await query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_active = 1 AND p.stock_quantity <= p.min_stock
       ORDER BY p.stock_quantity ASC`
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy sản phẩm sắp hết hàng', error: error.message });
  }
}

export async function getCategoryShare(req, res) {
  try {
    const period = getCategorySharePeriod(req.query.period);
    const selectedDate = getSelectedDate(req.query.date);
    const dateFilter = selectedDate
      ? `AND DATE(o.created_at) = '${selectedDate}'`
      : getCategoryShareDateFilter(period);
    const rows = await query(
      `SELECT
         COALESCE(c.name, 'Chưa phân loại') AS name,
         SUM(oi.subtotal) AS revenue,
         SUM(oi.quantity) AS quantity
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN products p ON oi.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE o.status = 'completed'
         ${dateFilter}
       GROUP BY c.id, c.name
       ORDER BY revenue DESC`
    );
    const totalRevenue = rows.reduce((sum, row) => sum + toNumber(row.revenue), 0);

    res.json(rows.map((row) => ({
      name: row.name,
      revenue: toNumber(row.revenue),
      quantity: toNumber(row.quantity),
      percentage: totalRevenue > 0 ? Number(((toNumber(row.revenue) / totalRevenue) * 100).toFixed(1)) : 0
    })));
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy cơ cấu doanh thu', error: error.message });
  }
}

export async function getRecentOrders(req, res) {
  try {
    const filters = getPeriodFilters(req.query.period || 'today', 'o.', req.query.date, req.query.date_from, req.query.date_to);
    const rows = await query(
      `SELECT
         o.id,
         o.order_number,
         o.total,
         o.status,
         o.payment_method,
         o.created_at,
         COALESCE(c.name, 'Khách thường') AS customer_name,
         u.name AS cashier_name
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN users u ON o.user_id = u.id
       WHERE ${filters.current}
       ORDER BY o.created_at DESC
       LIMIT 6`
    );

    res.json(rows.map((row) => ({
      ...row,
      total: toNumber(row.total)
    })));
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy đơn hàng gần đây', error: error.message });
  }
}

export async function getOperationalAlerts(req, res) {
  try {
    const [lowStockRows, outOfStockRows, slowMovingRows, warranties] = await Promise.all([
      query(
        `SELECT COUNT(*) AS value
         FROM products
         WHERE is_active = 1
           AND stock_quantity > 0
           AND stock_quantity <= min_stock`
      ),
      query(
        `SELECT COUNT(*) AS value
         FROM products
         WHERE is_active = 1 AND stock_quantity <= 0`
      ),
      query(
        `SELECT COUNT(*) AS value
         FROM products p
         WHERE p.is_active = 1
           AND p.stock_quantity > 0
           AND EXISTS (
             SELECT 1
             FROM order_items history_item
             JOIN orders history_order ON history_order.id = history_item.order_id
             WHERE history_item.product_id = p.id
               AND history_order.status = 'completed'
           )
           AND NOT EXISTS (
             SELECT 1
             FROM order_items recent_item
             JOIN orders recent_order ON recent_order.id = recent_item.order_id
             WHERE recent_item.product_id = p.id
               AND recent_order.status = 'completed'
               AND recent_order.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           )`
      ),
      listWarranties()
    ]);

    const expiringWarranties = warranties.filter((warranty) => {
      const daysLeft = getDaysUntil(warranty.expiresAt);
      return warranty.warrantyEnabled && warranty.status === 'active' && daysLeft >= 0 && daysLeft <= 7;
    });

    res.json({
      lowStockProducts: toNumber(lowStockRows[0].value),
      outOfStockProducts: toNumber(outOfStockRows[0].value),
      slowMovingProducts: toNumber(slowMovingRows[0].value),
      expiringWarranties: expiringWarranties.length,
      rules: {
        slowMovingDays: 30,
        warrantyDueDays: 7
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy cảnh báo vận hành', error: error.message });
  }
}

export async function getStaffPerformance(req, res) {
  try {
    const filters = getPeriodFilters(req.query.period || 'today', 'o.', req.query.date, req.query.date_from, req.query.date_to);
    const rows = await query(
      `SELECT
         o.user_id,
         COALESCE(NULLIF(TRIM(u.name), ''), 'Nhan vien') AS name,
         COALESCE(u.role, 'employee') AS role,
         COUNT(*) AS count,
         COALESCE(SUM(o.total), 0) AS total
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.status = 'completed'
         AND ${filters.current}
         AND LOWER(COALESCE(u.role, 'employee')) NOT IN ('owner', 'manager', 'admin')
       GROUP BY o.user_id, name, role
       ORDER BY total DESC`
    );

    res.json(rows.map((row) => ({
      id: row.user_id,
      name: row.name,
      role: row.role,
      count: toNumber(row.count),
      total: toNumber(row.total)
    })));
  } catch (error) {
    res.status(500).json({ message: 'Khong the lay hieu suat nhan vien', error: error.message });
  }
}
