import { query } from '../config/db.js';

export async function getAll(req, res) {
  try {
    const categories = await query('SELECT * FROM categories ORDER BY name');
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy danh mục', error: error.message });
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
