// src/routes/hoso.js  —  Quản lý hồ sơ (bổ sung NCC)
'use strict';
const express = require('express');
const pool    = require('../db/pool');
const { requireLogin } = require('../middleware/auth');
const router  = express.Router();

const TBL       = 'mtp_hoso';
const TBL_DONVI = 'mtp_donvi';

const LOAI_MAP = {
  '150': '150/2006/NĐ-CP',
  '49':  '49/2015/QĐ-TTg',
  '62':  '62/2011/QĐ-TTg',
  '290': '290/2005/QĐ-TTg',
  'NCC': 'Người có công',
};
const LOAI_FLIP = Object.fromEntries(Object.entries(LOAI_MAP).map(([k,v])=>[v,k]));
const MUC_VALID = [12100000, 14900000, 18000000, 23400000, 25300000];

// NCC-specific extra fields
const NCC_FIELDS = [
  'doituong','namsinh','ngaytutran','chitietloai','ban_doituong',
  'nguoinhan','quanhe','ngaysinh_nhan','gioitinh','quequan_nhan',
  'thuongtru_nhan','so_ngay_trinh',
];

function toShort(val) {
  val = String(val||'').trim();
  if (LOAI_MAP[val]) return val;
  return LOAI_FLIP[val] || val;
}

function dateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0,10);
}

function extractNccFields(body) {
  const obj = {};
  for (const f of NCC_FIELDS) {
    if (['namsinh','ngaytutran','ngaysinh_nhan'].includes(f)) {
      obj[f] = dateOrNull(body[f]);
    } else {
      obj[f] = body[f] || null;
    }
  }
  return obj;
}

// ── GET /api/hoso — DataTables server-side ───────────────
router.get('/', requireLogin, async (req, res) => {
  const dot    = parseInt(req.query.dot)    || 0;
  const loai   = req.query.loai            || '';
  const xa_id  = parseInt(req.query.xa_id) || 0;
  const search = req.query.search          || '';
  const start  = parseInt(req.query.start) || 0;
  const length = parseInt(req.query.length)|| 25;
  const draw   = parseInt(req.query.draw)  || 1;

  const where  = ['1=1'];
  const params = [];
  if (dot)   { where.push('h.dot=?');   params.push(dot); }
  if (loai)  { where.push('h.loai=?');  params.push(toShort(loai)); }
  if (xa_id) { where.push('h.xa_id=?'); params.push(xa_id); }
  if (search) {
    where.push('(h.soqd LIKE ? OR h.ghichu LIKE ? OR h.doituong LIKE ? OR d.xa LIKE ? OR h.nguoinhan LIKE ?)');
    const q = `%${search}%`;
    params.push(q,q,q,q,q);
  }
  const whereStr = where.join(' AND ');

  try {
    const [[{total}]]    = await pool.query(`SELECT COUNT(*) AS total FROM ${TBL}`);
    const [[{filtered}]] = await pool.query(
      `SELECT COUNT(*) AS filtered FROM ${TBL} h LEFT JOIN ${TBL_DONVI} d ON h.xa_id=d.id WHERE ${whereStr}`,
      params
    );

    const limitSql = length === -1 ? '' : `LIMIT ${start}, ${length}`;
    const [rows] = await pool.query(`
      SELECT h.*, d.xa, d.donvi, d.sotk
      FROM ${TBL} h LEFT JOIN ${TBL_DONVI} d ON h.xa_id=d.id
      WHERE ${whereStr}
      ORDER BY h.dot ASC, d.xa ASC, h.id ASC ${limitSql}`, params);

    const data = rows.map((row, i) => [
      start + i + 1,
      row.soqd || '(chưa có QĐ)',
      LOAI_MAP[row.loai] || row.loai,
      Number(row.muc).toLocaleString('vi-VN') + ' đ',
      row.xa || '',
      'Đợt ' + row.dot,
      row.ghichu || '',
      // Extra NCC info for display
      row.doituong || '',
      row.nguoinhan || '',
      // Action data
      {
        id: row.id, soqd: row.soqd||'', loai: row.loai,
        muc: row.muc, xa_id: row.xa_id, dot: row.dot, ghichu: row.ghichu||'',
        // NCC fields
        doituong: row.doituong||'', namsinh: row.namsinh||'',
        ngaytutran: row.ngaytutran||'', chitietloai: row.chitietloai||'',
        ban_doituong: row.ban_doituong||'', nguoinhan: row.nguoinhan||'',
        quanhe: row.quanhe||'', ngaysinh_nhan: row.ngaysinh_nhan||'',
        gioitinh: row.gioitinh||'', quequan_nhan: row.quequan_nhan||'',
        thuongtru_nhan: row.thuongtru_nhan||'', so_ngay_trinh: row.so_ngay_trinh||'',
      }
    ]);

    res.json({ draw, recordsTotal: total, recordsFiltered: filtered, data });
  } catch (err) {
    res.status(500).json({ status:'error', msg: err.message });
  }
});

