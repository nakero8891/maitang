// src/routes/donvi.js
const express = require('express');
const pool    = require('../db/pool');
const { requireLogin } = require('../middleware/auth');
const router  = express.Router();

const TBL = 'mtp_donvi';
const TBL_HOSO = 'mtp_hoso';

// GET  /api/donvi — danh sách tất cả
router.get('/', requireLogin, async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM ${TBL} ORDER BY xa ASC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ status: 'error', msg: err.message });
  }
});

// POST /api/donvi — thêm mới
router.post('/', requireLogin, async (req, res) => {
  const { xa, donvi, sotk, khobac, mst, canbo, sdt } = req.body;
  if (!xa || !donvi) return res.status(400).json({ status: 'error', msg: 'Thiếu tên xã hoặc tên đơn vị' });
  try {
    const [result] = await pool.query(
      `INSERT INTO ${TBL} (xa, donvi, sotk, khobac, mst, canbo, sdt) VALUES (?,?,?,?,?,?,?)`,
      [xa, donvi, sotk||null, khobac||null, mst||null, canbo||null, sdt||null]
    );
    res.json({ status: 'ok', msg: 'Thêm đơn vị thành công', id: result.insertId });
  } catch (err) {
    res.status(500).json({ status: 'error', msg: err.message });
  }
});

// PUT /api/donvi/:id — sửa
router.put('/:id', requireLogin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { xa, donvi, sotk, khobac, mst, canbo, sdt } = req.body;
  if (!id || !xa || !donvi) return res.status(400).json({ status: 'error', msg: 'Thiếu thông tin' });
  try {
    await pool.query(
      `UPDATE ${TBL} SET xa=?, donvi=?, sotk=?, khobac=?, mst=?, canbo=?, sdt=? WHERE id=?`,
      [xa, donvi, sotk||null, khobac||null, mst||null, canbo||null, sdt||null, id]
    );
    res.json({ status: 'ok', msg: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ status: 'error', msg: err.message });
  }
});

// DELETE /api/donvi/:id — xoá
router.delete('/:id', requireLogin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ status: 'error', msg: 'Mã đơn vị không hợp lệ' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [units] = await conn.query('SELECT id FROM ' + TBL + ' WHERE id=? FOR UPDATE', [id]);
    if (!units.length) { await conn.rollback(); return res.status(404).json({ status: 'error', msg: 'Không tìm thấy đơn vị' }); }
    const [[{ cnt }]] = await conn.query('SELECT COUNT(*) AS cnt FROM ' + TBL_HOSO + ' WHERE xa_id=?', [id]);
    if (cnt > 0) { await conn.rollback(); return res.status(409).json({ status: 'error', msg: 'Không thể xóa — còn ' + cnt + ' hồ sơ liên kết' }); }
    await conn.query('DELETE FROM ' + TBL + ' WHERE id=?', [id]);
    await conn.commit();
    res.json({ status: 'ok', msg: 'Đã xoá đơn vị' });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ status: 'error', msg: 'Đơn vị đang được hồ sơ sử dụng' });
    res.status(500).json({ status: 'error', msg: err.message });
  } finally { conn.release(); }
});
// POST /api/donvi/import — nhập hàng loạt
router.post('/import', requireLogin, async (req, res) => {
  const rows = req.body.rows || [];
  let ok = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const xa = (r.xa || '').trim();
    const donvi = (r.donvi || '').trim();
    if (!xa || !donvi) { errors.push(`Dòng ${i+1}: thiếu tên xã/đơn vị`); continue; }
    try {
      await pool.query(
        `INSERT INTO ${TBL} (xa, donvi, sotk, khobac, mst, canbo, sdt)
         VALUES (?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE donvi=VALUES(donvi), sotk=VALUES(sotk),
           khobac=VALUES(khobac), mst=VALUES(mst), canbo=VALUES(canbo), sdt=VALUES(sdt)`,
        [xa, donvi, r.sotk||null, r.khobac||null, r.mst||null, r.canbo||null, r.sdt||null]
      );
      ok++;
    } catch (err) {
      errors.push(`Dòng ${i+1}: ${err.message}`);
    }
  }
  res.json({ status: 'ok', inserted: ok, errors });
});

module.exports = router;
