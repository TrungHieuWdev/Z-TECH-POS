import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Thiếu email hoặc mật khẩu' });
    }

    const users = await query('SELECT * FROM users WHERE email = ?', [email]);
    const user = users[0];

    if (!user) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(
      safeUser,
      process.env.JWT_SECRET || 'pos_secret_key_2024',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ token, user: safeUser });
  } catch (error) {
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      return res.status(500).json({
        message: 'Không kết nối được MySQL',
        error: 'Kiểm tra DB_USER và DB_PASSWORD trong backend/.env'
      });
    }

    res.status(500).json({ message: 'Không thể đăng nhập', error: error.message });
  }
}

export async function getMe(req, res) {
  res.json(req.user);
}
