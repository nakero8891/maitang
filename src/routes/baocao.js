// src/routes/baocao.js
// Báo cáo CHỈ tổng hợp:
//   - Loại 150/49/62/290 (không tổng hợp NCC vì khác nguồn vốn)
//   - Hồ sơ đã có số quyết định (soqd IS NOT NULL AND soqd != '')
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
    // NCC không tổng hợp vào báo cáo (nguồn vốn khác)
};
const MUC_LIST = [12100000, 14900000, 18000000, 23400000, 25300000];

// Điều kiện lọc chung: không NCC, phải có số QĐ
const BASE_FILTER = `h.loai != 'NCC' AND h.soqd IS NOT NULL AND h.soqd != ''`;

function fullLoais() { return Object.values(LOAI_MAP); }
function toFull(s)   { return LOAI_MAP[s] || s; }

function dotFilter(dot) {
    if (dot) return {
        where:  `WHERE h.dot=? AND ${BASE_FILTER}`,
        params: [dot],
    };
    return {
        where:  `WHERE ${BASE_FILTER}`,
        params: [],
    };
}

// GET /api/baocao/thongbao?dot=1
router.get('/thongbao', requireLogin, async (req, res) => {
    const dot = req.query.dot ? parseInt(req.query.dot) : null;
    const { where, params } = dotFilter(dot);
    try {
        const [rows] = await pool.query(
            `SELECT h.soqd, h.loai, h.muc, d.id AS donvi_id, d.xa, d.donvi, d.sotk
             FROM ${TBL} h LEFT JOIN ${TBL_DONVI} d ON h.xa_id=d.id
             ${where} ORDER BY d.xa ASC, h.id ASC`, params);

        const xaMap = new Map();
        for (const row of rows) {
            const key = row.donvi_id == null ? 'unknown:' + row.xa : String(row.donvi_id);
            if (!xaMap.has(key)) xaMap.set(key, { xa: row.xa, donvi: row.donvi, sotk: row.sotk, total: 0, soqds: [] });
            const item = xaMap.get(key);
            item.total += Number(row.muc);
            if (row.soqd && !item.soqds.includes(row.soqd)) item.soqds.push(row.soqd);
        }
        const data  = Array.from(xaMap.values()).map((v) => ({
            xa: v.xa, donvi: v.donvi, sotk: v.sotk, total: v.total, soqds: v.soqds.join('; '),
        }));
        const total = data.reduce((s, r) => s + r.total, 0);
        res.json({ dot, data, total });
    } catch (err) { res.status(500).json({ status: 'error', msg: err.message }); }
});

// GET /api/baocao/chitiet?dot=1
router.get('/chitiet', requireLogin, async (req, res) => {
    const dot = req.query.dot ? parseInt(req.query.dot) : null;
    const { where, params } = dotFilter(dot);
    try {
        const [rows] = await pool.query(
            `SELECT h.soqd, h.loai, h.muc, d.xa, d.donvi, d.sotk
             FROM ${TBL} h LEFT JOIN ${TBL_DONVI} d ON h.xa_id=d.id
             ${where} ORDER BY d.xa ASC`, params);

        const loais = fullLoais();
        const xaMap = new Map();
        for (const row of rows) {
            const key = row.donvi_id == null ? 'unknown:' + row.xa : String(row.donvi_id);
            if (!xaMap.has(key)) {
                const cells = {};
                for (const l of loais) { cells[l] = {}; for (const m of MUC_LIST) cells[l][m] = 0; }
                xaMap.set(key, { xa: row.xa, donvi: row.donvi, sotk: row.sotk, soqds: [], cells });
            }
            const item = xaMap.get(key);
            const full = toFull(row.loai);
            if (!item.cells[full]) item.cells[full] = {};
            item.cells[full][Number(row.muc)] = (item.cells[full][Number(row.muc)] || 0) + 1;
            if (row.soqd && !item.soqds.includes(row.soqd)) item.soqds.push(row.soqd);
        }
        const data = Array.from(xaMap.values()).map((v) => ({
            xa: v.xa, donvi: v.donvi, sotk: v.sotk, soqds: v.soqds.join('; '), cells: v.cells,
        }));
        res.json({ dot, loais, mucs: MUC_LIST, data });
    } catch (err) { res.status(500).json({ status: 'error', msg: err.message }); }
});

// GET /api/baocao/chitietxa?dot=1&xa_id=51
router.get('/chitietxa', requireLogin, async (req, res) => {
    const dot   = parseInt(req.query.dot)   || 1;
    const xa_id = parseInt(req.query.xa_id) || 0;
    if (!xa_id) return res.status(400).json({ status: 'error', msg: 'Thiếu xa_id' });
    try {
        const [rows] = await pool.query(
            `SELECT h.soqd, h.loai, h.muc, d.xa, d.donvi, d.sotk
             FROM ${TBL} h LEFT JOIN ${TBL_DONVI} d ON h.xa_id=d.id
             WHERE h.dot=? AND h.xa_id=? AND ${BASE_FILTER}
             ORDER BY h.id ASC`, [dot, xa_id]);

        const loais = fullLoais();
        const cells = {};
        for (const l of loais) { cells[l] = {}; for (const m of MUC_LIST) cells[l][m] = 0; }

        let xa_name = '', donvi = '', sotk = '', total = 0;
        const soqds = [];
        for (const row of rows) {
            xa_name = row.xa; donvi = row.donvi; sotk = row.sotk;
            const full = toFull(row.loai);
            if (!cells[full]) { cells[full] = {}; for (const m of MUC_LIST) cells[full][m] = 0; }
            cells[full][Number(row.muc)] = (cells[full][Number(row.muc)] || 0) + 1;
            if (row.soqd && !soqds.includes(row.soqd)) soqds.push(row.soqd);
            total += Number(row.muc);
        }
        res.json({ dot, xa: xa_name, donvi, sotk, soqds: soqds.join('; '), cells, total, loais, mucs: MUC_LIST });
    } catch (err) { res.status(500).json({ status: 'error', msg: err.message }); }
});

// GET /api/baocao/xabydot?dot=1
// Chỉ lấy xã có hồ sơ hợp lệ (không NCC, có số QĐ)
router.get('/xabydot', requireLogin, async (req, res) => {
    const dot = parseInt(req.query.dot) || 1;
    try {
        const [rows] = await pool.query(
            `SELECT DISTINCT d.id, d.xa
             FROM ${TBL} h JOIN ${TBL_DONVI} d ON h.xa_id=d.id
             WHERE h.dot=? AND ${BASE_FILTER}
             ORDER BY d.xa`, [dot]);
        res.json(rows);
    } catch (err) { res.status(500).json({ status: 'error', msg: err.message }); }
});

module.exports = router;
