#!/usr/bin/env bash
# Integration + Unit Test Suite for IT Ops Management
set +e

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$DIR")"
cd "$ROOT"
BASE="http://127.0.0.1:3199"
PASS=0; FAIL=0
pass() { PASS=$((PASS+1)); }
fail() { FAIL=$((FAIL+1)); echo "  FAIL $1"; }

# ── Helpers ──
login_admin() {
  curl -sf -X POST "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"0000"}' \
    -c /tmp/itops-ck.txt >/dev/null 2>&1
}

# ── Cleanup old server ──
kill $(lsof -ti:3199) 2>/dev/null || true
sleep 0.5

echo "===== UNIT TESTS ====="

echo ""
echo ">>> DB Module"
node -e "
const db = require('./db').getDb();
try {
  const cats = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
  const qas = db.prepare('SELECT COUNT(*) as c FROM qa_entries').get().c;
  const users = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (cats>=4) console.log('OK categories exist ('+cats+')');
  else console.log('FAIL categories too few: '+cats);
  if (qas>=5) console.log('OK qa_entries exist ('+qas+')');
  else console.log('FAIL qa_entries too few: '+qas);
  if (users>=1) console.log('OK users exist ('+users+')');
  else console.log('FAIL users too few: '+users);
} catch(e) { console.log('FAIL', e.message); }
" 2>&1 | while IFS= read -r line; do
  case "$line" in OK*) pass "$line";; FAIL*) fail "$line";; *) [ -n "$line" ] && echo "  $line";; esac
done

echo ""
echo ">>> DB Schema"
node -e "
const db = require('./db').getDb();
const tables = {categories:['id','name','color','icon'], qa_entries:['id','qa_number','title','question','answer','category_id','status'], users:['id','username','password','role','status'], sessions:['sid','expires','data'], tags:['id','name','created_at'], qa_entry_tags:['qa_entry_id','tag_id']};
for (const [table, cols] of Object.entries(tables)) {
  const actual = db.prepare('PRAGMA table_info('+table+')').all().map(r=>r.name);
  const missing = cols.filter(c => !actual.includes(c));
  if (missing.length) console.log('FAIL '+table+' missing: '+missing.join(','));
  else console.log('OK '+table+' schema ('+actual.length+' cols)');
}
" 2>&1 | while IFS= read -r line; do
  case "$line" in OK*) pass "$line";; FAIL*) fail "$line";; *) [ -n "$line" ] && echo "  $line";; esac
done

echo ""
echo ">>> Seed Data"
node -e "
const db = require('./db').getDb();
const admin = db.prepare(\"SELECT * FROM users WHERE username='admin'\").get();
if (!admin) { console.log('FAIL admin user not seeded'); process.exit(1); }
if (admin.role !== 'Admin') console.log('FAIL admin role='+admin.role);
else console.log('OK admin role=Admin');
if (admin.status !== 'active') console.log('FAIL admin status='+admin.status);
else console.log('OK admin status=active');
const cad = db.prepare(\"SELECT * FROM categories WHERE name='CAD'\").get();
if (!cad) console.log('FAIL CAD category not seeded');
else console.log('OK CAD category seeded');
const qa1 = db.prepare(\"SELECT * FROM qa_entries WHERE qa_number='QA-0001'\").get();
if (!qa1) console.log('FAIL QA-0001 not seeded');
else if (qa1.status !== 'Published') console.log('FAIL QA-0001 status='+qa1.status);
else console.log('OK QA-0001 seeded and Published');
" 2>&1 | while IFS= read -r line; do
  case "$line" in OK*) pass "$line";; FAIL*) fail "$line";; *) [ -n "$line" ] && echo "  $line";; esac
done

