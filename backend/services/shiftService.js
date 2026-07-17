import { query } from '../config/db.js';

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
  const userCode = String(user?.employeeCode || user?.employee_code || '').trim().toUpperCase();
  if (shiftCode && userCode) return shiftCode === userCode;
  return String(shift?.employee || '').trim() === String(user?.name || '').trim();
}

export async function getStoredShifts(db = query) {
  const rows = await db('SELECT shifts_json FROM shift_store WHERE id = 1');
  if (!rows[0]) return [];
  try {
    const shifts = JSON.parse(rows[0].shifts_json || '[]');
    return Array.isArray(shifts) ? shifts : [];
  } catch {
    return [];
  }
}

export function filterOwnShifts(shifts, user) {
  return shifts.filter((shift) => isOwnShift(shift, user));
}

export async function hasActiveShift(user, db = query) {
  const shifts = await getStoredShifts(db);
  const today = getVietnamDateKey();
  return shifts.some((shift) => (
    isOwnShift(shift, user) &&
    shift.workDate === today &&
    shift.status === 'active'
  ));
}

