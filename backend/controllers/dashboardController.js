import { query } from '../config/db.js';

const toNumber = (value) => Number(value || 0);

function getPercentChange(current, previous) {
  const currentValue = toNumber(current);
  const previousValue = toNumber(previous);

  if (previousValue === 0) {
    return null;
  }

  return Number((((currentValue - previousValue) / previousValue) * 100).toFixed(1));
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

function getCategoryShareDateFilter(period = 'today') {
  switch (period) {
    case 'today':
      return 'AND DATE(o.created_at) = CURDATE()';
    case 'yesterday':
      return 'AND DATE(o.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
    case '7days':
      return 'AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)';
    case '14days':
      return 'AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)';
    case '90days':
      return 'AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL 89 DAY)';
    case '30days':
    default:
      return 'AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)';
  }
}

function getPeriodFilters(value = 'today', alias = '', selectedDate = '') {
  const period = getCategorySharePeriod(value);
  const column = `${alias}created_at`;
  const date = getSelectedDate(selectedDate);
  if (date) {
    return {
      current: `DATE(${column}) = '${date}'`,
      previous: `DATE(${column}) = DATE_SUB('${date}', INTERVAL 1 DAY)`
    };
  }
  if (period === 'today') return { current: `DATE(${column}) = CURDATE()`, previous: `DATE(${column}) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)` };
  if (period === 'yesterday') return { current: `DATE(${column}) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`, previous: `DATE(${column}) = DATE_SUB(CURDATE(), INTERVAL 2 DAY)` };
  if (period === '7days') return { current: `${column} >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)`, previous: `${column} >= DATE_SUB(CURDATE(), INTERVAL 13 DAY) AND ${column} < DATE_SUB(CURDATE(), INTERVAL 6 DAY)` };
  if (period === '14days') return { current: `${column} >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)`, previous: `${column} >= DATE_SUB(CURDATE(), INTERVAL 27 DAY) AND ${column} < DATE_SUB(CURDATE(), INTERVAL 13 DAY)` };
  if (period === '90days') return { current: `${column} >= DATE_SUB(CURDATE(), INTERVAL 89 DAY)`, previous: `${column} >= DATE_SUB(CURDATE(), INTERVAL 179 DAY) AND ${column} < DATE_SUB(CURDATE(), INTERVAL 89 DAY)` };
  return { current: `${column} >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)`, previous: `${column} >= DATE_SUB(CURDATE(), INTERVAL 59 DAY) AND ${column} < DATE_SUB(CURDATE(), INTERVAL 29 DAY)` };
}

export async function getSummary(req, res) {
  try {
    const filters = getPeriodFilters(req.query.period || 'today', '', req.query.date);
    const orderItemFilters = getPeriodFilters(req.query.period || 'today', 'o.', req.query.date);
    const [
      todayRevenue,
      yesterdayRevenue,
      monthRevenue,
      todayOrders,
      yesterdayOrders,
      lowStock,
      productsSold,
      previousProductsSold,
      estimatedProfit,
      previousEstimatedProfit,
      paymentTotals
    ] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(total), 0) AS value FROM orders WHERE status = 'completed' AND ${filters.current}`
      ),
      query(
        `SELECT COALESCE(SUM(total), 0) AS value
         FROM orders
         WHERE status = 'completed' AND ${filters.previous}`
      ),
      query(
        `SELECT COALESCE(SUM(total), 0) AS value
         FROM orders
         WHERE status = 'completed'
           AND YEAR(created_at) = YEAR(CURDATE())
           AND MONTH(created_at) = MONTH(CURDATE())`
      ),
      query(`SELECT COUNT(*) AS value FROM orders WHERE status = 'completed' AND ${filters.current}`),
      query(`SELECT COUNT(*) AS value FROM orders WHERE status = 'completed' AND ${filters.previous}`),
      query('SELECT COUNT(*) AS value FROM products WHERE is_active = 1 AND stock_quantity <= min_stock'),
      query(
        `SELECT COALESCE(SUM(oi.quantity), 0) AS value
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.status = 'completed' AND ${orderItemFilters.current}`
      ),
      query(
        `SELECT COALESCE(SUM(oi.quantity), 0) AS value
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.status = 'completed' AND ${orderItemFilters.previous}`
      ),
      query(
        `SELECT COALESCE(SUM(oi.subtotal - (COALESCE(p.cost_price, 0) * oi.quantity)), 0) AS value
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN products p ON oi.product_id = p.id
         WHERE o.status = 'completed' AND ${orderItemFilters.current}`
      ),
      query(
        `SELECT COALESCE(SUM(oi.subtotal - (COALESCE(p.cost_price, 0) * oi.quantity)), 0) AS value
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN products p ON oi.product_id = p.id
         WHERE o.status = 'completed' AND ${orderItemFilters.previous}`
      ),
      query(
        `SELECT
           SUM(CASE WHEN payment_method = 'cash' THEN 1 ELSE 0 END) AS cash_count,
           SUM(CASE WHEN payment_method = 'transfer' THEN 1 ELSE 0 END) AS transfer_count
         FROM orders
         WHERE status = 'completed' AND ${filters.current}`
      )
    ]);

    const todayRevenueValue = toNumber(todayRevenue[0].value);
    const yesterdayRevenueValue = toNumber(yesterdayRevenue[0].value);
    const todayOrdersValue = toNumber(todayOrders[0].value);
    const yesterdayOrdersValue = toNumber(yesterdayOrders[0].value);
    const productsSoldValue = toNumber(productsSold[0].value);
    const previousProductsSoldValue = toNumber(previousProductsSold[0].value);
    const estimatedProfitValue = toNumber(estimatedProfit[0].value);
    const previousEstimatedProfitValue = toNumber(previousEstimatedProfit[0].value);

    res.json({
      todayRevenue: todayRevenueValue,
      yesterdayRevenue: yesterdayRevenueValue,
      monthRevenue: toNumber(monthRevenue[0].value),
      todayOrders: todayOrdersValue,
      yesterdayOrders: yesterdayOrdersValue,
      lowStockCount: toNumber(lowStock[0].value),
      productsSold: productsSoldValue,
      previousProductsSold: previousProductsSoldValue,
      estimatedProfit: estimatedProfitValue,
      previousEstimatedProfit: previousEstimatedProfitValue,
      revenueGrowth: getPercentChange(todayRevenueValue, yesterdayRevenueValue),
      orderGrowth: getPercentChange(todayOrdersValue, yesterdayOrdersValue),
      productsSoldGrowth: getPercentChange(productsSoldValue, previousProductsSoldValue),
      estimatedProfitGrowth: getPercentChange(estimatedProfitValue, previousEstimatedProfitValue),
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
    const filters = getPeriodFilters(period, '', selectedDate);
    const bucketExpression = period === 'today' || period === 'yesterday' || selectedDate
      ? 'HOUR(created_at)'
      : "DATE_FORMAT(created_at, '%Y-%m-%d')";

    const rows = await query(
      `SELECT ${bucketExpression} AS bucket, COALESCE(SUM(total), 0) AS revenue
       FROM orders
       WHERE status = 'completed'
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
    const filters = getPeriodFilters(req.query.period || 'today', 'o.', req.query.date);
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
    const filters = getPeriodFilters(req.query.period || 'today', 'o.', req.query.date);
    const rows = await query(
      `SELECT
         o.id,
         o.order_number,
         o.total,
         o.status,
         o.payment_method,
         o.created_at,
         COALESCE(c.name, 'Khách lẻ') AS customer_name,
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

export async function getStaffPerformance(req, res) {
  try {
    const filters = getPeriodFilters(req.query.period || 'today', 'o.', req.query.date);
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
