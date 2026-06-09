// Issue #151 — Conditional ETag caching for static JS/CSS
// Regression test: verifies Cache-Control header and 304 on conditional GET

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
    if (opts.etag) headers['If-None-Match'] = opts.etag;

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
            setCookie: Array.isArray(res.headers['set-cookie'])
              ? res.headers['set-cookie']
              : res.headers['set-cookie']
                ? [res.headers['set-cookie']]
                : [],
          });
        });
      },
    );
    r.on('error', () => resolve({ status: -1, body: '', headers: {}, setCookie: [] }));
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

describe('Issue #151 — Conditional ETag caching for static JS/CSS', () => {
  test('GET /css/style.css returns Cache-Control: public, max-age=0, must-revalidate', async () => {
    const r = await req('GET', '/css/style.css');
    assert.strictEqual(r.status, 200, 'GET /css/style.css must return 200');

    const cc = r.headers['cache-control'] || '';
    assert.ok(
      cc.includes('public'),
      'Cache-Control must include "public", got: ' + cc,
    );
    assert.ok(
      /max-age\s*=\s*0/.test(cc),
      'Cache-Control must have max-age=0, got: ' + cc,
    );
    assert.ok(
      cc.includes('must-revalidate'),
      'Cache-Control must include "must-revalidate", got: ' + cc,
    );
    assert.ok(
      !cc.includes('no-store'),
      'Cache-Control must NOT contain "no-store", got: ' + cc,
    );
  });

  test('GET /js/app.js returns Cache-Control: public, max-age=0, must-revalidate', async () => {
    const r = await req('GET', '/js/app.js');
    assert.strictEqual(r.status, 200, 'GET /js/app.js must return 200');

    const cc = r.headers['cache-control'] || '';
    assert.ok(
      cc.includes('public'),
      'Cache-Control must include "public", got: ' + cc,
    );
    assert.ok(
      /max-age\s*=\s*0/.test(cc),
      'Cache-Control must have max-age=0, got: ' + cc,
    );
    assert.ok(
      cc.includes('must-revalidate'),
      'Cache-Control must include "must-revalidate", got: ' + cc,
    );
    assert.ok(
      !cc.includes('no-store'),
      'Cache-Control must NOT contain "no-store", got: ' + cc,
    );
  });

  test('Conditional GET with valid ETag returns 304 Not Modified', async () => {
    // First request to get the ETag
    const first = await req('GET', '/css/style.css');
    assert.strictEqual(first.status, 200, 'First GET must return 200');

    const etag = first.headers['etag'];
    assert.ok(etag, 'Response must include ETag header for conditional caching');

    // Conditional GET with the ETag
    const second = await req('GET', '/css/style.css', { etag });
    assert.strictEqual(second.status, 304, 'Conditional GET with valid ETag must return 304');
    assert.strictEqual(
      second.body.length,
      0,
      '304 response must have empty body',
    );
  });

  test('Conditional GET with invalid ETag returns 200 with full content', async () => {
    const r = await req('GET', '/css/style.css', { etag: '"non-existent-etag"' });
    assert.strictEqual(r.status, 200, 'Conditional GET with invalid ETag must return 200');
    assert.ok(r.body.length > 0, 'Response must have non-empty body');
  });

  test('Both /css/style.css and /js/app.js have ETag headers', async () => {
    const css = await req('GET', '/css/style.css');
    assert.ok(css.headers['etag'], '/css/style.css must have ETag header');

    const js = await req('GET', '/js/app.js');
    assert.ok(js.headers['etag'], '/js/app.js must have ETag header');
  });
});
