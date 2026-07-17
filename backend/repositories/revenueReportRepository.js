import { query } from '../config/db.js';

const refundJoin = `
  LEFT JOIN (
    SELECT order_id, SUM(amount) AS refund_amount
    FROM payments
    WHERE payment_method = 'refund' AND status IN ('completed', 'refunded')
    GROUP BY order_id
  ) rf ON rf.order_id = o.id`;

const lineDiscount = `CASE WHEN o.subtotal > 0
  THEN (oi.subtotal / o.subtotal) * COALESCE(o.discount, 0) ELSE 0 END`;
const lineRefund = `CASE WHEN o.subtotal > 0
  THEN (oi.subtotal / o.subtotal) * COALESCE(rf.refund_amount, 0) ELSE 0 END`;
const lineNet = `(oi.subtotal - ${lineDiscount} - ${lineRefund})`;
const lineCost = `(oi.quantity * COALESCE(oi.cost_price_snapshot, p.cost_price, 0))`;

function buildWhere(filters, { from = filters.from, to = filters.to, completedOnly = false } = {}) {
  const clauses = ['o.created_at >= ?', "o.created_at < DATE_ADD(?, INTERVAL 1 DAY)"];
  const params = [from, to];

  if (completedOnly) {
    // A cancelled-only filter must stay cancelled-only across every widget;
    // revenue datasets intentionally become empty because cancelled invoices
    // never contribute to sales.
    clauses.push(filters.orderStatus === 'cancelled' ? '1 = 0' : "o.status = 'completed'");
  }
  else if (filters.orderStatus !== 'all') {
    clauses.push('o.status = ?');
    params.push(filters.orderStatus);
  }
  if (filters.categoryId) {
    clauses.push('p.category_id = ?');
    params.push(filters.categoryId);
  }
  if (filters.employeeId) {
    clauses.push('o.user_id = ?');
    params.push(filters.employeeId);
  }
  if (filters.paymentMethod) {
    clauses.push('o.payment_method = ?');
    params.push(filters.paymentMethod);
  }
  return { sql: clauses.join(' AND '), params };
}

