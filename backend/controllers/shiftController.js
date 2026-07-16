import { query } from '../config/db.js';
import { hasFullAccess } from '../middleware/auth.js';

const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function getVietnamDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function isOwnShift(shift, user) {
  const shiftCode = String(shift?.employeeCode || '').trim().toUpperCase();
  const userCode = String(user?.employeeCode || '').trim().toUpperCase();
  if (shiftCode && userCode) return shiftCode === userCode;
  return String(shift?.employee || '').trim() === String(user?.name || '').trim();
}

export async function ensureShiftStore() {
  return true;
}

export async function getShifts(req, res) {
  try {
    await ensureShiftStore();
    const rows = await query('SELECT shifts_json FROM shift_store WHERE id = 1');
    const shifts = rows[0] ? JSON.parse(rows[0].shifts_json) : [];
    res.json(hasFullAccess(req.user) ? shifts : shifts.filter((shift) => isOwnShift(shift, req.user)));
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
  await ensureShiftStore();
  const rows = await query('SELECT shifts_json FROM shift_store WHERE id = 1');
  if (!rows[0]) return false;
  const shifts = JSON.parse(rows[0].shifts_json || '[]');
  const today = getVietnamDateKey();
  return shifts.some((shift) => (
    isOwnShift(shift, { name: employeeName, employeeCode })
    && shift.workDate === today
    && shift.status === 'active'
  ));
}
