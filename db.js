const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'it-ops.db');
let db;

function getDb() {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
    seedUsers();
    seedData();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6366f1',
      icon TEXT NOT NULL DEFAULT '📋',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS qa_entries (
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
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Viewer' CHECK(role IN ('Admin','Contributor','Viewer')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('active','pending','disabled')),
      must_change_password INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      expires TEXT NOT NULL,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
  `);

  // migrations: add must_change_password column if not present
  try {
    db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0');
  } catch (e) {
    // SQLite throws SQLITE_ERROR for duplicate column — ignore, re-throw everything else
    if (!e.message.includes('duplicate column')) throw e;
  }
}

function seedUsers() {
  if (db.prepare('SELECT COUNT(*) as c FROM users').get().c > 0) return;
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('0000', 10);
  db.prepare('INSERT INTO users (username, password, role, status) VALUES (?,?,?,?)').run(
    'admin',
    hash,
    'Admin',
    'active',
  );
}

function seedData() {
  if (db.prepare('SELECT COUNT(*) as c FROM categories').get().c > 0) return;

  const cats = [
    ['CAD', '#4f46e5', '📐'],
    ['GIS', '#16a34a', '🗺️'],
    ['PVNS', '#f97316', '📡'],
    ['ACOS', '#dc2626', '🛡️'],
  ];
  const catMap = {};
  for (const [n, c, i] of cats) {
    const r = db.prepare('INSERT INTO categories (name, color, icon) VALUES (?,?,?)').run(n, c, i);
    catMap[n] = r.lastInsertRowid;
  }

  const qas = [
    [
      'QA-0001',
      '如何重置使用者密碼',
      '使用者忘記密碼該如何處理？',
      'Step 1: 確認身分。Step 2: 至 Admin → User Management → Reset Password。Step 3: 產生一次性連結寄送。',
      'CAD',
      'password,account',
      'Published',
    ],
    [
      'QA-0002',
      'API 504 處理流程',
      'Gateway timeout 時如何回應客戶？',
      '1. 確認是否單一用戶問題。2. curl 測試。3. 全面性問題通報 on-call。4. 單一問題建議清除 DNS cache。',
      'GIS',
      'api,timeout',
      'Published',
    ],
    [
      'QA-0003',
      'VPN 連線設定',
      '如何連線公司內部 VPN？',
      'Windows: 設定 → VPN → 新增 → server.company.com。Mac: 系統偏好 → 網路 → VPN。使用公司憑證登入。',
      'PVNS',
      'vpn,remote',
      'Published',
    ],
    [
      'QA-0004',
      '登入異常基本檢查',
      '使用者反應無法登入時的先檢查項目',
      '1. 帳號未鎖定？2. 密碼未過期？3. 瀏覽器版本？4. 清除 cache。5. 試無痕模式。',
      'ACOS',
      'login',
      'Published',
    ],
    [
      'QA-0005',
      '報表匯出格式說明',
      '系統支援哪些報表匯出格式？',
      '支援 CSV、Excel (.xlsx)、PDF。CSV: 大量資料。Excel: 含格式。PDF: 正式報告。',
      'CAD',
      'report,export',
      'Draft',
    ],
  ];
  for (const q of qas) {
    db.prepare(
      'INSERT INTO qa_entries (qa_number,title,question,answer,category_id,tags,status) VALUES (?,?,?,?,?,?,?)',
    ).run(q[0], q[1], q[2], q[3], catMap[q[4]], q[5], q[6]);
  }
}

module.exports = { getDb };
