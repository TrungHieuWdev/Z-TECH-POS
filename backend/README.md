# Z-TECH POS Backend

## Setup

```bash
npm install
npm run dev
```

API chạy tại `http://localhost:5000`.

## Database

Database scripts đã được tách ra thư mục `../database`.

Nếu đang đứng trong thư mục `backend`, import bằng:

```bash
mysql -u root -e "CREATE DATABASE pos_accessories CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root pos_accessories < ../database/schema.sql
mysql -u root pos_accessories < ../database/seed.sql
```
