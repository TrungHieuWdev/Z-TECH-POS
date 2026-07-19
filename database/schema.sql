SET NAMES utf8mb4;

DROP TABLE IF EXISTS warranty_claims;
DROP TABLE IF EXISTS warranties;
DROP TABLE IF EXISTS promotion_categories;
DROP TABLE IF EXISTS promotion_products;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS purchase_order_items;
DROP TABLE IF EXISTS purchase_orders;
DROP TABLE IF EXISTS system_activity_logs;
DROP TABLE IF EXISTS shift_store;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS promotions;
DROP TABLE IF EXISTS ai_report_analysis_results;
DROP TABLE IF EXISTS ai_restock_suggestion_logs;
DROP TABLE IF EXISTS inventory_logs;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS device_models;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS brands;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  employee_code VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password VARCHAR(255) NOT NULL,
  role ENUM('owner', 'manager', 'employee', 'admin', 'cashier', 'warehouse') DEFAULT 'employee',
  role_id INT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  note TEXT,
  last_login_at DATETIME NULL,
  token_version INT UNSIGNED NOT NULL DEFAULT 0,
  password_changed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
);

CREATE TABLE ai_report_analysis_results (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  analysis_key CHAR(64) NOT NULL,
  requested_by INT NULL,
  report_type VARCHAR(50) NOT NULL DEFAULT 'revenue',
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  filters_json JSON NOT NULL,
  result_json JSON NOT NULL,
  executive_summary TEXT NOT NULL,
  health_score TINYINT UNSIGNED NOT NULL,
  outlook ENUM('positive','neutral','negative') NOT NULL,
  provider VARCHAR(100) NOT NULL,
  model VARCHAR(150) NOT NULL,
  analyzed_at DATETIME(3) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_report_period (period_from, period_to),
  INDEX idx_ai_report_requested_by (requested_by),
  INDEX idx_ai_report_created_at (created_at),
  UNIQUE KEY uk_ai_report_analysis_key (analysis_key),
  CONSTRAINT fk_ai_report_requested_by FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
  CHECK (health_score <= 100)
);

CREATE TABLE brands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brand_name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_code VARCHAR(30) UNIQUE,
  supplier_name VARCHAR(150) NOT NULL,
  supplier_group VARCHAR(100), contact_name VARCHAR(100),
  phone VARCHAR(20), email VARCHAR(150), address TEXT, note TEXT,
  status ENUM('active','paused','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_suppliers_name (supplier_name), INDEX idx_suppliers_status (status)
);

CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE device_models (
  id INT AUTO_INCREMENT PRIMARY KEY,
  family ENUM('apple', 'samsung', 'vivo', 'oppo', 'xiaomi', 'generic') NOT NULL,
  name VARCHAR(100) NOT NULL,
  series VARCHAR(50),
  release_year SMALLINT,
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_device_models_family_name (family, name),
  INDEX idx_device_models_family (family)
);

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(100) NULL,
  barcode VARCHAR(50) NULL,
  category_id INT NOT NULL,
  brand_id INT NULL,
  device_model_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(15,0) NOT NULL,
  cost_price DECIMAL(15,0),
  stock_quantity INT DEFAULT 0,
  min_stock INT DEFAULT 5,
  max_stock INT NULL,
  image_url TEXT,
  warranty_enabled BOOLEAN DEFAULT FALSE,
  warranty_period_days INT DEFAULT 0,
  warranty_type ENUM('replace', 'repair', 'manufacturer', 'initial_exchange', 'none') DEFAULT 'none',
  warranty_conditions TEXT,
  warranty_exclusions TEXT,
  warranty_note TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_category (category_id),
  INDEX idx_products_device_model (device_model_id),
  INDEX idx_products_active (is_active),
  UNIQUE KEY uk_products_sku (sku),
  UNIQUE KEY uk_products_barcode (barcode),
  CHECK (price >= 0),
  CHECK (cost_price IS NULL OR cost_price >= 0),
  CHECK (stock_quantity >= 0),
  CHECK (min_stock >= 0),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL,
  FOREIGN KEY (device_model_id) REFERENCES device_models(id)
);

CREATE TABLE customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
  loyalty_points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL,
  updated_by INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

