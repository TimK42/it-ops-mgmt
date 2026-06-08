// Test: Issue #129 - Users table CHECK constraint updated to allow 'Editor' role
// The previous migration renamed Contributor → Editor via PRAGMA ignore_check_constraints
// but never updated the DDL CHECK constraint. This migration recreates the users table
// with CHECK(role IN ('Admin','Editor','Viewer')).
//
// Usage: node tests/test-issue129-editor-check.js

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

let passed = 0,
  failed = 0;
const failures = [];

function test(name) {
  process.stdout.write(`  ✓ ${name}\n`);
  passed++;
}

function testFail(name, msg) {
  process.stdout.write(`  FAIL ${name}: ${msg}\n`);
  failed++;
  failures.push(`${name}: ${msg}`);
}

// ── SQL for the OLD schema (with deprecated Contributor CHECK) ──
const OLD_SCHEMA = `
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
`;

// ── The migration block from db.js (copy-paste of the fix) ──
function applyMigration(db) {
  const userSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (userSchema && !userSchema.sql.includes("CHECK(role IN ('Admin','Editor','Viewer'))")) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'Viewer' CHECK(role IN ('Admin','Editor','Viewer')),
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('active','pending','disabled')),
          must_change_password INTEGER NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO users_new SELECT * FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
      `);
    } catch (e) {
      // Idempotent: if migration already ran, temp table may not exist
      if (!e.message.includes('no such table')) throw e;
    }
  }
}

function run() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'itops-test-129-'));
  const dbPath = path.join(tmpDir, 'test.db');
  const db = new Database(dbPath);

  try {
    // ═══ 1. Create OLD schema (before fix) ──
    db.exec(OLD_SCHEMA);

    // Verify old schema rejects Editor
    const oldSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
    try {
      db.prepare('INSERT INTO users (username, password, role) VALUES (?,?,?)').run(
        'editor_try', 'pass123', 'Editor',
      );
      testFail(
        'Editor rejection in old schema',
        'Editor INSERT should have been rejected by old CHECK constraint',
      );
    } catch (e) {
      if (e.message.includes('CHECK constraint failed')) {
        test('Old schema rejects role=Editor (Editor would fail without the fix)');
      } else {
        testFail('Editor rejection in old schema', `Unexpected error: ${e.message}`);
      }
    }

    // ═══ 2. Insert a Contributor row into old schema (simulates existing data) ──
    db.prepare('INSERT INTO users (username, password, role) VALUES (?,?,?)').run(
      'old_contrib', 'pass123', 'Contributor',
    );
    db.prepare('INSERT INTO users (username, password, role) VALUES (?,?,?)').run(
      'old_admin', 'pass123', 'Admin',
    );
    db.prepare('INSERT INTO users (username, password, role) VALUES (?,?,?)').run(
      'old_viewer', 'pass123', 'Viewer',
    );

    // ═══ 3. Run the rename migration (preceding migration in db.js) ──
    // This renames Contributor→Editor via PRAGMA before table recreation
    try {
      db.exec('PRAGMA ignore_check_constraints = ON');
      db.exec("UPDATE users SET role = 'Editor' WHERE role = 'Contributor'");
    } finally {
      db.exec('PRAGMA ignore_check_constraints = OFF');
    }

    // Verify old_contrib was renamed to Editor
    const renamedContrib = db.prepare("SELECT role FROM users WHERE username = 'old_contrib'").get();
    if (renamedContrib && renamedContrib.role === 'Editor') {
      test('Pre-migration rename: Contributor→Editor via PRAGMA ignore_check_constraints');
    } else {
      testFail('Pre-migration rename', `Expected Editor, got: ${JSON.stringify(renamedContrib)}`);
    }

    // ═══ 4. Run the table recreation migration ──
    applyMigration(db);

    // Verify schema was updated
    const migratedSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (migratedSchema.sql.includes("CHECK(role IN ('Admin','Editor','Viewer'))")) {
      test('Migration updates CHECK constraint to allow Editor');
    } else {
      testFail('Migration updates CHECK constraint', `Schema still lacks Editor: ${migratedSchema.sql}`);
    }

    // ═══ 5. Editor registration succeeds after migration ──
    try {
      db.prepare('INSERT INTO users (username, password, role) VALUES (?,?,?)').run(
        'new_editor', 'pass123', 'Editor',
      );
      test('Editor INSERT succeeds after migration');
    } catch (e) {
      testFail('Editor INSERT after migration', `Unexpected error: ${e.message}`);
    }

    // ═══ 6. Contributor role is still rejected (constraint compatibility) ──
    try {
      db.prepare('INSERT INTO users (username, password, role) VALUES (?,?,?)').run(
        'try_contrib', 'pass123', 'Contributor',
      );
      testFail(
        'Contributor rejection after migration',
        'Contributor INSERT should still be rejected',
      );
    } catch (e) {
      if (e.message.includes('CHECK constraint failed')) {
        test('Contributor INSERT rejected after migration (correct)');
      } else {
        testFail('Contributor rejection after migration', `Unexpected error: ${e.message}`);
      }
    }

    // ═══ 7. Data preservation ──
    const users = db.prepare('SELECT username, role FROM users ORDER BY username').all();
    const oldContrib = users.find((u) => u.username === 'old_contrib');
    if (oldContrib && oldContrib.role === 'Editor') {
      test('Existing data preserved: old Contributor row survives migration (renamed to Editor)');
    } else {
      testFail(
        'Data preservation (old_contrib)',
        `Expected old_contrib/Editor, got: ${JSON.stringify(oldContrib)}`,
      );
    }

    const oldAdmin = users.find((u) => u.username === 'old_admin');
    if (oldAdmin && oldAdmin.role === 'Admin') {
      test('Existing data preserved: old Admin row survives migration');
    } else {
      testFail(
        'Data preservation',
        `Expected old_admin/Admin, got: ${JSON.stringify(oldAdmin)}`,
      );
    }

    const oldViewer = users.find((u) => u.username === 'old_viewer');
    if (oldViewer && oldViewer.role === 'Viewer') {
      test('Existing data preserved: old Viewer row survives migration');
    } else {
      testFail(
        'Data preservation',
        `Expected old_viewer/Viewer, got: ${JSON.stringify(oldViewer)}`,
      );
    }

    // Verify row count (3 old rows + 1 new Editor = 4)
    const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    if (count === 4) {
      test(`All 4 rows present (3 pre-migration + 1 new Editor), got ${count}`);
    } else {
      testFail('Row count', `Expected 4 rows, got ${count}`);
    }

    // ═══ 8. Idempotency: running migration again doesn't throw ──
    try {
      applyMigration(db);
      test('Migration idempotent: second run does not throw');
    } catch (e) {
      testFail('Migration idempotency', `Second run threw: ${e.message}`);
    }

    // Verify schema still correct after second run
    const finalSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (finalSchema.sql.includes("CHECK(role IN ('Admin','Editor','Viewer'))")) {
      test('Schema remains correct after second migration run');
    } else {
      testFail('Schema after idempotent run', 'CHECK constraint missing after second migration');
    }

    // ═══ 9. Extra: ensure Admin/Viewer still work ──
    try {
      db.prepare('INSERT INTO users (username, password, role) VALUES (?,?,?)').run(
        'new_admin', 'pass123', 'Admin',
      );
      db.prepare('INSERT INTO users (username, password, role) VALUES (?,?,?)').run(
        'new_viewer', 'pass123', 'Viewer',
      );
      test('Admin and Viewer roles still accepted after migration');
    } catch (e) {
      testFail('Admin/Viewer acceptance', `Unexpected error: ${e.message}`);
    }

  } finally {
    db.close();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore cleanup errors */
    }
  }

  // ── Results ──
  const total = passed + failed;
  process.stdout.write(`\n${passed} / ${total} tests passed\n`);
  if (failed > 0) {
    process.stdout.write(`\nFailures:\n`);
    for (const f of failures) process.stdout.write(`  - ${f}\n`);
    process.exit(1);
  }
}

run();