echo ""
echo ">>> Session Store"
node -e "
const SQLiteStore = require('./session-store');
const store = new SQLiteStore(require('./db').getDb());
if (typeof store.set !== 'function') console.log('FAIL no set method');
else if (typeof store.get !== 'function') console.log('FAIL no get method');
else if (typeof store.destroy !== 'function') console.log('FAIL no destroy method');
else if (typeof store.touch !== 'function') console.log('FAIL no touch method');
else console.log('OK session-store has get/set/destroy/touch');
" 2>&1 | while IFS= read -r line; do
  case "$line" in OK*) pass "$line";; FAIL*) fail "$line";; *) [ -n "$line" ] && echo "  $line";; esac
done

echo ""
echo ">>> Password Hashing"
node -e "
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('0000', 10);
if (bcrypt.compareSync('0000', hash)) console.log('OK bcrypt verify works');
else console.log('FAIL bcrypt verify broken');
if (!bcrypt.compareSync('wrong', hash)) console.log('OK bcrypt rejects wrong password');
else console.log('FAIL bcrypt accepted wrong password');
" 2>&1 | while IFS= read -r line; do
  case "$line" in OK*) pass "$line";; FAIL*) fail "$line";; *) [ -n "$line" ] && echo "  $line";; esac
done

echo ""
echo ">>> Mocha Unit Tests (Issue #55, #94, #107, #117, #121-123, #134, #137, #138, #142, #143, #144, #163, #177, #184, #188)"
MOCHA_OUTPUT=$(npx mocha tests/test-issue94-search.js tests/test-issue107-chips.js tests/test-issue117-export.js tests/test-issue121-123-archive-button.js tests/test-issue134-unarchive.js tests/test-issue137-pwa.js tests/test-issue138.js tests/test-issue142-darkmode.js tests/test-issue143.js tests/test-issue55-dashboard.js tests/test-issue163-screen-flash.js tests/test-issue177-sort.js tests/test-issue184-sticky-toolbar.js tests/test-issue188-rebootstrap.js tests/test-issue198-login-checkbox.js --timeout 60000 2>&1)
MOCHA_EXIT=$?
echo "$MOCHA_OUTPUT"
MOCHA_LINE=$(echo "$MOCHA_OUTPUT" | tail -3 | grep -E '[0-9]+ passing|[0-9]+ failing' | tail -1)
if [ -n "$MOCHA_LINE" ]; then
  MOCHA_PASS=$(echo "$MOCHA_LINE" | grep -oE '[0-9]+ passing' | grep -oE '[0-9]+')
  MOCHA_FAIL=$(echo "$MOCHA_LINE" | grep -oE '[0-9]+ failing' | grep -oE '[0-9]+')
  [ -n "$MOCHA_PASS" ] && pass "mocha: $MOCHA_PASS passing"
  [ -n "$MOCHA_FAIL" ] && [ "$MOCHA_FAIL" != "0" ] && fail "mocha: $MOCHA_FAIL failing"
fi
[ "$MOCHA_EXIT" -ne 0 ] && fail "mocha: exit code $MOCHA_EXIT"

echo ""
echo ">>> Standalone Node Tests"
# Issue #129: Editor CHECK constraint migration (standalone, uses node + better-sqlite3)
node tests/test-issue129-editor-check.js 2>&1
if [ $? -eq 0 ]; then
  pass "node: test-issue129-editor-check.js passed"
else
  fail "node: test-issue129-editor-check.js failed"
fi

# ── Start test server ──
echo ""
echo "===== INTEGRATION TESTS ====="
node -e "require('./server').listen(3199,'127.0.0.1',()=>console.log('SERVER_READY'))" &
SPID=$!
for i in $(seq 1 10); do
  curl -sf "$BASE/" >/dev/null 2>&1 && break
  sleep 0.3
done
echo "Server PID: $SPID"

echo ""
echo ">>> Static File Serving"
for path in / /css/style.css /js/app.js; do
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path")
  [ "$STATUS" = "200" ] && pass "GET $path => $STATUS" || fail "GET $path => $STATUS (expected 200)"
