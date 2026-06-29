import { query } from '../config/db.js';

export async function getAll(req, res) {
  try {
    const includeHidden = String(req.query.include_hidden || '') === '1';
    const categories = await query(
      `SELECT c.*, COUNT(DISTINCT p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.is_active = 1 AND p.category_id = c.id
       ${includeHidden ? '' : 'WHERE c.is_active = 1'}
       GROUP BY c.id
       ORDER BY FIELD(c.name, 'Ốp lưng', 'Kính cường lực', 'Miếng dán PPF', 'Thiết bị sạc', 'Tai nghe', 'Loa Bluetooth', 'Giá đỡ điện thoại', 'Phụ kiện chụp ảnh', 'Phụ kiện ô tô', 'Phụ kiện vệ sinh', 'Phụ kiện tiện ích', 'Phụ kiện khác'), c.name`
    );
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy danh mục', error: error.message });
  }
}

export async function updateVisibility(req, res) {
  try {
    const isActive = Number(req.body.is_active);

    if (![0, 1].includes(isActive)) {
      return res.status(400).json({ message: 'Trạng thái danh mục không hợp lệ' });
    }

    const result = await query(
      'UPDATE categories SET is_active = ? WHERE id = ?',
      [isActive, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Không tìm thấy danh mục' });
    }

    const updated = await query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ message: 'Không thể cập nhật trạng thái danh mục', error: error.message });
  }
}

export async function create(req, res) {
  try {
    const { name, description = '' } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Tên danh mục là bắt buộc' });
    }

    const result = await query(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name, description]
    );
    const created = await query('SELECT * FROM categories WHERE id = ?', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (error) {
    res.status(500).json({ message: 'Không thể tạo danh mục', error: error.message });
  }
}

export async function update(req, res) {
  try {
    const { name, description = '' } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Tên danh mục là bắt buộc' });
    }

    const result = await query(
      'UPDATE categories SET name = ?, description = ? WHERE id = ?',
      [name, description, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Không tìm thấy danh mục' });
    }

    const updated = await query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ message: 'Không thể cập nhật danh mục', error: error.message });
  }
}

export async function remove(req, res) {
  try {
    const result = await query('DELETE FROM categories WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Không tìm thấy danh mục' });
    }

    res.json({ message: 'Đã xóa danh mục' });
  } catch (error) {
    res.status(400).json({ message: 'Không thể xóa danh mục đang có sản phẩm', error: error.message });
  }
}
