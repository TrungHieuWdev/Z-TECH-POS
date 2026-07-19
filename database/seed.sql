SET NAMES utf8mb4;

INSERT INTO roles (id, role_name, description, status) VALUES
(1, 'Quản trị viên', 'Toàn quyền vận hành hệ thống', 'active'),
(2, 'Quản lý', 'Vai trò cũ đã được gộp vào Quản trị viên', 'inactive'),
(3, 'Nhân viên bán hàng', 'Bán hàng và xử lý hóa đơn', 'active'),
(4, 'Nhân viên kho', 'Nhập hàng và quản lý tồn kho', 'active');

INSERT INTO brands (id, brand_name, description, status) VALUES
(1, 'Anker', 'Phụ kiện sạc và âm thanh', 'active'), (2, 'Baseus', 'Phụ kiện điện thoại', 'active'),
(3, 'Remax', 'Phụ kiện điện tử', 'active'), (4, 'Hoco', 'Phụ kiện điện thoại', 'active'),
(5, 'Ugreen', 'Cáp và thiết bị kết nối', 'active'), (6, 'Samsung', 'Thiết bị Samsung', 'active'),
(7, 'Apple', 'Thiết bị Apple', 'active'), (8, 'Xiaomi', 'Thiết bị Xiaomi', 'active');

INSERT INTO suppliers (id, supplier_code, supplier_name, phone, email, address, note, status) VALUES
(1, 'NCC001', 'Nhà phân phối phụ kiện miền Nam', '0909000001', 'nppmiennam@gmail.com', 'TP.HCM', 'Nhà cung cấp tổng hợp', 'active'),
(2, 'NCC002', 'Kho phụ kiện chính hãng', '0909000002', 'contact@khophukien.vn', 'Hà Nội', 'Ưu tiên hàng chính hãng', 'active'),
(3, 'NCC003', 'Đối tác thiết bị di động', '0909000003', 'sales@doitacthididong.vn', 'Đà Nẵng', NULL, 'active');

INSERT INTO users (id, name, employee_code, email, password, role) VALUES
(1, 'Quản trị viên', 'CH001', 'owner@pos.com', '$2a$10$zJ0vlNynsAv7pjIDZJnD2.wctQCc5BglAf3qlasqs1YWNuaWoV5ii', 'admin'),
(2, 'Quản trị viên', 'QL001', 'manager@pos.com', '$2a$10$zJ0vlNynsAv7pjIDZJnD2.wctQCc5BglAf3qlasqs1YWNuaWoV5ii', 'admin'),
(3, 'Nhân viên', 'NV001', 'employee@pos.com', '$2a$10$ID9zzPKRdedSZE5o.mjYOekfeOx08RQ8tuT58nx07b0e/IJhaNL2G', 'employee');

INSERT INTO categories (id, name, description) VALUES
(1, 'Cường lực màn hình', 'Kính cường lực theo từng model máy, phục vụ bán kèm khi khách mua ốp hoặc thay phụ kiện.'),
(2, 'Cường lực camera', 'Kính bảo vệ cụm camera sau, dễ tư vấn theo từng dòng máy.'),
(3, 'Ốp lưng', 'Ốp lưng theo model, chất liệu và kiểu dáng để trưng bày tại quầy.'),
(4, 'Sạc & cáp', 'Củ sạc, cáp sạc, sạc nhanh và phụ kiện nguồn dùng hằng ngày.'),
(5, 'Tai nghe', 'Tai nghe dây, tai nghe Bluetooth và phụ kiện âm thanh cá nhân.'),
(6, 'Loa bluetooth', 'Loa di động, loa mini và phụ kiện âm thanh bán kèm.'),
(7, 'Phụ kiện chụp ảnh', 'Tripod, gậy selfie, đèn livestream và phụ kiện hỗ trợ quay chụp.'),
(8, 'Phụ kiện vệ sinh', 'Bộ vệ sinh màn hình, khăn lau, dung dịch và dụng cụ chăm sóc thiết bị.'),
(9, 'Miếng dán PPF', 'Miếng dán lưng, viền và màn hình PPF theo model máy.');

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

INSERT INTO product_templates VALUES
(1, 3, 'Ốp lưng chống sốc', 'Ốp lưng bảo vệ bốn góc, ôm sát model máy, phù hợp bán tại quầy.', 129000, 62000, 28, 6, 'Case'),
(2, 1, 'Cường lực full màn', 'Kính 9H full màn, chống xước, cảm ứng mượt, cắt đúng model.', 79000, 26000, 45, 10, 'Glass'),
(3, 2, 'Cường lực camera sau', 'Bộ kính bảo vệ cụm camera, dễ lắp, không ảnh hưởng chất lượng ảnh.', 69000, 24000, 34, 8, 'Lens'),
(4, 4, 'Bộ sạc nhanh tương thích', 'Cáp và củ sạc nhanh tương thích chuẩn cổng của model máy.', 249000, 145000, 18, 5, 'Charger'),
(5, 9, 'Miếng dán PPF mặt lưng', 'Miếng dán PPF trong suốt, hạn chế trầy xước và giữ dáng máy khi dùng hằng ngày.', 99000, 42000, 25, 6, 'Utility');

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
(1, 'Khách thường', '0900000000', NULL, NULL),
(2, 'Nguyễn Văn An', '0901000001', 'an.nguyen@example.com', 'TP.HCM'),
(3, 'Trần Thị Bích', '0901000002', 'bich.tran@example.com', 'TP.HCM'),
(4, 'Lê Hoàng Nam', '0901000003', 'nam.le@example.com', 'TP.HCM'),
(5, 'Phạm Minh Châu', '0901000004', 'chau.pham@example.com', 'TP.HCM');

INSERT INTO inventory_logs (product_id, user_id, type, quantity, note, created_at)
SELECT id, 1, 'IMPORT', stock_quantity, CONCAT('Nhập tồn đầu kỳ - ', name), '2026-06-10 08:00:00'
FROM products
WHERE id IN (1, 51, 101, 151, 201, 250);

UPDATE users SET role_id = CASE role
  WHEN 'owner' THEN 1 WHEN 'admin' THEN 1 WHEN 'manager' THEN 1
  WHEN 'warehouse' THEN 4 ELSE 3 END;

INSERT INTO promotions
  (code, promotion_name, discount_type, discount_value, start_date, end_date, status, note, data, created_by, updated_by)
VALUES
('WELCOME10', 'Ưu đãi khách hàng mới', 'percentage', 10, '2026-01-01', '2027-12-31', 'active',
 'Giảm 10% cho chương trình chào mừng', '{"code":"WELCOME10","name":"Ưu đãi khách hàng mới","type":"percentage","value":10,"enabled":true}', 1, 1),
('SALE50000', 'Giảm 50.000 đồng', 'fixed_amount', 50000, '2026-01-01', '2027-12-31', 'active',
 'Áp dụng theo điều kiện bán hàng', '{"code":"SALE50000","name":"Giảm 50.000 đồng","type":"fixed","value":50000,"enabled":true}', 1, 1);
