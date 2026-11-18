// src/middleware/auth.js

/** Bảo vệ các route API — trả JSON nếu chưa đăng nhập */
function requireLogin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  return res.status(401).json({ status: 'error', msg: 'Chưa đăng nhập hoặc không có quyền' });
}

/** Bảo vệ các route HTML — redirect về trang login */
function requireLoginPage(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  return res.redirect('/login');
}

module.exports = { requireLogin, requireLoginPage };