export async function getAggregate(filters, range = {}) {
  const where = buildWhere(filters, range);
  const rows = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN o.status='completed' THEN oi.subtotal ELSE 0 END), 0) AS gross_revenue,
       COALESCE(SUM(CASE WHEN o.status='completed' THEN ${lineDiscount} ELSE 0 END), 0) AS discount,
       COALESCE(SUM(CASE WHEN o.status='completed' THEN ${lineRefund} ELSE 0 END), 0) AS refunds,
       COALESCE(SUM(CASE WHEN o.status='completed' THEN ${lineCost} ELSE 0 END), 0) AS cost,
       COUNT(DISTINCT CASE WHEN o.status='completed' THEN o.id END) AS completed_orders
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     ${refundJoin}
     WHERE ${where.sql}`,
    where.params
  );
  return rows[0] || {};
}

export async function getDataAvailability() {
  const rows = await query(
    `SELECT
       DATE_FORMAT(MIN(created_at), '%Y-%m-%d') AS available_from,
       DATE_FORMAT(MAX(created_at), '%Y-%m-%d') AS available_to
     FROM orders
     WHERE status = 'completed'`
  );
  return rows[0] || {};
}

export async function getDaily(filters, range = {}) {
  const where = buildWhere(filters, { ...range, completedOnly: true });
  return query(
    `SELECT DATE_FORMAT(o.created_at, '%Y-%m-%d') AS date,
       COALESCE(SUM(${lineNet}), 0) AS net_revenue,
       COALESCE(SUM(${lineNet} - ${lineCost}), 0) AS gross_profit
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     ${refundJoin}
     WHERE ${where.sql}
     GROUP BY DATE_FORMAT(o.created_at, '%Y-%m-%d')
     ORDER BY date`,
    where.params
  );
}

export async function getHourlyTrend(filters) {
  const where = buildWhere(filters, { completedOnly: true });
  return query(
    `SELECT HOUR(o.created_at) AS hour,
       COALESCE(SUM(${lineNet}), 0) AS net_revenue,
       COALESCE(SUM(${lineNet} - ${lineCost}), 0) AS gross_profit
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     ${refundJoin}
     WHERE ${where.sql}
     GROUP BY HOUR(o.created_at)
     ORDER BY hour`,
    where.params
  );
}

export async function getCategories(filters, range = {}) {
  const where = buildWhere(filters, { ...range, completedOnly: true });
  return query(
    `SELECT p.category_id AS category_id,
       COALESCE(c.name, 'Chưa phân loại') AS name,
       COALESCE(SUM(oi.quantity), 0) AS sold_quantity,
       COALESCE(SUM(${lineNet}), 0) AS net_revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     ${refundJoin}
     WHERE ${where.sql}
     GROUP BY p.category_id, c.name
     ORDER BY net_revenue DESC`,
    where.params
  );
}

export async function getPaymentMethods(filters, range = {}) {
  const where = buildWhere(filters, { ...range, completedOnly: true });
  return query(
    `SELECT COALESCE(o.payment_method, 'other') AS payment_method,
       COUNT(DISTINCT o.id) AS transaction_count,
       COALESCE(SUM(${lineNet}), 0) AS amount
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     ${refundJoin}
     WHERE ${where.sql}
     GROUP BY o.payment_method
     HAVING amount > 0
     ORDER BY amount DESC`,
    where.params
  );
}

export async function getHourly(filters, range = {}) {
  const where = buildWhere(filters, { ...range, completedOnly: true });
  return query(
    `SELECT HOUR(COALESCE(pay.completed_at, o.created_at)) AS hour,
       COALESCE(SUM(${lineNet}), 0) AS net_revenue,
       COUNT(DISTINCT o.id) AS completed_orders
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     LEFT JOIN (
       SELECT order_id, MAX(COALESCE(paid_at, created_at)) AS completed_at
       FROM payments WHERE status='completed' GROUP BY order_id
     ) pay ON pay.order_id = o.id
     ${refundJoin}
     WHERE ${where.sql}
     GROUP BY HOUR(COALESCE(pay.completed_at, o.created_at))
     ORDER BY hour`,
    where.params
  );
}

const productSortColumns = {
  sku: 'sku', name: 'name', categoryName: 'category_name', soldQuantity: 'sold_quantity',
  grossRevenue: 'gross_revenue', discount: 'discount', netRevenue: 'net_revenue',
  cost: 'cost', grossProfit: 'gross_profit', margin: 'margin', returnedQuantity: 'returned_quantity'
};

export async function getProducts(filters, { exportAll = false } = {}) {
  const where = buildWhere(filters, { completedOnly: true });
  const searchClause = filters.search ? ' AND (p.name LIKE ? OR p.sku LIKE ?)' : '';
  const searchParams = filters.search ? [`%${filters.search}%`, `%${filters.search}%`] : [];
  const params = [...where.params, ...searchParams];
  const countRows = await query(
    `SELECT COUNT(DISTINCT p.id) AS total
     FROM order_items oi
     JOIN orders o ON o.id=oi.order_id
     JOIN products p ON p.id=oi.product_id
     WHERE ${where.sql}${searchClause}`,
    params
  );
  const sortColumn = productSortColumns[filters.sortBy];
  // LIMIT placeholders are rejected by some MySQL prepared-statement versions.
  // Both values have already passed strict positive-integer validation.
  const pagingSql = exportAll ? '' : ` LIMIT ${filters.limit} OFFSET ${(filters.page - 1) * filters.limit}`;
  const dataParams = params;
  const rows = await query(
    `SELECT p.id AS product_id, COALESCE(p.sku, '') AS sku, p.name,
       COALESCE(c.name, 'Chưa phân loại') AS category_name,
       COALESCE(SUM(oi.quantity), 0) AS sold_quantity,
       COALESCE(SUM(oi.subtotal), 0) AS gross_revenue,
       COALESCE(SUM(${lineDiscount}), 0) AS discount,
       COALESCE(SUM(${lineRefund}), 0) AS refunds,
       COALESCE(SUM(${lineNet}), 0) AS net_revenue,
       COALESCE(SUM(${lineCost}), 0) AS cost,
       COALESCE(SUM(${lineNet} - ${lineCost}), 0) AS gross_profit,
       CASE WHEN SUM(${lineNet}) <> 0
         THEN (SUM(${lineNet} - ${lineCost}) / SUM(${lineNet})) * 100 ELSE 0 END AS margin,
       0 AS returned_quantity
     FROM order_items oi
     JOIN orders o ON o.id=oi.order_id
     JOIN products p ON p.id=oi.product_id
     LEFT JOIN categories c ON c.id=p.category_id
     ${refundJoin}
     WHERE ${where.sql}${searchClause}
     GROUP BY p.id, p.sku, p.name, c.name
     ORDER BY ${sortColumn} ${filters.sortOrder.toUpperCase()}, p.id ASC${pagingSql}`,
    dataParams
  );
  return { rows, total: Number(countRows[0]?.total || 0) };
}

export async function getFilterOptions() {
  const [categories, employees, methods] = await Promise.all([
    query('SELECT id, name FROM categories WHERE is_active=1 ORDER BY name'),
    query("SELECT id, name FROM users WHERE status='active' ORDER BY name"),
    query('SELECT DISTINCT payment_method AS value FROM orders WHERE payment_method IS NOT NULL ORDER BY payment_method')
  ]);
  return { categories, employees, paymentMethods: methods.map((row) => row.value), orderStatuses: ['completed', 'cancelled'] };
}

export async function getPosOverview(filters) {
  const dateParams = [filters.from, filters.to];
  const categoryClause = filters.categoryId ? ' AND p.category_id = ?' : '';
  const inventoryParams = filters.categoryId ? [filters.categoryId] : [];
  const employeeClause = filters.employeeId ? ' AND o.user_id = ?' : '';
  const paymentClause = filters.paymentMethod ? ' AND o.payment_method = ?' : '';
  const salesParams = [...dateParams];
  if (filters.employeeId) salesParams.push(filters.employeeId);
  if (filters.paymentMethod) salesParams.push(filters.paymentMethod);
  const pairClauses = [
    "o.status = 'completed'",
    'o.created_at >= DATE_SUB(?, INTERVAL 89 DAY)',
    'o.created_at < DATE_ADD(?, INTERVAL 1 DAY)'
  ];
  const pairParams = [filters.to, filters.to];
  if (filters.employeeId) {
    pairClauses.push('o.user_id = ?');
    pairParams.push(filters.employeeId);
  }
  if (filters.paymentMethod) {
    pairClauses.push('o.payment_method = ?');
    pairParams.push(filters.paymentMethod);
  }
  if (filters.categoryId) {
    pairClauses.push('(first_product.category_id = ? OR second_product.category_id = ?)');
    pairParams.push(filters.categoryId, filters.categoryId);
  }

  const [inventoryRows, inventoryRiskRows, employeeRows, customerRows, purchaseRows, promotionRows, statusRows, slowMovingRows, slowMovingCountRows, crossSellRows] = await Promise.all([
    query(
      `SELECT COUNT(*) AS active_products,
         SUM(CASE WHEN COALESCE(p.stock_quantity, 0) = 0 THEN 1 ELSE 0 END) AS out_of_stock,
         SUM(CASE WHEN COALESCE(p.stock_quantity, 0) <= COALESCE(p.min_stock, 0) THEN 1 ELSE 0 END) AS low_stock,
         COALESCE(SUM(COALESCE(p.stock_quantity, 0) * COALESCE(p.cost_price, 0)), 0) AS inventory_cost_value,
         COALESCE(SUM(COALESCE(p.stock_quantity, 0) * p.price), 0) AS inventory_retail_value
       FROM products p WHERE p.is_active=1${categoryClause}`,
      inventoryParams
    ),
    query(
      `SELECT p.id AS product_id, p.name, COALESCE(p.stock_quantity, 0) AS stock_quantity,
         COALESCE(p.min_stock, 0) AS min_stock, COALESCE(s.sold_quantity, 0) AS sold_quantity
       FROM products p
       LEFT JOIN (
         SELECT oi.product_id, SUM(oi.quantity) AS sold_quantity
         FROM order_items oi JOIN orders o ON o.id=oi.order_id
         WHERE o.status='completed' AND o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)
         ${employeeClause}${paymentClause}
         GROUP BY oi.product_id
       ) s ON s.product_id=p.id
       WHERE p.is_active=1${categoryClause}
       ORDER BY (COALESCE(p.stock_quantity, 0) <= COALESCE(p.min_stock, 0)) DESC,
         COALESCE(s.sold_quantity, 0) DESC, COALESCE(p.stock_quantity, 0) ASC
       LIMIT 12`,
      [...salesParams, ...inventoryParams]
    ),
    query(
      `SELECT o.user_id,
         COUNT(DISTINCT o.id) AS completed_orders,
         COALESCE(SUM(${lineNet}), 0) AS net_revenue
       FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN products p ON p.id=oi.product_id
       ${refundJoin}
       WHERE ${buildWhere(filters, { completedOnly: true }).sql}
       GROUP BY o.user_id ORDER BY net_revenue DESC LIMIT 10`,
      buildWhere(filters, { completedOnly: true }).params
    ),
    query(
      `SELECT COUNT(DISTINCT CASE WHEN o.customer_id IS NOT NULL THEN o.customer_id END) AS purchasing_customers,
         COUNT(DISTINCT o.id) AS completed_orders,
         SUM(CASE WHEN o.customer_id IS NULL THEN 1 ELSE 0 END) AS guest_orders
       FROM orders o
       WHERE o.status='completed' AND o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)`,
      dateParams
    ),
    query(
      `SELECT COUNT(*) AS completed_purchase_orders, COALESCE(SUM(total_amount), 0) AS purchased_value
       FROM purchase_orders
       WHERE status='completed' AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`,
      dateParams
    ),
    query(
      `SELECT COUNT(*) AS total_promotions,
         SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active_promotions
       FROM promotions`
    ),
    query(
      `SELECT status, COUNT(*) AS total
       FROM orders WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
       GROUP BY status`,
      dateParams
    ),
    query(
      `SELECT p.id AS product_id, p.name,
         COALESCE(p.stock_quantity, 0) AS stock_quantity,
         COALESCE(p.min_stock, 0) AS min_stock,
         DATE_FORMAT(sales.last_sold_at, '%Y-%m-%d') AS last_sold_at
       FROM products p
       JOIN (
         SELECT oi.product_id, MAX(o.created_at) AS last_sold_at
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.status = 'completed'
         GROUP BY oi.product_id
       ) sales ON sales.product_id = p.id
       WHERE p.is_active = 1
         AND p.stock_quantity > 0
         AND sales.last_sold_at < DATE_SUB(NOW(), INTERVAL 30 DAY)${categoryClause}
       ORDER BY sales.last_sold_at ASC, p.stock_quantity DESC
       LIMIT 10`,
      inventoryParams
    ),
    query(
      `SELECT
         COUNT(*) AS total
       FROM products p
       JOIN (
         SELECT oi.product_id, MAX(o.created_at) AS last_sold_at
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.status = 'completed'
         GROUP BY oi.product_id
       ) sales ON sales.product_id = p.id
       WHERE p.is_active = 1
         AND p.stock_quantity > 0
         AND sales.last_sold_at < DATE_SUB(NOW(), INTERVAL 30 DAY)${categoryClause}`,
      inventoryParams
    ),
    query(
      `SELECT
         first_product.id AS first_product_id,
         first_product.name AS first_product_name,
         second_product.id AS second_product_id,
         second_product.name AS second_product_name,
         COUNT(DISTINCT o.id) AS paired_orders
       FROM order_items first_item
       JOIN order_items second_item
         ON second_item.order_id = first_item.order_id
        AND second_item.product_id > first_item.product_id
       JOIN orders o ON o.id = first_item.order_id
       JOIN products first_product ON first_product.id = first_item.product_id
       JOIN products second_product ON second_product.id = second_item.product_id
       WHERE ${pairClauses.join(' AND ')}
       GROUP BY first_product.id, first_product.name, second_product.id, second_product.name
       ORDER BY paired_orders DESC, first_product.id, second_product.id
       LIMIT 10`,
      pairParams
    )
  ]);

  return {
    inventory: inventoryRows[0] || {},
    inventoryRisks: inventoryRiskRows,
    employees: employeeRows,
    customers: customerRows[0] || {},
    purchases: purchaseRows[0] || {},
    promotions: promotionRows[0] || {},
    orderStatuses: statusRows,
    slowMovingProducts: slowMovingRows,
    slowMovingCount: Number(slowMovingCountRows[0]?.total || 0),
    crossSellPairs: crossSellRows
  };
}
