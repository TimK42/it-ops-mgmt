const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');
const { validatePassword } = require('../lib/password');

const router = Router();

// GET /api/auth/me — current user info
router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const db = getDb();
  const u = db
    .prepare('SELECT id, username, role, status, created_at FROM users WHERE id = ?')
    .get(req.session.userId);
  if (!u || u.status !== 'active') {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Account disabled' });
  }
  res.json({
    id: u.id,
    username: u.username,
    role: u.role,
    status: u.status,
    created_at: u.created_at,
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password, remember } = req.body;
  const isFormPost = req.is('application/x-www-form-urlencoded');
  if (!username || !password) {
    if (isFormPost) return res.redirect('/?error=missing');
    return res.status(400).json({ error: 'Username and password required' });
  }

  const db = getDb();
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!u || !bcrypt.compareSync(password, u.password)) {
    if (isFormPost) return res.redirect('/?error=invalid');
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (u.status === 'pending') {
    if (isFormPost) return res.redirect('/?error=pending');
    return res.status(403).json({ error: 'Account pending approval' });
  }
  if (u.status === 'disabled') {
    if (isFormPost) return res.redirect('/?error=disabled');
    return res.status(403).json({ error: 'Account disabled' });
  }

  req.session.userId = u.id;
  req.session.role = u.role;
  if (remember) req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  if (u.must_change_password) {
    if (isFormPost) return res.redirect('/?error=force-change');
    return res.json({
      id: u.id,
      username: u.username,
      role: u.role,
      must_change_password: true,
    });
  }
  if (isFormPost) return res.redirect('/qa');
  res.json({ id: u.id, username: u.username, role: u.role });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });
  if (username.length < 2) return res.status(400).json({ error: 'Username too short' });
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });
  const r = role || 'Viewer';
  if (!['Contributor', 'Viewer'].includes(r))
    return res.status(400).json({ error: 'Invalid role' });

  const db = getDb();
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'Username taken' });

  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (username, password, role) VALUES (?,?,?)').run(username, hash, r);
  res.status(201).json({ message: 'Registration submitted for approval' });
});

// POST /api/user/change-password (mounted at /api/auth AND /api/user — only /api/user/change-password is exposed via server.js)
router.post('/change-password', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const { currentPassword, newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ error: 'New password required' });

  const db = getDb();
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (u.status !== 'active')
    return res.status(403).json({ error: 'Account is disabled or pending' });

  // Forced change: skip currentPassword validation when must_change_password is set
  if (!u.must_change_password) {
    if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
    if (!bcrypt.compareSync(currentPassword, u.password))
      return res.status(400).json({ error: 'Current password is incorrect' });
  }

  const pwErr = validatePassword(newPassword);
  if (pwErr) return res.status(400).json({ error: pwErr });

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare(
    "UPDATE users SET password = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?",
  ).run(hash, req.session.userId);
  res.json({ ok: true });
});

module.exports = router;
