import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { closePool, query } from './config/db.js';
import { getJwtSecret } from './config/auth.js';
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
import promotionRoutes from './routes/promotions.js';
import supplierRoutes from './routes/suppliers.js';
import purchaseOrderRoutes from './routes/purchaseOrders.js';
import paymentRoutes from './routes/payments.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);
const isProduction = process.env.NODE_ENV === 'production';
const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadsDirectory = path.join(serverDirectory, 'uploads');

function validateRuntimeConfig() {
  getJwtSecret();
  if (isProduction && !String(process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || '').trim()) {
    throw new Error('FRONTEND_ORIGINS is required in production');
  }
}

validateRuntimeConfig();

const configuredOrigins = String(process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);
const allowedOrigins = new Set([
  ...configuredOrigins,
  ...(!isProduction ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : [])
]);

function isDevelopmentHost(hostname) {
  return ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
}

function isAllowedOrigin(origin) {
  if (!origin || allowedOrigins.has(origin)) return true;

  try {
    const url = new URL(origin);
    return !isProduction &&
      ['http:', 'https:'].includes(url.protocol) &&
      isDevelopmentHost(url.hostname);
  } catch {
    return false;
  }
}

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    console.warn(`[CORS] Rejected origin: ${origin || '(no origin)'}`);
    return callback(new Error('Origin không được CORS cho phép'));
  },
  credentials: true
}));
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
if (String(process.env.TRUST_PROXY || '').toLowerCase() === 'true') {
  app.set('trust proxy', 1);
}
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT || 600),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Quá nhiều yêu cầu, vui lòng thử lại sau' }
}));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use((req, res, next) => {
  if (!isProduction) return next();
  const sendJson = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === 'object' && !Array.isArray(body) && 'error' in body) {
      const { error, ...safeBody } = body;
      return sendJson(safeBody);
    }
    return sendJson(body);
  };
  return next();
});
app.use('/uploads', express.static(uploadsDirectory, {
  dotfiles: 'deny',
  fallthrough: false,
  immutable: isProduction,
  maxAge: isProduction ? '7d' : 0,
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

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

app.get('/api/health/live', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/health', async (req, res, next) => {
  try {
    await query('SELECT 1 AS ok');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    error.status = 503;
    next(error);
  }
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
app.use('/api/promotions', promotionRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/payments', paymentRoutes);

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  const status = error.status || error.statusCode || 500;
  const isProductionError = isProduction && status >= 500;

  return res.status(status).json({
    message: isProductionError ? 'Lỗi hệ thống, vui lòng thử lại sau' : error.message || 'Lỗi hệ thống'
  });
});

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

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down...`);

  const forceTimer = setTimeout(() => process.exit(1), 10000);
  forceTimer.unref();
  server.close(async () => {
    try {
      await closePool();
      clearTimeout(forceTimer);
      process.exit(0);
    } catch (error) {
      console.error('Database shutdown failed:', error.message);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
