USE pos_accessories;

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL,
  updated_by INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

INSERT INTO system_settings (setting_key, setting_value) VALUES
('vat_enabled', '0'),
('vat_rate', '0')
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);
