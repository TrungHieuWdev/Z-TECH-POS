SET NAMES utf8mb4;

INSERT INTO users (id, name, email, password, role) VALUES
(1, 'Chủ cửa hàng', 'owner@pos.com', '$2a$10$zJ0vlNynsAv7pjIDZJnD2.wctQCc5BglAf3qlasqs1YWNuaWoV5ii', 'owner'),
(2, 'Quản lý', 'manager@pos.com', '$2a$10$zJ0vlNynsAv7pjIDZJnD2.wctQCc5BglAf3qlasqs1YWNuaWoV5ii', 'manager'),
(3, 'Nhân viên', 'employee@pos.com', '$2a$10$gP1nmk.Bvd80W7hfPCJuD.5RZ6qwwCZPG4TEuEde013Z3Nz6CH5FC', 'employee')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  email = VALUES(email),
  password = VALUES(password),
  role = VALUES(role);
