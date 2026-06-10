SET NAMES utf8mb4;

INSERT INTO users (id, name, email, password, role) VALUES
(1, 'Admin', 'admin@pos.com', '$2b$10$Vt7krIvjNgyN67LXqly0uOcTpN0LI55cYRbcKC71pUDAP0nJ7RPa.', 'admin'),
(2, 'Thu ngân', 'cashier@pos.com', '$2a$10$wtJie2Wc93SqCCri5u/f4uZX7ATSSyMxlrCTEkPmNHLl9Oa0QdLim', 'cashier');

INSERT INTO categories (id, name, description) VALUES
(1, 'Ốp lưng', 'Ốp lưng theo đúng model máy'),
(2, 'Sạc & cáp', 'Cáp sạc, củ sạc, sạc không dây theo chuẩn cổng'),
(3, 'Tai nghe & âm thanh', 'Tai nghe dây, Bluetooth và phụ kiện âm thanh'),
(4, 'Kính cường lực', 'Kính màn hình và kính camera theo từng model'),
(5, 'Phụ kiện tiện ích', 'Giá đỡ, dán lưng, túi chống nước và phụ kiện hỗ trợ');

INSERT INTO device_models (id, family, name, series, release_year, notes) VALUES
(1, 'apple', 'iPhone 11', 'iPhone', 2019, 'Đời iPhone 11'),
(2, 'apple', 'iPhone 11 Pro Max', 'iPhone', 2019, 'Đời iPhone 11 Pro Max'),
(3, 'apple', 'iPhone 12', 'iPhone', 2020, 'Đời iPhone 12'),
(4, 'apple', 'iPhone 12 Pro Max', 'iPhone', 2020, 'Đời iPhone 12 Pro Max'),
(5, 'apple', 'iPhone 13', 'iPhone', 2021, 'Đời iPhone 13'),
(6, 'apple', 'iPhone 13 Pro Max', 'iPhone', 2021, 'Đời iPhone 13 Pro Max'),
(7, 'apple', 'iPhone 14 Pro Max', 'iPhone', 2022, 'Đời iPhone 14 Pro Max'),
(8, 'apple', 'iPhone 15 Pro Max', 'iPhone', 2023, 'Đời iPhone 15 Pro Max'),
(9, 'apple', 'iPhone 16 Pro Max', 'iPhone', 2024, 'Đời iPhone 16 Pro Max'),
(10, 'apple', 'iPhone 17 Pro Max', 'iPhone', 2025, 'Đời iPhone 17 Pro Max'),
(11, 'samsung', 'Galaxy S20', 'Galaxy S', 2020, 'Dòng Galaxy S20'),
(12, 'samsung', 'Galaxy S20 Ultra', 'Galaxy S', 2020, 'Dòng Galaxy S20 Ultra'),
(13, 'samsung', 'Galaxy S21', 'Galaxy S', 2021, 'Dòng Galaxy S21'),
(14, 'samsung', 'Galaxy S21 Ultra', 'Galaxy S', 2021, 'Dòng Galaxy S21 Ultra'),
(15, 'samsung', 'Galaxy S22 Ultra', 'Galaxy S', 2022, 'Dòng Galaxy S22 Ultra'),
(16, 'samsung', 'Galaxy S23', 'Galaxy S', 2023, 'Dòng Galaxy S23'),
(17, 'samsung', 'Galaxy S23 Ultra', 'Galaxy S', 2023, 'Dòng Galaxy S23 Ultra'),
(18, 'samsung', 'Galaxy S24 Ultra', 'Galaxy S', 2024, 'Dòng Galaxy S24 Ultra'),
(19, 'samsung', 'Galaxy S25 Ultra', 'Galaxy S', 2025, 'Dòng Galaxy S25 Ultra'),
(20, 'samsung', 'Galaxy S26 Ultra', 'Galaxy S', 2026, 'Dòng Galaxy S26 Ultra'),
(21, 'vivo', 'Vivo V23 5G', 'Vivo V', 2022, 'V series 2022'),
(22, 'vivo', 'Vivo V25 Pro', 'Vivo V', 2022, 'V series 2022'),
(23, 'vivo', 'Vivo Y35', 'Vivo Y', 2022, 'Y series 2022'),
(24, 'vivo', 'Vivo V27 5G', 'Vivo V', 2023, 'V series 2023'),
(25, 'vivo', 'Vivo V29 5G', 'Vivo V', 2023, 'V series 2023'),
(26, 'vivo', 'Vivo Y36', 'Vivo Y', 2023, 'Y series 2023'),
(27, 'vivo', 'Vivo V30 5G', 'Vivo V', 2024, 'V series 2024'),
(28, 'vivo', 'Vivo V40 5G', 'Vivo V', 2024, 'V series 2024'),
(29, 'vivo', 'Vivo V50 5G', 'Vivo V', 2025, 'V series 2025'),
(30, 'vivo', 'Vivo V60 5G', 'Vivo V', 2025, 'V series dùng cho giai đoạn bán 2025-2026'),
(31, 'oppo', 'Oppo Reno8 5G', 'Reno', 2022, 'Reno series 2022'),
(32, 'oppo', 'Oppo Reno8 Pro 5G', 'Reno', 2022, 'Reno series 2022'),
(33, 'oppo', 'Oppo A78 5G', 'A series', 2023, 'A series 2023'),
(34, 'oppo', 'Oppo Reno10 5G', 'Reno', 2023, 'Reno series 2023'),
(35, 'oppo', 'Oppo Reno11 5G', 'Reno', 2024, 'Reno series 2024'),
(36, 'oppo', 'Oppo Reno11 F 5G', 'Reno', 2024, 'Reno series 2024'),
(37, 'oppo', 'Oppo Reno12 5G', 'Reno', 2024, 'Reno series 2024'),
(38, 'oppo', 'Oppo Reno13 5G', 'Reno', 2024, 'Reno series 2024-2025'),
(39, 'oppo', 'Oppo Reno14 5G', 'Reno', 2025, 'Reno series 2025'),
(40, 'oppo', 'Oppo Reno15 5G', 'Reno', 2026, 'Reno series dùng cho giai đoạn bán 2026'),
(41, 'xiaomi', 'Redmi Note 11', 'Redmi Note', 2022, 'Redmi Note 2022'),
(42, 'xiaomi', 'Redmi Note 11 Pro 5G', 'Redmi Note', 2022, 'Redmi Note 2022'),
(43, 'xiaomi', 'Xiaomi 12', 'Xiaomi', 2022, 'Xiaomi flagship 2022'),
(44, 'xiaomi', 'Redmi Note 12 Pro 5G', 'Redmi Note', 2023, 'Redmi Note 2023'),
(45, 'xiaomi', 'Xiaomi 13', 'Xiaomi', 2023, 'Xiaomi flagship 2023'),
(46, 'xiaomi', 'Redmi Note 13 Pro 5G', 'Redmi Note', 2024, 'Redmi Note 2024'),
(47, 'xiaomi', 'Poco X6 Pro', 'Poco', 2024, 'Poco 2024'),
(48, 'xiaomi', 'Xiaomi 14', 'Xiaomi', 2024, 'Xiaomi flagship 2024'),
(49, 'xiaomi', 'Redmi Note 14 Pro+ 5G', 'Redmi Note', 2025, 'Redmi Note 2025'),
(50, 'xiaomi', 'Xiaomi 15', 'Xiaomi', 2025, 'Xiaomi flagship dùng cho giai đoạn bán 2025-2026');

