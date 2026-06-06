const express = require('express');
const { getDb } = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const tags = db
    .prepare(
      `
    SELECT t.name, COUNT(qt.qa_entry_id) as count
    FROM tags t
    LEFT JOIN qa_entry_tags qt ON t.id = qt.tag_id
    GROUP BY t.id, t.name
    ORDER BY count DESC, t.name ASC
  `,
    )
    .all();
  res.json(tags);
});

module.exports = router;
