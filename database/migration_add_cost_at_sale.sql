-- Safe, explicit migration for immutable sale-time cost.
-- Review and run manually in each environment. This file is never executed by application startup.

DELIMITER $$

DROP PROCEDURE IF EXISTS add_cost_at_sale_if_missing$$
CREATE PROCEDURE add_cost_at_sale_if_missing()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'order_items'
      AND column_name = 'cost_at_sale'
  ) THEN
    ALTER TABLE order_items
      ADD COLUMN cost_at_sale DECIMAL(15,0) NULL AFTER cost_price_snapshot;
  END IF;
END$$

CALL add_cost_at_sale_if_missing()$$
DROP PROCEDURE IF EXISTS add_cost_at_sale_if_missing$$

DELIMITER ;

CREATE TABLE IF NOT EXISTS cost_at_sale_backfill_audit (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_item_id INT NOT NULL,
  previous_cost_at_sale DECIMAL(15,0) NULL,
  backfilled_cost_at_sale DECIMAL(15,0) NOT NULL,
  source_type VARCHAR(40) NOT NULL,
  source_reference VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_cost_at_sale_backfill_order_item (order_item_id)
);

-- A positive snapshot was captured on the sale row itself, so copying it is deterministic.
INSERT IGNORE INTO cost_at_sale_backfill_audit
  (order_item_id, previous_cost_at_sale, backfilled_cost_at_sale, source_type, source_reference)
SELECT oi.id, oi.cost_at_sale, oi.cost_price_snapshot,
       'cost_price_snapshot', CONCAT('order_items:', oi.id)
FROM order_items oi
WHERE oi.cost_at_sale IS NULL
  AND oi.cost_price_snapshot IS NOT NULL
  AND oi.cost_price_snapshot > 0;

UPDATE order_items oi
JOIN cost_at_sale_backfill_audit audit ON audit.order_item_id = oi.id
SET oi.cost_at_sale = audit.backfilled_cost_at_sale
WHERE oi.cost_at_sale IS NULL
  AND audit.source_type = 'cost_price_snapshot';

-- Backfill remaining legacy rows after the administrator has explicitly
-- completed the product cost catalogue. Positive snapshots are never changed.
INSERT IGNORE INTO cost_at_sale_backfill_audit
  (order_item_id, previous_cost_at_sale, backfilled_cost_at_sale, source_type, source_reference)
SELECT oi.id, oi.cost_at_sale, p.cost_price,
       'current_product_cost', CONCAT('products:', p.id)
FROM order_items oi
JOIN products p ON p.id = oi.product_id
WHERE (oi.cost_at_sale IS NULL OR oi.cost_at_sale <= 0)
  AND p.cost_price IS NOT NULL
  AND p.cost_price > 0;

UPDATE order_items oi
JOIN cost_at_sale_backfill_audit audit ON audit.order_item_id = oi.id
SET oi.cost_at_sale = audit.backfilled_cost_at_sale,
    oi.cost_price_snapshot = COALESCE(oi.cost_price_snapshot, audit.backfilled_cost_at_sale)
WHERE (oi.cost_at_sale IS NULL OR oi.cost_at_sale <= 0)
  AND audit.source_type = 'current_product_cost';

-- Outstanding rows remain NULL. The import columns are shown only as evidence;
-- no purchase price is written automatically because the schema has no lot-to-sale allocation.
DROP VIEW IF EXISTS missing_cost_at_sale_items;
CREATE VIEW missing_cost_at_sale_items AS
SELECT
  oi.id AS order_item_id,
  o.id AS order_id,
  o.order_number,
  o.created_at AS sold_at,
  p.id AS product_id,
  p.sku,
  p.name AS product_name,
  oi.quantity,
  oi.cost_price_snapshot,
  COUNT(DISTINCT CASE WHEN po.status = 'completed' AND po.created_at <= o.created_at THEN poi.id END) AS prior_purchase_line_count,
  COUNT(DISTINCT CASE WHEN po.status = 'completed' AND po.created_at <= o.created_at THEN poi.import_price END) AS distinct_prior_import_prices,
  MIN(CASE WHEN po.status = 'completed' AND po.created_at <= o.created_at THEN poi.import_price END) AS minimum_prior_import_price,
  MAX(CASE WHEN po.status = 'completed' AND po.created_at <= o.created_at THEN poi.import_price END) AS maximum_prior_import_price,
  'Thiếu giá vốn' AS cost_status
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN products p ON p.id = oi.product_id
LEFT JOIN purchase_order_items poi ON poi.product_id = oi.product_id
LEFT JOIN purchase_orders po ON po.id = poi.purchase_order_id
WHERE oi.cost_at_sale IS NULL OR oi.cost_at_sale <= 0
GROUP BY oi.id, o.id, o.order_number, o.created_at, p.id, p.sku, p.name,
         oi.quantity, oi.cost_price_snapshot;

-- Review after migration:
-- SELECT * FROM missing_cost_at_sale_items ORDER BY sold_at, order_item_id;
