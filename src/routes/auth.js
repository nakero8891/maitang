// src/routes/auth.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const pool    = require('../db/pool');
const router  = express.Router();

// POST /login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ status: 'error', msg: 'Thiếu tài khoản hoặc mật khẩu' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE username = ? LIMIT 1', [username]
    );
    if (!rows.length) {
      return res.status(401).json({ status: 'error', msg: 'Tài khoản không tồn tại' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ status: 'error', msg: 'Sai mật khẩu' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ status: 'error', msg: 'Không có quyền truy cập' });
    }
    req.session.user = {
      id:       user.id,
      username: user.username,
      fullname: user.fullname,
      role:     user.role,
    };
    return res.json({ status: 'ok', redirect: '/' });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ status: 'error', msg: 'Lỗi server: ' + err.message });
  }
});

// POST /logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ status: 'ok' }));
});

module.exports = router;
