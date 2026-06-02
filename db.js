const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'it-ops.db');
let db;

function getDb() {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
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
  `);
}

function seedData() {
  if (db.prepare('SELECT COUNT(*) as c FROM categories').get().c > 0) return;

  const cats = [
    ['UI', '#eab308', '🎨'], ['System', '#6366f1', '⚙'], ['API', '#16a34a', '🔌'],
    ['Database', '#dc2626', '🗄'], ['Network', '#f97316', '🌐'], ['Security', '#ef4444', '🔒'], ['General', '#6b7280', '📋'],
  ];
  const catMap = {};
  for (const [n, c, i] of cats) {
    const r = db.prepare('INSERT INTO categories (name, color, icon) VALUES (?,?,?)').run(n, c, i);
    catMap[n] = r.lastInsertRowid;
  }


  const qas = [
    ['QA-0001', '如何重置使用者密碼', '使用者忘記密碼該如何處理？', 'Step 1: 確認身分。Step 2: 至 Admin → User Management → Reset Password。Step 3: 產生一次性連結寄送。', 'System', 'password,account', 'Published'],
    ['QA-0002', 'API 504 處理流程', 'Gateway timeout 時如何回應客戶？', '1. 確認是否單一用戶問題。2. curl 測試。3. 全面性問題通報 on-call。4. 單一問題建議清除 DNS cache。', 'API', 'api,timeout', 'Published'],
    ['QA-0003', 'VPN 連線設定', '如何連線公司內部 VPN？', 'Windows: 設定 → VPN → 新增 → server.company.com。Mac: 系統偏好 → 網路 → VPN。使用公司憑證登入。', 'Network', 'vpn,remote', 'Published'],
    ['QA-0004', '登入異常基本檢查', '使用者反應無法登入時的先檢查項目', '1. 帳號未鎖定？2. 密碼未過期？3. 瀏覽器版本？4. 清除 cache。5. 試無痕模式。', 'UI', 'login', 'Published'],
    ['QA-0005', '報表匯出格式說明', '系統支援哪些報表匯出格式？', '支援 CSV、Excel (.xlsx)、PDF。CSV: 大量資料。Excel: 含格式。PDF: 正式報告。', 'System', 'report,export', 'Draft'],
  ];
  for (const q of qas) {
    db.prepare('INSERT INTO qa_entries (qa_number,title,question,answer,category_id,tags,status) VALUES (?,?,?,?,?,?,?)')
      .run(q[0], q[1], q[2], q[3], catMap[q[4]], q[5], q[6]);
  }
}

module.exports = { getDb };
