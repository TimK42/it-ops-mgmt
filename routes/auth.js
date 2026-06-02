const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');

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
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  const db = getDb();
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!u || !bcrypt.compareSync(password, u.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (u.status === 'pending') return res.status(403).json({ error: 'Account pending approval' });
  if (u.status === 'disabled') return res.status(403).json({ error: 'Account disabled' });

  req.session.userId = u.id;
  req.session.role = u.role;
  if (remember) req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
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
  if (password.length < 4) return res.status(400).json({ error: 'Password too short (min 4)' });
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

module.exports = router;