DROP TEMPORARY TABLE IF EXISTS product_templates;
CREATE TEMPORARY TABLE product_templates (
  id INT PRIMARY KEY,
  category_id INT NOT NULL,
  template_name VARCHAR(80) NOT NULL,
  description_template VARCHAR(255) NOT NULL,
  price DECIMAL(15,0) NOT NULL,
  cost_price DECIMAL(15,0) NOT NULL,
  stock_quantity INT NOT NULL,
  min_stock INT NOT NULL,
  image_label VARCHAR(40) NOT NULL
);

INSERT INTO product_templates VALUES
(1, 1, 'Ốp lưng chống sốc', 'Ốp lưng bảo vệ bốn góc, ôm sát model máy, phù hợp bán tại quầy.', 129000, 62000, 28, 6, 'Case'),
(2, 4, 'Kính cường lực full màn', 'Kính 9H full màn, chống xước, cảm ứng mượt, cắt đúng model.', 79000, 26000, 45, 10, 'Glass'),
(3, 4, 'Kính camera sau', 'Bộ kính bảo vệ cụm camera, dễ lắp, không ảnh hưởng chất lượng ảnh.', 69000, 24000, 34, 8, 'Lens'),
(4, 2, 'Bộ sạc nhanh tương thích', 'Cáp và củ sạc nhanh tương thích chuẩn cổng của model máy.', 249000, 145000, 18, 5, 'Charger'),
(5, 5, 'Giá đỡ kiêm dán lưng tiện ích', 'Phụ kiện tiện ích dùng kèm hằng ngày, trưng bày theo đúng model.', 99000, 42000, 25, 6, 'Utility');

INSERT INTO products
(category_id, device_model_id, name, description, price, cost_price, stock_quantity, min_stock, image_url)
SELECT
  pt.category_id,
  dm.id,
  CONCAT(pt.template_name, ' ', dm.name),
  CONCAT(pt.description_template, ' Dòng máy: ', dm.name, '.'),
  pt.price,
  pt.cost_price,
  pt.stock_quantity,
  pt.min_stock,
  CONCAT('ztech://product/', dm.family, '/', LOWER(pt.image_label))
FROM device_models dm
CROSS JOIN product_templates pt
ORDER BY dm.family, dm.id, pt.id;

INSERT INTO customers (id, name, phone, email, address) VALUES
(1, 'Khách lẻ', '0900000000', NULL, NULL),
(2, 'Nguyễn Văn An', '0901000001', 'an.nguyen@example.com', 'TP.HCM'),
(3, 'Trần Thị Bích', '0901000002', 'bich.tran@example.com', 'TP.HCM'),
(4, 'Lê Hoàng Nam', '0901000003', 'nam.le@example.com', 'TP.HCM'),
(5, 'Phạm Minh Châu', '0901000004', 'chau.pham@example.com', 'TP.HCM');

INSERT INTO inventory_logs (product_id, user_id, type, quantity, note, created_at)
SELECT id, 1, 'in', stock_quantity, CONCAT('Nhập tồn đầu kỳ - ', name), '2026-06-10 08:00:00'
FROM products
WHERE id IN (1, 51, 101, 151, 201, 250);
