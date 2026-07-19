import { query } from '../config/db.js';

const toNumber = (value) => Number(value || 0);

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultRange() {
  const today = new Date();
  const dateTo = formatDate(today);
  const start = new Date(today);
  start.setDate(today.getDate() - 6);

  return {
    dateFrom: formatDate(start),
    dateTo
  };
}

function getPreviousRange(dateFrom, dateTo) {
  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);
  const days = Math.max(Math.round((end - start) / 86400000) + 1, 1);
  const previousEnd = new Date(start);
  previousEnd.setDate(start.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousEnd.getDate() - days + 1);

  return {
    previousFrom: formatDate(previousStart),
    previousTo: formatDate(previousEnd)
  };
}

function getPercentChange(current, previous) {
  const currentValue = toNumber(current);
  const previousValue = toNumber(previous);

  if (previousValue === 0) {
    return null;
  }

  const percentage = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
  return Number(Math.max(-100, Math.min(100, percentage)).toFixed(1));
}

function getCompletedOrderWhere(alias = 'o') {
  return `${alias}.status = 'completed' AND DATE(${alias}.created_at) BETWEEN ? AND ?`;
}

const discountedLineRevenue = `
  CASE
    WHEN o.subtotal > 0 THEN oi.subtotal * (o.total / o.subtotal)
    ELSE oi.subtotal
  END
`;

