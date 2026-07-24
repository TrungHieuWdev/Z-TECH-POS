# Deploy Z-TECH POS lên Vercel + Aiven

Production dùng một project Vercel cho cả React và Express, cùng domain để
cookie HttpOnly/CSRF ổn định. MySQL nên đặt tại Aiven Singapore, cùng khu vực
`sin1` với Vercel Function để giảm độ trễ.

## 1. Tạo MySQL Aiven

1. Tạo Aiven for MySQL tại Singapore. Production nên dùng Business để có
   standby; Startup chỉ phù hợp chạy thử.
2. Tạo database `pos_accessories` và user ứng dụng riêng. Không dùng tài khoản
   quản trị cho kết nối thường ngày.
3. Tải CA certificate và sao chép Service URI.
4. Từ máy quản trị, trỏ `.env` tạm vào Aiven rồi chạy:

```powershell
cd backend
npm run migrate:hardening
npm run migrate:production-readiness
npm run migrate:security-sessions
npm run migrate:pos-business
npm run migrate:ai-report-results
```

Không chạy migration trong mỗi lần build Vercel.

## 2. Tạo Blob và project Vercel

1. Import repository vào Vercel; giữ Root Directory ở thư mục gốc.
2. Framework preset là Vite. Build/output đã khai báo trong `vercel.json`.
3. Trong Storage, tạo Vercel Blob public và kết nối project. Vercel tự thêm
   `BLOB_READ_WRITE_TOKEN`.
4. Thêm Environment Variables cho Production:

```text
NODE_ENV=production
DATABASE_URL=mysql://USER:PASSWORD@HOST:PORT/pos_accessories
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
DB_SSL_CA=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----
DB_CONNECTION_LIMIT=3
DB_MAX_IDLE=2
DB_IDLE_TIMEOUT_MS=60000
DB_CONNECT_TIMEOUT_MS=10000
JWT_SECRET=<secret ngẫu nhiên mới, tối thiểu 32 ký tự>
MFA_ENCRYPTION_KEY=<secret ngẫu nhiên khác, tối thiểu 32 ký tự>
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_DAYS=7
API_RATE_LIMIT=600
LOGIN_RATE_LIMIT=10
TRUST_PROXY=true
JSON_BODY_LIMIT=1mb
```

Sau khi gắn domain chính thức, thêm:

```text
FRONTEND_ORIGINS=https://pos.tenmiencuaban.vn
```

Không đưa `.env`, Service URI, CA, Blob token hoặc secret vào Git.

## 3. Deploy và smoke test

Deploy project rồi kiểm tra:

```text
GET https://pos.tenmiencuaban.vn/api/health/live
GET https://pos.tenmiencuaban.vn/api/health
```

Endpoint thứ hai phải trả `database: connected`. Sau đó đăng nhập, mở ca, tạo
đơn thử, thanh toán, tải logo và đối chiếu lại tồn kho. Bật MFA cho admin trước
khi sử dụng thật.

## 4. Chống quá tải và mất dữ liệu

- Vercel Firewall: bật Bot Protection; rate limit `/api/auth/login` nghiêm hơn
  `/api/*`; chặn quốc gia không phục vụ. Limiter Express chỉ là lớp phụ vì
  Function có thể tự scale.
- Aiven: cảnh báo CPU, disk, connections và replication lag; giữ automatic
  backups và thử restore định kỳ sang service tạm.
- Vercel Observability: cảnh báo tỷ lệ 5xx và thời gian API.
- Không cache `/api` vì có dữ liệu cửa hàng. Assets Vite có hash được cache một
  năm; API luôn lấy dữ liệu mới.
- Nếu Aiven không ở Singapore, đổi `regions` trong `vercel.json` sang vùng
  Vercel gần database nhất.

## 5. Kiểm tra trước khi public

```powershell
npm install
npm test
npm run build
npm run audit:production
```

Đổi toàn bộ mật khẩu/secret từng dùng ở local, bật domain HTTPS, MFA admin,
kiểm tra phân quyền từng vai trò và xác nhận đã restore được một bản backup.
