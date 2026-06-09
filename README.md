# Z-TECH POS

## Cấu trúc

```text
Z-TECH POS/
  backend/
  database/
  frontend/
```

## Yêu cầu

- Node.js >= 18
- MySQL đang chạy

## Setup lần đầu

### 1. Tạo database và import dữ liệu

Mở MySQL Workbench hoặc terminal và chạy:

```sql
CREATE DATABASE pos_accessories CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Sau đó import từ thư mục root của dự án:

```bash
mysql -u root pos_accessories < database/schema.sql
mysql -u root pos_accessories < database/seed.sql
```

### 2. Chạy Backend

```bash
cd backend
npm install
npm run dev
```

Backend chạy tại `http://localhost:5000`.

### 3. Chạy Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend chạy tại `http://localhost:5173`.

## Tài khoản mặc định

- Admin: `admin@pos.com` / `admin123`
- Cashier: `cashier@pos.com` / `123456`
