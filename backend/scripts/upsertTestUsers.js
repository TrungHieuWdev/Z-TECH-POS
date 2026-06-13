import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const users = [
  {
    id: 1,
    name: 'Chủ cửa hàng',
    employeeCode: 'CH001',
    email: 'owner@pos.com',
    password: 'admin123',
    role: 'owner'
  },
  {
    id: 2,
    name: 'Quản lý',
    employeeCode: 'QL001',
    email: 'manager@pos.com',
    password: 'admin123',
    role: 'manager'
  },
  {
    id: 3,
    name: 'Nhân viên',
    employeeCode: 'NV001',
    email: 'employee@pos.com',
    password: '123456',
    role: 'employee'
  }
];

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pos_accessories'
});

async function ensureEmployeeCodeColumn() {
  const [columns] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'employee_code'`
  );

  if (columns.length === 0) {
    await connection.execute(
      'ALTER TABLE users ADD COLUMN employee_code VARCHAR(20) NULL AFTER name'
    );
  }

  // Backfill old rows before enforcing uniqueness.
  await connection.execute(`
    UPDATE users
    SET employee_code = CASE
      WHEN email = 'owner@pos.com' THEN 'CH001'
      WHEN email = 'manager@pos.com' THEN 'QL001'
      WHEN email = 'employee@pos.com' THEN 'NV001'
      ELSE CONCAT('NV', LPAD(id, 3, '0'))
    END
    WHERE employee_code IS NULL OR employee_code = ''
  `);

  await connection.execute(
    'ALTER TABLE users MODIFY employee_code VARCHAR(20) NOT NULL'
  );

  const [indexes] = await connection.execute(
    `SHOW INDEX FROM users WHERE Key_name = 'uk_users_employee_code'`
  );

  if (indexes.length === 0) {
    await connection.execute(
      'ALTER TABLE users ADD UNIQUE KEY uk_users_employee_code (employee_code)'
    );
  }
}

try {
  await connection.execute(
    "ALTER TABLE users MODIFY role ENUM('owner', 'manager', 'employee', 'admin', 'cashier') DEFAULT 'employee'"
  );

  await ensureEmployeeCodeColumn();

  for (const user of users) {
    const hash = await bcrypt.hash(user.password, 10);

    await connection.execute(
      `INSERT INTO users (id, name, employee_code, email, password, role)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        employee_code = VALUES(employee_code),
        email = VALUES(email),
        password = VALUES(password),
        role = VALUES(role)`,
      [user.id, user.name, user.employeeCode, user.email, hash, user.role]
    );

    const [rows] = await connection.execute(
      'SELECT password FROM users WHERE employee_code = ?',
      [user.employeeCode]
    );
    const canLogin = rows[0] ? await bcrypt.compare(user.password, rows[0].password) : false;
    console.log(`${user.employeeCode} / ${user.password}: ${canLogin ? 'OK' : 'FAILED'}`);
  }
} finally {
  await connection.end();
}
