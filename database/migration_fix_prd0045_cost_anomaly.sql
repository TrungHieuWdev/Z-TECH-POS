START TRANSACTION;

CREATE TABLE IF NOT EXISTS product_cost_correction_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  order_item_id INT NULL,
  old_cost_price DECIMAL(15,0) NULL,
  corrected_cost_price DECIMAL(15,0) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  corrected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_cost_correction_product_item (product_id, order_item_id)
);

INSERT IGNORE INTO product_cost_correction_audit
  (product_id, order_item_id, old_cost_price, corrected_cost_price, reason)
SELECT p.id, NULL, p.cost_price, 42000,
  'PRD-0045 had 690000 while six historical sale snapshots and comparable PPF products use 42000'
FROM products p
WHERE p.sku = 'PRD-0045' AND p.cost_price = 690000;

INSERT IGNORE INTO product_cost_correction_audit
  (product_id, order_item_id, old_cost_price, corrected_cost_price, reason)
SELECT oi.product_id, oi.id, oi.cost_price_snapshot, 42000,
  'Correct anomalous sale snapshot to verified historical cost for PRD-0045'
FROM order_items oi
JOIN products p ON p.id = oi.product_id
WHERE p.sku = 'PRD-0045' AND oi.cost_price_snapshot = 690000;

UPDATE products
SET cost_price = 42000
WHERE sku = 'PRD-0045' AND cost_price = 690000;

UPDATE order_items oi
JOIN products p ON p.id = oi.product_id
SET oi.cost_price_snapshot = 42000
WHERE p.sku = 'PRD-0045' AND oi.cost_price_snapshot = 690000;

COMMIT;
