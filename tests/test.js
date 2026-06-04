// Integration test runner for IT Ops Management
// Usage: node tests/test.js
// Starts server, runs tests, exits with code

const http = require('http');
const fs = require('fs');
const path = require('path');

let passed = 0,
  failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) passed++;
  else {
    failed++;
    failures.push(msg);
    process.stdout.write('  FAIL ' + msg + '\n');
  }
}

function req(method, urlPath, opts = {}) {
  return new Promise((resolve) => {
    const headers = {};
    if (opts.formBody) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (opts.body) {
      headers['Content-Type'] = opts.contentType || 'application/json';
    }
    if (opts.cookie) headers['Cookie'] = opts.cookie;

    const r = http.request(
      {
        hostname: '127.0.0.1',
        port: 3199,
        path: urlPath,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString();
          let json = null;
          try {
            json = JSON.parse(body);
          } catch {
            /* empty */
          }
          const setCookie = res.headers['set-cookie'] || [];
          resolve({
            status: res.statusCode,
            body,
            json,
            setCookie: Array.isArray(setCookie) ? setCookie : [setCookie],
            headers: res.headers,
          });
        });
      },
    );
    r.on('error', () => resolve({ status: -1, body: '', json: null, setCookie: [], headers: {} }));
    if (opts.formBody) {
      const qs = Object.entries(opts.formBody)
        .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
        .join('&');
      r.write(qs);
    } else if (opts.body) {
      r.write(opts.contentType ? JSON.stringify(opts.body) : JSON.stringify(opts.body));
    }
    r.end();
  });
}

async function login(username = 'admin', password = '0000') {
  const r = await req('POST', '/api/auth/login', {
    body: { username, password },
  });
  return r.setCookie[0]?.split(';')[0] || '';
}

