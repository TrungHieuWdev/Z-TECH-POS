SET NAMES utf8mb4;

-- The AI restock feature has been removed. Its historical log table is no
-- longer part of the application data model.
DROP TABLE IF EXISTS ai_restock_suggestion_logs;

-- Persist each newly generated AI report so results survive server restarts
-- and can be used for report history later.
CREATE TABLE IF NOT EXISTS ai_report_analysis_results (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