done
STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/nonexistent-page")
[ "$STATUS" = "404" ] && pass "GET /nonexistent-page => 404" || fail "GET /nonexistent-page => $STATUS (expected 404)"
CT=$(curl -s "$BASE/" | head -c 20)
echo "$CT" | grep -qi '<!doctype' && pass "Response is HTML document" || fail "Response is not HTML"

echo ""
echo ">>> Authentication"
# Admin login
login_admin
[ $? -eq 0 ] && pass "Login admin/0000" || fail "Login admin/0000 failed"

# /me with cookie
ME=$(curl -s "$BASE/api/auth/me" -b /tmp/itops-ck.txt)
echo "$ME" | grep -q '"username":"admin"' && pass "Auth /me returns admin" || fail "Auth /me failed: $(echo $ME | head -c 80)"

# Wrong password
WS=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' -d '{"username":"admin","password":"wrong"}')
[ "$WS" = "401" ] && pass "Wrong password => 401" || fail "Wrong password => $WS"

# Nonexistent user
NX=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' -d '{"username":"nobody","password":"x"}')
[ "$NX" = "401" ] && pass "Nonexistent user => 401" || fail "Nonexistent user => $NX"

# /me without cookie
NC=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/auth/me")
[ "$NC" = "401" ] && pass "/me no cookie => 401" || fail "/me no cookie => $NC"

echo ""
echo ">>> Registration"
TS=$(date +%s)
UV="ituv_$TS"
UC="ituc_$TS"
# Valid
R1=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$UV\",\"password\":\"Test1234!\",\"role\":\"Viewer\"}")
[ "$R1" = "201" ] && pass "Register Viewer => 201" || fail "Register Viewer => $R1"

# Duplicate
R2=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$UV\",\"password\":\"Test1234!\",\"role\":\"Viewer\"}")
[ "$R2" = "409" ] && pass "Register duplicate => 409" || fail "Register duplicate => $R2"

# Short username
R3=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/register" \
  -H 'Content-Type: application/json' -d '{"username":"x","password":"1234"}')
[ "$R3" = "400" ] && pass "Register short username => 400" || fail "Register short username => $R3"

# Short password
R4=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/register" \
  -H 'Content-Type: application/json' -d '{"username":"valid","password":"ab"}')
[ "$R4" = "400" ] && pass "Register short password => 400" || fail "Register short password => $R4"

# Pending account login blocked
R5=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$UV\",\"password\":\"Test1234!\"}")
[ "$R5" = "403" ] && pass "Pending account login => 403" || fail "Pending account login => $R5"

echo ""
echo ">>> Change Password"
# Create a temporary test user for change-password tests (admin pw stays 0000)
CPW_USER="cpwusr_$TS"
CPW_PASS="OrigP@ss1"
CPW_CREATE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/users/create" \
  -H 'Content-Type: application/json' \
  -b /tmp/itops-ck.txt \
  -d "{\"username\":\"$CPW_USER\",\"password\":\"$CPW_PASS\",\"role\":\"Viewer\"}")
[ "$CPW_CREATE" = "201" ] || { fail "CPW setup: create user => $CPW_CREATE"; exit 1; }

# Login as test user
CPW_CK="/tmp/itops-cpw.txt"
CPW_LOGIN=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$CPW_USER\",\"password\":\"$CPW_PASS\"}" \
  -c "$CPW_CK")
[ "$CPW_LOGIN" = "200" ] || { fail "CPW setup: login => $CPW_LOGIN"; exit 1; }

# Unauthenticated change password (no cookie)
CP1=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/user/change-password" \
  -H 'Content-Type: application/json' \
  -d '{"currentPassword":"x","newPassword":"y"}')
[ "$CP1" = "401" ] && pass "Change password no auth => 401" || fail "Change password no auth => $CP1"

# Wrong current password
CP2=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/user/change-password" \
  -H 'Content-Type: application/json' \
  -b "$CPW_CK" \
  -d '{"currentPassword":"wrongpass","newPassword":"Str0ng!New"}')
[ "$CP2" = "400" ] && pass "Change password wrong current => 400" || fail "Change password wrong current => $CP2"

