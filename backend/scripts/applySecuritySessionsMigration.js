import { closePool, query } from '../config/db.js';

async function addColumnIfMissing(name, definition) {
  const rows = await query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ? LIMIT 1`,
    [name]
  );
  if (!rows.length) await query(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
}

async function run() {
  await addColumnIfMissing('failed_login_attempts', 'INT UNSIGNED NOT NULL DEFAULT 0 AFTER password_changed_at');
  await addColumnIfMissing('locked_until', 'DATETIME NULL AFTER failed_login_attempts');
  await addColumnIfMissing('last_failed_login_at', 'DATETIME NULL AFTER locked_until');
  await addColumnIfMissing('mfa_enabled', 'BOOLEAN NOT NULL DEFAULT FALSE AFTER last_failed_login_at');
  await addColumnIfMissing('mfa_secret_encrypted', 'TEXT NULL AFTER mfa_enabled');
  await addColumnIfMissing('mfa_recovery_codes_json', 'TEXT NULL AFTER mfa_secret_encrypted');
  await query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      refresh_token_hash CHAR(64) NOT NULL,
      csrf_token_hash CHAR(64) NOT NULL,
      user_agent VARCHAR(255) NULL,
      ip_address VARCHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME NULL,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      UNIQUE KEY uk_auth_sessions_refresh (refresh_token_hash),
      INDEX idx_auth_sessions_user (user_id, revoked_at, expires_at),
      CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await query('DELETE FROM auth_sessions WHERE expires_at < DATE_SUB(NOW(), INTERVAL 30 DAY)');
  console.log('Security sessions migration applied');
}

run()
  .then(() => closePool())
  .catch(async (error) => {
    console.error('Security sessions migration failed:', error.message);
    await closePool().catch(() => {});
    process.exitCode = 1;
  });
