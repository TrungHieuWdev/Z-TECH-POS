-- Gộp các tài khoản Chủ cửa hàng và Quản lý cũ thành Quản trị viên.
-- Giữ các giá trị ENUM cũ để vẫn đọc được bản sao lưu/dữ liệu chưa di chuyển.
UPDATE users
SET role = 'admin'
WHERE role IN ('owner', 'manager');

UPDATE users u
LEFT JOIN roles r ON r.role_name = 'Admin'
SET u.role_id = r.id
WHERE u.role = 'admin' AND r.id IS NOT NULL;

UPDATE roles
SET role_name = 'Quản trị viên',
    description = 'Toàn quyền vận hành hệ thống'
WHERE role_name = 'Admin';

UPDATE roles
SET description = 'Vai trò cũ đã được gộp vào Quản trị viên',
    status = 'inactive'
WHERE role_name = 'Quản lý';
