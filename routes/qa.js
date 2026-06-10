const express = require('express');
const { getDb } = require('../db');
const { VALID_STATUSES } = require('../shared/qa-status-constants');
const router = express.Router();

function getTagsForEntry(db, entryId) {
  return db
    .prepare(
      `SELECT t.name FROM tags t JOIN qa_entry_tags qt ON t.id = qt.tag_id WHERE qt.qa_entry_id = ? ORDER BY t.name`,
    )
    .all(entryId)
    .map((t) => t.name);
}

function setEntryTags(db, entryId, tags) {
  if (!tags || !Array.isArray(tags) || tags.length === 0) return;
  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const linkTag = db.prepare(
    'INSERT OR IGNORE INTO qa_entry_tags (qa_entry_id, tag_id) VALUES (?, (SELECT id FROM tags WHERE name = ?))',
  );
  const seen = new Set();
  for (const name of tags) {
    if (typeof name !== 'string') continue;
    const trimmed = name.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      insertTag.run(trimmed);
      linkTag.run(entryId, trimmed);
    }
  }
}

// Auth is handled by server.js middleware — roleGuard removed to avoid
// dual-authority drift (see server.js /api/qa middleware).
// Status transition guards (publish/unarchive Admin-only) remain inline.
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
    where +=
      ' AND q.id IN (SELECT qt.qa_entry_id FROM qa_entry_tags qt JOIN tags t ON t.id = qt.tag_id WHERE t.name LIKE ?)';
    p.push(`%${tag}%`);
  }
  if (search) {
    const clean = search.replace(/^#+/, '');
    where +=
      ' AND (q.title LIKE ? OR q.question LIKE ? OR q.answer LIKE ? OR c.name LIKE ? OR q.id IN (SELECT qt.qa_entry_id FROM qa_entry_tags qt JOIN tags t ON t.id = qt.tag_id WHERE t.name LIKE ?))';
    const s = `%${clean}%`;
    p.push(s, s, s, s, s);
  }

  const { total } = db
    .prepare(
      `SELECT COUNT(*) as total FROM qa_entries q LEFT JOIN categories c ON q.category_id = c.id ${where}`,
    )
    .get(...p);

  const offset = (page - 1) * perPage;
  let orderClause;
  if (sort === 'popular') {
    const { max_usage } = db.prepare('SELECT COALESCE(MAX(usage_count),0) as max_usage FROM qa_entries').get();
    if (max_usage === 0) {
      orderClause = 'ORDER BY q.created_at DESC';
    } else {
      const bucketSize = Math.max(1, Math.ceil(max_usage / 10.0));
      orderClause = `ORDER BY
        CASE
          WHEN q.usage_count = 0 THEN 1
          ELSE 1 + MIN(9, CAST((q.usage_count - 1) / ${bucketSize} AS INTEGER))
        END DESC,
        q.created_at DESC`;
    }
  } else {
    const order = sort === 'oldest' ? 'ASC' : 'DESC';
    orderClause = `ORDER BY q.created_at ${order}`;
  }
  const sql = `SELECT q.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM qa_entries q LEFT JOIN categories c ON q.category_id = c.id ${where} ${orderClause} LIMIT ? OFFSET ?`;
  const data = db.prepare(sql).all(...p, perPage, offset);

  // Batch-load tags for all entries
  if (data.length > 0) {
    const ids = data.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const tagRows = db
      .prepare(
        `SELECT qt.qa_entry_id, t.name FROM tags t JOIN qa_entry_tags qt ON t.id = qt.tag_id WHERE qt.qa_entry_id IN (${placeholders}) ORDER BY t.name`,
      )
      .all(...ids);
    const tagMap = {};
    for (const row of tagRows) {
      if (!tagMap[row.qa_entry_id]) tagMap[row.qa_entry_id] = [];
      tagMap[row.qa_entry_id].push(row.name);
    }
    for (const entry of data) {
      entry.tags = tagMap[entry.id] || [];
    }
  }

  res.json({ data, total, page, per_page: perPage });
});

router.get('/statuses', (req, res) => {
  res.json({ statuses: VALID_STATUSES });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT q.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM qa_entries q LEFT JOIN categories c ON q.category_id = c.id WHERE q.id=?`,
    )
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  row.tags = getTagsForEntry(db, row.id);
  db.prepare('UPDATE qa_entries SET usage_count = usage_count + 1 WHERE id = ?').run(req.params.id);
  res.json(row);
});

router.post('/', (req, res) => {
  const { title, question, answer, category_id, tags, status } = req.body;
  if (!title || !question) return res.status(400).json({ error: 'Title and question required' });

  // Validate status value
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res
      .status(400)
      .json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const db = getDb();
  const last = db.prepare('SELECT qa_number FROM qa_entries ORDER BY id DESC LIMIT 1').get();
  const num = last
    ? String(parseInt(last.qa_number.replace('QA-', '')) + 1).padStart(4, '0')
    : '0006';

  const runTransaction = db.transaction(() => {
    const r = db
      .prepare(
        'INSERT INTO qa_entries (qa_number,title,question,answer,category_id,status) VALUES (?,?,?,?,?,?)',
      )
      .run(
        `QA-${num}`,
        title,
        question || '',
        answer || '',
        category_id || null,
        status || 'Draft',
      );

    const entryId = r.lastInsertRowid;
    if (tags && Array.isArray(tags)) {
      setEntryTags(db, entryId, tags);
    }

    return { id: entryId, qa_number: `QA-${num}` };
  });

  const result = runTransaction();
  res.status(201).json(result);
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { title, question, answer, category_id, tags, status } = req.body;
  if (!db.prepare('SELECT id FROM qa_entries WHERE id=?').get(req.params.id))
    return res.status(404).json({ error: 'Not found' });

  // Validate status value before processing transitions
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res
      .status(400)
      .json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  // Role-based status transition guards
  if (status && req.session.role !== 'Admin') {
    // Only Admin can publish (status → Published)
    if (status === 'Published') {
      return res.status(403).json({ error: 'Only Admin can publish QA entries' });
    }
    // Only Admin can unarchive (setting status=Draft on an Archived entry)
    if (status === 'Draft') {
      const current = db.prepare('SELECT status FROM qa_entries WHERE id=?').get(req.params.id);
      if (current && current.status === 'Archived') {
        return res.status(403).json({ error: 'Only Admin can unarchive QA entries' });
      }
    }
  }

  const runTransaction = db.transaction(() => {
    db.prepare(
      "UPDATE qa_entries SET title=COALESCE(?,title), question=COALESCE(?,question), answer=COALESCE(?,answer), category_id=COALESCE(?,category_id), status=COALESCE(?,status), updated_at=datetime('now') WHERE id=?",
    ).run(title, question, answer, category_id, status, req.params.id);

    if (tags !== undefined) {
      db.prepare('DELETE FROM qa_entry_tags WHERE qa_entry_id = ?').run(req.params.id);
      if (Array.isArray(tags) && tags.length > 0) {
        setEntryTags(db, req.params.id, tags);
      }
    }
  });

  runTransaction();
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM qa_entries WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
