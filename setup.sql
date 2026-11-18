-- ============================================================
-- setup.sql
-- Chạy file này trong database MTP trước khi dùng ứng dụng
-- mysql -u root -p mtp < setup.sql
-- ============================================================

-- Tạo bảng users nếu chưa có
CREATE TABLE IF NOT EXISTS `users` (
  `id`         int NOT NULL AUTO_INCREMENT,
  `username`   varchar(50)  NOT NULL,
  `password`   varchar(255) NOT NULL COMMENT 'bcrypt hash',
  `fullname`   varchar(100) NOT NULL,
  `role`       enum('admin','user') NOT NULL DEFAULT 'user',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Thêm tài khoản admin mặc định
-- Mật khẩu: Admin@123
-- (hash bcrypt rounds=12 của chuỗi "Admin@123")
INSERT INTO `users` (`username`, `password`, `fullname`, `role`) VALUES
(
  'admin',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCkpDMVDoFxPjXSbNGNBH7a',
  'Quản trị viên',
  'admin'
)
ON DUPLICATE KEY UPDATE
  `password` = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCkpDMVDoFxPjXSbNGNBH7a',
  `role`     = 'admin';

-- Kiểm tra
SELECT id, username, fullname, role, created_at FROM users;