# Weak new password (no uppercase)
CP3=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/user/change-password" \
  -H 'Content-Type: application/json' \
  -b "$CPW_CK" \
  -d '{"currentPassword":"OrigP@ss1","newPassword":"weak1234!"}')
[ "$CP3" = "400" ] && pass "Change password weak new => 400" || fail "Change password weak new => $CP3"

# Valid change password
CP4=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/user/change-password" \
  -H 'Content-Type: application/json' \
  -b "$CPW_CK" \
  -d '{"currentPassword":"OrigP@ss1","newPassword":"Str0ng!New"}')
[ "$CP4" = "200" ] && pass "Change password valid => 200" || fail "Change password valid => $CP4"

# Verify login with new password
CP5=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$CPW_USER\",\"password\":\"Str0ng!New\"}")
[ "$CP5" = "200" ] && pass "Login with new password => 200" || fail "Login with new password => $CP5"

echo ""
echo ">>> Role-Based Access Control"
# Re-login as admin (fresh session)
login_admin

# QA GET with admin cookie
QA=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/qa" -b /tmp/itops-ck.txt)
[ "$QA" = "200" ] && pass "QA GET as Admin => 200" || fail "QA GET as Admin => $QA"

# Categories with admin
CAT=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/categories" -b /tmp/itops-ck.txt)
[ "$CAT" = "200" ] && pass "Categories as Admin => 200" || fail "Categories as Admin => $CAT"

# Users with admin
USR=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/users" -b /tmp/itops-ck.txt)
[ "$USR" = "200" ] && pass "Users as Admin => 200" || fail "Users as Admin => $USR"

# Unauthenticated access
QN=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/qa")
[ "$QN" = "401" ] && pass "QA GET no cookie => 401" || fail "QA GET no cookie => $QN"

CN=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/categories")
[ "$CN" = "401" ] && pass "Categories no cookie => 401" || fail "Categories no cookie => $CN"

echo ""
echo ">>> API Stats"
login_admin
STATS=$(curl -s "$BASE/api/stats" -b /tmp/itops-ck.txt)
echo "$STATS" | grep -q '"qa"' && pass "Stats has qa count" || fail "Stats missing qa: $STATS"
echo "$STATS" | grep -q '"categories"' && pass "Stats has categories count" || fail "Stats missing categories: $STATS"

echo ""
echo ">>> Session Security"
# Fresh login, check headers
HH=$(curl -s -D - -o /dev/null -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"0000"}' 2>&1)
echo "$HH" | grep -qi 'HttpOnly' && pass "Cookie has HttpOnly" || fail "Cookie missing HttpOnly"
echo "$HH" | grep -qi 'SameSite=Lax' && pass "Cookie has SameSite=Lax" || fail "Cookie missing SameSite=Lax"

# Logout
LL=$(curl -s -X POST "$BASE/api/auth/logout" -b /tmp/itops-ck.txt)
echo "$LL" | grep -q '"ok":true' && pass "Logout returns ok" || fail "Logout failed: $LL"

echo ""
echo ">>> QA API Operations"
login_admin

# Single QA entry
Q1=$(curl -s "$BASE/api/qa/1" -b /tmp/itops-ck.txt)
echo "$Q1" | grep -q '"qa_number"' && pass "QA GET /1 returns data" || fail "QA GET /1 failed: $(echo $Q1 | head -c 80)"

# Nonexistent QA entry
Q404=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/qa/99999" -b /tmp/itops-ck.txt)
[ "$Q404" = "404" ] && pass "QA GET /99999 => 404" || fail "QA GET /99999 => $Q404"

# Create QA entry — use first real category ID
CAT_ID=$(node -e "console.log(require('./db').getDb().prepare('SELECT id FROM categories LIMIT 1').get().id)")
CREATE=$(curl -s -w '\n%{http_code}' -X POST "$BASE/api/qa" \
  -H 'Content-Type: application/json' \
  -b /tmp/itops-ck.txt \
  -d "{\"title\":\"Test Entry\",\"question\":\"Q?\",\"answer\":\"A\",\"category_id\":$CAT_ID}")
