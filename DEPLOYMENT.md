# Z-TECH POS - checklist triển khai

## 1. Sao lưu trước khi cập nhật

```powershell
mysqldump --single-transaction --routines --triggers -h <DB_HOST> -u <DB_USER> -p <DB_NAME> > ztech-pos-backup.sql
```

Kiểm tra file backup có dữ liệu trước khi tiếp tục và lưu một bản ngoài máy chủ chạy ứng dụng.

## 2. Cấu hình production

- Sao chép `backend/.env.example` thành `backend/.env`.
- Đặt `NODE_ENV=production`.
- Tạo `JWT_SECRET` ngẫu nhiên tối thiểu 32 ký tự.
- Khai báo chính xác `FRONTEND_ORIGINS` dùng HTTPS.
- Đặt `TRUST_PROXY=true` nếu backend chạy sau Nginx/Cloudflare.
- Không commit file `.env`.
- Cấu hình tài khoản ngân hàng trong trang Cài đặt; mã nguồn không còn chứa tài khoản mặc định.

Frontend mặc định gọi `/api` và `/uploads` cùng domain. Chỉ đặt `VITE_API_URL` khi frontend và backend thực sự chạy ở hai origin khác nhau.

## 3. Migration và kiểm tra

```powershell
cd backend
npm ci
npm run migrate:hardening
npm run migrate:pos-business
npm run migrate:ai-report-results
npm run migrate:production-readiness
npm test
```

```powershell
cd ../frontend
npm ci
npm run build
```

## 4. Reverse proxy

Phục vụ `frontend/dist` qua HTTPS, chuyển tiếp `/api` và `/uploads` tới backend. Không mở trực tiếp cổng MySQL ra Internet.

Health check:

- Liveness: `GET /api/health/live`
- Readiness (bao gồm MySQL): `GET /api/health`

## 5. Sau triển khai

- Đăng nhập từng vai trò và kiểm tra quyền.
- Mở ca nhân viên, tạo một đơn thử, hủy đơn và đối chiếu tồn kho.
- Kiểm tra mua X tặng Y: số mua và quà hiển thị riêng, tổng tiền do backend trả về.
- Tắt hoặc làm hết hạn một khuyến mãi và xác nhận POS không còn hiển thị.
- Kiểm tra cấu hình VAT, tiền mặt, chuyển khoản và QR.
- Thiết lập backup MySQL tự động hằng ngày và thử phục hồi định kỳ.
