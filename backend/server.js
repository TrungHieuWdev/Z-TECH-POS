import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import deviceModelRoutes from './routes/deviceModels.js';
import categoryRoutes from './routes/categories.js';
import customerRoutes from './routes/customers.js';
import orderRoutes from './routes/orders.js';
import inventoryRoutes from './routes/inventory.js';
import dashboardRoutes from './routes/dashboard.js';
import reportRoutes from './routes/reports.js';
import activityLogRoutes from './routes/activityLogs.js';
import employeeRoutes from './routes/employees.js';
import warrantyRoutes from './routes/warranties.js';
import publicWarrantyRoutes from './routes/publicWarranties.js';
import shiftRoutes from './routes/shifts.js';
import settingsRoutes from './routes/settings.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);

const allowedOrigins = new Set([
  process.env.FRONTEND_ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean));

function isAllowedOrigin(origin) {
  if (!origin || allowedOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && url.port === '5173' && (
      /^10\./.test(url.hostname) ||
      /^192\.168\./.test(url.hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)
    );
  } catch {
    return false;
  }
}

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error('Origin không được CORS cho phép'));
  },
  credentials: true
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Z-TECH POS API</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #f5f7fb;
            color: #111827;
            font-family: Arial, sans-serif;
          }
          main {
            width: min(560px, calc(100% - 32px));
            padding: 28px;
            border-radius: 12px;
            background: white;
            box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
          }
          h1 { margin: 0 0 8px; font-size: 28px; }
          p { margin: 8px 0; color: #4b5563; line-height: 1.5; }
          a {
            display: inline-block;
            margin-top: 16px;
            padding: 10px 14px;
            border-radius: 8px;
            background: #4338ca;
            color: white;
            text-decoration: none;
            font-weight: 700;
          }
          code {
            padding: 2px 6px;
            border-radius: 6px;
            background: #eef2ff;
            color: #3730a3;
          }
        </style>
      </head>
      <body>
        <main>
          <h1>Z-TECH POS API đang chạy</h1>
          <p>Backend chạy tại <code>http://localhost:${PORT}</code>.</p>
          <p>API health: <code>/api/health</code></p>
          <p>Giao diện frontend chạy tại <code>http://localhost:5173</code>.</p>
          <a href="http://localhost:5173">Mở frontend</a>
        </main>
      </body>
    </html>
  `);
});

app.get('/api/health', (req, res) => {
  res.json({ message: 'POS API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/device-models', deviceModelRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/warranties', warrantyRoutes);
app.use('/api/public/warranties', publicWarrantyRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/settings', settingsRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Không tìm thấy API' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\nKhong the khoi dong backend: port ${PORT} dang duoc tien trinh khac su dung.`);
    console.error(`Hay chay: npm run dev de tu dong giai phong port ${PORT}, hoac doi PORT trong file .env.\n`);
    process.exit(1);
  }

  throw error;
});
