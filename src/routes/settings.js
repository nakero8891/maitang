// src/routes/settings.js
'use strict';
const express = require('express');
const pool    = require('../db/pool');
const { requireLogin } = require('../middleware/auth');
const router  = express.Router();

const ALLOWED_KEYS = ['nguoilap', 'ke_toan', 'thu_truong'];

// Tự tạo bảng nếu chưa có (tránh lỗi nếu quên chạy migration)
async function ensureTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS mtp_settings (
                \`key\`        varchar(100) NOT NULL,
                \`value\`      text DEFAULT NULL,
                \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (\`key\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
    } catch(e) { /* ignore */ }
}
ensureTable();

// GET /api/settings
router.get('/', requireLogin, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT `key`, `value` FROM mtp_settings');
        const data = { nguoilap: '', ke_toan: '', thu_truong: '' };
        for (const r of rows) data[r.key] = r.value || '';
        res.json({ status: 'ok', data });
    } catch (err) {
        // Bảng chưa tồn tại → trả default, không crash
        res.json({ status: 'ok', data: { nguoilap: '', ke_toan: '', thu_truong: '' } });
    }
});

// POST /api/settings
router.post('/', requireLogin, async (req, res) => {
    try {
        for (const key of ALLOWED_KEYS) {
            if (key in req.body) {
                await pool.query(
                    'INSERT INTO mtp_settings (`key`,`value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value`=?',
                    [key, req.body[key] || '', req.body[key] || '']
                );
            }
        }
        res.json({ status: 'ok', msg: 'Đã lưu cài đặt' });
    } catch (err) {
        res.status(500).json({ status: 'error', msg: err.message });
    }
});

module.exports = router;
