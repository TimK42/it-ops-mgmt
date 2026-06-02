const express = require('express');
const { getDb } = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const {
    status,
    category_id,
    search,
    tag,
    sort = 'newest',
    _page = 1,
    _per_page = 20,
  } = req.query;
  const page = Math.max(1, parseInt(_page) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(_per_page) || 20));

  let where = 'WHERE 1=1';
  const p = [];
  if (status) {
    where += ' AND q.status=?';
    p.push(status);
  }
  if (category_id) {
    where += ' AND q.category_id=?';
    p.push(category_id);
  }
  if (tag) {
    where += ' AND q.tags LIKE ?';
    p.push(`%${tag}%`);
  }
  if (search) {
    const clean = search.replace(/^#+/, '');
    where += ' AND (q.title LIKE ? OR q.question LIKE ? OR q.tags LIKE ?)';
    const s = `%${clean}%`;
    p.push(s, s, s);
  }

  const { total } = db
    .prepare(
      `SELECT COUNT(*) as total FROM qa_entries q LEFT JOIN categories c ON q.category_id = c.id ${where}`,
    )
    .get(...p);

  const order = sort === 'oldest' ? 'ASC' : 'DESC';
  const offset = (page - 1) * perPage;
  const sql = `SELECT q.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM qa_entries q LEFT JOIN categories c ON q.category_id = c.id ${where} ORDER BY q.created_at ${order} LIMIT ? OFFSET ?`;
  const data = db.prepare(sql).all(...p, perPage, offset);

  res.json({ data, total, page, per_page: perPage });
});

router.get('/:id', (req, res) => {
  const row = getDb()
    .prepare(
      `SELECT q.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM qa_entries q LEFT JOIN categories c ON q.category_id = c.id WHERE q.id=?`,
    )
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { title, question, answer, category_id, tags, status } = req.body;
  if (!title || !question) return res.status(400).json({ error: 'Title and question required' });
  const db = getDb();
  const last = db.prepare('SELECT qa_number FROM qa_entries ORDER BY id DESC LIMIT 1').get();
  const num = last
    ? String(parseInt(last.qa_number.replace('QA-', '')) + 1).padStart(4, '0')
    : '0006';
  const r = db
    .prepare(
      'INSERT INTO qa_entries (qa_number,title,question,answer,category_id,tags,status) VALUES (?,?,?,?,?,?,?)',
    )
    .run(
      `QA-${num}`,
      title,
      question || '',
      answer || '',
      category_id || null,
      tags || '',
      status || 'Published',
    );
  res.status(201).json({ id: r.lastInsertRowid, qa_number: `QA-${num}` });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { title, question, answer, category_id, tags, status } = req.body;
  if (!db.prepare('SELECT id FROM qa_entries WHERE id=?').get(req.params.id))
    return res.status(404).json({ error: 'Not found' });
  db.prepare(
    "UPDATE qa_entries SET title=COALESCE(?,title), question=COALESCE(?,question), answer=COALESCE(?,answer), category_id=COALESCE(?,category_id), tags=COALESCE(?,tags), status=COALESCE(?,status), updated_at=datetime('now') WHERE id=?",
  ).run(title, question, answer, category_id, tags, status, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM qa_entries WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
