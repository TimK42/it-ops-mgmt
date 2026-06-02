const express = require('express');
const { getDb } = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const { status, category_id, search, tag, sort='newest' } = req.query;
  let sql = `SELECT q.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM qa_entries q LEFT JOIN categories c ON q.category_id = c.id WHERE 1=1`;
  const p = [];
  if (status) { sql += ' AND q.status=?'; p.push(status); }
  if (category_id) { sql += ' AND q.category_id=?'; p.push(category_id); }
  if (tag) { sql += ' AND q.tags LIKE ?'; p.push(`%${tag}%`); }
  if (search) { 
    const clean = search.replace(/^#+/, ''); // strip # for tag matching
    sql += ' AND (q.title LIKE ? OR q.question LIKE ? OR q.tags LIKE ?)'; 
    const s=`%${clean}%`; p.push(s,s,s); 
  }
  sql += sort === 'oldest' ? ' ORDER BY q.created_at ASC' : ' ORDER BY q.created_at DESC';
  res.json(db.prepare(sql).all(...p));
});

router.get('/:id', (req, res) => {
  const row = getDb().prepare(`SELECT q.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM qa_entries q LEFT JOIN categories c ON q.category_id = c.id WHERE q.id=?`).get(req.params.id);
  if (!row) return res.status(404).json({error:'Not found'});
  res.json(row);
});

router.post('/', (req, res) => {
  const { title, question, answer, category_id, tags, status } = req.body;
  if (!title || !question) return res.status(400).json({error:'Title and question required'});
  const db = getDb();
  const last = db.prepare("SELECT qa_number FROM qa_entries ORDER BY id DESC LIMIT 1").get();
  const num = last ? String(parseInt(last.qa_number.replace('QA-','')) + 1).padStart(4,'0') : '0006';
  const r = db.prepare('INSERT INTO qa_entries (qa_number,title,question,answer,category_id,tags,status) VALUES (?,?,?,?,?,?,?)')
    .run(`QA-${num}`, title, question||'', answer||'', category_id||null, tags||'', status||'Published');
  res.status(201).json({id: r.lastInsertRowid, qa_number: `QA-${num}`});
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { title, question, answer, category_id, tags, status } = req.body;
  if (!db.prepare('SELECT id FROM qa_entries WHERE id=?').get(req.params.id)) return res.status(404).json({error:'Not found'});
  db.prepare("UPDATE qa_entries SET title=COALESCE(?,title), question=COALESCE(?,question), answer=COALESCE(?,answer), category_id=COALESCE(?,category_id), tags=COALESCE(?,tags), status=COALESCE(?,status), updated_at=datetime('now') WHERE id=?")
    .run(title, question, answer, category_id, tags, status, req.params.id);
  res.json({ok:true});
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM qa_entries WHERE id=?').run(req.params.id);
  res.json({ok:true});
});

module.exports = router;
