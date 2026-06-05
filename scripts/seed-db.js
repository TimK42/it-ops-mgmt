const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dir = path.join(__dirname, 'data');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, 'it-ops.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT NOT NULL DEFAULT '📋',
  created_at TEXT DEFAULT (datetime('now'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS qa_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qa_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT DEFAULT '',
  category_id INTEGER REFERENCES categories(id),
  tags TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Published' CHECK(status IN ('Published','Draft','Archived')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Viewer' CHECK(role IN ('Admin','Contributor','Viewer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('active','pending','disabled')),
  created_at TEXT DEFAULT (datetime('now'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  expires INTEGER,
  data TEXT
)`);

const hash = bcrypt.hashSync('0000', 10);
db.prepare('INSERT OR IGNORE INTO users (username, password, role, status) VALUES (?, ?, ?, ?)').run('admin', hash, 'Admin', 'active');
db.prepare('INSERT OR IGNORE INTO users (username, password, role, status) VALUES (?, ?, ?, ?)').run('viewer', hash, 'Viewer', 'active');
db.prepare('INSERT OR IGNORE INTO categories (name, color, icon) VALUES (?, ?, ?)').run('Networking', '#6366f1', '🌐');
db.prepare('INSERT OR IGNORE INTO categories (name, color, icon) VALUES (?, ?, ?)').run('Security', '#ef4444', '🔒');
db.prepare('INSERT OR IGNORE INTO qa_entries (qa_number, title, question, answer, category_id, status) VALUES (?, ?, ?, ?, ?, ?)').run('QA-001', 'How to reset password', 'Steps for password reset?', 'Use the admin panel', 1, 'Published');
db.prepare('INSERT OR IGNORE INTO qa_entries (qa_number, title, question, answer, category_id, status) VALUES (?, ?, ?, ?, ?, ?)').run('QA-002', 'Firewall rules', 'How to configure firewall?', 'Add rules in the config', 2, 'Draft');
console.log('DB seeded!');
db.close();