CR_CODE=$(echo "$CREATE" | tail -1)
if [ "$CR_CODE" = "201" ]; then
  pass "QA POST => 201"
  QID=$(echo "$CREATE" | head -1 | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
else
  fail "QA POST => $CR_CODE"
  QID=""
fi

# Update QA entry
if [ -n "$QID" ]; then
  UP=$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE/api/qa/$QID" \
    -H 'Content-Type: application/json' \
    -b /tmp/itops-ck.txt \
    -d '{"title":"Updated Title"}')
  [ "$UP" = "200" ] && pass "QA PUT /$QID => 200" || fail "QA PUT /$QID => $UP"
fi

# Delete QA entry
if [ -n "$QID" ]; then
  DL=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/qa/$QID" -b /tmp/itops-ck.txt)
  [ "$DL" = "200" ] && pass "QA DELETE /$QID => 200" || fail "QA DELETE /$QID => $DL"
fi

# Pagination
QP=$(curl -s "$BASE/api/qa?_page=1&_per_page=2" -b /tmp/itops-ck.txt)
echo "$QP" | grep -q '"total"' && pass "QA pagination returns total" || fail "QA pagination failed"
echo "$QP" | grep -q '"page":1' && pass "QA pagination page=1" || fail "QA pagination wrong page"

# Filter
QF=$(curl -s "$BASE/api/qa?status=Published&search=VPN" -b /tmp/itops-ck.txt)
echo "$QF" | grep -q '"data"' && pass "QA filter works" || fail "QA filter failed"

echo ""
echo ">>> QA Statuses (Issue #173)"
# GET /api/qa/statuses returns 200 with statuses array
QS=$(curl -s "$BASE/api/qa/statuses" -b /tmp/itops-ck.txt)
echo "$QS" | grep -q '"statuses"' && pass "QA statuses: JSON has statuses key" || fail "QA statuses: missing statuses key: $QS"
echo "$QS" | grep -q '"Draft"' && pass "QA statuses: includes Draft" || fail "QA statuses: missing Draft"
echo "$QS" | grep -q '"Published"' && pass "QA statuses: includes Published" || fail "QA statuses: missing Published"
echo "$QS" | grep -q '"Archived"' && pass "QA statuses: includes Archived" || fail "QA statuses: missing Archived"
# Verify exact count matches shared module (no extra statuses)
EXPECTED_COUNT=$(node -pe 'require("./shared/qa-status-constants").VALID_STATUSES.length')
echo "$QS" | node -e '
  const v=require("./shared/qa-status-constants").VALID_STATUSES;
  const d=JSON.parse(require("fs").readFileSync("/dev/stdin","utf8"));
  process.exit(d.statuses&&d.statuses.length===v.length?0:1);
' && pass "QA statuses: exactly ${EXPECTED_COUNT} statuses as expected" || {
  GOT_COUNT=$(echo "$QS" | node -pe 'JSON.parse(require("fs").readFileSync("/dev/stdin","utf8")).statuses.length')
  fail "QA statuses: expected ${EXPECTED_COUNT} statuses, got: ${GOT_COUNT}"
}

echo ""
echo ">>> HTML / JS / CSS Accessibility"
# Static HTML has skip-link + <main> (no-JS fallback a11y)
grep -q 'skip-link' public/index.html && pass "Static HTML: skip-link present" || fail "Static HTML: skip-link missing"
grep -q 'id="main-content"' public/index.html && pass "Static HTML: main-content id" || fail "Static HTML: main-content id missing"
grep -q '<main' public/index.html && pass "Static HTML: <main> landmark" || fail "Static HTML: <main> landmark missing"