async function run() {
  // ── Start server ──
  const { spawn } = require('child_process');
  const server = spawn(
    'node',
    ['-e', "require('./server').listen(3199,'127.0.0.1',()=>console.log('ready'))"],
    {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  await new Promise((ok) => {
    server.stdout.on('data', (d) => {
      if (d.toString().includes('ready')) ok();
    });
  });

  try {
    // ═══ STATIC FILES ═══
    console.log('\n>>> Static Files');
    let r = await req('GET', '/');
    assert(r.status === 200, 'GET / => 200');
    assert(
      (r.headers['content-type'] || '').includes('text/html'),
      'GET / => Content-Type includes html',
    );

    r = await req('GET', '/css/style.css');
    assert(r.status === 200, 'GET /css/style.css => 200');

    r = await req('GET', '/js/app.js');
    assert(r.status === 200, 'GET /js/app.js => 200');

    // ═══ SPA REGISTER ROUTE ═══
    console.log('\n>>> SPA Register Route');
    r = await req('GET', '/register');
    assert(r.status === 200, 'GET /register => 200');
    assert(
      (r.headers['content-type'] || '').includes('text/html'),
      'GET /register => Content-Type includes html',
    );
    assert(r.body.includes('<div id="app"'), 'GET /register => contains app shell');

    // ═══ NO-JS FALLBACK ═══
    console.log('\n>>> No-JS Fallback');
    r = await req('GET', '/');
    assert(r.body.includes('id="login-fallback"'), 'GET / => login fallback present');
    assert(r.body.includes('id="login-form"'), 'GET / => login form present');
    r = await req('GET', '/nonexistent-page');
    assert(r.status === 404, 'Catch-all => 404');
    assert(r.body.includes('id="login-fallback"'), 'Catch-all 404 => login fallback present');

    // ═══ AUTH ═══
    console.log('\n>>> Auth');
    let cookie = await login('admin', '0000');
    assert(cookie.length > 0, 'Login admin/0000 sets cookie');

    r = await req('GET', '/api/auth/me', { cookie });
    assert(r.status === 200, 'Auth /me => 200');
    assert(r.json?.username === 'admin', 'Auth /me returns admin');

    r = await req('POST', '/api/auth/login', {
      body: { username: 'admin', password: 'wrong' },
    });
    assert(r.status === 401, 'Wrong password => 401');

    r = await req('POST', '/api/auth/login', {
      body: { username: 'nobody', password: 'x' },
    });
    assert(r.status === 401, 'Nonexistent user => 401');

    r = await req('GET', '/api/auth/me');
    assert(r.status === 401, '/me without cookie => 401');

    // Form POST (no-JS fallback)
    r = await req('POST', '/api/auth/login', {
      formBody: { username: 'admin', password: '0000' },
    });
    assert(r.status === 302, 'Form login POST correct => 302');
    assert(r.headers['location'] === '/qa', 'Form login redirect => /qa');

    r = await req('POST', '/api/auth/login', {
      formBody: { username: 'admin', password: 'wrong' },
    });
    assert(r.status === 302, 'Form login wrong pw => 302');
    assert(r.headers['location'] === '/?error=invalid', 'Form login wrong pw => /?error=invalid');

    r = await req('POST', '/api/auth/login', {
      formBody: { username: '', password: '' },
    });
    assert(r.status === 302, 'Form login empty fields => 302');
    assert(r.headers['location'] === '/?error=missing', 'Form login empty => /?error=missing');

    // ═══ REGISTRATION ═══
    console.log('\n>>> Registration');
    r = await req('POST', '/api/auth/register', {
      body: { username: 'node_test_v', password: 'test1234', role: 'Viewer' },
    });
    assert(r.status === 201, 'Register Viewer => 201');

    r = await req('POST', '/api/auth/register', {
      body: { username: 'node_test_v', password: 'test1234', role: 'Viewer' },
    });
    assert(r.status === 409, 'Register duplicate => 409');

    r = await req('POST', '/api/auth/register', {
      body: { username: 'x', password: '1234', role: 'Viewer' },
    });
    assert(r.status === 400, 'Register short username => 400');

    r = await req('POST', '/api/auth/register', {
      body: { username: 'validuser', password: 'ab', role: 'Viewer' },
    });
    assert(r.status === 400, 'Register short password => 400');

    // Admin role should be rejected during registration
    r = await req('POST', '/api/auth/register', {
      body: { username: `admin_test_${Date.now()}`, password: 'test1234', role: 'Admin' },
    });
    assert(r.status === 400, 'Register with Admin role => 400');
    assert(r.json?.error === 'Invalid role', 'Register Admin => error message is Invalid role');

    // Pending account login blocked
    r = await req('POST', '/api/auth/login', {
      body: { username: 'node_test_v', password: 'test1234' },
    });
    assert(r.status === 403, 'Pending account login => 403');

    // ═══ RBAC ═══
    console.log('\n>>> Role-Based Access');
    cookie = await login('admin', '0000');

    r = await req('GET', '/api/qa', { cookie });
    assert(r.status === 200, 'QA GET Admin => 200');

    r = await req('GET', '/api/categories', { cookie });
    assert(r.status === 200, 'Categories Admin => 200');

    r = await req('GET', '/api/users', { cookie });
    assert(r.status === 200, 'Users Admin => 200');

    r = await req('GET', '/api/qa');
    assert(r.status === 401, 'QA GET no auth => 401');

    r = await req('GET', '/api/categories');
    assert(r.status === 401, 'Categories no auth => 401');

    // ═══ API STATS ═══
    console.log('\n>>> API Stats');
    r = await req('GET', '/api/stats', { cookie });
    assert(r.status === 200, 'Stats => 200');
    assert(r.json?.qa !== undefined, 'Stats has qa count');
    assert(r.json?.categories !== undefined, 'Stats has categories count');

    // ═══ SESSION SECURITY ═══
    console.log('\n>>> Session Security');
    r = await req('POST', '/api/auth/login', {
      body: { username: 'admin', password: '0000' },
    });
    const cookieStr = r.setCookie[0] || '';
    assert(cookieStr.includes('HttpOnly'), 'Cookie has HttpOnly');
    assert(cookieStr.includes('SameSite=Lax'), 'Cookie has SameSite=Lax');

    // Logout
    cookie = await login('admin', '0000');
    r = await req('POST', '/api/auth/logout', { cookie });
    assert(r.json?.ok === true, 'Logout returns ok');

    // ═══ QA API CRUD ═══
    console.log('\n>>> QA API Operations');
    cookie = await login('admin', '0000');

    r = await req('GET', '/api/qa/1', { cookie });
    assert(r.status === 200, 'QA GET /1 => 200');
    assert(r.json?.qa_number, 'QA /1 has qa_number');

    r = await req('GET', '/api/qa/99999', { cookie });
    assert(r.status === 404, 'QA GET /99999 => 404');

    // Get real category ID for testing
    let catId = 1;
    try {
      const db = require('../db').getDb();
      const cat = db.prepare('SELECT id FROM categories LIMIT 1').get();
      if (cat) catId = cat.id;
    } catch {
      /* empty */
    }

    r = await req('POST', '/api/qa', {
      cookie,
      body: {
        title: 'Test Entry',
        question: 'Q?',
        answer: 'A',
        category_id: catId,
      },
    });
    assert(r.status === 201, 'QA POST => 201');
    const newId = r.json?.id;

    if (newId) {
      r = await req('PUT', `/api/qa/${newId}`, {
        cookie,
        body: { title: 'Updated' },
      });
      assert(r.status === 200, `QA PUT /${newId} => 200`);

      r = await req('DELETE', `/api/qa/${newId}`, { cookie });
      assert(r.status === 200, `QA DELETE /${newId} => 200`);
    }

    r = await req('GET', '/api/qa?_page=1&_per_page=2', { cookie });
    assert(r.status === 200, 'QA pagination => 200');
    assert(r.json?.total !== undefined, 'QA pagination has total');
    assert(r.json?.page === 1, 'QA pagination page=1');

    r = await req('GET', '/api/qa?status=Published&search=VPN', { cookie });
    assert(r.status === 200, 'QA filter works');

    // ═══ ACCESSIBILITY ═══
    console.log('\n>>> Accessibility');

    // Static HTML has skip-link (no-JS fallback a11y)
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf-8');
    assert(html.includes('skip-link'), 'Static HTML: skip-link present');
    assert(html.includes('id="main-content"'), 'Static HTML: main-content id present');
    assert(html.includes('<main'), 'Static HTML: <main> landmark present');

    // JS checks
    r = await req('GET', '/js/app.js');
    const js = r.body;
    assert(js.includes('aria-label="Main navigation"'), 'JS: nav aria-label');
    assert(js.includes('<header class="topbar">'), 'JS: topbar <header>');
    assert(js.includes('main-content'), 'JS: main-content id');
    assert(js.includes('for="global-search"'), 'JS: search label for');
    assert(js.includes('type="search"'), 'JS: search type="search"');
    assert(js.includes('inputmode="search"'), 'JS: search inputmode="search"');
    assert(js.includes('aria-label="Close"'), 'JS: close aria-label');
    assert(js.includes('aria-label="Toggle sidebar"'), 'JS: toggle aria-label');
    assert(js.includes('aria-label="Toggle theme"'), 'JS: theme toggle aria-label');
    assert(js.includes('aria-pressed='), 'JS: theme toggle aria-pressed');
    assert(!js.includes('tabindex="0"'), 'JS: no tabindex=0 on interactive elements');
    assert(!js.includes('role="button"'), 'JS: no role=button on interactive elements');
    assert(js.includes('esc(t.trim())'), 'JS: esc() XSS prevention');
    assert(js.includes('<h1>'), 'JS: h1 heading');
    assert(js.includes('autofocus'), 'JS: autofocus');
    assert(
      !js.includes('<div class="nav-item" onclick'),
      'JS: nav uses <button> not <div onclick>',
    );
    assert(js.includes('<button class="nav-item"'), 'JS: nav <button> elements');
    assert(js.includes('for="auth-user"'), 'JS: auth-user label present');
    assert(js.includes('for="auth-pass"'), 'JS: auth-pass label present');
    assert(js.includes('for="auth-role"'), 'JS: auth-role label present');
    assert(js.includes('skip-link'), 'JS: skip-link present');
    assert(js.includes('tabindex="-1"'), 'JS: tabindex=-1 for main');
    assert(
      !js.includes('onkeydown=') && !js.includes('onkeyup='),
      'JS: no inline keyboard handlers',
    );

    // CSS checks
    r = await req('GET', '/css/style.css');
    const css = r.body;
    assert(css.includes('.skip-link'), 'CSS: .skip-link');
    assert(css.includes(':focus-visible'), 'CSS: :focus-visible');
    assert(
      css.includes('background: transparent'),
      'CSS: background: transparent (Prettier format)',
    );

    // Mobile overflow fix (#61) CSS checks
    assert(css.includes('overflow-x: hidden'), 'CSS: .modal-body overflow-x hidden (#61)');
    assert(
      css.includes('max-width: 100%') &&
        css.includes('.detail-section-content') &&
        css.indexOf('word-break: break-word', css.indexOf('.detail-section-content')) <
          css.indexOf('}', css.indexOf('.detail-section-content')),
      'CSS: .detail-section-content word-break inside block (#61)',
    );
    assert(
      css.includes('.admin-table td[data-label]:before'),
      'CSS: mobile card layout with data-label pseudo-elements (#61)',
    );
    assert(
      css.includes('.color-hex-label') &&
        css
          .slice(css.indexOf('.color-hex-label'), css.indexOf('}', css.indexOf('.color-hex-label')))
          .includes('clip: rect(0, 0, 0, 0)'),
      'CSS: .color-hex-label clip inside block (#61)',
    );

    // ═══ QA DETAIL SPA ROUTE (R4-H1) ═══
    console.log('\n>>> QA Detail SPA Route');
    r = await req('GET', '/qa/1');
    // SPA catch-all route returns 404 with app shell for non-static paths
    assert(r.status === 404, 'GET /qa/1 => 404 (SPA catch-all)');
    assert(
      (r.headers['content-type'] || '').includes('text/html'),
      'GET /qa/1 => Content-Type includes html',
    );
    assert(r.body.includes('<div id="app"'), 'GET /qa/1 => contains app shell');
    assert(r.body.includes('id="login-fallback"'), 'GET /qa/1 => login fallback present');
    assert(r.body.includes('skip-link'), 'GET /qa/1 => skip-link present');

    // ═══ SPA CATEGORIES ROUTE (R4-H2) ═══
    console.log('\n>>> SPA Categories Route');
    r = await req('GET', '/categories');
    assert(r.status === 404, 'GET /categories => 404 (SPA catch-all)');
    assert(
      (r.headers['content-type'] || '').includes('text/html'),
      'GET /categories => Content-Type includes html',
    );
    assert(r.body.includes('<div id="app"'), 'GET /categories => contains app shell');
    assert(r.body.includes('skip-link'), 'GET /categories => skip-link present');

    // ═══ QA DETAIL FIX CODE CHECK (R4-H1 & R4-H2) ═══
    console.log('\n>>> QA Detail Fix Code');
    r = await req('GET', '/js/app.js');
    const appjs = r.body;
    // R4-H2: navigate() must close modal before changing page
    // Check closeModal appears inside navigate() body (first 400 chars)
    const navStart = appjs.indexOf('function navigate(page)');
    assert(navStart >= 0, 'JS: navigate() function exists');
    const navBody = appjs.slice(navStart, navStart + 400);
    assert(
      navBody.includes("closeModal('detail-modal')"),
      'JS: closeModal(detail-modal) called inside navigate() body',
    );
    // R4-H1: showQADetail() must clear page-content before loading QA detail
    assert(
      appjs.includes("page-content').innerHTML = ''"),
      'JS: showQADetail() clears page-content before rendering',
    );
    // closeModal function must still exist
    assert(appjs.includes('function closeModal('), 'JS: closeModal() function exists');

    // Mobile overflow fix (#61) JS checks
    assert(
      appjs.includes('data-label="Username"'),
      'JS: renderUsers() data-label for Username (#61)',
    );
    assert(appjs.includes('data-label="Role"'), 'JS: renderUsers() data-label for Role (#61)');
    assert(appjs.includes('data-label="Status"'), 'JS: renderUsers() data-label for Status (#61)');
    assert(
      appjs.includes('data-label="Created"'),
      'JS: renderUsers() data-label for Created (#61)',
    );
    assert(appjs.includes('data-label="Icon"'), 'JS: renderCategories() data-label for Icon (#61)');
    assert(appjs.includes('data-label="Name"'), 'JS: renderCategories() data-label for Name (#61)');
    assert(
      appjs.includes('data-label="Color"'),
      'JS: renderCategories() data-label for Color (#61)',
    );
    assert(appjs.includes('data-label="QA"'), 'JS: renderCategories() data-label for QA (#61)');
    assert(
      appjs.includes('class="color-hex-label"'),
      'JS: renderCategories() wraps hex in color-hex-label (#61)',
    );
    assert(
      appjs.includes('detail-section-content'),
      'JS: showQADetail() renders detail-section-content for overflow protection (#61)',
    );
  } finally {
    server.kill();
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }
  console.log(failures.length === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
  process.exit(failures.length > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