// ── POST /api/hoso — thêm mới ────────────────────────────
router.post('/', requireLogin, async (req, res) => {
  let { soqd, loai, muc, xa_id, dot, ghichu } = req.body;
  soqd  = (soqd||'').trim() || null;
  loai  = toShort(loai||'');
  muc   = parseInt(muc)   || 0;
  xa_id = parseInt(xa_id) || 0;
  dot   = parseInt(dot)   || 1;

  if (!loai || !muc || !xa_id)
    return res.status(400).json({ status:'error', msg:'Thiếu thông tin bắt buộc (loại, mức, xã)' });
  if (!LOAI_MAP[loai])
    return res.status(400).json({ status:'error', msg:'Loại đối tượng không hợp lệ' });
  if (!MUC_VALID.includes(muc))
    return res.status(400).json({ status:'error', msg:'Mức hỗ trợ không hợp lệ' });

  const ncc = extractNccFields(req.body);

  try {
    const [result] = await pool.query(`
      INSERT INTO ${TBL}
        (soqd, loai, muc, xa_id, dot, ghichu,
         doituong, namsinh, ngaytutran, chitietloai, ban_doituong,
         nguoinhan, quanhe, ngaysinh_nhan, gioitinh,
         quequan_nhan, thuongtru_nhan, so_ngay_trinh)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [soqd, loai, muc, xa_id, dot, ghichu||null,
       ncc.doituong, ncc.namsinh, ncc.ngaytutran, ncc.chitietloai, ncc.ban_doituong,
       ncc.nguoinhan, ncc.quanhe, ncc.ngaysinh_nhan, ncc.gioitinh,
       ncc.quequan_nhan, ncc.thuongtru_nhan, ncc.so_ngay_trinh]);

    res.json({ status:'ok', msg:'Thêm hồ sơ thành công', id: result.insertId });
  } catch (err) {
    res.status(500).json({ status:'error', msg: err.message });
  }
});

// ── PUT /api/hoso/:id — sửa ─────────────────────────────
router.put('/:id', requireLogin, async (req, res) => {
  const id = parseInt(req.params.id);
  let { soqd, loai, muc, xa_id, dot, ghichu } = req.body;
  soqd  = (soqd||'').trim() || null;
  loai  = toShort(loai||'');
  muc   = parseInt(muc);
  xa_id = parseInt(xa_id);
  dot   = parseInt(dot);
  const ncc = extractNccFields(req.body);

  try {
    await pool.query(`
      UPDATE ${TBL} SET
        soqd=?, loai=?, muc=?, xa_id=?, dot=?, ghichu=?,
        doituong=?, namsinh=?, ngaytutran=?, chitietloai=?, ban_doituong=?,
        nguoinhan=?, quanhe=?, ngaysinh_nhan=?, gioitinh=?,
        quequan_nhan=?, thuongtru_nhan=?, so_ngay_trinh=?
      WHERE id=?`,
      [soqd, loai, muc, xa_id, dot, ghichu||null,
       ncc.doituong, ncc.namsinh, ncc.ngaytutran, ncc.chitietloai, ncc.ban_doituong,
       ncc.nguoinhan, ncc.quanhe, ncc.ngaysinh_nhan, ncc.gioitinh,
       ncc.quequan_nhan, ncc.thuongtru_nhan, ncc.so_ngay_trinh, id]);

    res.json({ status:'ok', msg:'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ status:'error', msg: err.message });
  }
});

// ── DELETE /api/hoso/:id ─────────────────────────────────
router.delete('/:id', requireLogin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query(`DELETE FROM ${TBL} WHERE id=?`, [id]);
    res.json({ status:'ok', msg:'Đã xoá hồ sơ' });
  } catch (err) {
    res.status(500).json({ status:'error', msg: err.message });
  }
});

// ── POST /api/hoso/import — nhập hàng loạt (hỗ trợ NCC) ─
router.post('/import', requireLogin, async (req, res) => {
  const rows = req.body.rows || [];
  let ok = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const r    = rows[i];
    const soqd = (r.soqd||'').trim() || null;
    const loai = toShort(r.loai||'');
    const muc  = parseInt(String(r.muc||'').replace(/[,.\s]/g,'')) || 0;
    const xa   = (r.xa||'').trim();
    const dot  = parseInt(r.dot) || 1;
    const ghichu = (r.ghichu||'').trim() || null;

    if (!loai || !muc || !xa) { errors.push(`Dòng ${i+1}: thiếu dữ liệu`); continue; }
    if (!LOAI_MAP[loai]) { errors.push(`Dòng ${i+1}: loại "${loai}" không hợp lệ`); continue; }

    try {
      const [[xaRow]] = await pool.query(
        `SELECT id FROM ${TBL_DONVI} WHERE xa=? LIMIT 1`, [xa]
      );
      if (!xaRow) { errors.push(`Dòng ${i+1}: không tìm thấy xã '${xa}'`); continue; }

      // NCC extra fields
      const ncc = {
        doituong:      r.doituong      || null,
        namsinh:       dateOrNull(r.namsinh),
        ngaytutran:    dateOrNull(r.ngaytutran),
        chitietloai:   r.chitietloai   || null,
        ban_doituong:  r.ban_doituong  || null,
        nguoinhan:     r.nguoinhan     || null,
        quanhe:        r.quanhe        || null,
        ngaysinh_nhan: dateOrNull(r.ngaysinh_nhan),
        gioitinh:      r.gioitinh      || null,
        quequan_nhan:  r.quequan_nhan  || null,
        thuongtru_nhan:r.thuongtru_nhan|| null,
        so_ngay_trinh: r.so_ngay_trinh || null,
      };

      await pool.query(`
        INSERT INTO ${TBL}
          (soqd, loai, muc, xa_id, dot, ghichu,
           doituong, namsinh, ngaytutran, chitietloai, ban_doituong,
           nguoinhan, quanhe, ngaysinh_nhan, gioitinh,
           quequan_nhan, thuongtru_nhan, so_ngay_trinh)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [soqd, loai, muc, xaRow.id, dot, ghichu,
         ncc.doituong, ncc.namsinh, ncc.ngaytutran, ncc.chitietloai, ncc.ban_doituong,
         ncc.nguoinhan, ncc.quanhe, ncc.ngaysinh_nhan, ncc.gioitinh,
         ncc.quequan_nhan, ncc.thuongtru_nhan, ncc.so_ngay_trinh]);
      ok++;
    } catch (err) {
      errors.push(`Dòng ${i+1}: ${err.message}`);
    }
  }

  res.json({ status:'ok', inserted: ok, errors });
});

module.exports = router;
