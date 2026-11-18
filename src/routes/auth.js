// src/routes/auth.js
'use strict';
const express = require('express');
const bcrypt  = require('bcryptjs');
const pool    = require('../db/pool');
const { requireLogin } = require('../middleware/auth');
const router  = express.Router();

router.post('/login', async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) {
    return res.status(400).json({ status: 'error', msg: 'Thiếu tài khoản hoặc mật khẩu' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE username = ? LIMIT 1', [username]
    );
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password))) {
      return res.status(401).json({ status: 'error', msg: 'Tài khoản hoặc mật khẩu không đúng' });
    }
    const user = rows[0];
    if (user.role !== 'admin') {
      return res.status(403).json({ status: 'error', msg: 'Không có quyền truy cập' });
    }
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regenerate error:', err);
        return res.status(500).json({ status: 'error', msg: 'Không thể tạo phiên đăng nhập' });
      }
      req.session.user = { id: user.id, username: user.username, fullname: user.fullname, role: user.role };
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.status(500).json({ status: 'error', msg: 'Không thể lưu phiên đăng nhập' });
        }
        return res.json({ status: 'ok', redirect: '/' });
      });
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ status: 'error', msg: 'Lỗi máy chủ' });
  }
});

router.get('/api/me', requireLogin, (req, res) => res.json(req.session.user));

router.post('/logout', (req, res, next) => {
  if (!req.session) return res.json({ status: 'ok' });
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('mtp_session', {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    });
    return res.json({ status: 'ok' });
  });
});

module.exports = router;
