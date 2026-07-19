SET NAMES utf8mb4;

-- Add a column only when it does not exist. This keeps the migration safe for
-- databases that have already received part of the schema manually.
DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;
DROP PROCEDURE IF EXISTS add_fk_if_missing;
DELIMITER $$
CREATE PROCEDURE add_column_if_missing(
  IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
    PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$

CREATE PROCEDURE add_index_if_missing(
  IN p_table VARCHAR(64), IN p_index VARCHAR(64), IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND INDEX_NAME = p_index
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD ', p_definition);
    PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$

CREATE PROCEDURE add_fk_if_missing(
  IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_referenced_table VARCHAR(64), IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table
      AND COLUMN_NAME = p_column AND REFERENCED_TABLE_NAME = p_referenced_table
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD ', p_definition);
    PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_roles_name (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS brands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brand_name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_brands_name (brand_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_code VARCHAR(30) NULL,
  supplier_name VARCHAR(150) NOT NULL,
  supplier_group VARCHAR(100) NULL,
  contact_name VARCHAR(100) NULL,
  phone VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  address TEXT NULL,
  note TEXT NULL,
  status ENUM('active','paused','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_suppliers_code (supplier_code),
  INDEX idx_suppliers_name (supplier_name),
  INDEX idx_suppliers_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE suppliers
  MODIFY COLUMN status ENUM('active','paused','inactive') NOT NULL DEFAULT 'active';

INSERT IGNORE INTO roles (role_name, description) VALUES
  ('Quản trị viên', 'Toàn quyền vận hành hệ thống'),
  ('Nhân viên bán hàng', 'Bán hàng và xử lý hóa đơn'),
  ('Nhân viên kho', 'Nhập hàng và quản lý tồn kho');
INSERT IGNORE INTO brands (brand_name, description) VALUES
  ('Anker', 'Phụ kiện sạc và âm thanh'), ('Baseus', 'Phụ kiện điện thoại'),
  ('Remax', 'Phụ kiện điện tử'), ('Hoco', 'Phụ kiện điện thoại'),
  ('Ugreen', 'Cáp và thiết bị kết nối'), ('Samsung', 'Thiết bị Samsung'),
  ('Apple', 'Thiết bị Apple'), ('Xiaomi', 'Thiết bị Xiaomi');
INSERT IGNORE INTO suppliers (supplier_code, supplier_name, phone, address) VALUES
  ('NCC001', 'Nhà phân phối phụ kiện miền Nam', '0909000001', 'TP.HCM'),
  ('NCC002', 'Kho phụ kiện chính hãng', '0909000002', 'Hà Nội'),
  ('NCC003', 'Đối tác thiết bị di động', '0909000003', 'Đà Nẵng');

CALL add_column_if_missing('users', 'role_id', 'INT NULL AFTER role');
CALL add_column_if_missing('products', 'brand_id', 'INT NULL AFTER category_id');
CALL add_column_if_missing('products', 'max_stock', 'INT NULL AFTER min_stock');
CALL add_column_if_missing('inventory_logs', 'before_quantity', 'INT NULL AFTER quantity');
CALL add_column_if_missing('inventory_logs', 'after_quantity', 'INT NULL AFTER before_quantity');
CALL add_column_if_missing('inventory_logs', 'reference_type', 'VARCHAR(50) NULL AFTER after_quantity');
CALL add_column_if_missing('inventory_logs', 'reference_id', 'INT NULL AFTER reference_type');

-- ENUM must be widened before legacy values are normalized.
ALTER TABLE inventory_logs MODIFY COLUMN type
  ENUM('in','out','adjust','IMPORT','SALE','ADJUSTMENT','RETURN','WARRANTY','CANCEL_ORDER') NOT NULL;
UPDATE inventory_logs SET type = 'IMPORT' WHERE type = 'in';
UPDATE inventory_logs SET type = 'SALE' WHERE type = 'out';
UPDATE inventory_logs SET type = 'ADJUSTMENT' WHERE type = 'adjust';
ALTER TABLE inventory_logs MODIFY COLUMN type
  ENUM('IMPORT','SALE','ADJUSTMENT','RETURN','WARRANTY','CANCEL_ORDER') NOT NULL;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_code VARCHAR(30) NOT NULL,
  supplier_id INT NOT NULL,
  user_id INT NOT NULL,
  total_amount DECIMAL(15,0) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(15,0) NOT NULL DEFAULT 0,
  payment_status ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  payment_method ENUM('cash','transfer','other') NULL,
  due_date DATE NULL,
  paid_at DATETIME NULL,
  note TEXT NULL,
  status ENUM('draft','completed','cancelled') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_purchase_orders_code (purchase_code),
  INDEX idx_purchase_orders_supplier (supplier_id),
  INDEX idx_purchase_orders_user (user_id),
  INDEX idx_purchase_orders_payment_status (payment_status, due_date),
  CONSTRAINT fk_purchase_orders_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_purchase_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  import_price DECIMAL(15,0) NOT NULL,
  subtotal DECIMAL(15,0) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_purchase_items_order (purchase_order_id),
  INDEX idx_purchase_items_product (product_id),
  CONSTRAINT fk_purchase_items_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_purchase_items_product FOREIGN KEY (product_id) REFERENCES products(id),
  CHECK (quantity > 0), CHECK (import_price >= 0), CHECK (subtotal >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @purchase_payment_columns_missing = (
  SELECT COUNT(*) = 0
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'purchase_orders'
    AND COLUMN_NAME = 'paid_amount'
);

CALL add_column_if_missing('purchase_orders', 'paid_amount', 'DECIMAL(15,0) NOT NULL DEFAULT 0 AFTER total_amount');
CALL add_column_if_missing('purchase_orders', 'payment_status', "ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid' AFTER paid_amount");
CALL add_column_if_missing('purchase_orders', 'payment_method', "ENUM('cash','transfer','other') NULL AFTER payment_status");
CALL add_column_if_missing('purchase_orders', 'due_date', 'DATE NULL AFTER payment_method');
CALL add_column_if_missing('purchase_orders', 'paid_at', 'DATETIME NULL AFTER due_date');

SET @purchase_payment_backfill_sql = IF(
  @purchase_payment_columns_missing,
  "UPDATE purchase_orders
   SET paid_amount = CASE WHEN status = 'completed' THEN total_amount ELSE 0 END,
       payment_status = CASE WHEN status = 'completed' THEN 'paid' ELSE 'unpaid' END,
       payment_method = CASE WHEN status = 'completed' THEN 'other' ELSE NULL END,
       paid_at = CASE WHEN status = 'completed' THEN created_at ELSE NULL END",
  'SELECT 1'
);
PREPARE purchase_payment_backfill_stmt FROM @purchase_payment_backfill_sql;
EXECUTE purchase_payment_backfill_stmt;
DEALLOCATE PREPARE purchase_payment_backfill_stmt;

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  payment_method ENUM('cash','card','transfer','e_wallet','refund','other') NOT NULL,
  amount DECIMAL(15,0) NOT NULL,
  paid_amount DECIMAL(15,0) NULL,
  change_amount DECIMAL(15,0) NULL,
  status ENUM('pending','completed','failed','refunded','partially_refunded') NOT NULL DEFAULT 'completed',
  paid_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payments_order (order_id),
  INDEX idx_payments_status (status),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CHECK (amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS warranties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  warranty_code VARCHAR(40) NOT NULL,
  order_item_id INT NOT NULL,
  customer_id INT NULL,
  product_id INT NOT NULL,
  warranty_start DATE NOT NULL,
  warranty_end DATE NULL,
  status ENUM('active','expired','void','claimed') NOT NULL DEFAULT 'active',
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_warranties_code (warranty_code),
  UNIQUE KEY uk_warranties_order_item (order_item_id),
  INDEX idx_warranties_customer (customer_id),
  INDEX idx_warranties_product (product_id),
  CONSTRAINT fk_warranties_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id),
  CONSTRAINT fk_warranties_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_warranties_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS warranty_claims (
  id INT AUTO_INCREMENT PRIMARY KEY,
  warranty_id INT NOT NULL,
  issue_description TEXT NOT NULL,
  resolution TEXT NULL,
  status ENUM('received','inspecting','repairing','resolved','rejected','cancelled') NOT NULL DEFAULT 'received',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_warranty_claims_warranty (warranty_id),
  CONSTRAINT fk_warranty_claims_warranty FOREIGN KEY (warranty_id) REFERENCES warranties(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Keep legacy code/data columns because the current promotion API uses them.
CREATE TABLE IF NOT EXISTS promotions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  data LONGTEXT NOT NULL,
  created_by INT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_promotions_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_promotions_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL add_column_if_missing('promotions', 'promotion_name', 'VARCHAR(150) NULL AFTER code');
CALL add_column_if_missing('promotions', 'discount_type', "ENUM('percentage','fixed_amount') NULL AFTER promotion_name");
CALL add_column_if_missing('promotions', 'discount_value', 'DECIMAL(15,2) NULL AFTER discount_type');
CALL add_column_if_missing('promotions', 'start_date', 'DATETIME NULL AFTER discount_value');
CALL add_column_if_missing('promotions', 'end_date', 'DATETIME NULL AFTER start_date');
CALL add_column_if_missing('promotions', 'status', "ENUM('draft','active','inactive','expired') NOT NULL DEFAULT 'draft' AFTER end_date");
CALL add_column_if_missing('promotions', 'note', 'TEXT NULL AFTER status');

CREATE TABLE IF NOT EXISTS promotion_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  promotion_id INT NOT NULL,
  product_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_promotion_products (promotion_id, product_id),
  INDEX idx_promotion_products_product (product_id),
  CONSTRAINT fk_promotion_products_promotion FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
  CONSTRAINT fk_promotion_products_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promotion_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  promotion_id INT NOT NULL,
  category_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_promotion_categories (promotion_id, category_id),
  INDEX idx_promotion_categories_category (category_id),
  CONSTRAINT fk_promotion_categories_promotion FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
  CONSTRAINT fk_promotion_categories_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shift_store (
  id TINYINT PRIMARY KEY DEFAULT 1,
  shifts_json LONGTEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  module VARCHAR(50) NOT NULL,
  action_label VARCHAR(100) NOT NULL,
  target_name VARCHAR(255) NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_system_activity_created (created_at),
  INDEX idx_system_activity_user (user_id),
  CONSTRAINT fk_system_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Repair indexes and foreign keys when a table already existed before this migration.
CALL add_index_if_missing('roles', 'uk_roles_name', 'UNIQUE KEY uk_roles_name (role_name)');
CALL add_index_if_missing('brands', 'uk_brands_name', 'UNIQUE KEY uk_brands_name (brand_name)');
CALL add_index_if_missing('suppliers', 'uk_suppliers_code', 'UNIQUE KEY uk_suppliers_code (supplier_code)');
CALL add_index_if_missing('suppliers', 'idx_suppliers_name', 'INDEX idx_suppliers_name (supplier_name)');
CALL add_index_if_missing('suppliers', 'idx_suppliers_status', 'INDEX idx_suppliers_status (status)');
CALL add_index_if_missing('purchase_orders', 'uk_purchase_orders_code', 'UNIQUE KEY uk_purchase_orders_code (purchase_code)');
CALL add_index_if_missing('purchase_orders', 'idx_purchase_orders_payment_status', 'INDEX idx_purchase_orders_payment_status (payment_status, due_date)');
CALL add_index_if_missing('promotion_products', 'uk_promotion_products', 'UNIQUE KEY uk_promotion_products (promotion_id, product_id)');
CALL add_index_if_missing('promotion_categories', 'uk_promotion_categories', 'UNIQUE KEY uk_promotion_categories (promotion_id, category_id)');
CALL add_index_if_missing('warranties', 'uk_warranties_code', 'UNIQUE KEY uk_warranties_code (warranty_code)');
CALL add_index_if_missing('warranties', 'uk_warranties_order_item', 'UNIQUE KEY uk_warranties_order_item (order_item_id)');

CALL add_fk_if_missing('products', 'brand_id', 'brands', 'CONSTRAINT fk_products_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL');
CALL add_fk_if_missing('users', 'role_id', 'roles', 'CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL');
CALL add_fk_if_missing('purchase_orders', 'supplier_id', 'suppliers', 'CONSTRAINT fk_purchase_orders_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)');
CALL add_fk_if_missing('purchase_orders', 'user_id', 'users', 'CONSTRAINT fk_purchase_orders_user FOREIGN KEY (user_id) REFERENCES users(id)');
CALL add_fk_if_missing('purchase_order_items', 'purchase_order_id', 'purchase_orders', 'CONSTRAINT fk_purchase_items_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE');
CALL add_fk_if_missing('purchase_order_items', 'product_id', 'products', 'CONSTRAINT fk_purchase_items_product FOREIGN KEY (product_id) REFERENCES products(id)');
CALL add_fk_if_missing('payments', 'order_id', 'orders', 'CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id)');
CALL add_fk_if_missing('warranties', 'order_item_id', 'order_items', 'CONSTRAINT fk_warranties_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id)');
CALL add_fk_if_missing('warranties', 'customer_id', 'customers', 'CONSTRAINT fk_warranties_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL');
CALL add_fk_if_missing('warranties', 'product_id', 'products', 'CONSTRAINT fk_warranties_product FOREIGN KEY (product_id) REFERENCES products(id)');
CALL add_fk_if_missing('warranty_claims', 'warranty_id', 'warranties', 'CONSTRAINT fk_warranty_claims_warranty FOREIGN KEY (warranty_id) REFERENCES warranties(id) ON DELETE CASCADE');
CALL add_fk_if_missing('promotion_products', 'promotion_id', 'promotions', 'CONSTRAINT fk_promotion_products_promotion FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE');
CALL add_fk_if_missing('promotion_products', 'product_id', 'products', 'CONSTRAINT fk_promotion_products_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE');
CALL add_fk_if_missing('promotion_categories', 'promotion_id', 'promotions', 'CONSTRAINT fk_promotion_categories_promotion FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE');
CALL add_fk_if_missing('promotion_categories', 'category_id', 'categories', 'CONSTRAINT fk_promotion_categories_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE');
CALL add_fk_if_missing('system_activity_logs', 'user_id', 'users', 'CONSTRAINT fk_system_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');

INSERT INTO promotions
  (code, promotion_name, discount_type, discount_value, start_date, end_date, status, note, data)
VALUES
  ('WELCOME10', 'Ưu đãi khách hàng mới', 'percentage', 10, '2026-01-01', '2027-12-31', 'active',
   'Giảm 10% cho chương trình chào mừng', '{"code":"WELCOME10","name":"Ưu đãi khách hàng mới","type":"percentage","value":10,"enabled":true}'),
  ('SALE50000', 'Giảm 50.000 đồng', 'fixed_amount', 50000, '2026-01-01', '2027-12-31', 'active',
   'Áp dụng theo điều kiện bán hàng', '{"code":"SALE50000","name":"Giảm 50.000 đồng","type":"fixed","value":50000,"enabled":true}')
ON DUPLICATE KEY UPDATE code = VALUES(code);

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;
DROP PROCEDURE IF EXISTS add_fk_if_missing;

-- Deliberately keep the name shift_store for application compatibility.
-- A future migration may normalize it to shift_sessions after the API/UI changes.
