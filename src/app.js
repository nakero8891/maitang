// src/app.js
'use strict';
const express = require('express');
const session = require('express-session');
const path    = require('path');
require('dotenv').config();

const authRouter     = require('./routes/auth');
const donviRouter    = require('./routes/donvi');
const hosoRouter     = require('./routes/hoso');
const baocaoRouter   = require('./routes/baocao');
const draftRouter    = require('./routes/draft');
const settingsRouter = require('./routes/settings');

const app    = express();
const PUBLIC = path.join(__dirname, '..', 'public');

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Session store dùng mysql2 (không cần package mới) ──
const mysql2 = require('mysql2/promise');

const DB_CFG = {
    host:             process.env.DB_HOST     || 'localhost',
    port:             Number(process.env.DB_PORT) || 3306,
    user:             process.env.DB_USER,
    password:         process.env.DB_PASSWORD,   // ← khớp với .env
    database:         process.env.DB_NAME,
    charset:          'utf8mb4',
};

async function initSessionTable() {
    try {
        const conn = await mysql2.createConnection(DB_CFG);
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS sessions (
                session_id VARCHAR(128) NOT NULL PRIMARY KEY,
                expires    INT(11) UNSIGNED NOT NULL,
                data       TEXT,
                INDEX idx_expires (expires)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        await conn.end();
        console.log('✅ Session table ready');
    } catch(e) {
        console.warn('⚠ Session table init failed:', e.message);
    }
}
initSessionTable();

class MysqlSessionStore extends session.Store {
    async _pool() {
        if (!this._p) this._p = mysql2.createPool({ ...DB_CFG, connectionLimit: 5 });
        return this._p;
    }

    async get(sid, cb) {
        try {
            const pool = await this._pool();
            const [[row]] = await pool.execute(
                'SELECT data FROM sessions WHERE session_id=? AND expires>?',
                [sid, Math.floor(Date.now() / 1000)]
            );
            cb(null, row ? JSON.parse(row.data) : null);
        } catch(e) { cb(null, null); }   // lỗi DB → coi như không có session, không crash
    }

    async set(sid, sess, cb) {
        try {
            const pool    = await this._pool();
            const maxAge  = sess.cookie?.maxAge || 28800000;
            const expires = Math.floor((Date.now() + maxAge) / 1000);
            await pool.execute(
                'INSERT INTO sessions (session_id,expires,data) VALUES (?,?,?) ON DUPLICATE KEY UPDATE expires=?,data=?',
                [sid, expires, JSON.stringify(sess), expires, JSON.stringify(sess)]
            );
            cb(null);
        } catch(e) { cb(null); }   // lỗi DB → không crash
    }

    async destroy(sid, cb) {
        try {
            const pool = await this._pool();
            await pool.execute('DELETE FROM sessions WHERE session_id=?', [sid]);
        } catch(e) { /* ignore */ }
        cb(null);
    }
}

// Dọn session hết hạn mỗi giờ
setInterval(async () => {
    try {
        const conn = await mysql2.createConnection(DB_CFG);
        await conn.execute('DELETE FROM sessions WHERE expires<?', [Math.floor(Date.now()/1000)]);
        await conn.end();
    } catch(e) { /* ignore */ }
}, 3600 * 1000);

app.use(session({
    key:               'mtp_session',
    secret:            process.env.SESSION_SECRET || 'change_me_please',
    store:             new MysqlSessionStore(),
    resave:            false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 8 * 3600 * 1000 },
}));

// Page routes
app.get('/login', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(path.join(PUBLIC, 'login.html'));
});
app.get('/', (req, res) => {
    if (!req.session?.user) return res.redirect('/login');
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(path.join(PUBLIC, 'index.html'));
});

app.use(express.static(PUBLIC));

app.use('/',             authRouter);
app.use('/api/donvi',    donviRouter);
app.use('/api/hoso',     hosoRouter);
app.use('/api/baocao',   baocaoRouter);
app.use('/api/draft',    draftRouter);
app.use('/api/settings', settingsRouter);

// ── Global error handler ── trả JSON thay vì HTML "Internal Server Error"
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ status: 'error', msg: err.message || 'Lỗi server' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MTP server running on port ${PORT}`));
