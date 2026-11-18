-- ═══════════════════════════════════════════════════════════════
-- MIGRATION v2 — Thêm các cột chi tiết vào bảng mtp_hoso
-- Chạy 1 lần trên MySQL: mysql -u USER -p DB_NAME < migrate_v2.sql
-- ═══════════════════════════════════════════════════════════════

-- Thêm cột thông tin đối tượng từ trần
ALTER TABLE mtp_hoso
  ADD COLUMN IF NOT EXISTS ten_dt         VARCHAR(200)  DEFAULT NULL COMMENT 'Họ tên người từ trần',
  ADD COLUMN IF NOT EXISTS ngay_sinh      DATE          DEFAULT NULL COMMENT 'Ngày sinh người từ trần',
  ADD COLUMN IF NOT EXISTS gioi_tinh      VARCHAR(10)   DEFAULT NULL COMMENT 'Nam/Nữ của người từ trần',
  ADD COLUMN IF NOT EXISTS que_quan_dt    VARCHAR(300)  DEFAULT NULL COMMENT 'Quê quán người từ trần',
  ADD COLUMN IF NOT EXISTS ban_dt         VARCHAR(100)  DEFAULT NULL COMMENT 'Bản/Thôn người từ trần',
  ADD COLUMN IF NOT EXISTS xa_dt          VARCHAR(100)  DEFAULT NULL COMMENT 'Xã người từ trần',
  ADD COLUMN IF NOT EXISTS loai_chitiet   VARCHAR(300)  DEFAULT NULL COMMENT 'Chi tiết loại đối tượng (VD: Huân chương KC hạng Ba)',

  -- Thêm cột thông tin người nhận mai táng phí
  ADD COLUMN IF NOT EXISTS nguoi_nhan     VARCHAR(200)  DEFAULT NULL COMMENT 'Họ tên người nhận',
  ADD COLUMN IF NOT EXISTS gioi_tinh_nhan VARCHAR(10)   DEFAULT NULL COMMENT 'Nam/Nữ người nhận',
  ADD COLUMN IF NOT EXISTS quan_he        VARCHAR(100)  DEFAULT NULL COMMENT 'Quan hệ với người từ trần (VD: con trai, con gái)',
  ADD COLUMN IF NOT EXISTS ban_nhan       VARCHAR(100)  DEFAULT NULL COMMENT 'Bản thường trú người nhận',
  ADD COLUMN IF NOT EXISTS xa_nhan        VARCHAR(100)  DEFAULT NULL COMMENT 'Xã thường trú người nhận',
  ADD COLUMN IF NOT EXISTS que_quan_nhan  VARCHAR(300)  DEFAULT NULL COMMENT 'Quê quán người nhận',

  -- Số QĐ và ngày QĐ (nhập sau khi có quyết định)
  ADD COLUMN IF NOT EXISTS so_qd          VARCHAR(100)  DEFAULT NULL COMMENT 'Số quyết định',
  ADD COLUMN IF NOT EXISTS ngay_qd        DATE          DEFAULT NULL COMMENT 'Ngày ký quyết định',

  -- Đợt tổng hợp (NULL = chưa tổng hợp)
  ADD COLUMN IF NOT EXISTS dot_tonghop    INT           DEFAULT NULL COMMENT 'Đợt tổng hợp (NULL = chưa tổng hợp)';

-- Chuyển cột soqd cũ (nếu có) sang ten_dt để giữ dữ liệu
-- UPDATE mtp_hoso SET ten_dt = soqd WHERE ten_dt IS NULL AND soqd IS NOT NULL;

-- Index để tăng tốc query
CREATE INDEX IF NOT EXISTS idx_hoso_dot_tonghop ON mtp_hoso(dot_tonghop);
CREATE INDEX IF NOT EXISTS idx_hoso_so_qd       ON mtp_hoso(so_qd);

SELECT 'Migration v2 hoàn thành!' AS result;
