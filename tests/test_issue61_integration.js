// Integration tests for issue #61 — mobile responsive fixes
// Run: node tests/test.js && node tests/test_issue61_integration.js
const http = require('http');
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
    if (opts.formBody) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    else if (opts.body) headers['Content-Type'] = opts.contentType || 'application/json';
    if (opts.cookie) headers['Cookie'] = opts.cookie;
    const r = http.request(
      { hostname: '127.0.0.1', port: 3199, path: urlPath, method, headers },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString();
          let json = null;
          try {
            json = JSON.parse(body);
          } catch {}
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
  const r = await req('POST', '/api/auth/login', { body: { username, password } });
  return r.setCookie[0]?.split(';')[0] || '';
}

async function run() {
  const { spawn } = require('child_process');
  const server = spawn(
    'node',
    ['-e', "require('./server').listen(3199,'127.0.0.1',()=>console.log('ready'))"],
    { cwd: path.join(__dirname, '..'), stdio: ['ignore', 'pipe', 'pipe'] },
  );
  await new Promise((ok) => {
    server.stdout.on('data', (d) => {
      if (d.toString().includes('ready')) ok();
    });
  });

  try {
    // ═══════════════════════════════════════════════
    // REGRESSION: Auth still works
    // ═══════════════════════════════════════════════
    console.log('\n>>> Regression — Auth');
    let cookie = await login('admin', '0000');
    assert(cookie.length > 0, '[R] Login admin/0000 sets cookie');

    let r = await req('GET', '/api/auth/me', { cookie });
    assert(r.status === 200, '[R] Auth /me => 200');
    assert(r.json?.username === 'admin', '[R] Auth /me returns admin');

    // ═══════════════════════════════════════════════
    // FIX 1: CSS — table-container overflow-x on mobile
    // ═══════════════════════════════════════════════
    console.log('\n>>> FIX 1 — CSS: Table container horizontal scroll');
    r = await req('GET', '/css/style.css');
    const css = r.body;
    assert(css.includes('.table-container'), 'CSS: .table-container class exists');
    assert(css.includes('overflow-x: auto'), 'CSS: table-container overflow-x auto');
    assert(css.includes('-webkit-overflow-scrolling: touch'), 'CSS: touch scrolling enabled');

    // ═══════════════════════════════════════════════
    // FIX 2: CSS — Color dot for categories table
    // ═══════════════════════════════════════════════
    console.log('\n>>> FIX 2 — CSS: Categories color dot');
    assert(css.includes('.color-dot'), 'CSS: .color-dot class exists');
    assert(css.includes('border-radius: 50%'), 'CSS: color-dot is circular');
    assert(css.includes('.color-hex'), 'CSS: .color-hex class exists');
    assert(css.includes('font-family: monospace'), 'CSS: color-hex uses monospace');
    // color-hex hidden on narrow viewports
    assert(css.includes('@media (max-width: 768px)'), 'CSS: 768px media query for color-hex');

    // ═══════════════════════════════════════════════
    // FIX 3: CSS — QA Detail modal overflow fixes
    // ═══════════════════════════════════════════════
    console.log('\n>>> FIX 3 — CSS: Modal and detail overflow');
    assert(css.includes('.modal-body'), 'CSS: .modal-body class exists');
    assert(css.includes('overflow-x: hidden'), 'CSS: modal-body overflow-x hidden');
    assert(css.includes('.modal-title'), 'CSS: .modal-title class exists');
    assert(css.includes('overflow-wrap: break-word'), 'CSS: overflow-wrap break-word present');
    assert(css.includes('.detail-banner'), 'CSS: .detail-banner class exists');
    assert(css.includes('min-width: 0'), 'CSS: detail-banner min-width 0');
    assert(css.includes('.detail-id'), 'CSS: .detail-id class exists');
    assert(css.includes('.detail-section-content'), 'CSS: .detail-section-content class exists');

    // ═══════════════════════════════════════════════
    // FIX 4: CSS — Responsive users table (card layout)
    // ═══════════════════════════════════════════════
    console.log('\n>>> FIX 4 — CSS: Responsive users table');
    assert(css.includes('.users-table'), 'CSS: .users-table class exists');
    assert(css.includes('@media (max-width: 480px)'), 'CSS: 480px media query for users table');
    assert(
      css.includes('attr(data-label)'),
      'CSS: data-label content attribute for mobile headers',
    );
    assert(css.includes('clip-path: inset(50%)'), 'CSS: screen-reader only pattern in users table');
    assert(css.includes('flex-wrap: wrap'), 'CSS: actions cell wraps on mobile');

    // ═══════════════════════════════════════════════
    // FIX 5: JS — Categories render (color-dot + color-hex)
    // ═══════════════════════════════════════════════
    console.log('\n>>> FIX 5 — JS: Categories render structure');
    r = await req('GET', '/js/app.js');
    const js = r.body;
    assert(js.includes('class="color-dot"'), 'JS: color-dot class in categories render');
    assert(js.includes('class="color-hex"'), 'JS: color-hex class in categories render');
    assert(js.includes('title='), 'JS: title attribute on color-dot (accessibility)');
    assert(js.includes('class="color-hex"'), 'JS: color-hex class renders in categories template');

    // ═══════════════════════════════════════════════
    // FIX 6: JS — Users render (responsive table + data-label)
    // ═══════════════════════════════════════════════
    console.log('\n>>> FIX 6 — JS: Users render structure');
    assert(js.includes('class="users-table"'), 'JS: users-table class on table element');
    assert(js.includes('data-label="Username"'), 'JS: data-label Username on td');
    assert(js.includes('data-label="Role"'), 'JS: data-label Role on td');
    assert(js.includes('data-label="Status"'), 'JS: data-label Status on td');
    assert(js.includes('data-label="Created"'), 'JS: data-label Created on td');
    assert(js.includes('data-label="Actions"'), 'JS: data-label Actions on td');

    // ═══════════════════════════════════════════════
    // REGRESSION: API endpoints still work
    // ═══════════════════════════════════════════════
    console.log('\n>>> Regression — API endpoints');
    r = await req('GET', '/api/categories', { cookie });
    assert(r.status === 200, '[R] Categories GET => 200');
    assert(Array.isArray(r.json), '[R] Categories returns array');

    r = await req('GET', '/api/users', { cookie });
    assert(r.status === 200, '[R] Users GET => 200');
    assert(Array.isArray(r.json), '[R] Users returns array');
    assert(r.json.length > 0, '[R] Users returns at least one user');

    r = await req('GET', '/api/qa', { cookie });
    assert(r.status === 200, '[R] QA GET => 200');
    assert(r.json && Array.isArray(r.json.data), '[R] QA returns object with data array');

    // ═══════════════════════════════════════════════
    // REGRESSION: Static files still serve
    // ═══════════════════════════════════════════════
    console.log('\n>>> Regression — Static files');
    r = await req('GET', '/');
    assert(r.status === 200, '[R] GET / => 200');

    r = await req('GET', '/js/app.js');
    assert(r.status === 200, '[R] GET /js/app.js => 200');

    r = await req('GET', '/css/style.css');
    assert(r.status === 200, '[R] GET /css/style.css => 200');
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
