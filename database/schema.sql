SET NAMES utf8mb4;

DROP TABLE IF EXISTS inventory_logs;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS device_models;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  employee_code VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('owner', 'manager', 'employee', 'admin', 'cashier') DEFAULT 'employee',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE device_models (
  id INT AUTO_INCREMENT PRIMARY KEY,
  family ENUM('apple', 'samsung', 'vivo', 'oppo', 'xiaomi') NOT NULL,
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
  category_id INT NOT NULL,
  device_model_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(15,0) NOT NULL,
  cost_price DECIMAL(15,0),
  stock_quantity INT DEFAULT 0,
  min_stock INT DEFAULT 5,
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
  CHECK (price >= 0),
  CHECK (cost_price IS NULL OR cost_price >= 0),
  CHECK (stock_quantity >= 0),
  CHECK (min_stock >= 0),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (device_model_id) REFERENCES device_models(id)
);

CREATE TABLE customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT,
  user_id INT NOT NULL,
  order_number VARCHAR(20) UNIQUE NOT NULL,
  subtotal DECIMAL(15,0) NOT NULL,
  warranty_enabled_snapshot BOOLEAN NULL,
  warranty_period_days_snapshot INT NULL,
  warranty_type_snapshot VARCHAR(30) NULL,
  warranty_conditions_snapshot TEXT NULL,
  warranty_exclusions_snapshot TEXT NULL,
  warranty_note_snapshot TEXT NULL,
  discount DECIMAL(15,0) DEFAULT 0,
  total DECIMAL(15,0) NOT NULL,
  payment_method ENUM('cash', 'card', 'transfer') DEFAULT 'cash',
  status ENUM('completed', 'cancelled') DEFAULT 'completed',
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(15,0) NOT NULL,
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
  type ENUM('in', 'out', 'adjust') NOT NULL,
  quantity INT NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
