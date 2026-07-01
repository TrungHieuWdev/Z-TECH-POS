import { query } from '../config/db.js';

function parsePromotion(row) {
  try {
    const data = JSON.parse(row.data || '{}');
    return {
      ...data,
      id: row.id,
      code: row.code,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch {
    return {
      id: row.id,
      code: row.code,
      name: row.code,
      enabled: false,
      status: 'ended',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}

function validatePromotion(body) {
  const code = normalizeCode(body.code);
  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) return 'Mã khuyến mãi không hợp lệ';
  if (!String(body.name || '').trim()) return 'Tên khuyến mãi là bắt buộc';
  return '';
}

export async function getAll(req, res) {
  try {
    const rows = await query('SELECT * FROM promotions ORDER BY updated_at DESC, id DESC');
    res.json(rows.map(parsePromotion));
  } catch (error) {
    res.status(500).json({ message: 'Không thể lấy danh sách khuyến mãi', error: error.message });
  }
}

export async function create(req, res) {
  try {
    const message = validatePromotion(req.body);
    if (message) return res.status(400).json({ message });

    const code = normalizeCode(req.body.code);
    const payload = { ...req.body, code };
    const result = await query(
      'INSERT INTO promotions (code, data, created_by, updated_by) VALUES (?, ?, ?, ?)',
      [code, JSON.stringify(payload), req.user.id, req.user.id]
    );
    const rows = await query('SELECT * FROM promotions WHERE id = ?', [result.insertId]);
    res.status(201).json(parsePromotion(rows[0]));
  } catch (error) {
    const status = error.code === 'ER_DUP_ENTRY' ? 409 : 500;
    res.status(status).json({ message: status === 409 ? 'Mã khuyến mãi đã tồn tại' : 'Không thể tạo khuyến mãi', error: error.message });
  }
}

export async function update(req, res) {
  try {
    const message = validatePromotion(req.body);
    if (message) return res.status(400).json({ message });

    const promotionId = Number(req.params.id);
    const code = normalizeCode(req.body.code);
    const payload = { ...req.body, id: promotionId, code };
    const result = await query(
      'UPDATE promotions SET code = ?, data = ?, updated_by = ? WHERE id = ?',
      [code, JSON.stringify(payload), req.user.id, promotionId]
    );

    if (result.affectedRows === 0) return res.status(404).json({ message: 'Không tìm thấy khuyến mãi' });

    const rows = await query('SELECT * FROM promotions WHERE id = ?', [promotionId]);
    res.json(parsePromotion(rows[0]));
  } catch (error) {
    const status = error.code === 'ER_DUP_ENTRY' ? 409 : 500;
    res.status(status).json({ message: status === 409 ? 'Mã khuyến mãi đã tồn tại' : 'Không thể cập nhật khuyến mãi', error: error.message });
  }
}

export async function remove(req, res) {
  try {
    const result = await query('DELETE FROM promotions WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Không tìm thấy khuyến mãi' });
    res.json({ message: 'Đã xóa khuyến mãi' });
  } catch (error) {
    res.status(500).json({ message: 'Không thể xóa khuyến mãi', error: error.message });
  }
}