export async function getSalesReport(req, res) {
  try {
    const defaults = getDefaultRange();
    const dateFrom = req.query.date_from || defaults.dateFrom;
    const dateTo = req.query.date_to || defaults.dateTo;

    if (!isValidDate(dateFrom) || !isValidDate(dateTo)) {
      return res.status(400).json({ message: 'Khoảng ngày báo cáo không hợp lệ' });
    }

    if (dateFrom > dateTo) {
      return res.status(400).json({ message: 'Ngày bắt đầu không được lớn hơn ngày kết thúc' });
    }

    const { previousFrom, previousTo } = getPreviousRange(dateFrom, dateTo);
    const orderWhere = getCompletedOrderWhere('o');
    const params = [dateFrom, dateTo];

    const [
      summaryRows,
      previousRows,
      itemSummaryRows,
      dailyRows,
      recentOrders,
      categoryRows,
      topProductRows,
      attentionProductRows
    ] = await Promise.all([
      query(
        `SELECT
           COALESCE(SUM(o.total), 0) AS revenue,
           COUNT(*) AS orders
         FROM orders o
         WHERE ${orderWhere}`,
        params
      ),
      query(
        `SELECT
           COALESCE(SUM(o.total), 0) AS revenue,
           COUNT(*) AS orders
         FROM orders o
         WHERE ${orderWhere}`,
        [previousFrom, previousTo]
      ),
      query(
        `SELECT
           COALESCE(SUM(oi.quantity), 0) AS sold_quantity,
           COALESCE(SUM(${discountedLineRevenue} - (COALESCE(oi.cost_price_snapshot, p.cost_price, 0) * oi.quantity)), 0) AS gross_profit
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN products p ON oi.product_id = p.id
         WHERE ${orderWhere}`,
        params
      ),
      query(
        `SELECT
           DATE_FORMAT(o.created_at, '%Y-%m-%d') AS report_date,
           COALESCE(SUM(${discountedLineRevenue}), 0) AS revenue,
           COALESCE(SUM(${discountedLineRevenue} - (COALESCE(oi.cost_price_snapshot, p.cost_price, 0) * oi.quantity)), 0) AS gross_profit
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN products p ON oi.product_id = p.id
         WHERE ${orderWhere}
         GROUP BY DATE_FORMAT(o.created_at, '%Y-%m-%d')
         ORDER BY DATE_FORMAT(o.created_at, '%Y-%m-%d')`,
        params
      ),
      query(
        `SELECT
           o.id,
           o.order_number,
           o.total,
           o.status,
           o.payment_method,
           o.created_at,
           COALESCE(c.name, 'Khách thường') AS customer_name,
           u.name AS cashier_name,
           COALESCE((
             SELECT SUM(
               CASE
                 WHEN o.subtotal > 0 THEN oi2.subtotal * (o.total / o.subtotal)
                 ELSE oi2.subtotal
               END - (COALESCE(oi2.cost_price_snapshot, p2.cost_price, 0) * oi2.quantity)
             )
             FROM order_items oi2
             JOIN products p2 ON oi2.product_id = p2.id
             WHERE oi2.order_id = o.id
           ), 0) AS gross_profit
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         LEFT JOIN users u ON o.user_id = u.id
         WHERE ${orderWhere}
         ORDER BY o.created_at DESC`,
        params
      ),
      query(
        `SELECT
           COALESCE(c.name, 'Chưa phân loại') AS name,
           COALESCE(SUM(oi.quantity), 0) AS quantity,
           COALESCE(SUM(${discountedLineRevenue}), 0) AS revenue
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN products p ON oi.product_id = p.id
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE ${orderWhere}
         GROUP BY c.id, c.name
         ORDER BY revenue DESC`,
        params
      ),
      query(
        `SELECT
           p.id AS product_id,
           p.name,
           COALESCE(c.name, 'Chưa phân loại') AS category_name,
           COALESCE(SUM(oi.quantity), 0) AS quantity,
           COALESCE(SUM(${discountedLineRevenue}), 0) AS revenue,
           COALESCE(SUM(${discountedLineRevenue} - (COALESCE(oi.cost_price_snapshot, p.cost_price, 0) * oi.quantity)), 0) AS gross_profit,
           MAX(p.stock_quantity) AS stock_quantity
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN products p ON oi.product_id = p.id
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE ${orderWhere}
         GROUP BY p.id, p.name, c.name
         ORDER BY revenue DESC
        LIMIT 10`,
        params
      ),
      query(
        `SELECT
           p.id AS product_id,
           p.name,
           p.stock_quantity,
           p.min_stock,
           COALESCE((
             SELECT SUM(oi2.quantity)
             FROM order_items oi2
             JOIN orders o2 ON oi2.order_id = o2.id
             WHERE oi2.product_id = p.id
               AND o2.status = 'completed'
               AND DATE(o2.created_at) BETWEEN ? AND ?
           ), 0) AS sold_quantity
         FROM products p
         WHERE p.is_active = 1
         ORDER BY
           (p.stock_quantity <= p.min_stock) DESC,
           sold_quantity DESC,
           p.stock_quantity ASC
         LIMIT 5`,
        params
      )
    ]);

    const summary = summaryRows[0] || {};
    const previous = previousRows[0] || {};
    const itemSummary = itemSummaryRows[0] || {};
    const totalCategoryRevenue = categoryRows.reduce((sum, row) => sum + toNumber(row.revenue), 0);

    res.json({
      range: { dateFrom, dateTo, previousFrom, previousTo },
      summary: {
        revenue: toNumber(summary.revenue),
        orders: toNumber(summary.orders),
        soldQuantity: toNumber(itemSummary.sold_quantity),
        grossProfit: toNumber(itemSummary.gross_profit),
        revenueGrowth: getPercentChange(summary.revenue, previous.revenue),
        orderGrowth: getPercentChange(summary.orders, previous.orders)
      },
      daily: dailyRows.map((row) => ({
        date: row.report_date,
        revenue: toNumber(row.revenue),
        grossProfit: toNumber(row.gross_profit)
      })),
      recentOrders: recentOrders.map((order) => ({
        ...order,
        total: toNumber(order.total),
        gross_profit: toNumber(order.gross_profit)
      })),
      categories: categoryRows.map((category) => ({
        name: category.name,
        quantity: toNumber(category.quantity),
        revenue: toNumber(category.revenue),
        percentage: totalCategoryRevenue > 0
          ? Number(((toNumber(category.revenue) / totalCategoryRevenue) * 100).toFixed(1))
          : 0
      })),
      topProducts: topProductRows.map((product) => ({
        product_id: product.product_id,
        name: product.name,
        category_name: product.category_name,
        quantity: toNumber(product.quantity),
        revenue: toNumber(product.revenue),
        gross_profit: toNumber(product.gross_profit),
        stock_quantity: toNumber(product.stock_quantity)
      })),
      attentionProducts: attentionProductRows.map((product) => ({
        product_id: product.product_id,
        name: product.name,
        sold_quantity: toNumber(product.sold_quantity),
        stock_quantity: toNumber(product.stock_quantity),
        min_stock: toNumber(product.min_stock)
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy báo cáo doanh thu', error: error.message });
  }
}
