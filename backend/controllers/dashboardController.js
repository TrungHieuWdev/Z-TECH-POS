import { query } from '../config/db.js';

const toNumber = (value) => Number(value || 0);

function getPercentChange(current, previous) {
  const currentValue = toNumber(current);
  const previousValue = toNumber(previous);

  if (previousValue === 0) {
    return currentValue > 0 ? 100 : 0;
  }

  return Number((((currentValue - previousValue) / previousValue) * 100).toFixed(1));
}

function getCategorySharePeriod(value = 'month') {
  return ['today', 'week', 'month', 'year', 'all'].includes(value) ? value : 'month';
}

function getCategoryShareDateFilter(period = 'month') {
  switch (period) {
    case 'today':
      return 'AND DATE(o.created_at) = CURDATE()';
    case 'week':
      return 'AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)';
    case 'year':
      return 'AND YEAR(o.created_at) = YEAR(CURDATE())';
    case 'all':
      return '';
    case 'month':
    default:
      return "AND o.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')";
  }
}

export async function getSummary(req, res) {
  try {
    const [
      todayRevenue,
      yesterdayRevenue,
      monthRevenue,
      todayOrders,
      yesterdayOrders,
      lowStock,
      newCustomers,
      yesterdayCustomers
    ] = await Promise.all([
      query(
        "SELECT COALESCE(SUM(total), 0) AS value FROM orders WHERE status = 'completed' AND DATE(created_at) = CURDATE()"
      ),
      query(
        `SELECT COALESCE(SUM(total), 0) AS value
         FROM orders
         WHERE status = 'completed' AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`
      ),
      query(
        `SELECT COALESCE(SUM(total), 0) AS value
         FROM orders
         WHERE status = 'completed'
           AND YEAR(created_at) = YEAR(CURDATE())
           AND MONTH(created_at) = MONTH(CURDATE())`
      ),
      query("SELECT COUNT(*) AS value FROM orders WHERE DATE(created_at) = CURDATE()"),
      query("SELECT COUNT(*) AS value FROM orders WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)"),
      query('SELECT COUNT(*) AS value FROM products WHERE is_active = 1 AND stock_quantity <= min_stock'),
      query('SELECT COUNT(*) AS value FROM customers WHERE DATE(created_at) = CURDATE()'),
      query('SELECT COUNT(*) AS value FROM customers WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)')
    ]);

    const todayRevenueValue = toNumber(todayRevenue[0].value);
    const yesterdayRevenueValue = toNumber(yesterdayRevenue[0].value);
    const todayOrdersValue = toNumber(todayOrders[0].value);
    const yesterdayOrdersValue = toNumber(yesterdayOrders[0].value);
    const newCustomersValue = toNumber(newCustomers[0].value);
    const yesterdayCustomersValue = toNumber(yesterdayCustomers[0].value);

    res.json({
      todayRevenue: todayRevenueValue,
      yesterdayRevenue: yesterdayRevenueValue,
      monthRevenue: toNumber(monthRevenue[0].value),
      todayOrders: todayOrdersValue,
      yesterdayOrders: yesterdayOrdersValue,
      lowStockCount: toNumber(lowStock[0].value),
      newCustomers: newCustomersValue,
      yesterdayCustomers: yesterdayCustomersValue,
      revenueGrowth: getPercentChange(todayRevenueValue, yesterdayRevenueValue),
      orderGrowth: getPercentChange(todayOrdersValue, yesterdayOrdersValue),
      customerGrowth: getPercentChange(newCustomersValue, yesterdayCustomersValue)
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy tổng quan', error: error.message });
  }
}

export async function getRevenueChart(req, res) {
  try {
    const rows = await query(
      `SELECT DATE(created_at) AS date, COALESCE(SUM(total), 0) AS revenue
       FROM orders
       WHERE status = 'completed'
         AND created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at)`
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy biểu đồ doanh thu', error: error.message });
  }
}

export async function getTopProducts(req, res) {
  try {
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
         AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
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
    const dateFilter = getCategoryShareDateFilter(period);
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
