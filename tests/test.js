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

    // ═══ PWA ═══
    console.log('\n>>> PWA');
    r = await req('GET', '/manifest.json');
    assert(r.status === 200, 'GET /manifest.json => 200');
    assert(
      (r.headers['content-type'] || '').includes('json'),
      'GET /manifest.json => Content-Type includes json',
    );
    assert(r.json?.name, 'manifest.json has name');
    assert(r.json?.short_name, 'manifest.json has short_name');
    assert(Array.isArray(r.json?.icons), 'manifest.json has icons array');
    assert(r.json?.icons?.length >= 2, 'manifest.json has >=2 icons');

    r = await req('GET', '/sw.js');
    assert(r.status === 200, 'GET /sw.js => 200');
    assert(
      (r.headers['content-type'] || '').includes('javascript'),
      'GET /sw.js => Content-Type includes javascript',
    );

    r = await req('GET', '/icons/icon-192.png');
    assert(r.status === 200, 'GET /icons/icon-192.png => 200');

    r = await req('GET', '/icons/icon-512.png');
    assert(r.status === 200, 'GET /icons/icon-512.png => 200');

    r = await req('GET', '/');
    assert(r.body.includes('rel="manifest"'), 'index.html has manifest link');
    assert(r.body.includes('meta name="theme-color"'), 'index.html has theme-color meta');
    assert(
      r.body.includes('name="apple-mobile-web-app-capable"'),
      'index.html has apple-mobile-web-app-capable meta',
    );
    assert(r.body.includes('rel="apple-touch-icon"'), 'index.html has apple-touch-icon link');
    assert(
      r.body.includes('serviceWorker') && r.body.includes('register'),
      'index.html has service worker registration',
    );

    // Issue #92: PWA Install Prompt UX
    assert(
      r.body.includes('id="pwa-install-banner"'),
      'index.html has pwa-install-banner container',
    );

    // JS checks for PWA install logic
    r = await req('GET', '/js/app.js');
    const pwaJs = r.body;
    assert(pwaJs.includes('beforeinstallprompt'), 'JS: beforeinstallprompt event listener');
    assert(
      pwaJs.includes('(display-mode: standalone)'),
      'JS: matchMedia display-mode standalone check',
    );
    assert(pwaJs.includes('navigator.standalone'), 'JS: iOS navigator.standalone detection');
    assert(/iPhone\|iPad\|iPod/.test(pwaJs), 'JS: iOS user-agent detection (iPhone|iPad|iPod)');
    assert(pwaJs.includes('deferredInstallPrompt'), 'JS: deferredInstallPrompt variable');
    assert(pwaJs.includes('pwa-install-btn'), 'JS: install button element ID');
    assert(pwaJs.includes('appinstalled'), 'JS: appinstalled event listener');
    assert(pwaJs.includes('pwa-ios-dismissed'), 'JS: iOS dismiss localStorage key');
    assert(pwaJs.includes('pwa-android-dismissed'), 'JS: Android dismiss localStorage key');
    assert(pwaJs.includes('Add to Home Screen'), 'JS: iOS install guide text');
    assert(pwaJs.includes('initPWA'), 'JS: initPWA function called');
    // Verify initPWA() is invoked (not just defined) — look for invocation without 'function ' prefix
    assert(
      /(?<!function\s)initPWA\s*\(/.test(pwaJs),
      'JS: initPWA() is invoked as a function call (not only defined)',
    );
    assert(pwaJs.includes('showAndroidInstallButton'), 'JS: showAndroidInstallButton function');
    // Verify the iOS banner element structure renders the share icon SVG + step text
    assert(
      /share.*icon|square\.and\.arrow/i.test(pwaJs) || /1\.\s*Tap.*Share|Share.*menu/i.test(pwaJs),
      'JS: iOS banner references share icon or Share menu instructions',
    );
    // Verify Android install button HTML structure
    assert(pwaJs.includes('id="pwa-install-btn"'), 'JS: Android install button element with id');
    assert(
      pwaJs.includes('id="pwa-dismiss-android"'),
      'JS: Android dismiss button element with id',
    );
    // Verify standalone detection returns early from initPWA
    assert(
      pwaJs.includes('if (isStandalone()) return;'),
      'JS: standalone mode causes early return from initPWA',
    );
    // Verify appinstalled listener clears the banner and nulls the deferred prompt
    assert(
      pwaJs.includes("banner.innerHTML = ''") && pwaJs.includes('appinstalled'),
      'JS: appinstalled event clears banner HTML',
    );

    // CSS checks for PWA install banner styles
    r = await req('GET', '/css/style.css');
    const pwaCss = r.body;
    assert(pwaCss.includes('.pwa-ios-banner'), 'CSS: .pwa-ios-banner style');
    assert(pwaCss.includes('.pwa-android-banner'), 'CSS: .pwa-android-banner style');
    assert(pwaCss.includes('.pwa-banner-content'), 'CSS: .pwa-banner-content style');
    // Verify the animation has both @keyframes definition and CSS class application
    assert(
      /@keyframes\s+pwa-slide-up/.test(pwaCss),
      'CSS: @keyframes pwa-slide-up animation defined',
    );
    assert(/animation.*pwa-slide-up/.test(pwaCss), 'CSS: pwa-slide-up animation applied to banner');
    // Verify the banner uses fixed positioning at the bottom
    assert(
      /bottom\s*:\s*0/.test(pwaCss) && /position\s*:\s*fixed/.test(pwaCss),
      'CSS: banner uses position: fixed; bottom: 0',
    );

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
    const ntv = `node_test_v_${Date.now()}`;
    r = await req('POST', '/api/auth/register', {
      body: { username: ntv, password: 'Test1234!', role: 'Viewer' },
    });
    assert(r.status === 201, 'Register Viewer => 201');

    r = await req('POST', '/api/auth/register', {
      body: { username: ntv, password: 'Test1234!', role: 'Viewer' },
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
      body: { username: `admin_test_${Date.now()}`, password: 'Test1234!', role: 'Admin' },
    });
    assert(r.status === 400, 'Register with Admin role => 400');
    assert(r.json?.error === 'Invalid role', 'Register Admin => error message is Invalid role');

    // Pending account login blocked
    r = await req('POST', '/api/auth/login', {
      body: { username: ntv, password: 'Test1234!' },
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

    // Search by answer content
    r = await req('POST', '/api/qa', {
      cookie,
      body: {
        title: 'Answer Search Test',
        question: 'ignore',
        answer: 'unique_secret_string_reply',
        category_id: catId,
      },
    });
    assert(r.status === 201, 'QA create for answer search => 201');
    const answerSearchId = r.json?.id;
    assert(answerSearchId, 'QA create for answer search has id');

    r = await req('GET', '/api/qa?status=Published&search=unique_secret_string_reply', { cookie });
    assert(r.status === 200, 'QA search by answer => 200');
    assert(r.json?.data?.length > 0, 'QA search by answer returns results');
    assert(
      r.json.data.some((e) => e.id === answerSearchId),
      'QA search found entry by answer',
    );

    if (answerSearchId) {
      r = await req('DELETE', '/api/qa/' + answerSearchId, { cookie });
      assert(r.status === 200, 'QA DELETE answer search entry => 200');
    }

    // Search by category name
    const catSearchName = 'unique_cat_search_' + Date.now();
    r = await req('POST', '/api/categories', {
      cookie,
      body: { name: catSearchName },
    });
    assert(r.status === 201, 'Category create for search test => 201');
    const catSearchId = r.json?.id;
    assert(catSearchId, 'Category create has id');

    r = await req('POST', '/api/qa', {
      cookie,
      body: {
        title: 'Cat Search QA',
        question: 'Q',
        answer: 'A',
        category_id: catSearchId,
      },
    });
    assert(r.status === 201, 'QA create for category search => 201');
    const catSearchQaId = r.json?.id;
    assert(catSearchQaId, 'QA create has id');

    r = await req('GET', '/api/qa?status=Published&search=' + encodeURIComponent(catSearchName), {
      cookie,
    });
    assert(r.status === 200, 'QA search by category name => 200');
    assert(r.json?.data?.length > 0, 'QA search by category name returns results');
    assert(
      r.json.data.some((e) => e.id === catSearchQaId),
      'QA search found entry by category name',
    );

    if (catSearchQaId) {
      r = await req('DELETE', '/api/qa/' + catSearchQaId, { cookie });
      assert(r.status === 200, 'QA DELETE category search qa entry => 200');
    }
    if (catSearchId) {
      r = await req('DELETE', '/api/categories/' + catSearchId, { cookie });
      assert(r.status === 200, 'Category DELETE search test entry => 200');
    }

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
    // Issue #63 assertions
    assert(appjs.includes('users-search'), 'JS: renderUsers() includes users-search input (#63)');
    assert(appjs.includes('search-clear'), 'JS: renderQA() includes search-clear button (#63)');
    assert(
      appjs.includes('auth-pass-confirm'),
      'JS: renderLogin() includes auth-pass-confirm field (#63)',
    );
    assert(
      appjs.includes("confirmErr.textContent = 'Passwords do not match'"),
      'JS: renderLogin() register password-match validation (#63)',
    );
    assert(
      appjs.includes('Title is required'),
      'JS: showCreateQA() has inline Title validation (#63)',
    );
    assert(
      appjs.includes('Question is required'),
      'JS: showCreateQA() has inline Question validation (#63)',
    );
    assert(
      appjs.includes('e.g., password,account (comma separated)'),
      'JS: showCreateQA() tags placeholder updated (#63)',
    );
    assert(
      appjs.includes("404: 'Page Not Found'"),
      'JS: navigate() titles map includes 404: "Page Not Found" (#63)',
    );
    assert(
      appjs.includes('body.title = body.title.trim()'),
      'JS: showCreateQA() trims whitespace before validation (#63)',
    );
    // ═══ ISSUE #73: MOBILE OVERFLOW FIX ═══
    console.log('\n>>> Issue #73 Mobile Overflow Fix');
    const styleCss = fs.readFileSync(
      path.join(__dirname, '..', 'public', 'css', 'style.css'),
      'utf-8',
    );

    // Problem 1: Users table overflow
    // .table-container must have overflow-x: auto instead of overflow: hidden
    const tcStart = styleCss.indexOf('.table-container');
    if (tcStart === -1) throw new Error('Could not find .table-container in CSS');
    const tcEnd = styleCss.indexOf('}', tcStart);
    if (tcEnd === -1) throw new Error('Could not find end of .table-container block');
    const tcBlock = styleCss.slice(tcStart, tcEnd);
    assert(/overflow-x\s*:\s*auto/.test(tcBlock), 'CSS: .table-container has overflow-x: auto');
    assert(
      !/overflow\s*:\s*hidden/.test(tcBlock),
      'CSS: .table-container no longer has overflow: hidden',
    );

    // Problem 2: QA Detail title overflow on mobile
    // Inside the @media query, .topbar-title must have white-space: normal + word-break
    // Use lastIndexOf('max-width: 768px') to target the last (mobile) @media block, skipping any earlier one for the sidebar overlay
    const mqStart = styleCss.lastIndexOf('(max-width: 768px)');
    if (mqStart === -1) throw new Error('Could not find @media (max-width: 768px) block in CSS');
    const mqOpen = styleCss.indexOf('{', mqStart);
    if (mqOpen === -1) throw new Error('Could not find opening brace of mobile media query');
    let depth = 1;
    let mqClose = mqOpen + 1;
    while (depth > 0 && mqClose < styleCss.length) {
      if (styleCss[mqClose] === '{') depth++;
      else if (styleCss[mqClose] === '}') depth--;
      mqClose++;
    }
    if (depth > 0) throw new Error('Could not find matching closing brace of mobile media query');
    const mqBlock = styleCss.slice(mqOpen + 1, mqClose - 1);
    const ttStart = mqBlock.indexOf('.topbar-title');
    if (ttStart === -1) throw new Error('Could not find .topbar-title in mobile CSS block');
    const ttEnd = mqBlock.indexOf('}', ttStart);
    if (ttEnd === -1) throw new Error('Could not find end of .topbar-title block');
    const ttBlock = mqBlock.slice(ttStart, ttEnd);
    assert(
      /white-space\s*:\s*normal/.test(ttBlock),
      'CSS (mobile): .topbar-title white-space: normal',
    );
    assert(
      /word-break\s*:\s*break-word/.test(ttBlock),
      'CSS (mobile): .topbar-title word-break: break-word',
    );
    assert(
      /overflow-wrap\s*:\s*break-word/.test(ttBlock),
      'CSS (mobile): .topbar-title overflow-wrap: break-word',
    );

    // Problem 3: Page switch — body overflow-x hidden on mobile
    assert(
      /(?:^|\s)body\s*\{[^}]*overflow-x:\s*hidden\s*;/.test(mqBlock),
      'CSS (mobile): body overflow-x: hidden',
    );

    // Problem 3b: .content should NOT use 100vw on mobile (iOS Safari bug — width calculation mismatch)
    const ctStart = mqBlock.indexOf('.content');
    if (ctStart === -1) throw new Error('Could not find .content in mobile CSS block');
    const ctEnd = mqBlock.indexOf('}', ctStart);
    if (ctEnd === -1) throw new Error('Could not find end of .content block');
    const ctBlock = mqBlock.slice(ctStart, ctEnd);
    assert(
      !/max-width/.test(ctBlock),
      'CSS (mobile): .content should NOT have max-width (avoid iOS 100vw bug)',
    );
    assert(
      /overflow\s*:\s*visible/.test(ctBlock),
      'CSS (mobile): .content overflow: visible (#84)',
    );

    // ═══ ISSUE #84: MOBILE SCROLLBAR GUTTER — body & .main overrides ═══
    console.log('\n>>> Issue #84 Mobile scrollbar gutter fix — body & .main overrides');

    // Extract body block inside mobile media query (whitespace-tolerant regex)
    const bodyMatch = mqBlock.match(/(?:^|\s)body\s*\{[^}]*\}/m);
    if (!bodyMatch) throw new Error('Could not find body block in mobile CSS block');
    const bodyBlock = bodyMatch[0];
    assert(/height\s*:\s*auto/.test(bodyBlock), 'CSS (mobile): body height: auto (#84)');
    assert(/min-height\s*:\s*100vh/.test(bodyBlock), 'CSS (mobile): body min-height: 100vh (#84)');
    assert(/overflow-y\s*:\s*auto/.test(bodyBlock), 'CSS (mobile): body overflow-y: auto (#84)');

    // Extract .main block inside mobile media query (whitespace-tolerant regex)
    const mainMatch = mqBlock.match(/\.main\s*\{[^}]*\}/);
    if (!mainMatch) throw new Error('Could not find .main block in mobile CSS block');
    const mainBlock = mainMatch[0];
    assert(/overflow\s*:\s*visible/.test(mainBlock), 'CSS (mobile): .main overflow: visible (#84)');

    // ═══ ISSUE #79 (updated #95): scrollbar-gutter: stable on .content ═══
    console.log('\n>>> Issue #79 (updated #95) scrollbar-gutter: stable on .content');

    // .content block (desktop style) should have scrollbar-gutter: stable (#95)
    const cdIndex = styleCss.indexOf('.content');
    if (cdIndex === -1) throw new Error('Could not find .content (desktop) rule in stylesheet');
    const contentDesktop = styleCss.slice(cdIndex);
    const cdEnd = contentDesktop.indexOf('}');
    if (cdEnd === -1) throw new Error('Could not find end of .content (desktop) block');
    const cdBlock = contentDesktop.slice(0, cdEnd);
    assert(
      /scrollbar-gutter\s*:\s*stable/.test(cdBlock),
      'CSS: .content should have scrollbar-gutter: stable (#95)',
    );
    assert(
      /overflow-wrap\s*:\s*break-word/.test(cdBlock),
      'CSS: .content still has overflow-wrap: break-word',
    );

    // ═══ ISSUE #95: BODY SCROLLBAR-GUTTER ═══
    console.log('\n>>> Issue #95 Body scrollbar-gutter: stable');

    // top-level body rule should have scrollbar-gutter: stable
    const topBodyMatch = styleCss.match(/^body\s*\{[^}]*\}/m);
    if (!topBodyMatch) throw new Error('Could not find top-level body rule');
    assert(
      /scrollbar-gutter\s*:\s*stable/.test(topBodyMatch[0]),
      'CSS: top-level body should have scrollbar-gutter: stable (#95)',
    );

    // ═══ ISSUE #87: SIDEBAR NAV ITEMS WCAG 44px TOUCH TARGET ═══
    console.log('\n>>> Issue #87 Sidebar nav items 44px touch target');

    // Check .nav-item has min-height: 44px for WCAG 2.5.5 compliance
    const niMatch = styleCss.match(/\.nav-item\s*\{[^}]*\}/);
    if (!niMatch) throw new Error('Could not find .nav-item block in CSS');
    const niBlock = niMatch[0];
    assert(
      /min-height\s*:\s*44px/.test(niBlock),
      'CSS: .nav-item has min-height: 44px (WCAG 2.5.5 touch target)',
    );

    // Verify min-height is NOT media-query-scoped (affects all views including tablet ≥768px)
    const desktopNavMatch = styleCss.match(/\.nav-item[^{]*\{[^}]*min-height\s*:\s*44px[^}]*\}/);
    assert(
      desktopNavMatch && desktopNavMatch.index < mqStart,
      'CSS: .nav-item min-height:44px is in global scope (not just mobile @media)',
    );

    // ═══ ISSUE #88: TABLET BUTTON SIZES — .btn & .btn-sm WCAG 44px ═══
    console.log('\n>>> Issue #88 Tablet buttons .btn & .btn-sm 44px touch target');

    // Check global .btn has min-height: 44px
    const btnMatch = styleCss.match(/\.btn\s*\{[^}]*\}/);
    if (!btnMatch) throw new Error('Could not find .btn block in CSS');
    const btnBlock = btnMatch[0];
    assert(
      /min-height\s*:\s*44px/.test(btnBlock),
      'CSS: .btn has min-height: 44px (WCAG 2.5.5 touch target)',
    );

    // Check global .btn-sm has min-height: 44px and adequate padding
    const btnSmMatch = styleCss.match(/\.btn-sm\s*\{[^}]*\}/);
    if (!btnSmMatch) throw new Error('Could not find .btn-sm block in CSS');
    const btnSmBlock = btnSmMatch[0];
    assert(
      /min-height\s*:\s*44px/.test(btnSmBlock),
      'CSS: .btn-sm has min-height: 44px (WCAG 2.5.5 touch target)',
    );
    assert(
      /padding\s*:\s*10px\s+12px/.test(btnSmBlock),
      'CSS: .btn-sm has adequate padding (10px 12px) to fill 44px height',
    );

    // Verify both are in global scope (before mobile @media)
    const btnGlobalMatch = styleCss.match(/\.btn\s*\{[^}]*min-height\s*:\s*44px[^}]*\}/);
    assert(
      btnGlobalMatch && btnGlobalMatch.index < mqStart,
      'CSS: .btn min-height:44px is in global scope (not just mobile @media)',
    );

    // Verify .btn-sm min-height is also global
    const btnSmGlobalMatch = styleCss.match(/\.btn-sm\s*\{[^}]*min-height\s*:\s*44px[^}]*\}/);
    assert(
      btnSmGlobalMatch && btnSmGlobalMatch.index < mqStart,
      'CSS: .btn-sm min-height:44px is in global scope (not just mobile @media)',
    );
    // ═══ PASSWORD COMPLEXITY ═══
    console.log('\n>>> Password Complexity');

    // validatePassword unit tests
    {
      const { validatePassword } = require('../lib/password');
      assert(
        validatePassword('Abcdef1!') === null,
        'validatePassword: valid password returns null',
      );
      assert(validatePassword('Ab1!') !== null, 'validatePassword: <8 chars returns error');
      assert(
        validatePassword('abcdef1!') !== null,
        'validatePassword: missing uppercase returns error',
      );
      assert(
        validatePassword('ABCDEF1!') !== null,
        'validatePassword: missing lowercase returns error',
      );
      assert(
        validatePassword('Abcdefg!') !== null,
        'validatePassword: missing digit returns error',
      );
      assert(
        validatePassword('Abcdef12') !== null,
        'validatePassword: missing special char returns error',
      );
    }

    // Register rejects weak passwords
    const weakPws = ['short', 'nouppercase1!', 'NOLOWERCASE1!', 'Abcdefgh', 'Abcdef12', 'abcdef1!'];
    for (const pw of weakPws) {
      r = await req('POST', '/api/auth/register', {
        body: {
          username: 'wpwtest-' + pw.replace(/[^a-z0-9]/gi, ''),
          password: pw,
          role: 'Viewer',
        },
      });
      assert(r.status === 400, `Register weak password "${pw}" => 400 (got ${r.status})`);
    }

    // Admin create user rejects weak passwords
    cookie = await login('admin', '0000');
    for (const pw of weakPws) {
      r = await req('POST', '/api/users/create', {
        cookie,
        body: { username: 'cuweak-' + pw.replace(/[^a-z0-9]/gi, ''), password: pw, role: 'Viewer' },
      });
      assert(r.status === 400, `Admin create weak password "${pw}" => 400 (got ${r.status})`);
    }

    // Change-password tests (use a new user created by admin with valid password)
    const cpwUser = 'cpwtest_' + Date.now();
    const cpwPass = 'OrigP@ss1';
    r = await req('POST', '/api/users/create', {
      cookie,
      body: { username: cpwUser, password: cpwPass, role: 'Viewer' },
    });
    assert(r.status === 201, 'CPW: admin create test user => 201');

    // Login as new user
    let cpwCookie = await login(cpwUser, cpwPass);
    assert(cpwCookie.length > 0, 'CPW: login as test user gets cookie');

    // Unauthenticated change password
    r = await req('POST', '/api/user/change-password', {
      body: { currentPassword: cpwPass, newPassword: 'NewP@ss1!' },
    });
    assert(r.status === 401, 'CPW: unauthenticated => 401');

    // Wrong current password
    r = await req('POST', '/api/user/change-password', {
      cookie: cpwCookie,
      body: { currentPassword: 'WrongP@ss1', newPassword: 'NewP@ss1!' },
    });
    assert(r.status === 400, 'CPW: wrong current password => 400');

    // Weak new password
    r = await req('POST', '/api/user/change-password', {
      cookie: cpwCookie,
      body: { currentPassword: cpwPass, newPassword: 'short' },
    });
    assert(r.status === 400, 'CPW: weak new password => 400');

    // Valid change password
    r = await req('POST', '/api/user/change-password', {
      cookie: cpwCookie,
      body: { currentPassword: cpwPass, newPassword: 'NewP@ss1!' },
    });
    assert(r.status === 200 && r.json?.ok === true, 'CPW: valid change => 200 ok');

    // Verify can login with new password
    cpwCookie = await login(cpwUser, 'NewP@ss1!');
    assert(cpwCookie.length > 0, 'CPW: login with new password works');

    // Check session is still valid
    r = await req('GET', '/api/auth/me', { cookie: cpwCookie });
    assert(r.status === 200 && r.json?.username === cpwUser, 'CPW: session valid after change');

    console.log('\n>>> Forced Password Reset');

    // Create a test user for forced reset tests
    const resetUser = 'resetuser_' + Date.now();
    const resetPass = 'ResetP@ss1';
    const createRes = await req('POST', '/api/users/create', {
      cookie,
      body: { username: resetUser, password: resetPass, role: 'Viewer' },
    });
    assert(createRes.status === 201, 'FPR: admin create test user => 201');
    const resetUserId = createRes.json.id;

    // Unauthenticated admin reset password
    r = await req('PATCH', '/api/users/' + resetUserId + '/password', {
      body: { password: 'NewP@ss2!' },
    });
    assert(r.status === 401, 'FPR: unauthenticated => 401');

    // Non-Admin (Viewer) gets 403
    const viewerUser = 'viewerrp_' + Date.now();
    r = await req('POST', '/api/users/create', {
      cookie,
      body: { username: viewerUser, password: 'ViewRP@ss1', role: 'Viewer' },
    });
    assert(r.status === 201, 'FPR: create viewer user => 201');
    const viewerCookie = (await login(viewerUser, 'ViewRP@ss1')).split(';')[0];
    r = await req('PATCH', '/api/users/' + resetUserId + '/password', {
      cookie: viewerCookie,
      body: { password: 'EvilP@ss1!' },
    });
    assert(r.status === 403, 'FPR: Viewer reset password => 403');

    // No password
    r = await req('PATCH', '/api/users/' + resetUserId + '/password', {
      cookie,
      body: {},
    });
    assert(r.status === 400, 'FPR: no password => 400');

    // Weak password
    r = await req('PATCH', '/api/users/' + resetUserId + '/password', {
      cookie,
      body: { password: 'short' },
    });
    assert(r.status === 400, 'FPR: weak password => 400');

    // Login before admin reset — get a session cookie
    const preResetLogin = await req('POST', '/api/auth/login', {
      body: { username: resetUser, password: resetPass },
    });
    assert(preResetLogin.status === 200, 'FPR: pre-reset login => 200');
    const preResetCookie = preResetLogin.setCookie[0]?.split(';')[0] || '';
    assert(preResetCookie.length > 0, 'FPR: pre-reset cookie obtained');

    // Verify session works
    r = await req('GET', '/api/auth/me', { cookie: preResetCookie });
    assert(r.status === 200, 'FPR: pre-reset session valid');

    // Valid admin reset password
    r = await req('PATCH', '/api/users/' + resetUserId + '/password', {
      cookie,
      body: { password: 'FrcP@ss1!' },
    });
    assert(r.status === 200 && r.json?.ok === true, 'FPR: valid reset => 200 ok');

    // Verify old session is invalidated
    r = await req('GET', '/api/auth/me', { cookie: preResetCookie });
    assert(r.status === 401, 'FPR: pre-reset session invalidated after reset => 401');

    // Login returns must_change_password flag
    r = await req('POST', '/api/auth/login', {
      body: { username: resetUser, password: 'FrcP@ss1!' },
    });
    assert(r.status === 200, 'FPR: login after reset => 200');
    assert(r.json?.must_change_password === true, 'FPR: must_change_password flag in response');
    let resetCookie = r.setCookie[0]?.split(';')[0] || '';

    // GET /api/auth/me also reports must_change_password
    r = await req('GET', '/api/auth/me', { cookie: resetCookie });
    assert(r.status === 200, 'FPR: /me after forced login => 200');
    assert(r.json?.must_change_password === true, 'FPR: /me must_change_password is true');

    // Auth guard: must_change_password user cannot access other API endpoints
    r = await req('GET', '/api/qa', { cookie: resetCookie });
    assert(r.status === 403, 'FPR: auth guard blocks must_change_password user => 403');
    assert(
      r.json?.must_change_password === true,
      'FPR: auth guard returns must_change_password error',
    );

    // Forced change password: no currentPassword required
    r = await req('POST', '/api/user/change-password', {
      cookie: resetCookie,
      body: { newPassword: 'ChngP@ss1!' },
    });
    assert(
      r.status === 200 && r.json?.ok === true,
      'FPR: forced change (no currentPassword) => 200',
    );

    // Login with new password — must_change_password should be cleared
    r = await req('POST', '/api/auth/login', {
      body: { username: resetUser, password: 'ChngP@ss1!' },
    });
    assert(r.status === 200, 'FPR: login after forced change => 200');
    assert(r.json?.must_change_password !== true, 'FPR: must_change_password cleared after change');

    // Normal change password still requires currentPassword
    const normalResetCookie = r.setCookie[0]?.split(';')[0] || '';
    r = await req('POST', '/api/user/change-password', {
      cookie: normalResetCookie,
      body: { newPassword: 'NoCurP@ss1' },
    });
    assert(r.status === 400, 'FPR: normal change without currentPassword => 400');
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
