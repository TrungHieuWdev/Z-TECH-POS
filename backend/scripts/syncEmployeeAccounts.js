import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const employees = [
  {
    code: 'NV001',
    name: 'Hồ Viết Bảo',
    phone: '0901234567',
    password: 'NV001@123',
    role: 'manager',
    status: 'active',
    createdAt: '2026-06-10 08:00:00',
    lastLoginAt: '2026-06-13 19:39:53',
    note: 'Quản lý vận hành cửa hàng và phân quyền nhân viên.'
  },
  {
    code: 'NV002',
    name: 'Trần Thị Hạnh',
    phone: '0912888999',
    password: 'NV002@123',
    role: 'cashier',
    status: 'active',
    createdAt: '2026-06-10 08:00:00',
    lastLoginAt: '2026-06-05 14:47:16',
    note: 'Phụ trách bán hàng tại quầy POS.'
  },
  {
    code: 'NV003',
    name: 'Lê Quốc Khoa',
    phone: '0987456123',
    password: 'NV003@123',
    role: 'warehouse',
    status: 'active',
    createdAt: '2026-06-09 08:00:00',
    lastLoginAt: '2026-06-10 19:54:29',
    note: 'Phụ trách nhập kho, kiểm kho và điều chỉnh tồn.'
  },
  {
    code: 'NV004',
    name: 'Châu Thanh Sang',
    phone: '0933222111',
    password: 'NV004@123',
    role: 'cashier',
    status: 'active',
    createdAt: '2026-06-08 08:00:00',
    lastLoginAt: '2026-06-11 15:26:32',
    note: 'Hỗ trợ bán hàng trực ca chiều.'
  }
];

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pos_accessories'
});

try {
  await connection.execute('ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL AFTER email').catch(ignoreDup);
  await connection.execute("ALTER TABLE users ADD COLUMN status ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER role").catch(ignoreDup);
  await connection.execute('ALTER TABLE users ADD COLUMN note TEXT NULL AFTER status').catch(ignoreDup);
  await connection.execute('ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL AFTER note').catch(ignoreDup);
  await connection.execute(
    "ALTER TABLE users MODIFY role ENUM('owner', 'manager', 'employee', 'admin', 'cashier', 'warehouse') DEFAULT 'employee'"
  );

  for (const employee of employees) {
    const hash = await bcrypt.hash(employee.password, 10);
    const email = `${employee.code.toLowerCase()}@ztech.local`;

    await connection.execute(
      `INSERT INTO users (name, employee_code, email, phone, password, role, status, note, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         email = VALUES(email),
         phone = VALUES(phone),
         password = VALUES(password),
         role = VALUES(role),
         status = VALUES(status),
         note = VALUES(note),
         created_at = VALUES(created_at),
         last_login_at = VALUES(last_login_at)`,
      [
        employee.name,
        employee.code,
        email,
        employee.phone,
        hash,
        employee.role,
        employee.status,
        employee.note,
        employee.createdAt,
        employee.lastLoginAt
      ]
    );
  }

  console.log('Employee accounts synced');
} finally {
  await connection.end();
}

function ignoreDup(error) {
  if (error.code !== 'ER_DUP_FIELDNAME') {
    throw error;
  }
}
