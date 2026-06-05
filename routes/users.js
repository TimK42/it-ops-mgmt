const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');
const { validatePassword } = require('../lib/password');

const router = Router();

// GET /api/users — list all users (Admin only)
router.get('/', (req, res) => {
  const db = getDb();
  const users = db
    .prepare('SELECT id, username, role, status, created_at FROM users ORDER BY created_at DESC')
    .all();
  res.json(users);
});

// POST /api/users/create — Admin directly creates an active user
router.post('/create', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });
  if (username.length < 2) return res.status(400).json({ error: 'Username too short' });
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });
  const role = req.body.role || 'Viewer';
  if (!['Admin', 'Contributor', 'Viewer'].includes(role))
    return res.status(400).json({ error: 'Invalid role' });

  const db = getDb();
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'Username taken' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare("INSERT INTO users (username, password, role, status) VALUES (?,?,?,'active')")
    .run(username, hash, role);
  res.status(201).json({ id: info.lastInsertRowid, username, role, status: 'active' });
});

// POST /api/users/:id/approve
router.post('/:id/approve', (req, res) => {
  const db = getDb();
  const u = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  db.prepare("UPDATE users SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(
    req.params.id,
  );
  res.json({ ok: true });
});

// POST /api/users/:id/reject
router.post('/:id/reject', (req, res) => {
  const db = getDb();
  const u = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  // Existing sessions for this user will fail auth on next request (user deleted)
  res.json({ ok: true });
});

// POST /api/users/:id/toggle
router.post('/:id/toggle', (req, res) => {
  const db = getDb();
  const u = db.prepare('SELECT id, status FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  const next = u.status === 'disabled' ? 'active' : 'disabled';
  db.prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
    next,
    req.params.id,
  );
  res.json({ ok: true, status: next });
});

// PATCH /api/users/:id/password — Admin resets a user's password (forces change on next login + invalidates all sessions)
router.patch('/:id/password', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  const db = getDb();
  const u = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });

  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    "UPDATE users SET password = ?, must_change_password = 1, updated_at = datetime('now') WHERE id = ?",
  ).run(hash, req.params.id);

  // Delete all sessions for this user
  db.prepare("DELETE FROM sessions WHERE json_extract(data, '$.userId') = ?").run(
    Number(req.params.id),
  );

  res.json({ ok: true });
});

module.exports = router;
