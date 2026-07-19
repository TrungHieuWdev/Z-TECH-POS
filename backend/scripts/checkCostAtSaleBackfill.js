import { closePool, query } from '../config/db.js';

try {
  const [missing] = await query(
    `SELECT COUNT(*) AS missing_lines,
            COUNT(DISTINCT oi.product_id) AS missing_products
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.status = 'completed'
       AND (oi.cost_at_sale IS NULL OR oi.cost_at_sale <= 0)`
  );
  const [backfilled] = await query(
    `SELECT COUNT(*) AS filled_lines
     FROM cost_at_sale_backfill_audit
     WHERE source_type = 'current_product_cost'`
  );

  console.log(JSON.stringify({ backfilled, remaining: missing }, null, 2));
} finally {
  await closePool();
}
