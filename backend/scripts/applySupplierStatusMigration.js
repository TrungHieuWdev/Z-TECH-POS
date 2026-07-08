import { query } from '../config/db.js';

try {
  await query("ALTER TABLE suppliers MODIFY COLUMN status ENUM('active','paused','inactive') NOT NULL DEFAULT 'active'");
  console.log('Supplier status migration applied');
  process.exit(0);
} catch (error) {
  console.error('Supplier status migration failed:', error.message);
  process.exit(1);
}
