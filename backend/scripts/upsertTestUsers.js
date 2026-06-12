import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const users = [
  {
    id: 1,
    name: 'Chủ cửa hàng',
    email: 'owner@pos.com',
    password: 'admin123',
    role: 'owner'
  },
  {
    id: 2,
    name: 'Quản lý',
    email: 'manager@pos.com',
    password: 'admin123',
    role: 'manager'
  },
  {
    id: 3,
    name: 'Nhân viên',
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

try {
  await connection.execute(
    "ALTER TABLE users MODIFY role ENUM('owner', 'manager', 'employee', 'admin', 'cashier') DEFAULT 'employee'"
  );

  for (const user of users) {
    const hash = await bcrypt.hash(user.password, 10);

    await connection.execute(
      `INSERT INTO users (id, name, email, password, role)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        email = VALUES(email),
        password = VALUES(password),
        role = VALUES(role)`,
      [user.id, user.name, user.email, hash, user.role]
    );

    const [rows] = await connection.execute(
      'SELECT password FROM users WHERE email = ?',
      [user.email]
    );
    const canLogin = rows[0] ? await bcrypt.compare(user.password, rows[0].password) : false;
    console.log(`${user.email} / ${user.password}: ${canLogin ? 'OK' : 'FAILED'}`);
  }
} finally {
  await connection.end();
}
