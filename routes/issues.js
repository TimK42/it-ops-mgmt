const express = require('express');
const { getDb } = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const { status, priority, category_id, search, sort = 'newest' } = req.query;
  let sql = `SELECT i.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM issues i LEFT JOIN categories c ON i.category_id = c.id WHERE 1=1`;
  const p = [];
  if (status) { sql += ' AND i.status = ?'; p.push(status); }
  if (priority) { sql += ' AND i.priority = ?'; p.push(priority); }
  if (category_id) { sql += ' AND i.category_id = ?'; p.push(category_id); }
  if (search) { sql += ' AND (i.title LIKE ? OR i.description LIKE ?)'; const s = `%${search}%`; p.push(s, s); }
  sql += sort === 'oldest' ? ' ORDER BY i.created_at ASC' : ' ORDER BY i.created_at DESC';
  res.json(db.prepare(sql).all(...p));
});

router.get('/:id', (req, res) => {
  const row = getDb().prepare(`SELECT i.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM issues i LEFT JOIN categories c ON i.category_id = c.id WHERE i.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { title, description, category_id, status, priority, assignee, fraca } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const last = db.prepare("SELECT issue_number FROM issues ORDER BY id DESC LIMIT 1").get();
  const num = last ? String(parseInt(last.issue_number.replace('ISSUE-','')) + 1).padStart(4,'0') : '0013';
  const r = db.prepare('INSERT INTO issues (issue_number,title,description,category_id,status,priority,assignee,fraca) VALUES (?,?,?,?,?,?,?,?)')
    .run(`ISSUE-${num}`, title, description||'', category_id||null, status||'Open', priority||'Medium', assignee||'', fraca||null);
  res.status(201).json({ id: r.lastInsertRowid, issue_number: `ISSUE-${num}` });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { title, description, category_id, status, priority, assignee, resolution, fraca } = req.body;
  if (!db.prepare('SELECT id FROM issues WHERE id=?').get(req.params.id)) return res.status(404).json({error:'Not found'});
  db.prepare("UPDATE issues SET title=COALESCE(?,title), description=COALESCE(?,description), category_id=COALESCE(?,category_id), status=COALESCE(?,status), priority=COALESCE(?,priority), assignee=COALESCE(?,assignee), resolution=COALESCE(?,resolution), fraca=COALESCE(?,fraca), updated_at=datetime('now') WHERE id=?")
    .run(title, description, category_id, status, priority, assignee, resolution, fraca, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM issues WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
