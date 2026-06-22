USE pos_accessories;

SET @loyalty_column_existed = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'customers' AND column_name = 'loyalty_points'
);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS loyalty_points INT NOT NULL DEFAULT 0 AFTER address;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS points_used INT NOT NULL DEFAULT 0 AFTER discount,
  ADD COLUMN IF NOT EXISTS points_discount_amount DECIMAL(15,0) NOT NULL DEFAULT 0 AFTER points_used,
  ADD COLUMN IF NOT EXISTS points_earned INT NOT NULL DEFAULT 0 AFTER points_discount_amount;

-- Chỉ khởi tạo số dư từ lịch sử đúng lần đầu thêm cột.
SET @initialize_points = IF(
  @loyalty_column_existed = 0,
  "UPDATE customers c LEFT JOIN (SELECT customer_id, FLOOR(SUM(total) / 10000) AS earned FROM orders WHERE status = 'completed' AND customer_id IS NOT NULL GROUP BY customer_id) history ON history.customer_id = c.id SET c.loyalty_points = COALESCE(history.earned, 0)",
  'SELECT 1'
);
PREPARE initialize_points_statement FROM @initialize_points;
EXECUTE initialize_points_statement;
DEALLOCATE PREPARE initialize_points_statement;