INSERT INTO system_settings (setting_key, setting_value) VALUES
('vat_enabled', '0'),
('vat_rate', '0');

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT,
  user_id INT NOT NULL,
  order_number VARCHAR(20) UNIQUE NOT NULL,
  promotion_id INT NULL,
  promotion_code_snapshot VARCHAR(20) NULL,
  promotion_name_snapshot VARCHAR(150) NULL,
  subtotal DECIMAL(15,0) NOT NULL,
  warranty_enabled_snapshot BOOLEAN NULL,
  warranty_period_days_snapshot INT NULL,
  warranty_type_snapshot VARCHAR(30) NULL,
  warranty_conditions_snapshot TEXT NULL,
  warranty_exclusions_snapshot TEXT NULL,
  warranty_note_snapshot TEXT NULL,
  discount DECIMAL(15,0) DEFAULT 0,
  promotion_discount DECIMAL(15,0) NOT NULL DEFAULT 0,
  points_used INT NOT NULL DEFAULT 0,
  points_discount_amount DECIMAL(15,0) NOT NULL DEFAULT 0,
  points_earned INT NOT NULL DEFAULT 0,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  vat_amount DECIMAL(15,0) NOT NULL DEFAULT 0,
  total DECIMAL(15,0) NOT NULL,
  payment_method ENUM('cash', 'card', 'transfer') DEFAULT 'cash',
  status ENUM('completed', 'cancelled') DEFAULT 'completed',
  note TEXT,
  idempotency_key VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_orders_user_idempotency (user_id, idempotency_key),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  purchased_quantity INT NULL,
  gift_quantity INT NOT NULL DEFAULT 0,
  unit_price DECIMAL(15,0) NOT NULL,
  cost_price_snapshot DECIMAL(15,0) NULL,
  cost_at_sale DECIMAL(15,0) NULL,
  subtotal DECIMAL(15,0) NOT NULL,
  warranty_enabled_snapshot BOOLEAN NULL,
  warranty_period_days_snapshot INT NULL,
  warranty_type_snapshot VARCHAR(30) NULL,
  warranty_conditions_snapshot TEXT NULL,
  warranty_exclusions_snapshot TEXT NULL,
  warranty_note_snapshot TEXT NULL,
  public_token CHAR(36) UNIQUE,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE inventory_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  user_id INT NOT NULL,
  type ENUM('IMPORT','SALE','ADJUSTMENT','RETURN','WARRANTY','CANCEL_ORDER') NOT NULL,
  quantity INT NOT NULL,
  before_quantity INT NULL,
  after_quantity INT NULL,
  reference_type VARCHAR(50) NULL,
  reference_id INT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE promotions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  promotion_name VARCHAR(150) NULL,
  discount_type ENUM('percentage','fixed_amount') NULL,
  discount_value DECIMAL(15,2) NULL,
  start_date DATETIME NULL,
  end_date DATETIME NULL,
  status ENUM('draft','active','inactive','expired') NOT NULL DEFAULT 'draft',
  note TEXT NULL,
  data LONGTEXT NOT NULL,
  created_by INT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE purchase_orders (
  id INT AUTO_INCREMENT PRIMARY KEY, purchase_code VARCHAR(30) UNIQUE NOT NULL,
  supplier_id INT NOT NULL, user_id INT NOT NULL, total_amount DECIMAL(15,0) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(15,0) NOT NULL DEFAULT 0,
  payment_status ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  payment_method ENUM('cash','transfer','other') NULL,
  due_date DATE NULL,
  paid_at DATETIME NULL,
  note TEXT, status ENUM('draft','completed','cancelled') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_purchase_orders_payment_status (payment_status, due_date),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id), FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE purchase_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY, purchase_order_id INT NOT NULL, product_id INT NOT NULL,
  quantity INT NOT NULL, import_price DECIMAL(15,0) NOT NULL, subtotal DECIMAL(15,0) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id), CHECK (quantity > 0)
);

CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY, order_id INT NOT NULL,
  payment_method ENUM('cash','card','transfer','e_wallet','refund','other') NOT NULL,
  amount DECIMAL(15,0) NOT NULL, paid_amount DECIMAL(15,0), change_amount DECIMAL(15,0),
  status ENUM('pending','completed','failed','refunded','partially_refunded') NOT NULL DEFAULT 'completed',
  paid_at DATETIME, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id), CHECK (amount >= 0)
);

CREATE TABLE warranties (
  id INT AUTO_INCREMENT PRIMARY KEY, warranty_code VARCHAR(40) UNIQUE NOT NULL,
  order_item_id INT UNIQUE NOT NULL, customer_id INT NULL, product_id INT NOT NULL,
  warranty_start DATE NOT NULL, warranty_end DATE NULL,
  status ENUM('active','expired','void','claimed') NOT NULL DEFAULT 'active', note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_item_id) REFERENCES order_items(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE warranty_claims (
  id INT AUTO_INCREMENT PRIMARY KEY, warranty_id INT NOT NULL,
  issue_description TEXT NOT NULL, resolution TEXT,
  status ENUM('received','inspecting','repairing','resolved','rejected','cancelled') NOT NULL DEFAULT 'received',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (warranty_id) REFERENCES warranties(id) ON DELETE CASCADE
);

CREATE TABLE promotion_products (
  id INT AUTO_INCREMENT PRIMARY KEY, promotion_id INT NOT NULL, product_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uk_promotion_products (promotion_id, product_id),
  FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE promotion_categories (
  id INT AUTO_INCREMENT PRIMARY KEY, promotion_id INT NOT NULL, category_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uk_promotion_categories (promotion_id, category_id),
  FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE shift_store (
  id TINYINT PRIMARY KEY DEFAULT 1, shifts_json LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE system_activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NULL, module VARCHAR(50) NOT NULL,
  action_label VARCHAR(100) NOT NULL, target_name VARCHAR(255), description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_system_activity_created (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
