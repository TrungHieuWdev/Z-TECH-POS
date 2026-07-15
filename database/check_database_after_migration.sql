USE pos_accessories;

SHOW TABLES;
DESCRIBE products;
DESCRIBE users;
DESCRIBE inventory_logs;
DESCRIBE suppliers;
DESCRIBE purchase_orders;
DESCRIBE purchase_order_items;
DESCRIBE payments;
DESCRIBE warranties;
DESCRIBE warranty_claims;
DESCRIBE roles;
DESCRIBE brands;
DESCRIBE ai_report_analysis_results;

SELECT type, COUNT(*) AS total_logs
FROM inventory_logs
GROUP BY type
ORDER BY type;

SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, COLUMN_NAME;
