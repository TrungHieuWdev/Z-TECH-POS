# Sơ đồ UML hệ thống Z-TECH POS

Các sơ đồ trong thư mục này được xây dựng từ source hiện tại trong `frontend/src`, `backend` và `database/schema.sql`.

## Danh sách sơ đồ

- `01-use-case-tong-quan.puml`: Use Case tổng quan.
- `02-activity-dang-nhap.puml`: Activity đăng nhập.
- `03-activity-ban-hang-thanh-toan.puml`: Activity bán hàng và thanh toán.
- `04-activity-nhap-kho.puml`: Activity nhập kho.
- `05-activity-doi-tra-hang.puml`: Activity đổi/trả hàng.
- `06-sequence-dang-nhap.puml`: Sequence đăng nhập.
- `07-sequence-ban-hang-thanh-toan.puml`: Sequence bán hàng và thanh toán.
- `08-sequence-nhap-kho.puml`: Sequence nhập kho.
- `09-sequence-doi-tra-hang.puml`: Sequence đổi/trả hàng.
- `10-class-tong-the.puml`: Class Diagram miền nghiệp vụ tổng thể, ánh xạ từ schema MySQL.

## Giả định và giới hạn theo source hiện tại

- “Quản trị viên” đại diện nhóm vai trò có toàn quyền (`owner`, `manager`, `admin`).
- “Nhân viên” đại diện các vai trò vận hành còn lại. Quản trị viên kế thừa các tương tác chung của Nhân viên.
- Nhập kho được mô hình hóa theo phiếu nhập hàng `POST /api/purchase-orders`, không phải thao tác cộng tồn thủ công `POST /api/inventory/add`.
- Trả hàng hiện được backend triển khai dưới dạng hủy toàn bộ đơn hàng qua `PUT /api/orders/:id` với trạng thái `cancelled`.
- Đổi sản phẩm bảo hành hiện chỉ tạo/cập nhật yêu cầu bảo hành và lưu trạng thái đổi trong state frontend. Hàm `adjustInventoryForExchange()` đang rỗng, vì vậy sơ đồ không thể hiện việc backend trừ tồn sản phẩm đổi.
- Class Diagram thể hiện các thực thể dữ liệu và quan hệ có căn cứ trong `database/schema.sql`; không thêm phương thức vì dự án không dùng các lớp domain/ORM tương ứng.
