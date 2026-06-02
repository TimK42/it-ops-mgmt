const express = require('express');
const { getDb } = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.prepare(`SELECT c.*,
    (SELECT COUNT(*) FROM issues WHERE category_id=c.id) as issue_count,
    (SELECT COUNT(*) FROM qa_entries WHERE category_id=c.id) as qa_count
    FROM categories c ORDER BY c.name`).all());
});

router.post('/', (req, res) => {
  const { name, color, icon } = req.body;
  if (!name) return res.status(400).json({error:'Name required'});
  const r = getDb().prepare('INSERT INTO categories (name,color,icon) VALUES (?,?,?)').run(name, color||'#6b7280', icon||'📋');
  res.status(201).json({id: r.lastInsertRowid});
});

router.put('/:id', (req, res) => {
  const { name, color, icon } = req.body;
  getDb().prepare('UPDATE categories SET name=COALESCE(?,name), color=COALESCE(?,color), icon=COALESCE(?,icon) WHERE id=?')
    .run(name, color, icon, req.params.id);
  res.json({ok:true});
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
  res.json({ok:true});
});

module.exports = router;
