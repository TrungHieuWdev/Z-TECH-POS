import { query } from '../config/db.js';
import { hasFullAccess } from '../middleware/auth.js';
import { filterOwnShifts, getStoredShifts, hasActiveShift as checkActiveShift } from '../services/shiftService.js';

export async function ensureShiftStore() {
  return true;
}

export async function getShifts(req, res) {
  try {
    await ensureShiftStore();
    const shifts = await getStoredShifts();
    res.json(hasFullAccess(req.user) ? shifts : filterOwnShifts(shifts, req.user));
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

export async function hasActiveShift(employeeName, employeeCode = '') {
  return checkActiveShift({ name: employeeName, employeeCode });
}