JS=$(curl -sf "$BASE/js/app.js")
echo "$JS" | grep -q 'aria-label="Main navigation"' && pass "JS: nav aria-label" || fail "JS: nav aria-label"
echo "$JS" | grep -q 'main-content' && pass "JS: main-content id" || fail "JS: main-content id"
echo "$JS" | grep -q '<header class="topbar">' && pass "JS: topbar <header>" || fail "JS: topbar <header>"
echo "$JS" | grep -q 'for="global-search"' && pass "JS: search label for" || fail "JS: search label for"
echo "$JS" | grep -q 'type="search"' && pass 'JS: search type="search"' || fail 'JS: search type="search"'
echo "$JS" | grep -q 'inputmode="search"' && pass 'JS: search inputmode="search"' || fail 'JS: search inputmode="search"'
echo "$JS" | grep -q 'aria-label="Close"' && pass "JS: close aria-label" || fail "JS: close aria-label"
echo "$JS" | grep -q 'aria-label="Toggle sidebar"' && pass "JS: toggle aria-label" || fail "JS: toggle aria-label"
echo "$JS" | grep -q 'tabindex="0"' && fail "JS: has tabindex=0 (should be removed)" || pass "JS: no tabindex=0"
echo "$JS" | grep -q 'role="button"' && fail "JS: has role=button (should be removed)" || pass "JS: no role=button"
echo "$JS" | grep -q 'esc(t.trim())' && pass "JS: esc() XSS prevention" || fail "JS: esc() XSS prevention"
echo "$JS" | grep -q '<h1>' && pass "JS: h1 heading" || fail "JS: h1 heading"
echo "$JS" | grep -q 'autofocus' && pass "JS: autofocus" || fail "JS: autofocus"
echo "$JS" | grep -q '<div class="nav-item" onclick' && fail "JS: uses <div onclick> nav" || pass "JS: nav uses <button>"
echo "$JS" | grep -q '<button class="nav-item"' && pass "JS: nav <button> elements" || fail "JS: nav <button> missing"
echo "$JS" | grep -q 'for="auth-user"' && pass "JS: auth-user label" || fail "JS: auth-user label missing"
echo "$JS" | grep -q 'for="auth-pass"' && pass "JS: auth-pass label" || fail "JS: auth-pass label missing"
echo "$JS" | grep -q 'for="auth-role"' && pass "JS: auth-role label" || fail "JS: auth-role label missing"
echo "$JS" | grep -q 'skip-link' && pass "JS: skip-link present" || fail "JS: skip-link missing"
echo "$JS" | grep -q 'tabindex="-1"' && pass "JS: tabindex=-1 for main" || fail "JS: tabindex=-1 missing"
echo "$JS" | grep -q 'onkeydown=' || echo "$JS" | grep -q 'onkeyup=' && fail "JS: has inline keyboard handlers" || pass "JS: no inline keyboard handlers"

CSS=$(curl -sf "$BASE/css/style.css")
echo "$CSS" | grep -q '.skip-link' && pass "CSS: .skip-link" || fail "CSS: .skip-link"
echo "$CSS" | grep -q ':focus-visible' && pass "CSS: :focus-visible" || fail "CSS: :focus-visible"
echo "$CSS" | grep -qE 'background:\s*transparent' && pass "CSS: background:transparent" || fail "CSS: background:transparent"
echo "$JS" | node -e 'var d=require("fs").readFileSync("/dev/stdin","utf8");var n=d.indexOf("</nav>");var f=d.indexOf("<footer");process.exit(n>=0&&f>=0&&n<f?0:1);' && pass "JS: </nav> before <footer> (issue #181)" || fail "JS: </nav> before <footer> (issue #181)"
echo "$JS" | grep -q '<footer role="contentinfo"' && pass 'JS: footer role="contentinfo" (issue #181)' || fail 'JS: footer role="contentinfo" missing (issue #181)'
echo "$JS" | grep -q '<div class="sidebar-footer-user">' && echo "$JS" | grep -q 'IT Operations KB v' && pass "JS: sidebar version div (issue #181)" || fail "JS: sidebar version div missing (issue #181)"
echo "$CSS" | grep -q 'page-footer' && pass "CSS: .page-footer selector present (issue #181)" || fail "CSS: .page-footer selector missing (issue #181)"
echo "$CSS" | grep -q 'sidebar-footer-user' && pass "CSS: .sidebar-footer-user styles (issue #181)" || fail "CSS: .sidebar-footer-user styles missing (issue #181)"

