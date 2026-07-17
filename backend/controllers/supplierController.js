import { query } from '../config/db.js';

const selectSql = `SELECT s.id, s.supplier_code AS code, s.supplier_name AS name,
  s.supplier_group AS \`group\`, s.contact_name AS contact, s.phone, s.email,
  s.address, s.note, s.status, s.created_at, s.updated_at,
  MAX(CASE WHEN po.status = 'completed' THEN po.created_at END) AS last_purchase_at,
  COUNT(CASE WHEN po.status <> 'cancelled' THEN 1 END) AS purchase_order_count,
  COALESCE(SUM(CASE WHEN po.status <> 'cancelled' THEN po.total_amount ELSE 0 END), 0) AS total_purchased,
  COALESCE(SUM(CASE WHEN po.status <> 'cancelled' THEN po.paid_amount ELSE 0 END), 0) AS total_paid,
  COALESCE(SUM(CASE WHEN po.status <> 'cancelled' THEN GREATEST(po.total_amount - po.paid_amount, 0) ELSE 0 END), 0) AS total_debt
  FROM suppliers s
  LEFT JOIN purchase_orders po ON po.supplier_id = s.id`;

export async function getAll(req, res) {
  const rows = await query(`${selectSql} GROUP BY s.id ORDER BY s.supplier_name`);
  res.json(rows);
}

export async function create(req, res) {
  try {
    const { supplier_code, supplier_name, supplier_group = null, contact_name = null, phone = null, email = null, address = null, note = null, status = 'active' } = req.body;
    const result = await query(
      `INSERT INTO suppliers (supplier_code, supplier_name, supplier_group, contact_name, phone, email, address, note, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [supplier_code, supplier_name, supplier_group, contact_name, phone, email, address, note, status]
    );
    const rows = await query(`${selectSql} WHERE s.id = ? GROUP BY s.id`, [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ message: 'Không thể tạo nhà cung cấp' });
  }
}

export async function update(req, res) {
  try {
    const { supplier_code, supplier_name, supplier_group = null, contact_name = null, phone = null, email = null, address = null, note = null, status = 'active' } = req.body;
    const result = await query(
      `UPDATE suppliers SET supplier_code=?, supplier_name=?, supplier_group=?, contact_name=?, phone=?, email=?, address=?, note=?, status=? WHERE id=?`,
      [supplier_code, supplier_name, supplier_group, contact_name, phone, email, address, note, status, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy nhà cung cấp' });
    const rows = await query(`${selectSql} WHERE s.id = ? GROUP BY s.id`, [req.params.id]);
    res.json(rows[0]);
  } catch (error) {
    res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ message: 'Không thể cập nhật nhà cung cấp' });
  }
}

export async function remove(req, res) {
  const used = await query('SELECT id FROM purchase_orders WHERE supplier_id = ? LIMIT 1', [req.params.id]);
  if (used[0]) return res.status(409).json({ message: 'Nhà cung cấp đã có phiếu nhập, chỉ có thể ngừng hoạt động' });
  const result = await query('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy nhà cung cấp' });
  res.json({ message: 'Đã xóa nhà cung cấp' });
}
