import { query } from '../config/db.js';

function parsePromotion(row) {
  try {
    const data = JSON.parse(row.data || '{}');
    return normalizePromotionState({
      ...data,
      id: row.id,
      code: row.code,
      enabled: data.enabled !== false && !['inactive', 'expired'].includes(row.status),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
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

function getVietnamDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function normalizePromotionState(payload) {
  if (payload?.endDate && payload.endDate < getVietnamDate()) {
    return { ...payload, enabled: false, status: 'ended' };
  }
  if (payload?.enabled === false) {
    return { ...payload, enabled: false, status: 'ended' };
  }
  return payload;
}

function getDatabaseStatus(payload) {
  if (payload.endDate && payload.endDate < getVietnamDate()) return 'expired';
  return payload.enabled === false ? 'inactive' : 'active';
}

function getDatabaseValues(payload) {
  return [
    String(payload.name || '').trim(),
    payload.discountType === 'percent' ? 'percentage' : 'fixed_amount',
    Number(payload.discountValue || payload.comboDiscountValue || 0),
    payload.startDate ? `${payload.startDate} 00:00:00` : null,
    payload.endDate ? `${payload.endDate} 23:59:59` : null,
    getDatabaseStatus(payload),
    String(payload.description || payload.condition || '').trim() || null
  ];
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
    res.status(500).json({
      message: 'Không thể lấy danh sách khuyến mãi',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {})
    });
  }
}

export async function create(req, res) {
  try {
    const message = validatePromotion(req.body);
    if (message) return res.status(400).json({ message });

    const code = normalizeCode(req.body.code);
    const payload = normalizePromotionState({ ...req.body, code });
    const databaseValues = getDatabaseValues(payload);
    const result = await query(
      `INSERT INTO promotions
       (code, promotion_name, discount_type, discount_value, start_date, end_date, status,
        note, data, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, ...databaseValues, JSON.stringify(payload), req.user.id, req.user.id]
    );
    const rows = await query('SELECT * FROM promotions WHERE id = ?', [result.insertId]);
    res.status(201).json(parsePromotion(rows[0]));
  } catch (error) {
    const status = error.code === 'ER_DUP_ENTRY' ? 409 : 500;
    res.status(status).json({
      message: status === 409 ? 'Mã khuyến mãi đã tồn tại' : 'Không thể tạo khuyến mãi',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {})
    });
  }
}

export async function update(req, res) {
  try {
    const message = validatePromotion(req.body);
    if (message) return res.status(400).json({ message });

    const promotionId = Number(req.params.id);
    const code = normalizeCode(req.body.code);
    const payload = normalizePromotionState({ ...req.body, id: promotionId, code });
    const databaseValues = getDatabaseValues(payload);
    const result = await query(
      `UPDATE promotions
       SET code = ?, promotion_name = ?, discount_type = ?, discount_value = ?,
           start_date = ?, end_date = ?, status = ?, note = ?, data = ?, updated_by = ?
       WHERE id = ?`,
      [code, ...databaseValues, JSON.stringify(payload), req.user.id, promotionId]
    );

    if (result.affectedRows === 0) return res.status(404).json({ message: 'Không tìm thấy khuyến mãi' });

    const rows = await query('SELECT * FROM promotions WHERE id = ?', [promotionId]);
    res.json(parsePromotion(rows[0]));
  } catch (error) {
    const status = error.code === 'ER_DUP_ENTRY' ? 409 : 500;
    res.status(status).json({
      message: status === 409 ? 'Mã khuyến mãi đã tồn tại' : 'Không thể cập nhật khuyến mãi',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {})
    });
  }
}

export async function remove(req, res) {
  try {
    const result = await query('DELETE FROM promotions WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Không tìm thấy khuyến mãi' });
    res.json({ message: 'Đã xóa khuyến mãi' });
  } catch (error) {
    res.status(500).json({
      message: 'Không thể xóa khuyến mãi',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {})
    });
  }
}
