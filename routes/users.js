const { Router } = require('express');
const { getDb } = require('../db');

const router = Router();

// GET /api/users — list all users (Admin only)
router.get('/', (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, username, role, status, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

// POST /api/users/:id/approve
router.post('/:id/approve', (req, res) => {
  const db = getDb();
  const u = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  db.prepare("UPDATE users SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// POST /api/users/:id/reject
router.post('/:id/reject', (req, res) => {
  const db = getDb();
  const u = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  // Delete any sessions for this user
  res.json({ ok: true });
});

// POST /api/users/:id/toggle
router.post('/:id/toggle', (req, res) => {
  const db = getDb();
  const u = db.prepare('SELECT id, status FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  const next = u.status === 'disabled' ? 'active' : 'disabled';
  db.prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?").run(next, req.params.id);
  res.json({ ok: true, status: next });
});

module.exports = router;
