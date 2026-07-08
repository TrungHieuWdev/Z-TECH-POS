SET NAMES utf8mb4;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20) NULL AFTER email,
  ADD COLUMN IF NOT EXISTS status ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER role,
  ADD COLUMN IF NOT EXISTS note TEXT NULL AFTER status,
  ADD COLUMN IF NOT EXISTS last_login_at DATETIME NULL AFTER note;

ALTER TABLE users
  MODIFY role ENUM('owner', 'manager', 'employee', 'admin', 'cashier', 'warehouse') DEFAULT 'employee';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER points_earned,
  ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(15,0) NOT NULL DEFAULT 0 AFTER vat_rate;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS warranty_enabled_snapshot BOOLEAN NULL AFTER subtotal,
  ADD COLUMN IF NOT EXISTS warranty_period_days_snapshot INT NULL AFTER warranty_enabled_snapshot,
  ADD COLUMN IF NOT EXISTS warranty_type_snapshot VARCHAR(30) NULL AFTER warranty_period_days_snapshot,
  ADD COLUMN IF NOT EXISTS warranty_conditions_snapshot TEXT NULL AFTER warranty_type_snapshot,
  ADD COLUMN IF NOT EXISTS warranty_exclusions_snapshot TEXT NULL AFTER warranty_conditions_snapshot,
  ADD COLUMN IF NOT EXISTS warranty_note_snapshot TEXT NULL AFTER warranty_exclusions_snapshot,
  ADD COLUMN IF NOT EXISTS public_token CHAR(36) UNIQUE AFTER warranty_note_snapshot;

ALTER TABLE device_models
  MODIFY family ENUM('apple','samsung','vivo','oppo','xiaomi','generic') NOT NULL;

INSERT INTO device_models (family, name, series, notes)
VALUES ('generic', 'Phụ kiện tiện ích', 'Dùng chung', 'Không thuộc hãng hoặc model máy cụ thể')
ON DUPLICATE KEY UPDATE family = 'generic', series = 'Dùng chung';

CREATE TABLE IF NOT EXISTS promotions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  data LONGTEXT NOT NULL,
  created_by INT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);
