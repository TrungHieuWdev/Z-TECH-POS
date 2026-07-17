# Bộ sơ đồ hệ thống Z-TECH POS

Bộ tài liệu này được đối chiếu từ mã nguồn trong `frontend/src`, `backend` và `database/schema.sql`. Tổng cộng có **12 sơ đồ**, đúng số lượng yêu cầu:

File chỉnh sửa chính là **`ZTECH-POS-Diagrams.mdj`**, được tạo bằng phần tử native của StarUML. Ảnh cuối đã có nền trắng trong `staruml-final/png/` và `staruml-final/svg/`.

| STT | Loại | Ảnh PNG cuối | Mục đích |
|---:|---|---|---|
| 1 | Use Case | `01-use-case-tong-quat.png` | Phạm vi toàn hệ thống và ba nhóm tác nhân |
| 2 | Use Case | `02-use-case-quan-tri.png` | Các nghiệp vụ có quyền toàn phần |
| 3 | Activity | `03-activity-ban-hang.png` | Quy trình bán hàng tại POS |
| 4 | Activity | `04-activity-nhap-hang.png` | Lập phiếu nhập, cập nhật kho và công nợ |
| 5 | Sequence | `05-sequence-checkout.png` | Tương tác khi checkout và nhánh rollback |
| 6 | Sequence | `06-sequence-nhap-kho.png` | Tương tác khi nhập hàng trong transaction |
| 7 | Sequence | `07-sequence-tao-bao-hanh.png` | Tạo bảo hành cùng transaction bán hàng |
| 8 | Class | `08-class-nghiep-vu-cot-loi.png` | Lớp khái niệm bán hàng, thanh toán, bảo hành |
| 9 | Class | `09-class-kho-nhap-hang.png` | Lớp khái niệm kho và nhập hàng |
| 10 | ERD | `10-erd-toan-bo-csdl.png` | 23 bảng, PK/FK và quan hệ của schema hiện tại |
| 11 | Component | `11-component-kien-truc.png` | Kiến trúc React - Express/Node.js - MySQL |
| 12 | Deployment | `12-deployment.png` | Mô hình production theo `DEPLOYMENT.md` |

## Phạm vi chức năng đọc được từ mã nguồn

- Xác thực JWT, đổi mật khẩu và phân quyền theo vai trò.
- Nhân viên chỉ đăng nhập/bán hàng khi có ca đang hoạt động; `owner`, `manager`, `admin` có quyền toàn phần.
- POS: quét mã vạch, chọn khách, giỏ hàng, khuyến mãi, điểm thành viên, VAT, tiền mặt/chuyển khoản/QR, in hóa đơn.
- Quản lý sản phẩm, danh mục, mẫu thiết bị, khách hàng, nhà cung cấp, nhân viên và ca làm.
- Nhập hàng theo nhà cung cấp, cập nhật giá vốn/tồn kho, theo dõi công nợ nhập hàng.
- Hóa đơn, thanh toán, hủy đơn và hoàn tác tồn kho/điểm/bảo hành.
- Tự tạo phiếu bảo hành cho từng dòng hàng đủ điều kiện; tiếp nhận và cập nhật yêu cầu bảo hành; tra cứu công khai bằng token/QR.
- Báo cáo doanh thu, xuất Excel và phân tích bằng Google Gemini; lưu lịch sử phân tích.
- Cài đặt cửa hàng, in, thanh toán, VAT, kho và nhật ký hoạt động.

## Quy ước để đưa vào báo cáo

1. Use Case chỉ mô tả **mục tiêu người dùng**, không đưa tên API hay tên bảng vào hình.
2. Activity dùng swimlane để phân trách nhiệm giữa người dùng, frontend và backend/CSDL.
3. Sequence dùng tên thành phần thực tế trong code; nhánh điều kiện, lỗi và vòng lặp được thể hiện bằng `opt`, `alt`, `loop`.
4. Hai Class Diagram là **lớp miền khái niệm**. Dự án JavaScript hiện tại không khai báo các lớp entity này; không nên ghi rằng đây là sơ đồ lớp được sinh trực tiếp từ code.
5. ERD là mô hình vật lý: ghi PK/FK và lực lượng quan hệ. `orders.promotion_id` hiện là liên kết logic nhưng schema chưa khai báo khóa ngoại.
6. Deployment là mô hình production đề xuất theo tài liệu triển khai, vì repository không xác định nhà cung cấp cloud hoặc máy chủ cụ thể.

## Mở và xuất lại bằng StarUML

1. Mở StarUML, chọn **File > Open...** và mở `ZTECH-POS-Diagrams.mdj`.
2. Trong **Model Explorer**, mở `Mô hình hệ thống Z-TECH POS` rồi nhấp đúp sơ đồ cần sửa.
3. Sửa trực tiếp bằng Toolbox của StarUML. Tất cả actor, use case, activity node, lifeline, class, entity, component và node deployment đều là model native, không phải ảnh chèn vào canvas.
4. Xuất một hình bằng **File > Export Diagram As > PNG** hoặc **SVG**. Khi cần chèn Word nên ưu tiên SVG; khi nộp ảnh dùng bộ PNG nền trắng trong `staruml-final/png/`.

Các tệp `.puml` cũ được giữ làm bản tham khảo, không phải đầu ra chính của lần thiết kế này. Có thể tái tạo bộ ảnh nền trắng bằng generator trong `staruml-generator/`; bản `.mdj` và ảnh trong `staruml-final/` đã được tạo sẵn nên không cần chạy generator để chỉnh sửa thông thường.

- Use Case tổng quát, ERD, Component, Deployment: trang ngang.
- Activity và Sequence: trang dọc hoặc ngang tùy chiều dài.
- Class: trang ngang.

Tên hình trong báo cáo nên ghi theo mẫu: `Hình 3.x. Biểu đồ ... của hệ thống Z-TECH POS`, sau hình có 1 đoạn 3-5 câu giải thích mục tiêu, luồng chính và ngoại lệ quan trọng.

## Nguồn đối chiếu chính

- Điều hướng/quyền giao diện: `frontend/src/App.jsx`, `frontend/src/utils/permissions.js`.
- Checkout: `frontend/src/pages/POS.jsx`, `backend/routes/orders.js`, `backend/controllers/orderCreateController.js`.
- Nhập kho: `frontend/src/components/inventory/PurchaseReceivingTab.jsx`, `backend/controllers/purchaseOrderController.js`.
- Bảo hành: `backend/controllers/warrantyController.js`, `backend/controllers/publicWarrantyController.js`.
- Kiến trúc API: `backend/server.js`.
- CSDL: `database/schema.sql` và các migration.
- Triển khai: `DEPLOYMENT.md`.
