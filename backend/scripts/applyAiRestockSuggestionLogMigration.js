import { query } from '../config/db.js';

await query(`
  CREATE TABLE IF NOT EXISTS ai_restock_suggestion_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    analysis_run_id VARCHAR(36) NOT NULL,
    user_id INT NULL,
    product_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NULL,
    current_stock INT NOT NULL DEFAULT 0,
    sold_7_days INT NOT NULL DEFAULT 0,
    sold_30_days INT NOT NULL DEFAULT 0,
    sold_90_days INT NOT NULL DEFAULT 0,
    forecast_qty_target INT NOT NULL DEFAULT 0,
    reorder_point INT NOT NULL DEFAULT 0,
    suggested_quantity INT NOT NULL DEFAULT 0,
    estimated_cost DECIMAL(15,0) NULL,
    priority VARCHAR(30) NULL,
    reason TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ai_restock_logs_run (analysis_run_id),
    INDEX idx_ai_restock_logs_product (product_id),
    INDEX idx_ai_restock_logs_created_at (created_at),
    CONSTRAINT fk_ai_restock_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_ai_restock_logs_product FOREIGN KEY (product_id) REFERENCES products(id)
  )
`);

console.log('Da tao bang ai_restock_suggestion_logs trong MySQL.');
process.exit(0);
