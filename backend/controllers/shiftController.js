import { query } from '../config/db.js';

export async function ensureShiftStore() {
  await query(`CREATE TABLE IF NOT EXISTS shift_store (
    id TINYINT PRIMARY KEY DEFAULT 1,
    shifts_json LONGTEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
}

export async function getShifts(req, res) {
  try {
    await ensureShiftStore();
    const rows = await query('SELECT shifts_json FROM shift_store WHERE id = 1');
    res.json(rows[0] ? JSON.parse(rows[0].shifts_json) : []);
  } catch (error) { res.status(500).json({ message: 'Không thể tải ca làm', error: error.message }); }
}

export async function saveShifts(req, res) {
  try {
    await ensureShiftStore();
    const shifts = Array.isArray(req.body) ? req.body : [];
    await query(`INSERT INTO shift_store (id, shifts_json) VALUES (1, ?) ON DUPLICATE KEY UPDATE shifts_json = VALUES(shifts_json)`, [JSON.stringify(shifts)]);
    res.json(shifts);
  } catch (error) { res.status(500).json({ message: 'Không thể lưu ca làm', error: error.message }); }
}

export async function hasActiveShift(employeeName) {
  await ensureShiftStore();
  const rows = await query('SELECT shifts_json FROM shift_store WHERE id = 1');
  if (!rows[0]) return false;
  const shifts = JSON.parse(rows[0].shifts_json || '[]');
  const today = new Date().toISOString().slice(0, 10);
  return shifts.some((shift) => String(shift.employee || '').trim() === String(employeeName || '').trim() && shift.workDate === today && shift.status === 'active');
}
