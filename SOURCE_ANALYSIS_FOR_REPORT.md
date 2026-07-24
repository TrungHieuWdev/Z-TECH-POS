# PHÂN TÍCH SOURCE PHỤC VỤ BÁO CÁO ĐỒ ÁN Z-TECH POS

> Phạm vi: phân tích tĩnh source tại thời điểm 20/07/2026 và chạy bộ test không làm thay đổi dữ liệu. Tài liệu này không mô tả chức năng không có bằng chứng. “Chưa xác định từ source” được dùng khi source không đủ căn cứ.

## Mục lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Cấu trúc source và kết nối](#2-cấu-trúc-source-và-kết-nối)
3. [Tác nhân và phân quyền](#3-tác-nhân-và-phân-quyền)
4. [Phân tích chức năng theo module](#4-phân-tích-chức-năng-theo-module)
5. [Danh mục API và mức độ kết nối](#5-danh-mục-api-và-mức-độ-kết-nối)
6. [Cơ sở dữ liệu](#6-cơ-sở-dữ-liệu)
7. [Các luồng nghiệp vụ chính](#7-các-luồng-nghiệp-vụ-chính)
8. [Phân tích chức năng AI](#8-phân-tích-chức-năng-ai)
9. [Dữ liệu phục vụ UML](#9-dữ-liệu-phục-vụ-uml)
10. [Kiểm thử và đánh giá](#10-kiểm-thử-và-đánh-giá)
11. [Phân loại nội dung cho báo cáo](#11-phân-loại-nội-dung-cho-báo-cáo)
12. [Thông tin còn thiếu và điểm cần xác nhận](#12-thông-tin-còn-thiếu-và-điểm-cần-xác-nhận)
13. [Mục lục báo cáo bốn chương đề xuất](#13-mục-lục-báo-cáo-bốn-chương-đề-xuất)

## 1. Tổng quan dự án

| Nội dung | Kết luận từ source | Bằng chứng |
|---|---|---|
| Tên | **Z-TECH POS** | `README.md`; tiêu đề API trong `backend/server.js` |
| Mục tiêu | Hệ thống POS cho cửa hàng phụ kiện điện thoại: bán hàng, quản lý hàng hóa/kho, khách hàng, nhập hàng, nhân viên/ca, khuyến mãi, bảo hành, báo cáo doanh thu và phân tích AI | `frontend/package.json`; các route gắn tại `backend/server.js`; các bảng trong `database/schema.sql` |
| Người dùng | Quản trị viên và nhân viên cửa hàng; khách hàng chỉ dùng trang tra cứu bảo hành công khai qua token | `frontend/src/utils/permissions.js`; `backend/middleware/auth.js`; `frontend/src/App.jsx` (`/tra-cuu-bao-hanh/:publicToken`) |
| Kiến trúc | SPA React gọi REST API Express; backend truy cập MySQL bằng pool và transaction; file upload được phục vụ tại `/uploads`; AI là dịch vụ Gemini gọi từ server | `frontend/src/main.jsx`, `frontend/src/api/axios.js`; `backend/server.js`; `backend/config/db.js`; `backend/services/geminiRevenueAnalysisService.js` |
| Triển khai | Frontend Vite build thành tệp tĩnh, reverse proxy `/api` và `/uploads` sang Express; MySQL không mở trực tiếp ra Internet | `DEPLOYMENT.md`; `frontend/vite.config.js`; `backend/server.js` |

### Công nghệ thực sự được dùng

- Frontend: React 18, React Router 6, Vite 8, Tailwind CSS 3, Axios, `react-hot-toast`, Lucide; biểu đồ dùng cả Chart.js/`react-chartjs-2` và Recharts; ExcelJS để xuất/đọc Excel; ZXing để quét mã; QR dùng `qrcode` và `vietnam-qr-pay`. Bằng chứng: `frontend/package.json`, `frontend/src/components/reports/RevenueCharts.jsx`, `frontend/src/components/dashboard/RevenueAreaChart.jsx`, `frontend/src/pages/POS.jsx`.
- Backend: Node.js ES modules, Express 4, `mysql2/promise`, JWT, bcryptjs, Multer, Helmet, CORS, rate limit, ExcelJS. Không có ORM và không có lớp model riêng; controller/repository viết SQL trực tiếp. Bằng chứng: `backend/package.json`, `backend/config/db.js`, `backend/server.js`.
- Database: MySQL/utf8mb4; schema dùng PK tự tăng, FK, enum, check, index và JSON/LONGTEXT. Bằng chứng: `database/schema.sql`.
- AI: Gemini Generative Language REST API, model mặc định `gemini-3.1-flash-lite`; không dùng SDK. Bằng chứng: `backend/services/geminiRevenueAnalysisService.js` (`GEMINI_API_ROOT`, `DEFAULT_MODEL`, `analyzePosWithGemini`).

## 2. Cấu trúc source và kết nối

```text
Z-TECH POS/
├─ frontend/
│  ├─ src/main.jsx                 # điểm vào React
│  ├─ src/App.jsx                  # router, guard, lazy pages
│  ├─ src/pages/                   # màn hình nghiệp vụ
│  ├─ src/components/              # layout/widget/settings/report/inventory
│  ├─ src/services/                # wrapper API báo cáo/cài đặt/khuyến mãi/bảo hành
│  ├─ src/api/axios.js             # Axios, JWT, cache GET, timeout
│  └─ vite.config.js               # Vite/proxy phát triển
├─ backend/
│  ├─ server.js                    # điểm vào Express, middleware, mount route
│  ├─ routes/                      # khai báo endpoint và quyền
│  ├─ controllers/                 # nghiệp vụ và SQL cho phần lớn module
│  ├─ services/                    # báo cáo, AI, khuyến mãi, nhập hàng, ca
│  ├─ repositories/                # truy vấn báo cáo và lịch sử AI
│  ├─ middleware/, validation/     # JWT, quyền, ca, validate
│  ├─ config/db.js                 # pool + transaction MySQL
│  ├─ tests/                       # Node test runner
│  └─ scripts/                     # migration/check/reset/chuẩn hóa thủ công
├─ database/
│  ├─ schema.sql                   # schema đầy đủ cho cài mới
│  ├─ seed.sql                     # dữ liệu mẫu
│  └─ migration_*.sql             # nâng cấp database hiện hữu
├─ docs/uml/                       # UML đã có (không phải nguồn duy nhất để kết luận)
├─ README.md
└─ DEPLOYMENT.md
```

Luồng kết nối: `main.jsx` render `App`; `App.jsx` đặt `ProtectedRoute` và `PermissionRoute`; page/service gọi instance trong `frontend/src/api/axios.js`. Ở dev URL là `/api`; production ưu tiên `VITE_API_URL`/`VITE_API_BASE_URL`, nếu không dùng `/api`. Interceptor gắn `Authorization: Bearer <JWT>`, xóa phiên khi 401, cache GET được đánh dấu trong 30 giây. Express mount các router dưới `/api/*`; `auth` xác minh JWT rồi đọc lại `users`; controller/service/repository gọi `query` hoặc `withTransaction` trong `backend/config/db.js`. Pool mặc định database `pos_accessories`, timezone `+07:00`.

Biến cấu hình có bằng chứng: `PORT`, `NODE_ENV`, `FRONTEND_ORIGIN(S)`, `TRUST_PROXY`, `API_RATE_LIMIT`, `LOGIN_RATE_LIMIT`, `JSON_BODY_LIMIT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_CONNECTION_LIMIT`, `DB_QUEUE_LIMIT`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `VITE_API_URL`, `VITE_API_BASE_URL`, `VITE_PUBLIC_BASE_URL`. Nguồn: `backend/server.js`, `backend/config/*.js`, `backend/routes/auth.js`, `backend/services/geminiRevenueAnalysisService.js`, `frontend/src/api/axios.js`, `frontend/src/components/WarrantyQr.jsx`.

## 3. Tác nhân và phân quyền

### 3.1 Vai trò thực tế

| Nhóm | Giá trị trong source/DB | Quyền thực tế |
|---|---|---|
| Quản trị đầy đủ | `admin`; legacy `owner`, `manager` được chuẩn hóa thành `admin` | Mọi path frontend; mọi API đọc; API ghi quản trị qua `requireFullAccess`; dashboard và báo cáo toàn cửa hàng |
| Nhân viên | `employee`, `cashier`, `staff`; DB còn `warehouse` | Frontend: dashboard cá nhân, POS, xem sản phẩm/kho/khách hàng/đơn/ca/khuyến mãi/bảo hành; backend cho các GET chung, tạo/cập nhật khách, tạo đơn nếu có ca; không được CRUD quản trị |
| Khách tra cứu | Không phải user/role | Chỉ GET bảo hành bằng `publicToken` |

Bằng chứng: `database/schema.sql` (`users.role`); `backend/utils/roles.js`; `backend/middleware/auth.js` (`normalizeRole`, `requireFullAccess`); `frontend/src/utils/permissions.js`; `backend/middleware/activeShift.js`.

Lưu ý quan trọng: bảng `roles` và cột `users.role_id` tồn tại nhưng quyết định quyền runtime dựa trên chuỗi `users.role`, không truy vấn permission từ bảng `roles`. Vai trò `warehouse` hợp lệ trong schema nhưng `validateEmployee` chỉ cho tạo/sửa `employee|cashier|warehouse`; frontend không có bộ quyền riêng cho warehouse nên bị coi như nhân viên thông thường. `staff` có trong frontend nhưng không có trong enum DB. Đây là lệch mô hình, không phải hệ RBAC động.

### 3.2 Ma trận màn hình

| Màn hình | Quản trị | Nhân viên | Guard/API quyết định |
|---|---:|---:|---|
| Dashboard tổng | Có | Không; nhận `StaffDashboard` | `App.jsx:HomePage`; dashboard API `requireFullAccess` |
| POS | Có | Có, nhân viên cần ca khi tạo đơn | `sale:create`; `POST /orders` + `requireActiveShift` |
| Sản phẩm | CRUD | Chỉ xem | frontend path cho staff; route ghi `requireFullAccess` |
| Danh mục, NCC, nhập hàng, nhân viên, báo cáo, nhật ký, cài đặt | Có | Không | `permissions.js`; backend `requireFullAccess` |
| Kho | Điều chỉnh/nhập | Xem log và tồn | inventory route |
| Khách hàng | CRUD/xóa | xem, tạo, sửa; không xóa | customer route |
| Đơn hàng | xem/sửa/hủy/xóa | chỉ xem hóa đơn của chính mình | `permissions.js`; `orders.js`; `orderController.getAll/getById` thêm `o.user_id = req.user.id` cho user không có full access |
| Ca | xem/sửa mọi ca | GET được lọc ca của mình | `shiftService.filterOwnShifts`; PUT full access |
| Khuyến mãi | CRUD | xem để áp dụng | promotion routes |
| Bảo hành | tạo/cập nhật claim | frontend cho path, nhưng API ghi yêu cầu full access | `permissions.js` so với `routes/warranties.js` |

## 4. Phân tích chức năng theo module

| Module | Mục đích/người dùng | Chức năng và luồng đã triển khai | Frontend → API → xử lý → bảng | Đánh giá |
|---|---|---|---|---|
| Đăng nhập & quyền | Mọi tài khoản | Đăng nhập bằng mã NV/email, bcrypt, JWT 8h mặc định; kiểm tra status/token_version; nhớ phiên local/session; đổi mật khẩu thu hồi token cũ | `Login.jsx`, `SessionSecurity.jsx` → `/auth/*` → `authController`, `auth` → `users` | Hoàn chỉnh theo mô hình 2 nhóm quyền; RBAC động chưa dùng |
| Tổng quan | Quản trị; dashboard ca cho NV | KPI, doanh thu, sản phẩm bán chạy, đơn gần đây, cảnh báo vận hành; NV xem dữ liệu ca từ phía client | `Dashboard.jsx`, `StaffDashboard.jsx` → `/dashboard/*`, `/orders`, `/shifts` → `dashboardController` → orders/items/products/customers/users | Quản trị hoàn chỉnh; dashboard NV phụ thuộc dữ liệu GET rộng |
| Bán hàng & hóa đơn | NV/quản trị | tìm/quét hàng, giỏ, khách mới, khuyến mãi/quà, điểm, VAT, tiền mặt/chuyển khoản/QR, chống trùng, in hóa đơn; backend tự tính lại giá/khuyến mãi và transaction | `POS.jsx`, `PrintBill.jsx` → POST `/orders` → `orderCreateController.create` (route import) / logic `orderController.create`, `promotionEngine` → orders/items/products/inventory_logs/payments/warranties/customers | Hoàn chỉnh; card có trong DB/update nhưng tạo đơn chỉ nhận cash/transfer |
| Thanh toán | POS | Lưu một payment completed khi tạo đơn; tiền nhận/tiền thối; hủy chuyển payment sang refunded | POS/Orders → `/orders`; GET `/payments` không được frontend gọi → `paymentController` → `payments` | Một phần: không có màn hình/sổ giao dịch riêng, không partial sale/refund từng dòng |
| Sản phẩm/danh mục/thương hiệu | Quản trị ghi, NV xem | CRUD/import Excel/ảnh, SKU/barcode, mẫu máy, chính sách bảo hành, ẩn danh mục | `ProductManagement.jsx`, `Products.jsx`, `Categories.jsx`, `WarrantySettingsModal.jsx` → `/products`, `/categories`, `/device-models` → controllers → products/categories/device_models | Sản phẩm/danh mục hoàn chỉnh; `brands` có DB nhưng không route/UI |
| Kho & kiểm kê | Quản trị điều chỉnh, NV xem | Xem lịch sử; “nhập thêm” tăng tồn; “điều chỉnh” đặt tồn tuyệt đối; log trước/sau | `Inventory.jsx`, `InventoryPage.jsx` → `/inventory/logs|add|adjust` → `inventoryController` → products/inventory_logs | Một phần: có điều chỉnh tồn nhưng không có phiếu kiểm kê, kỳ kiểm kê, chi tiết chênh lệch/duyệt |
| Nhập hàng & NCC | Quản trị | CRUD NCC; tạo phiếu nhập completed trong transaction, tăng tồn/cập nhật giá vốn/log; công nợ paid/partial/unpaid và cập nhật thanh toán | `Suppliers.jsx`, `PurchaseReceivingTab.jsx`, `PurchaseOrders.jsx` → `/suppliers`, `/purchase-orders` → controllers + `purchaseOrderPaymentService` → suppliers/purchase_orders/items/products/inventory_logs | Hoàn chỉnh cho nhận hàng trực tiếp; trạng thái draft/cancelled có schema nhưng create luôn completed, không có hủy phiếu |
| Khách hàng | NV/quản trị | danh sách, tạo/sửa, chi tiết lịch sử mua và điểm; xóa chỉ quản trị | `Customers.jsx`, POS → `/customers` → `customerController` → customers/orders/order_items | Hoàn chỉnh cơ bản; phone DB không unique dù validation bắt buộc |
| Nhân viên/vai trò/ca | Quản trị; NV xem ca mình | CRUD nhân viên, khóa, reset mật khẩu, doanh thu NV; lưu toàn bộ lịch ca dạng JSON | `Employees.jsx`, `Shifts.jsx` → `/employees`, `/shifts` → controllers/`shiftService` → users/shift_store/orders | Một phần: không quản lý quyền động; ca là JSON, không FK/record chuẩn hóa/chấm công |
| Khuyến mãi | Quản trị tạo, mọi user xem/áp dụng | standard, mua X tặng Y, combo, món thứ N, bậc số lượng; phạm vi đơn/danh mục/sản phẩm/dòng máy; backend xác thực/tính lại | `Promotions.jsx`, `promotionService`, POS → `/promotions`, POST order → `promotionController`, `promotionEngine` → promotions; snapshots trong orders/items | Hoàn chỉnh theo JSON `data`; bảng promotion_products/categories tồn tại nhưng controller không dùng |
| Bảo hành | xem; quản trị xử lý | Tạo warranty khi bán sản phẩm bật bảo hành; tra cứu public token; tạo claim và chuyển trạng thái claim | `Warranty.jsx`, `WarrantyLookupPublic.jsx`, `WarrantyQr.jsx` → `/warranties`, `/public/warranties` → warranty controllers → order_items/warranties/warranty_claims | Một phần: cập nhật claim không validate enum ở middleware; không có transaction kho/đổi sản phẩm khi bảo hành |
| Nhật ký | Quản trị | Hợp nhất đơn, biến động kho và system activity; lọc/phân trang | `ActivityLogs.jsx`, `NotificationCenter.jsx` → `/activity-logs` → `activityLogController`, `activityLogger` → orders/inventory_logs/system_activity_logs | Hoàn chỉnh cho nguồn hiện có; không phải audit mọi thay đổi |
| Báo cáo | Quản trị | tổng hợp KPI, xu hướng, danh mục, thanh toán, theo giờ, hàng, cảnh báo, đối soát giá vốn; Excel/CSV; lọc tối đa 366 ngày | `Reports.jsx`, `RevenueCharts.jsx`, `revenueReportService.js` → `/reports/revenue/*` → revenue controller/service/repository → orders/items/payments/products/categories/users/purchases | Hoàn chỉnh, có kiểm tra thiếu `cost_at_sale`; API `/reports/sales` cũ không thấy frontend gọi |
| Phân tích AI | Quản trị | bấm phân tích, tổng hợp snapshot, gọi Gemini, chuẩn hóa/lưu/đọc/xóa lịch sử, render findings/actions/charts | `Reports.jsx` → `/reports/revenue/ai-analysis*` → revenue service + Gemini service + AI repository → dữ liệu POS + ai_report_analysis_results | Hoàn chỉnh khi có API key; là phân tích/nhận xét, không phải dự báo |
| Cài đặt | Quản trị ghi; authenticated đọc | cửa hàng/in ấn/thanh toán/VAT/kho/bảo mật, upload logo | `SettingsPage.jsx` và components → `/settings*` → `settingsController` → system_settings, uploads | Hoàn chỉnh theo key-value; logo ghi filesystem |

## 5. Danh mục API và mức độ kết nối

Quy ước quyền: **Public**, **Auth**, **Admin**, **Auth+ca**. “Dùng” nghĩa là tìm thấy lời gọi trong `frontend/src`; “chưa nối” nghĩa là route có thật nhưng không thấy lời gọi frontend.

| Method và endpoint | Mục đích; quyền | Request/response chính | Xử lý và bảng | FE |
|---|---|---|---|---|
| GET `/health/live`, `/health` | liveness/readiness; Public | status; readiness kiểm MySQL | `server.js`; `SELECT 1` | Chưa nối |
| POST `/auth/login` | đăng nhập; Public + rate limit | identifier/password → token,user | `authController.login`; users | Dùng |
| GET `/auth/me`; PUT `/auth/change-password` | hồ sơ/đổi mật khẩu; Auth | user; mật khẩu cũ/mới → message | `authController`; users | Dùng |
| GET `/products`; GET `/products/:id`; GET `/products/barcode/:barcode` | danh sách/chi tiết/quét; Auth | filter/id → products | `productController`; products/categories/device_models | Dùng |
| GET `/products/scan/:barcode` | alias quét; Auth | barcode → product | `productController.scan` | Chưa nối |
| POST/PUT/DELETE `/products[/:id]` | CRUD; Admin | product → product/message | `productController`; products/order_items | Dùng |
| POST `/products/import`; `/products/import-images` | import; Admin | JSON hoặc multipart → kết quả | `productController`; products/categories/device_models/uploads | Import JSON dùng; ảnh chưa thấy gọi |
| GET `/device-models` | mẫu máy; Auth | list | `deviceModelController`; device_models | Dùng |
| GET/POST/PUT/DELETE `/categories[/:id]`; PATCH `/:id/visibility` | danh mục; GET Auth, ghi Admin | category → row/message | `categoryController`; categories/products | Dùng |
| GET `/customers`; GET `/:id/details`; POST/PUT `/customers[/:id]` | khách; Auth | filter/customer → list/detail | `customerController`; customers/orders/items | Dùng |
| GET `/customers/:id`; DELETE `/customers/:id` | chi tiết/xóa; Auth/Admin | id → row/message | `customerController`; customers | Chưa nối trực tiếp / chưa thấy UI xóa |
| GET/POST/PUT/DELETE `/orders[/:id]` | hóa đơn; GET Auth, POST Auth+ca, PUT/DELETE Admin | cart/update → order/detail | order controllers; orders/items/products/logs/payments/warranties/customers | Dùng |
| GET `/inventory`, `/inventory/logs`; POST `/inventory/add`; PUT `/inventory/adjust` | kho; GET Auth, ghi Admin | product/quantity → log | `inventoryController`; products/inventory_logs | `/logs`, add, adjust dùng; `/` alias chưa nối |
| GET `/dashboard/summary|revenue-chart|top-products|operational-alerts|recent-orders` | dashboard; Admin | period → KPI/list | `dashboardController`; sales tables | Dùng |
| GET `/dashboard/low-stock|category-share|staff-performance` | dashboard bổ sung; Admin | filters → list | `dashboardController` | Chưa nối |
| GET `/employees`, `/employees/revenue`; POST/PUT/DELETE `/employees[/:id]`; POST `/:id/reset-password|toggle-status` | nhân viên; Admin | employee/filter → result | `employeeController`; users/orders/items | Dùng |
| GET/PUT `/shifts` | đọc/lưu lịch; Auth/Admin | shifts JSON → list | `shiftController`, `shiftService`; shift_store | Dùng |
| GET/POST/PUT/DELETE `/promotions[/:id]` | khuyến mãi; GET Auth, ghi Admin | promotion JSON → row | `promotionController`; promotions | Dùng |
| GET/POST/PUT/DELETE `/suppliers[/:id]` | NCC; GET Auth, ghi Admin | supplier → row | `supplierController`; suppliers/purchase_orders | Dùng |
| GET `/purchase-orders`; GET `/:id`; POST `/`; PATCH `/:id/payment` | nhập hàng; GET Auth, ghi Admin | items/payment → PO | `purchaseOrderController`; purchase tables/products/logs | Dùng |
| GET `/payments` | danh sách giao dịch; Admin | optional order_id → rows | `paymentController`; payments/orders | Chưa nối |
| GET `/warranties`; GET `/:orderItemId/claims`; POST claim; PUT `/claims/:claimId` | bảo hành; GET Auth, ghi Admin | issue/status → claim | `warrantyController`; warranties/claims/order data | list/post/put dùng; GET claims không thấy gọi riêng |
| GET `/public/warranties/:publicToken` | tra cứu; Public | token → bảo hành | `publicWarrantyController`; order_items/orders/products | Dùng |
| GET `/activity-logs` | nhật ký; Admin | filters/page → union list | `activityLogController`; 3 nguồn log | Dùng |
| GET/PUT `/settings`; POST `/settings/logo`; GET/PUT `/settings/vat`; GET/PUT `/settings/bank-transfer` | cài đặt; GET Auth, ghi Admin | key-values/file → settings | `settingsController`; system_settings/uploads | `/settings`, logo, bank dùng; endpoint VAT riêng chưa thấy gọi |
| GET `/reports/sales` | báo cáo legacy; Admin | date range → aggregates | `reportController`; sales tables | Chưa nối |
| GET `/reports/revenue/summary|trend|categories|payment-methods|stock-alerts|products` | báo cáo; Admin | bộ lọc → metrics/series | revenue stack; sales/inventory | Dùng |
| GET `/reports/revenue/hourly|cost-reconciliation` | báo cáo chi tiết; Admin | filters → rows | revenue stack | Chưa thấy frontend gọi trực tiếp |
| GET `/reports/revenue/export|export-excel` | xuất; Admin | filters → blob | `revenueReportController`; ExcelJS | Dùng |
| GET `/reports/revenue/ai-analysis` | gọi AI; Admin | filters → structured result | revenue + Gemini + AI repo | Dùng |
| GET `/reports/revenue/ai-analysis-history[/:id]`; DELETE `/:id` | lịch sử AI; Admin | page/id → list/detail/delete | AI repository; ai_report_analysis_results | Dùng |

## 6. Cơ sở dữ liệu

### 6.1 Danh sách bảng

| Bảng | PK | Mục đích và FK chính |
|---|---|---|
| `roles` | id | danh mục vai trò; runtime chưa dùng để phân quyền |
| `users` | id | tài khoản/nhân viên; `role_id→roles`; role/status/token_version |
| `ai_report_analysis_results` | id | lịch sử kết quả AI; `requested_by→users`, JSON input/output, score/outlook/provider/model |
| `brands` | id | thương hiệu; `products.brand_id→brands`; chưa có API/UI |
| `suppliers` | id | NCC, nhóm/liên hệ/trạng thái |
| `categories` | id | danh mục và `is_active` |
| `device_models` | id | dòng/mẫu thiết bị; unique family+name |
| `products` | id | SKU/barcode/giá/giá vốn/tồn/ngưỡng/bảo hành; FK category/brand/device_model |
| `customers` | id | hồ sơ và điểm tích lũy |
| `system_settings` | setting_key | key-value; `updated_by→users` |
| `orders` | id | hóa đơn, customer/user/promotion snapshot, tiền/điểm/VAT/status/idempotency |
| `order_items` | id | dòng hàng + purchased/gift + giá vốn và bảo hành snapshot + public token |
| `inventory_logs` | id | biến động IMPORT/SALE/ADJUSTMENT/RETURN/WARRANTY/CANCEL_ORDER; product/user |
| `promotions` | id | cấu hình khuyến mãi trong LONGTEXT `data`, metadata chuẩn |
| `purchase_orders` | id | phiếu nhập/công nợ; supplier/user |
| `purchase_order_items` | id | chi tiết nhập; purchase_order/product |
| `payments` | id | thanh toán/hoàn tiền theo order |
| `warranties` | id | một bảo hành/một order_item; customer/product |
| `warranty_claims` | id | nhiều lần yêu cầu trên warranty |
| `promotion_products` | id | nối n-n promotion-product; code runtime chưa dùng |
| `promotion_categories` | id | nối n-n promotion-category; code runtime chưa dùng |
| `shift_store` | id=1 | toàn bộ lịch ca dưới JSON |
| `system_activity_logs` | id | log nghiệp vụ bổ sung; user nullable |

Nguồn đầy đủ: `database/schema.sql`. Hai bảng audit chỉ xuất hiện trong migration và không nằm trong schema cài mới: `cost_at_sale_backfill_audit` (`migration_add_cost_at_sale.sql`) và `product_cost_correction_audit` (`migration_fix_prd0045_cost_anomaly.sql`). Bảng cũ `ai_restock_suggestion_logs` chỉ bị drop/thay thế, không phải bảng hiện hành.

### 6.2 Quan hệ

- 1-n: role-users (hình thức), category/products, brand/products, device_model/products, customer/orders, user/orders, order/order_items, product/order_items, product/inventory_logs, supplier/purchase_orders, purchase_order/items, product/purchase_order_items, order/payments, warranty/claims, user/AI results.
- 1-1: `warranties.order_item_id` unique tạo quan hệ order_item–warranty; mỗi `public_token` unique.
- n-n: promotion-product và promotion-category qua bảng nối theo schema; tuy nhiên runtime lưu phạm vi trong `promotions.data`. Đơn và sản phẩm là n-n qua order_items; phiếu nhập và sản phẩm qua purchase_order_items.

### 6.3 Quy tắc tồn kho và tiền

- Bán: transaction khóa product `FOR UPDATE`, kiểm tồn (trừ khi setting cho bán âm), trừ tổng quantity kể cả quà, ghi SALE với before/after. Hủy/xóa đơn hoàn đúng quantity, ghi CANCEL_ORDER, refund payment, void warranty, hoàn điểm. Nguồn: `backend/controllers/orderController.js` (`create`, `update`, `remove`) và route thực tế qua `orderCreateController.create`.
- Nhập hàng: khóa sản phẩm, cộng quantity, cập nhật `cost_price` bằng giá nhập mới nhất, ghi IMPORT, phiếu được đặt completed. Nguồn: `purchaseOrderController.create`.
- Điều chỉnh: `/add` cộng số lượng; `/adjust` đặt số lượng tuyệt đối; đều ghi inventory log. Nguồn: `inventoryController`.
- Báo cáo giá vốn dùng snapshot `order_items.cost_at_sale`, không thay bằng giá vốn hiện tại; thiếu giá vốn được báo thiếu. Nguồn: `revenueReportRepository.js`, `revenueReportService.getSummary`.
- Không có luồng hoàn trả từng dòng. `RETURN` và `WARRANTY` có trong enum nhưng không tìm thấy controller tạo log tương ứng. Hủy toàn hóa đơn dùng `CANCEL_ORDER`.

### 6.4 Khác nhau schema–migration–code

1. Schema hiện đã hợp nhất phần lớn migration: SKU/barcode, loyalty, cost_at_sale, category visibility, POS tables, AI results, VAT. Migration tồn tại để nâng DB cũ; không nên chạy lại tùy ý.
2. `roles`/`role_id`, `brands`, hai bảng nối promotion tồn tại nhưng code nghiệp vụ gần như không dùng. Quyền dựa vào `users.role`; promotion dựa vào JSON `data`.
3. `payments.payment_method` cho `e_wallet/refund/other`, orders cho `card`, nhưng tạo order validation chỉ chấp nhận `cash|transfer`; QR cuối cùng được lưu là transfer. Nguồn: `schema.sql`, `middleware/validate.js`, `POS.jsx`.
4. `purchase_orders.status` hỗ trợ draft/cancelled nhưng controller tạo thẳng completed và không có endpoint đổi/hủy.
5. `inventory_logs` có RETURN/WARRANTY nhưng chưa có luồng ghi tương ứng.
6. `warrantyController.ensureWarrantyData` có khả năng backfill snapshot/token bằng UPDATE khi endpoint danh sách chạy; đây là side effect của GET. Nguồn: `warrantyController.js`.
7. `schema.sql` drop bảng audit nhưng không tạo lại hai bảng audit của migration; DB nâng cấp và DB cài mới có thể khác về các bảng audit.

## 7. Các luồng nghiệp vụ chính

### 7.1 Đăng nhập

1. `Login.jsx` kiểm dữ liệu và POST `/auth/login`; `validateLogin` giới hạn identifier/password.
2. `authController.login` tìm `users` theo employee_code/email, yêu cầu active, dùng bcrypt so mật khẩu; sai trả 401, đúng cập nhật `last_login_at`, ký JWT chứa id/tokenVersion.
3. Frontend `saveAuth` lưu token/user vào localStorage hoặc sessionStorage rồi điều hướng. Mọi API sau đó qua `axios.js`; `auth` verify chữ ký, đọc lại user/status/token_version. Thất bại 401 và frontend xóa phiên.

### 7.2 Tạo và thanh toán hóa đơn

1. `POS.jsx` lấy products/categories/customers/promotions/settings; người dùng lập giỏ, chọn khách/khuyến mãi/điểm và phương thức.
2. POST `/orders` qua `auth`, `requireActiveShift`, `validateCreateOrder`. Không có ca: 403; dữ liệu sai: 400.
3. `orderCreateController.create`/logic order transaction gộp dòng trùng, khóa product, kiểm active/tồn; `promotionEngine.calculatePromotion` tính lại, không tin giá client.
4. Đọc VAT/payment settings; kiểm điểm khách và paid_amount; tạo `orders`, `order_items`, trừ `products.stock_quantity`, ghi SALE, tạo warranty nếu đủ điều kiện, tạo payment completed, cập nhật loyalty.
5. Thành công commit và trả order; lỗi rollback toàn bộ. Frontend in `PrintBill`. Bảng: orders, order_items, products, inventory_logs, payments, warranties, customers, promotions, settings.

### 7.3 Hủy hóa đơn và hoàn kho

`Orders.jsx` PUT order với status cancelled (Admin). Transaction khóa order/product; nếu đã cancelled thì không hoàn lần hai; cộng lại quantity, ghi CANCEL_ORDER, payment→refunded, warranty→void, đảo điểm, order→cancelled. DELETE thực hiện nghiệp vụ tương tự nhưng thực tế không xóa row, chỉ chuyển cancelled. Không có hoàn trả một phần/từng dòng. Nguồn: `orderController.update/remove`.

### 7.4 Tạo phiếu nhập

`PurchaseReceivingTab.jsx` POST supplier/items/payment. Validation yêu cầu 1–200 dòng. Transaction kiểm NCC không inactive, tạo purchase order/code, khóa từng product, thêm item, cộng tồn/cập nhật cost_price/ghi IMPORT, chuẩn hóa paid_amount/status/due_date bằng `purchaseOrderPaymentService`, đặt PO completed. Lỗi bất kỳ rollback. PATCH payment chỉ cập nhật công nợ, không thay tồn.

### 7.5 Kiểm kê/điều chỉnh

Source không có thực thể “phiếu kiểm kê”. Luồng hiện có: `Inventory.jsx` đọc products/logs; Admin chọn add hoặc adjust; validate product và quantity không âm; controller đọc tồn trước, cập nhật tồn, ghi ADJUSTMENT/IMPORT với before/after. Không có bước đếm nhiều mặt hàng, phê duyệt hay khóa kỳ — trạng thái chính xác: **điều chỉnh tồn đơn lẻ, không phải quy trình kiểm kê hoàn chỉnh**.

### 7.6 Bảo hành

Khi bán, policy snapshot nằm ở order_item và có thể tạo `warranties`. `Warranty.jsx` GET danh sách tổng hợp. Admin POST claim với mô tả ≥3 ký tự; controller tìm warranty, tạo claim received và warranty→claimed. PUT claim đổi status/resolution. Trang public GET bằng UUID token, không cần JWT. Chưa có xử lý nhập/xuất hàng bảo hành, chi phí, kỹ thuật viên hoặc hoàn tất tự động status warranty.

### 7.7 Báo cáo doanh thu

`Reports.jsx` tạo filter; service gọi song song summary/trend/categories/payment/products/stock alerts. Validation giới hạn ngày thực và tối đa 366 ngày. Repository aggregate orders/items/payments; cancelled bị loại, refund riêng được trừ, VAT tách riêng, lợi nhuận chỉ công bố khi đủ cost_at_sale. Frontend render KPI và chart, có export CSV/Excel.

### 7.8 Phân tích báo cáo bằng AI

Người dùng Admin bấm phân tích ở Reports → GET AI với bộ lọc → backend tổng hợp current/previous/trend 365 ngày/categories/payments/hourly/top products/inventory/NV/customer/purchase/promotion/order status → Gemini → sanitize/validate shape → ghép chart xác định từ MySQL → lưu lịch sử → trả frontend. Lỗi thiếu key/API/JSON/shape trả lỗi; transaction DB không liên quan vì chỉ lưu sau khi có kết quả hợp lệ.

## 8. Phân tích chức năng AI

- Vị trí/kích hoạt: module Báo cáo, `frontend/src/pages/Reports.jsx`, wrapper `requestAiRevenueAnalysis` trong `frontend/src/services/revenueReportService.js`; timeout client 75 giây.
- Dữ liệu đầu vào: aggregate từ MySQL qua `revenueReportRepository` và `getRestockSnapshot`; gửi snapshot đã tổng hợp và ẩn danh tương đối (`employee` là `NV-id`), không gửi danh sách khách cá nhân. Hàm: `revenueReportService.getAiAnalysis`.
- Dịch vụ/model: REST `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`; API key chỉ server; model từ `GEMINI_MODEL`, mặc định `gemini-3.1-flash-lite`. Hàm `analyzePosWithGemini`.
- Prompt: được dựng trong `geminiRevenueAnalysisService.js` từ snapshot và quy tắc tiếng Việt; yêu cầu không bịa, không gọi khuyến nghị là dự báo, schema JSON chặt `RESPONSE_SCHEMA`.
- Kiểm tra: Gemini được yêu cầu JSON MIME + response schema; code parse fence/JSON, `sanitizeResult` giới hạn độ dài, enum, số phần tử, score 0–100, thứ tự title; còn có kiểm tra cấu trúc/kết quả trước trả (cùng file).
- Kết quả AI: `executiveSummary`, `healthScore`, `outlook`, `findings`, `actions`. Chart trong response **do backend tạo trực tiếp từ số liệu MySQL**, không do AI sinh (`buildAiCharts`). Provider/model/time được gắn ở service.
- Lưu trữ: có, toàn bộ result/filter trong `ai_report_analysis_results`; repository hỗ trợ list/detail/delete. Không phải cache DB: mỗi phân tích hợp lệ được lưu với hash chống trùng.
- Cache/lỗi: cache memory TTL 5 phút theo hash snapshot/version/model; request dùng timeout/AbortController trong Gemini service; thiếu `GEMINI_API_KEY` dừng trước khi gọi; API 403/429 có thông báo riêng; JSON lỗi bị bắt; **không thấy fallback sinh nhận xét giả hoặc mô hình thứ hai**.
- Bản chất: đây là **phân tích và đề xuất dựa trên dữ liệu lịch sử/hiện tại**, không phải dự báo định lượng. Dù file cũ `restockForecast` dùng chữ forecast cho công thức bổ sung hàng, kết quả AI không chứng minh mô hình dự báo tương lai.

## 9. Dữ liệu phục vụ UML

Chỉ liệt kê phần có bằng chứng; chưa vẽ mới.

### Use Case tổng quan

- Actor Quản trị: quản lý sản phẩm/danh mục/NCC/nhập/kho/khách/NV/ca/khuyến mãi/hóa đơn/bảo hành/cài đặt; xem dashboard/log/report; gọi và quản lý lịch sử AI.
- Actor Nhân viên: đăng nhập/đổi mật khẩu, xem dashboard ca, bán hàng khi ca active, khách hàng, xem sản phẩm/kho/đơn/ca/khuyến mãi/bảo hành.
- Actor Khách hàng: tra cứu bảo hành bằng token.
- External actor: Gemini API nhận snapshot và trả structured analysis.

### Activity đề xuất

1. Bán hàng: chọn/quét hàng → khách/khuyến mãi/điểm → kiểm ca/validate → khóa và kiểm tồn → transaction ghi order/items/payment/warranty/log → in; nhánh lỗi rollback.
2. Nhập hàng: chọn NCC/hàng/giá → validate → khóa sản phẩm → tạo PO/items → cộng tồn/giá vốn/log → tính công nợ → commit.
3. Kiểm kê: source chỉ đủ vẽ “điều chỉnh tồn một sản phẩm”: xem tồn → nhập số thực tế → Admin/validate → update + log; không đủ bằng chứng cho phiếu kiểm kê.
4. Bảo hành: tra cứu → kiểm policy/thời hạn → tạo claim received → inspecting/repairing → resolved/rejected/cancelled.

### Sequence đề xuất

- Đăng nhập: Login → Axios → auth route/validation → authController → users/bcrypt → JWT → storage/router.
- Thanh toán: POS → orders route → activeShift/validation → order controller → promotion/settings/customer/products → orders/items/logs/payment/warranty → POS/PrintBill.
- Nhập hàng: PurchaseReceivingTab → PO route → validation/controller → supplier/products → PO/items/logs → response.
- AI: Reports → revenue endpoint → validator → service → repositories/MySQL → Gemini REST → sanitizer → AI repository/MySQL → charts/response → Reports.

### Class Diagram nghiệp vụ

Các lớp/thực thể có căn cứ: User, Role, Customer, Category, Brand, DeviceModel, Product, Order, OrderItem, Payment, InventoryLog, Supplier, PurchaseOrder, PurchaseOrderItem, Promotion, Warranty, WarrantyClaim, ShiftStore, SystemSetting, ActivityLog, AiReportAnalysisResult. Thuộc tính lấy từ `schema.sql`; association theo FK ở mục 6.

### State Diagram phù hợp

1. WarrantyClaim: `received → inspecting → repairing → resolved`; các nhánh `rejected`, `cancelled`. Source không ràng buộc transition cụ thể, chỉ có tập trạng thái; vì vậy không được khẳng định mọi mũi tên ngoài luồng UI quan sát được.
2. Purchase payment: `unpaid → partial → paid`; được tính từ paid_amount/total trong `purchaseOrderPaymentService`. Có thể cập nhật ngược nếu API cho paid_amount thấp hơn; source không cấm.

Order chỉ có `completed/cancelled` cũng có thể vẽ state đơn giản, nhưng hai state trên giàu ý nghĩa hơn.

### Component/Deployment/ERD

- Component: Browser SPA (pages/components/services/Axios) → Express (middleware/routes/controllers/services/repositories) → MySQL; Express → Gemini; Express → uploads filesystem.
- Deployment: client browser; web server/reverse proxy phục vụ `frontend/dist`; Node process cổng mặc định 5000; MySQL cổng mặc định 3306; Gemini HTTPS ngoài hệ thống. Máy chủ, cloud, Nginx cụ thể: **Chưa xác định từ source**.
- ERD: dùng toàn bộ bảng và FK mục 6; đánh dấu bốn bảng có schema nhưng runtime chưa dùng trực tiếp (`roles`, `brands`, `promotion_products`, `promotion_categories`).

Thư mục `docs/uml` đã có Use Case, Activity/Sequence đăng nhập-bán-nhập-đổi trả và Class, nhưng không được dùng để suy ra chức năng thiếu trong code.

## 10. Kiểm thử và đánh giá

### 10.1 Test hiện có và kết quả

Lệnh `npm test` trong `backend` ngày 20/07/2026: **47 test, 47 pass, 0 fail, 0 skip**. Không chạy migration/reset.

| File | Phạm vi |
|---|---|
| `tests/validation.test.js` | login/password/order/inventory/employee validation |
| `tests/revenueReport.test.js` | công thức doanh thu, refund, cost, kỳ so sánh, series, quyền/query |
| `tests/dashboardKpi.test.js` | KPI, khoảng ngày, cost completeness |
| `tests/promotionEngine.test.js` | gộp item, mua/tặng, chống quà sai |
| `tests/purchaseOrderPayment.test.js` | paid/partial/legacy/overpayment |
| `tests/geminiRevenueAnalysis.test.js` | gọi Gemini mock, JSON có cấu trúc, thiếu key |
| `tests/database.integration.test.js` | auth/schema, transaction rollback bán hàng, import, promotion |

### 10.2 Test còn thiếu nên bổ sung

- API end-to-end cho toàn bộ auth/role/active shift, token_version, tài khoản inactive và CORS/rate limit.
- Concurrent sale/PO/adjust cùng product; idempotency; hủy hai lần; điểm/VAT/QR; warranty creation trong rollback.
- CRUD sản phẩm/danh mục/NCC/khách/NV, import file và bảo mật upload.
- Chuyển trạng thái claim hợp lệ/không hợp lệ và public token; hết hạn warranty.
- GET ca lọc đúng user; lưu JSON lỗi; timezone/ca qua nửa đêm.
- AI cache/timeout/429/403/invalid JSON/invalid shape, save failure, history authorization; xác minh không lộ PII.
- Frontend component/e2e: guards, POS, in hóa đơn, reports/charts/export, offline/401, quét barcode.

### 10.3 Lỗi, hạn chế hoặc chưa đồng bộ tìm thấy (không sửa)

| Mức | Phát hiện có bằng chứng |
|---|---|
| Quyền | Hóa đơn đã được backend lọc theo `req.user.id` cho nhân viên, đúng với `invoice:view_own`; tuy nhiên GET customers/products/inventory là dữ liệu dùng chung và không có phân vùng theo nhân viên/ca. Cần xác nhận đây có đúng chính sách nghiệp vụ hay không. |
| Quyền | Frontend cho staff `warranty:create_ticket`/`update_basic_status`, nhưng backend POST/PUT claim yêu cầu Admin; UI và API không đồng bộ. |
| Schema/runtime | RBAC qua bảng `roles` không được triển khai; legacy owner/manager bị gom thành admin. `staff` frontend không thuộc enum DB; warehouse không có quyền riêng. |
| Nghiệp vụ | Không có hoàn trả từng dòng; không có phiếu kiểm kê; bảo hành không tạo biến động kho; PO không có lifecycle draft/cancel dù schema có. |
| API/UI | Các endpoint được đánh dấu “chưa nối” ở mục 5 có backend nhưng không thấy frontend sử dụng; `payments`, `brands`, role management không có UI. |
| Side effect | GET warranty list gọi `ensureWarrantyData` và có thể UPDATE order_items để backfill; GET không thuần đọc. |
| Validation | PUT warranty claim không có middleware xác nhận status thuộc enum; lỗi có thể trôi xuống MySQL. `validateStockQuantity` cho số thập phân không âm dù cột tồn là INT. |
| Dữ liệu | Phone khách không unique; validation bắt buộc phone nhưng schema cho null. Promotion relation tables không đồng bộ với JSON runtime. |
| Tài liệu | README cơ bản, DEPLOYMENT hữu ích; không thấy OpenAPI/Swagger hay đặc tả API. Frontend không có test. |
| Bảo mật/triển khai | `.env.example` được DEPLOYMENT nhắc đến nhưng không xuất hiện trong danh sách file `rg --files`; giá trị production thực tế và hạ tầng: Chưa xác định từ source. |

## 11. Phân loại nội dung cho báo cáo

- Chương 1: bài toán POS phụ kiện; actor/quyền; phạm vi module; yêu cầu chức năng và phi chức năng có bằng chứng (auth, transaction, security, performance cache, availability).
- Chương 2: React/Vite/Tailwind, REST/Express, JWT/bcrypt, MySQL/transaction, Chart.js/Recharts, Excel/QR/barcode, Gemini structured output.
- Chương 3: kiến trúc, component/deployment, use case/activity/sequence/state/class/ERD; schema và luồng bán–nhập–kho–bảo hành–report–AI.
- Chương 4: cấu trúc triển khai frontend/backend; các màn hình/API; test 47/47; đánh giá sai lệch/quyền/hạn chế.
- Kết luận/hạn chế/hướng phát triển: chỉ nêu hạn chế mục 10; hướng có thể đề xuất nhưng phải ghi là đề xuất, không mô tả như đã có.

## 12. Thông tin còn thiếu và điểm cần xác nhận

### 12.1 Thông tin cần người dùng cung cấp

1. Tên chính thức của đồ án/cửa hàng, chủ đầu tư và bối cảnh nghiệp vụ ngoài source.
2. Quy trình vận hành thực tế: ai hủy đơn, ai xử lý bảo hành, có hoàn hàng từng phần và kiểm kê định kỳ hay không.
3. Hạ tầng triển khai thật (máy chủ/domain/reverse proxy/backup/SSL) và ảnh chụp vận hành nếu cần báo cáo.
4. Phiên bản MySQL/Node production và schema database đang chạy sau migration; source chỉ cho cấu hình mặc định.
5. Tiêu chí nghiệm thu, dữ liệu khảo sát người dùng và kết quả kiểm thử UAT/hiệu năng/bảo mật ngoài test tự động.
6. Gemini model/API quota thực tế trong môi trường triển khai; không cần cung cấp secret.

### 12.2 Điểm cần xác nhận

1. `owner`/`manager` có chủ ý được gộp thành admin hay cần tách quyền?
2. Nhân viên có được xem mọi hóa đơn/khách/tồn hay chỉ dữ liệu của mình/ca mình?
3. Nhân viên có được tạo và cập nhật ticket bảo hành như frontend khai báo không?
4. “Kiểm kê” trong báo cáo nên ghi đúng là điều chỉnh tồn đơn lẻ, hay có quy trình bên ngoài chưa đưa vào source?
5. Bảng `brands`, `roles`, `promotion_products`, `promotion_categories` là nền tảng tương lai hay phần bỏ dở?
6. Endpoint/report legacy và API chưa nối ở mục 5 có chủ ý giữ lại không?
7. `DELETE /orders/:id` có chủ ý chỉ hủy mềm thay vì xóa không?
8. Có muốn công bố trong báo cáo rằng AI lưu toàn bộ kết quả và filter vào DB không?

## 13. Mục lục báo cáo bốn chương đề xuất

### Chương 1. Tổng quan và yêu cầu hệ thống

1.1 Bối cảnh POS cửa hàng phụ kiện điện thoại  
1.2 Mục tiêu và phạm vi  
1.3 Tác nhân và phân quyền  
1.4 Yêu cầu chức năng theo module  
1.5 Yêu cầu phi chức năng có trong source  
1.6 Giới hạn phạm vi

### Chương 2. Cơ sở lý thuyết và công nghệ

2.1 Kiến trúc SPA–REST–Database  
2.2 React, Vite và Tailwind CSS  
2.3 Node.js, Express và thiết kế REST API  
2.4 MySQL, khóa giao dịch và toàn vẹn dữ liệu  
2.5 JWT, bcrypt và bảo vệ ứng dụng web  
2.6 Chart.js/Recharts, Excel, QR và barcode  
2.7 Gemini API và structured JSON analysis

### Chương 3. Phân tích và thiết kế

3.1 Kiến trúc tổng thể và cấu trúc source  
3.2 Use Case và ma trận quyền  
3.3 Activity bán hàng, nhập hàng, điều chỉnh tồn, bảo hành  
3.4 Sequence đăng nhập, thanh toán, nhập hàng, AI  
3.5 Mô hình lớp nghiệp vụ và state  
3.6 Thiết kế dữ liệu/ERD  
3.7 Component và Deployment  
3.8 Thiết kế báo cáo và phân tích AI

### Chương 4. Xây dựng, kiểm thử và đánh giá

4.1 Xây dựng frontend  
4.2 Xây dựng backend và API  
4.3 Xây dựng database/migration/seed  
4.4 Hiện thực các luồng nghiệp vụ chính  
4.5 Hiện thực báo cáo và AI  
4.6 Cấu hình và triển khai  
4.7 Kiểm thử tự động và test case đề xuất  
4.8 Đánh giá kết quả, sai lệch và hạn chế

### Kết luận, hạn chế và hướng phát triển

Tóm tắt kết quả có thật; nêu các hạn chế tại mục 10; các hướng phát triển phải tách rõ khỏi chức năng đã triển khai.

---

## Phụ lục: tự kiểm tra chéo

Đã đối chiếu lại sau khi soạn:

1. Bán hàng: `POS.jsx` POST `/orders` ↔ `routes/orders.js` ↔ `orderCreateController.js`/`orderController.js` ↔ orders/order_items/products/inventory_logs/payments/warranties trong `schema.sql`.
2. Nhập hàng: `PurchaseReceivingTab.jsx` ↔ purchase-order route/controller/service ↔ purchase_orders/items/products/inventory_logs.
3. Bảo hành: `Warranty.jsx` và public page ↔ warranty routes/controllers ↔ warranties/claims/order_items; xác nhận chênh quyền staff.
4. AI: `Reports.jsx`/service ↔ revenue route/controller/service/repositories/Gemini ↔ ai_report_analysis_results; xác nhận chart được dựng từ MySQL, không phải AI.
5. Quyền: `permissions.js`/`App.jsx` ↔ `auth.js`, `activeShift.js`, từng route; xác nhận GET/list detail order có lọc `user_id` đối với nhân viên.
6. Test: đối chiếu bảy file test với kết quả Node test runner 47/47.
