// Issue #119 — #app flex container layout fix
// Verifies the page-width consistency fix across all routes
// Fix: Added #app { display: flex; flex: 1; min-width: 0; } to style.css

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

let server;

function req(method, urlPath, opts = {}) {
  return new Promise((resolve) => {
    const headers = {};
    if (opts.cookie) headers.Cookie = opts.cookie;
    if (opts.type) headers['Content-Type'] = opts.type;
    if (opts.body && !opts.type) headers['Content-Type'] = 'application/json';

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
          resolve({
            status: res.statusCode,
            body,
            headers: res.headers,
            setCookie: res.headers['set-cookie'] || [],
          });
        });
      },
    );
    r.on('error', () => resolve({ status: -1, body: '' }));
    if (opts.body) r.write(opts.body);
    r.end();
  });
}

before(async () => {
  server = spawn(
    'node',
    ['-e', "require('./server').listen(3199,'127.0.0.1',()=>console.log('ready'))"],
    { cwd: path.join(__dirname, '..'), stdio: ['ignore', 'pipe', 'pipe'] },
  );
  await new Promise((ok, fail) => {
    const to = setTimeout(() => fail(new Error('Server startup timeout')), 10000);
    server.stdout.on('data', (d) => {
      if (d.toString().includes('ready')) {
        clearTimeout(to);
        ok();
      }
    });
    server.stderr.on('data', (d) => {
      if (d.toString().includes('Error')) {
        clearTimeout(to);
        fail(new Error('Server error: ' + d.toString()));
      }
    });
  });
});

after(() => {
  if (server) server.kill();
});

describe('Issue #119 — #app flex container layout fix', () => {
  test('GET / returns 200 and HTML contains <div id="app">', async () => {
    const r = await req('GET', '/');
    assert.strictEqual(r.status, 200, 'GET / must return 200');
    assert.ok(r.body.includes('<div id="app"'), 'HTML must contain <div id="app" element');
    assert.ok(
      (r.headers['content-type'] || '').includes('text/html'),
      'Content-Type must include text/html',
    );
  });

  test('GET /css/style.css serves CSS and includes the #app fix rule', async () => {
    const r = await req('GET', '/css/style.css');
    assert.strictEqual(r.status, 200, 'GET /css/style.css must return 200');

    // Verify the #app rule from the fix
    const appRuleStart = r.body.indexOf('#app {');
    assert.ok(appRuleStart >= 0, 'CSS must contain #app rule');

    // Check the block contains all three required properties
    const blockEnd = r.body.indexOf('}', appRuleStart);
    const block = r.body.slice(appRuleStart, blockEnd + 1);
    assert.ok(block.includes('display: flex'), '#app rule must include display: flex');
    assert.ok(block.includes('flex: 1'), '#app rule must include flex: 1');
    assert.ok(block.includes('min-width: 0'), '#app rule must include min-width: 0');
  });

  test('Key static routes return 200 (no 500 errors from the layout change)', async () => {
    const routes = ['/', '/register', '/css/style.css', '/js/app.js', '/manifest.json'];
    for (const route of routes) {
      const r = await req('GET', route);
      assert.strictEqual(r.status, 200, `GET ${route} must return 200, got ${r.status}`);
    }
  });

  test('SPA catch-all routes serve app shell without crashing', async () => {
    // These routes are served via SPA catch-all (return 404 with app shell)
    const spaRoutes = ['/qa', '/categories', '/users', '/qa/1'];
    for (const route of spaRoutes) {
      const r = await req('GET', route);
      assert.strictEqual(
        r.status,
        404,
        `GET ${route} must return 404 (SPA catch-all), got ${r.status}`,
      );
      assert.ok(
        r.body.includes('<div id="app"'),
        `GET ${route} HTML must contain #app shell element`,
      );
    }
  });

  test('Auth endpoints still function after CSS layout change', async () => {
    // Login as admin
    const loginR = await req('POST', '/api/auth/login', {
      type: 'application/json',
      body: JSON.stringify({ username: 'admin', password: '0000' }),
    });
    assert.strictEqual(loginR.status, 200, 'Login admin/0000 must return 200');
    assert.ok(loginR.setCookie.length > 0, 'Login response must include Set-Cookie header');

    // Verify session with /me
    const cookie = loginR.setCookie[0].split(';')[0];
    const meR = await req('GET', '/api/auth/me', { cookie });
    assert.strictEqual(meR.status, 200, 'GET /api/auth/me must return 200');
    assert.ok(meR.body.includes('admin'), 'Session must belong to admin user');
  });

  test('Protected API routes return 200 for authenticated admin', async () => {
    // Login and get cookie
    const loginR = await req('POST', '/api/auth/login', {
      type: 'application/json',
      body: JSON.stringify({ username: 'admin', password: '0000' }),
    });
    const cookie = loginR.setCookie[0].split(';')[0];

    // Key API endpoints
    const apiRoutes = ['/api/qa', '/api/categories', '/api/users', '/api/tags', '/api/stats'];
    for (const route of apiRoutes) {
      const r = await req('GET', route, { cookie });
      assert.strictEqual(r.status, 200, `GET ${route} must return 200 for admin, got ${r.status}`);
    }
  });
});
