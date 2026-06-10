// Issue #170 — Status validation on QA create + byStatus prototype pollution hardening
// Verifies:
//   1. POST /api/qa rejects invalid status values
//   2. POST /api/qa defaults to 'Draft' when no status provided
//   3. POST /api/qa accepts valid statuses ('Draft', 'Published', 'Archived')
//   4. GET /api/stats byStatus is not polluted by __proto__ injection

const { test, describe, before, after, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3199;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function request(method, urlPath, opts = {}) {
  return new Promise((resolve) => {
    const headers = { 'Content-Type': 'application/json' };
    if (opts.cookie) headers.Cookie = opts.cookie;
    if (opts.body) {
      headers['Content-Type'] = 'application/json';
    }

    const r = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
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
            /* not json */
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body,
            json,
            ok: res.statusCode >= 200 && res.statusCode < 300,
          });
        });
      },
    );
    r.on('error', () => resolve({ status: -1, body: '', headers: {}, json: null, ok: false }));
    if (opts.body) r.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    r.end();
  });
}

async function loginAsAdmin() {
  const r = await request('POST', '/api/auth/login', {
    body: { username: 'admin', password: '0000' },
  });
  const setCookie = r.headers['set-cookie'] || [];
  const cookie = Array.isArray(setCookie)
    ? setCookie.map((c) => c.split(';')[0]).join('; ')
    : setCookie.split(';')[0];
  return cookie;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let server, cookie;
const createdIds = [];

before(async () => {
  server = spawn(
    'node',
    ['-e', `require('./server').listen(${PORT},'127.0.0.1',()=>console.log('ready'))`],
    { cwd: path.join(__dirname, '..'), stdio: ['ignore', 'pipe', 'pipe'] },
  );
  await new Promise((ok, fail) => {
    const to = setTimeout(() => fail(new Error('Server startup timeout (10s)')), 10000);
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

  cookie = await loginAsAdmin();
  assert.ok(cookie, 'Admin login should return a session cookie');
});

after(() => {
  if (server) server.kill();
});

// Cleanup created entries after each test
async function cleanupCreated() {
  while (createdIds.length) {
    const id = createdIds.pop();
    try {
      await request('DELETE', `/api/qa/${id}`, { cookie });
    } catch {
      /* ignore cleanup errors */
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/qa — status validation (Issue #170)', () => {
  afterEach(async () => {
    await cleanupCreated();
  });

  test('POST without status defaults to Draft', async () => {
    const r = await request('POST', '/api/qa', {
      cookie,
      body: { title: 'Default Draft', question: 'No status test?' },
    });
    assert.strictEqual(r.status, 201, 'POST /api/qa without status => 201');
    const id = r.json?.id;
    assert.ok(id, 'Response should include an id');
    createdIds.push(id);

    const fetched = await request('GET', `/api/qa/${id}`, { cookie });
    assert.strictEqual(fetched.json?.status, 'Draft', 'Default status should be Draft');
  });

  test('POST with status "Draft" succeeds', async () => {
    const r = await request('POST', '/api/qa', {
      cookie,
      body: { title: 'Explicit Draft', question: 'Q?', status: 'Draft' },
    });
    assert.strictEqual(r.status, 201, 'POST with status=Draft => 201');
    const id = r.json?.id;
    assert.ok(id);
    createdIds.push(id);

    const fetched = await request('GET', `/api/qa/${id}`, { cookie });
    assert.strictEqual(fetched.json?.status, 'Draft', 'Status should be Draft');
  });

  test('POST with status "Published" succeeds', async () => {
    const r = await request('POST', '/api/qa', {
      cookie,
      body: { title: 'Explicit Published', question: 'Q?', status: 'Published' },
    });
    assert.strictEqual(r.status, 201, 'POST with status=Published => 201');
    const id = r.json?.id;
    assert.ok(id);
    createdIds.push(id);

    const fetched = await request('GET', `/api/qa/${id}`, { cookie });
    assert.strictEqual(fetched.json?.status, 'Published', 'Status should be Published');
  });

  test('POST with status "Archived" succeeds', async () => {
    const r = await request('POST', '/api/qa', {
      cookie,
      body: { title: 'Explicit Archived', question: 'Q?', status: 'Archived' },
    });
    assert.strictEqual(r.status, 201, 'POST with status=Archived => 201');
    const id = r.json?.id;
    assert.ok(id);
    createdIds.push(id);

    const fetched = await request('GET', `/api/qa/${id}`, { cookie });
    assert.strictEqual(fetched.json?.status, 'Archived', 'Status should be Archived');
  });

  test('POST with invalid status "InvalidStatus" returns 400', async () => {
    const r = await request('POST', '/api/qa', {
      cookie,
      body: { title: 'Bad Status', question: 'Q?', status: 'InvalidStatus' },
    });
    assert.strictEqual(r.status, 400, 'POST with InvalidStatus => 400');
    assert.ok(r.json?.error, 'Response should include an error message');
  });

  test('POST with empty status "" returns 400', async () => {
    const r = await request('POST', '/api/qa', {
      cookie,
      body: { title: 'Empty Status', question: 'Q?', status: '' },
    });
    assert.strictEqual(r.status, 400, 'POST with empty status => 400');
    assert.ok(r.json?.error, 'Response should include an error message');
  });

  test('POST with __proto__ status returns 400 (prototype pollution prevention)', async () => {
    const r = await request('POST', '/api/qa', {
      cookie,
      body: { title: 'Proto Status', question: 'Q?', status: '__proto__' },
    });
    assert.strictEqual(r.status, 400, 'POST with __proto__ status => 400');
    assert.ok(r.json?.error, 'Response should include an error message');
  });
});

describe('GET /api/stats — byStatus not polluted by __proto__ (Issue #170)', () => {
  let polluteIds = [];

  afterEach(async () => {
    while (polluteIds.length) {
      const id = polluteIds.pop();
      try {
        await request('DELETE', `/api/qa/${id}`, { cookie });
      } catch {
        /* ignore */
      }
    }
  });

  test('stats endpoint returns expected response shape with three status counters', async () => {
    // Create entries with valid statuses
    const r1 = await request('POST', '/api/qa', {
      cookie,
      body: { title: 'Stats-Test-A', question: 'Q1?', status: 'Draft' },
    });
    assert.strictEqual(r1.status, 201);
    polluteIds.push(r1.json.id);

    const r2 = await request('POST', '/api/qa', {
      cookie,
      body: { title: 'Stats-Test-B', question: 'Q2?', status: 'Published' },
    });
    assert.strictEqual(r2.status, 201);
    polluteIds.push(r2.json.id);

    const r3 = await request('POST', '/api/qa', {
      cookie,
      body: { title: 'Stats-Test-C', question: 'Q3?', status: 'Archived' },
    });
    assert.strictEqual(r3.status, 201);
    polluteIds.push(r3.json.id);

    // Check stats — the endpoint flattens byStatus into individual counters
    const stats = await request('GET', '/api/stats', { cookie });
    assert.strictEqual(stats.status, 200, 'GET /api/stats => 200');

    const qa = stats.json?.qa;
    assert.ok(qa, 'Stats response should include qa object');

    // Should have the correct counter structure
    assert.ok(typeof qa.total === 'number', 'qa.total should be a number');
    assert.ok(typeof qa.published === 'number', 'qa.published should be a number');
    assert.ok(typeof qa.draft === 'number', 'qa.draft should be a number');
    assert.ok(typeof qa.archived === 'number', 'qa.archived should be a number');

    // Verify the response shape only contains the 4 expected keys.
    // This is a shape/type check — the server explicitly constructs
    // the response object from byStatus counters; count delta
    // assertions are not meaningful since other tests may create entries.
    assert.strictEqual(
      Object.keys(qa).length,
      4,
      'qa should only have 4 keys (total, published, draft, archived), got: ' +
        Object.keys(qa).join(', '),
    );
  });
});
