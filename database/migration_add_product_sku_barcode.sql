-- Bước 1: thêm nền tảng SKU/barcode cho sản phẩm hiện có.
-- Có thể chạy toàn bộ file này trong MySQL Workbench.
-- File không xóa hoặc thay đổi dữ liệu sản phẩm cũ.

USE pos_accessories;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sku VARCHAR(100) NULL AFTER id,
  ADD COLUMN IF NOT EXISTS barcode VARCHAR(100) NULL AFTER sku;

-- Chuỗi rỗng được đổi thành NULL để unique index chỉ kiểm tra mã có dữ liệu.
UPDATE products SET sku = NULL WHERE TRIM(COALESCE(sku, '')) = '';
UPDATE products SET barcode = NULL WHERE TRIM(COALESCE(barcode, '')) = '';

-- Kiểm tra trước khi tạo index. Hai truy vấn này phải trả về 0 dòng.
SELECT sku, COUNT(*) AS duplicate_count
FROM products
WHERE sku IS NOT NULL
GROUP BY sku
HAVING COUNT(*) > 1;

SELECT barcode, COUNT(*) AS duplicate_count
FROM products
WHERE barcode IS NOT NULL
GROUP BY barcode
HAVING COUNT(*) > 1;

-- MySQL cho phép nhiều giá trị NULL trong UNIQUE INDEX.
CREATE UNIQUE INDEX uk_products_sku ON products (sku);
CREATE UNIQUE INDEX uk_products_barcode ON products (barcode);

