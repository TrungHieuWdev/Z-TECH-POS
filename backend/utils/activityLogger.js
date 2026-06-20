import { query } from '../config/db.js';
let ready = false;
export async function ensureActivityTable() {
  if (ready) return;
  await query(`CREATE TABLE IF NOT EXISTS system_activity_logs (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NULL, module VARCHAR(50) NOT NULL, action_label VARCHAR(100) NOT NULL, target_name VARCHAR(255), description TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_system_activity_created (created_at))`);
  ready = true;
}
export async function logActivity(userId, actionLabel, targetName, description = '') {
  await ensureActivityTable();
  await query('INSERT INTO system_activity_logs (user_id, module, action_label, target_name, description) VALUES (?, ?, ?, ?, ?)', [userId || null, 'Sản phẩm', actionLabel, targetName, description]);
}
