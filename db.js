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
    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      category_id INTEGER REFERENCES categories(id),
      status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','In Progress','Resolved','Closed')),
      priority TEXT NOT NULL DEFAULT '3' CHECK(priority IN ('1','2','3','4','5','6')),
      assignee TEXT DEFAULT '',
      resolution TEXT DEFAULT '',
      fraca INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
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

  const issues = [
    ['ISSUE-0001', '登入頁面 Safari 顯示異常', 'CSS flexbox 在 Safari 15 不支援，導致登入按鈕偏移', 'UI', 'Open', '1', 'Alex M.', '', 23001],
    ['ISSUE-0002', '訂單匯出 CSV 亂碼問題', '中文檔名在 Excel 開啟時出現亂碼，需加入 BOM', 'System', 'In Progress', '2', 'Sarah J.', '', 23015],
    ['ISSUE-0003', 'API 504 Timeout 處理', 'Gateway timeout 時回傳空白畫面', 'API', 'Resolved', '3', 'Tim C.', '已加入 retry 機制', 22998],
    ['ISSUE-0004', '報表下載按鈕點擊無反應', 'Chrome 116+ 新版下載 API 變更', 'UI', 'Open', '2', 'Jenny L.', '', 22985],
    ['ISSUE-0005', '忘記密碼流程客服回覆範本', '逐步引導客戶重置密碼', 'System', 'Resolved', '4', 'Alex M.', '已建立標準回覆腳本', 23010],
    ['ISSUE-0006', '搜尋結果頁面分頁不準確', '第 2 頁之後結果與搜尋條件不符', 'API', 'In Progress', '1', 'Sarah J.', '', 22972],
    ['ISSUE-0007', '資料庫連線池溢滿', '高峰期連線數超過 pool 上限', 'Database', 'Closed', '2', 'Tim C.', '已調整 pool size', 23003],
    ['ISSUE-0008', 'VPN 斷線通知延遲', '斷線後 30 分鐘才收到警報', 'Network', 'Open', '3', '', '', 23020],
    ['ISSUE-0009', '密碼變更後舊 session 未失效', '安全性漏洞', 'Security', 'Resolved', '1', 'Sarah J.', '已實作 token revoke', 22990],
    ['ISSUE-0010', '行事曆同步異常', 'Google Calendar 與內部系統時間差 1 小時', 'System', 'In Progress', '4', 'Jenny L.', '', 23011],
    ['ISSUE-0011', '系統備份排程未執行', 'cron job 因磁碟空間不足跳過備份', 'Database', 'Open', '2', 'Tim C.', '', 22977],
    ['ISSUE-0012', 'LDAP 認證逾時', '大量請求時 LDAP 查詢逾時', 'Security', 'Resolved', '3', 'Alex M.', '已加入連線池', 23005],
  ];
  for (const i of issues) {
    db.prepare('INSERT INTO issues (issue_number,title,description,category_id,status,priority,assignee,resolution,fraca) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(i[0], i[1], i[2], catMap[i[3]], i[4], i[5], i[6], i[7], i[8]);
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
