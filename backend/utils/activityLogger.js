import { query } from '../config/db.js';
export async function ensureActivityTable() {
  return true;
}
export async function logActivity(userId, actionLabel, targetName, description = '') {
  await ensureActivityTable();
  await query('INSERT INTO system_activity_logs (user_id, module, action_label, target_name, description) VALUES (?, ?, ?, ?, ?)', [userId || null, 'Sản phẩm', actionLabel, targetName, description]);
}
