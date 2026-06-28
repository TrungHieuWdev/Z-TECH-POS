import { query } from '../config/db.js';

const columns = await query("SHOW COLUMNS FROM categories LIKE 'is_active'");

if (columns.length === 0) {
  await query(
    'ALTER TABLE categories ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER description'
  );
  console.log('Đã thêm trạng thái ẩn/hiện cho danh mục.');
} else {
  console.log('Trạng thái ẩn/hiện danh mục đã tồn tại.');
}
