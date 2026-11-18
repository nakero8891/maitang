#!/usr/bin/env node
/**
 * Tạo / đổi mật khẩu tài khoản admin
 * Dùng: node scripts/create-admin.js [username] [password] [fullname]
 * Mặc định nếu không truyền: admin / Admin@123 / Quản trị viên
 *
 * VD: node scripts/create-admin.js admin MatKhau@2026 "Nguyễn Văn A"
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool   = require('../src/db/pool');

async function main() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'Admin@123';
  const fullname = process.argv[4] || 'Quản trị viên';

  console.log(`Tạo tài khoản: ${username} / ${password}`);

  // Tạo bảng users nếu chưa có
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`users\` (
      \`id\`         int NOT NULL AUTO_INCREMENT,
      \`username\`   varchar(50)  NOT NULL,
      \`password\`   varchar(255) NOT NULL,
      \`fullname\`   varchar(100) NOT NULL,
      \`role\`       enum('admin','user') NOT NULL DEFAULT 'user',
      \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`username\` (\`username\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (username, password, fullname, role) VALUES (?,?,?,'admin')
     ON DUPLICATE KEY UPDATE password=VALUES(password), fullname=VALUES(fullname), role='admin'`,
    [username, hash, fullname]
  );

  console.log(`✅ Tài khoản "${username}" đã sẵn sàng. Mật khẩu: ${password}`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
