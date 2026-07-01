import { query } from '../config/db.js';

const selectSql = `SELECT id, supplier_code AS code, supplier_name AS name, phone, email,
  address, note, status, created_at, updated_at FROM suppliers`;

export async function getAll(req, res) {
  const rows = await query(`${selectSql} ORDER BY supplier_name`);
  res.json(rows);
}

export async function create(req, res) {
  try {
    const { supplier_code, supplier_name, phone = null, email = null, address = null, note = null, status = 'active' } = req.body;
    const result = await query(
      `INSERT INTO suppliers (supplier_code, supplier_name, phone, email, address, note, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [supplier_code, supplier_name, phone, email, address, note, status]
    );
    const rows = await query(`${selectSql} WHERE id = ?`, [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ message: 'Không thể tạo nhà cung cấp' });
  }
}

export async function update(req, res) {
  try {
    const { supplier_code, supplier_name, phone = null, email = null, address = null, note = null, status = 'active' } = req.body;
    const result = await query(
      `UPDATE suppliers SET supplier_code=?, supplier_name=?, phone=?, email=?, address=?, note=?, status=? WHERE id=?`,
      [supplier_code, supplier_name, phone, email, address, note, status, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy nhà cung cấp' });
    const rows = await query(`${selectSql} WHERE id = ?`, [req.params.id]);
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