echo ""
echo ">>> QA Detail SPA Routes"
# R4-H1: /qa/1 should serve SPA shell
QAD=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/qa/1")
[ "$QAD" = "404" ] && pass "GET /qa/1 => 404 (SPA catch-all)" || fail "GET /qa/1 => $QAD (expected 404)"
curl -s "$BASE/qa/1" | grep -q '<div id="app"' && pass "GET /qa/1: app shell present" || fail "GET /qa/1: missing app shell"

# R4-H2: /categories should serve SPA shell
CATR=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/categories")
[ "$CATR" = "404" ] && pass "GET /categories => 404 (SPA catch-all)" || fail "GET /categories => $CATR (expected 404)"
curl -s "$BASE/categories" | grep -q '<div id="app"' && pass "GET /categories: app shell present" || fail "GET /categories: missing app shell"

echo ""
echo ">>> QA Detail Fix Code Checks"
# R4-H2 fix: navigate() must close modal (verified by node index/slice check)
echo "$JS" | grep -q 'function navigate(page)' && pass "JS: navigate() function exists" || fail "JS: navigate() function missing"
echo "$JS" > /tmp/check_nav.js
node -e "
var js = require('fs').readFileSync('/tmp/check_nav.js','utf8');
var s = js.indexOf('function navigate(page)');
var body = s >= 0 ? js.slice(s, s + 400) : '';
process.exit(body.includes(\"closeModal('detail-modal')\") ? 0 : 1);
" && pass "JS: closeModal(detail-modal) inside navigate()" || fail "JS: closeModal(detail-modal) missing in navigate()"
# R4-H1 fix: showQADetail() must clear page-content
echo "$JS" | grep -q "page-content').innerHTML = ''" && pass "JS: showQADetail() clears page-content" || fail "JS: showQADetail() missing page-content clear"

# Issue #105: edit form X button fix
echo "$JS" > /tmp/check_105.js
node -e '
var js = require("fs").readFileSync("/tmp/check_105.js","utf8");
// Check 1: editQaId is set inside showCreateQA() (not just referenced in handler)
var setLine = "modal.dataset.editQaId = isEdit ? String(data.id) : \x27\x27";
var sf = js.indexOf("async function showCreateQA");
var sqEnd = js.indexOf("async function editQA", sf);
var showQA = sqEnd > 0 ? js.slice(sf, sqEnd) : js.slice(sf);
if (!showQA.includes(setLine)) process.exit(1);
// Check 2: delete editQaId in submit handler (not just Cancel)
var submitIdx = js.indexOf("getElementById(\x27f-q-submit\x27).onclick");
var closeIdx = js.indexOf("closeModal(\x27form-modal\x27)", submitIdx);
var subChunk = submitIdx > 0 ? js.slice(submitIdx, closeIdx) : "";
if (!subChunk.includes("delete modal.dataset.editQaId")) process.exit(1);
// Check 3: close-modal handler checks editQaId
var cm = js.indexOf("case \x27close-modal\x27");
var chunk = js.slice(cm, cm + 300);
if (!chunk.includes("form-modal") || !chunk.includes("editQaId")) process.exit(1);
process.exit(0);
' && pass "JS: #105 X button fix (editQaId set in showCreateQA, cleared on submit, checked in close-modal)" || fail "JS: #105 X button fix failed checks"

# ── Cleanup ──
kill $SPID 2>/dev/null

echo ""
echo "=================================================="
echo "RESULTS: $PASS passed, $FAIL failed"
echo "=================================================="
[ $FAIL -eq 0 ] && echo "ALL TESTS PASSED" || echo "SOME TESTS FAILED"
exit $FAIL
