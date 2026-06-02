const express = require('express');
const path = require('path');
const { getDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/qa', require('./routes/qa'));
app.use('/api/categories', require('./routes/categories'));

app.get('/api/stats', (req, res) => {
  const db = getDb();
  res.json({
    qa: { total: db.prepare('SELECT COUNT(*) as c FROM qa_entries').get().c },
    categories: db.prepare('SELECT COUNT(*) as c FROM categories').get().c,
  });
});

app.get('{*path}', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({error:'Not found'});
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`IT Ops Management running at http://localhost:${PORT}`);
  const db = getDb();
  console.log(`DB: ${db.prepare('SELECT COUNT(*) as c FROM qa_entries').get().c} QA entries, ${db.prepare('SELECT COUNT(*) as c FROM categories').get().c} categories`);
});
