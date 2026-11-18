# Quản lý Mai Táng Phí — Node.js + MySQL

## Cấu trúc project

```
maitang-node/
├── src/
│   ├── app.js              # Entry point Express
│   ├── db/
│   │   └── pool.js         # MySQL connection pool
│   ├── middleware/
│   │   └── auth.js         # Kiểm tra session
│   └── routes/
│       ├── auth.js         # POST /login, POST /logout
│       ├── donvi.js        # GET|POST|PUT|DELETE /api/donvi
│       ├── hoso.js         # GET|POST|PUT|DELETE /api/hoso
│       └── baocao.js       # GET /api/baocao/*
├── public/
│   ├── index.html          # Trang chính (không PHP)
│   ├── login.html          # Trang đăng nhập
│   └── js/
│       ├── api.js          # Wrapper gọi REST API
│       └── main.js         # Toàn bộ logic frontend
├── .env.example            # Mẫu cấu hình
├── package.json
└── README.md
```

---

## Cài đặt

### 1. Yêu cầu

- Node.js >= 18
- MySQL 8.x (giữ nguyên database hiện có)

### 2. Clone & cài package

```bash
cd /var/www
git clone <repo> maitang-node   # hoặc upload thư mục lên server
cd maitang-node
npm install
```

### 3. Tạo file .env

```bash
cp .env.example .env
nano .env
```

Điền thông tin thực tế:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=mtp
SESSION_SECRET=chuoi_ngau_nhien_dai_it_nhat_32_ky_tu
```

### 4. Tạo bảng users (nếu chưa có)

Chạy SQL này trong database `mtp`:

```sql
CREATE TABLE IF NOT EXISTS `users` (
  `id`       int NOT NULL AUTO_INCREMENT,
  `username` varchar(50)  NOT NULL UNIQUE,
  `password` varchar(255) NOT NULL COMMENT 'bcrypt hash',
  `fullname` varchar(100) NOT NULL,
  `role`     enum('admin','user') NOT NULL DEFAULT 'user',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Thêm tài khoản admin (chạy file `scripts/create-admin.js`):

```bash
node scripts/create-admin.js admin MatKhau@123 "Nguyễn Văn A"
```

### 5. Chạy thử

```bash
npm run dev        # development (nodemon tự reload)
npm start          # production
```

Mở trình duyệt: `http://localhost:3000`

---

## Triển khai production (VPS)

### Dùng PM2

```bash
npm install -g pm2
pm2 start src/app.js --name maitang
pm2 save
pm2 startup          # tự khởi động khi reboot
```

### Nginx reverse proxy

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### HTTPS (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## API Reference

### Auth
| Method | URL | Body | Mô tả |
|--------|-----|------|-------|
| POST | `/login` | `{username, password}` | Đăng nhập |
| POST | `/logout` | — | Đăng xuất |
| GET  | `/api/me` | — | Thông tin user hiện tại |

### Đơn vị (Xã)
| Method | URL | Mô tả |
|--------|-----|-------|
| GET    | `/api/donvi` | Danh sách tất cả |
| POST   | `/api/donvi` | Thêm mới |
| PUT    | `/api/donvi/:id` | Sửa |
| DELETE | `/api/donvi/:id` | Xoá |
| POST   | `/api/donvi/import` | Nhập hàng loạt |

### Hồ sơ
| Method | URL | Query params | Mô tả |
|--------|-----|-------------|-------|
| GET    | `/api/hoso` | `dot, loai, xa_id, search, start, length, draw` | DataTables server-side |
| POST   | `/api/hoso` | — | Thêm mới |
| PUT    | `/api/hoso/:id` | — | Sửa |
| DELETE | `/api/hoso/:id` | — | Xoá |
| POST   | `/api/hoso/import` | — | Nhập hàng loạt |

### Báo cáo
| Method | URL | Query | Mô tả |
|--------|-----|-------|-------|
| GET | `/api/baocao/thongbao` | `dot` | Bảng 3 — Thông báo đợt |
| GET | `/api/baocao/chitiet` | `dot` | Bảng 4 — Chi tiết đợt |
| GET | `/api/baocao/chitietxa` | `dot, xa_id` | Bảng 5 — Chi tiết xã |
| GET | `/api/baocao/xabydot` | `dot` | Danh sách xã có hồ sơ trong đợt |

---

## So sánh PHP → Node.js

| PHP | Node.js |
|-----|---------|
| `$.post(ACTION_URL, {action:'mtp_listDonvi'})` | `GET /api/donvi` |
| `$.post(ACTION_URL, {action:'mtp_addHoso'})` | `POST /api/hoso` |
| `$.post(ACTION_URL, {action:'mtp_updateDonvi', id})` | `PUT /api/donvi/:id` |
| `$.post(ACTION_URL, {action:'mtp_deleteDonvi', id})` | `DELETE /api/donvi/:id` |
| `$.post(ACTION_URL, {action:'mtp_thongBaoDot', dot})` | `GET /api/baocao/thongbao?dot=1` |
| `$.post(ACTION_URL, {action:'mtp_chiTietXa', dot, xa_id})` | `GET /api/baocao/chitietxa?dot=1&xa_id=51` |
| `session_start()` + `$_SESSION` | `express-session` |
| `require('config.php')` | `.env` + `pool.js` |
