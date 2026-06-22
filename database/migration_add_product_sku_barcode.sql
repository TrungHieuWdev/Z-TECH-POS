-- Migration barcode cho products. Không tạo sản phẩm mới.
USE pos_accessories;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS barcode VARCHAR(50) NULL AFTER sku;

ALTER TABLE products
  MODIFY COLUMN barcode VARCHAR(50) NULL;

UPDATE products SET barcode = NULL WHERE TRIM(COALESCE(barcode, '')) = '';

SET @barcode_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'products'
    AND column_name = 'barcode'
);
SET @create_barcode_index = IF(
  @barcode_index_exists = 0,
  'CREATE UNIQUE INDEX uk_products_barcode ON products (barcode)',
  'SELECT 1'
);
PREPARE barcode_index_statement FROM @create_barcode_index;
EXECUTE barcode_index_statement;
DEALLOCATE PREPARE barcode_index_statement;

-- Hai sản phẩm cũ đang hiển thị SKU dựng từ ID ở frontend nhưng sku trong DB là NULL.
-- Chỉ đồng bộ SKU cho đúng bản ghi hiện có; không tạo sản phẩm mới.
UPDATE products
SET sku = 'PRD-0277'
WHERE id = 277 AND sku IS NULL;

UPDATE products
SET sku = 'PRD-0278'
WHERE id = 278 AND sku IS NULL;

UPDATE products
SET barcode = '194644197421'
WHERE sku = 'PRD-0277';

UPDATE products
SET barcode = '8938555972973'
WHERE sku = 'PRD-0278';

SELECT id, name, sku, barcode, price, stock_quantity AS stock
FROM products
WHERE sku IN ('PRD-0277', 'PRD-0278');
