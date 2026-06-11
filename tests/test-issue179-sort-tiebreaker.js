// Test: Issue #179 — Sort tiebreaker (id as secondary sort when created_at ties)
//
// Coverage:
//   1. sort=newest: id DESC tiebreaker for same-timestamp entries
//   2. sort=oldest: id ASC tiebreaker for same-timestamp entries
//   3. sort=popular (no usage data, max_usage===0): id DESC tiebreaker
//   4. sort=popular (with usage data): id DESC tiebreaker within same bucket
//
// Usage: npx mocha tests/test-issue179-sort-tiebreaker.js --timeout 10000

const assert = require('assert');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3201;
const PREFIX = 'TIEBR179-';

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function request(method, urlPath, opts = {}) {
  return new Promise((resolve) => {
    const headers = { 'Content-Type': 'application/json' };
    if (opts.cookie) headers.Cookie = opts.cookie;
    if (opts.body) headers['Content-Type'] = 'application/json';
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
          resolve({ status: res.statusCode, headers: res.headers, body, json });
        });
      },
    );
    r.on('error', () => resolve({ status: -1, body: '', json: null, ok: false }));
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

function isTiebreakerEntry(e) {
  return typeof e.title === 'string' && e.title.startsWith(PREFIX);
}

// Strip prefix to get sort key
function stripPrefix(title) {
  return title.replace(PREFIX, '');
}

// ---------------------------------------------------------------
// Suite
// ---------------------------------------------------------------

describe('Issue #179 — Sort tiebreaker (id as secondary sort)', function () {
  let server, cookie;
  const createdIds = [];
  // Track created_at per id for verification
  const tsMap = {};

  before(async function () {
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

  after(function () {
    if (server) server.kill();
  });

  afterEach(async function () {
    // Cleanup all created entries
    const ids = createdIds.splice(0);
    await Promise.all(
      ids.map((id) => request('DELETE', `/api/qa/${id}`, { cookie }).catch(() => {})),
    );
    // Clear tsMap too
    for (const k of Object.keys(tsMap)) delete tsMap[k];
  });

  /**
   * Create a test entry. Created rapidly (no delay) so entries in the same
   * call batch are likely to share the same `datetime('now')` second.
   */
  async function createTbEntry(label) {
    const r = await request('POST', '/api/qa', {
      cookie,
      body: { title: PREFIX + label, question: 'Tiebreaker test entry?', answer: 'Answer' },
    });
    assert.strictEqual(r.status, 201, `POST /api/qa for "${label}" should return 201`);
    const entry = r.json;
    createdIds.push(entry.id);
    tsMap[entry.id] = entry.created_at;
    return entry;
  }

  /** Fetch entries and filter to only tiebreaker entries, preserving API order. */
  async function fetchTbEntries(queryString) {
    const res = await request('GET', `/api/qa?${queryString}`, { cookie });
    assert.strictEqual(res.status, 200, `GET /api/qa?${queryString} should return 200`);
    return res.json.data ? res.json.data.filter(isTiebreakerEntry) : [];
  }

  /**
   * Verify that within a group of entries sharing the same created_at,
   * they are ordered by id in the expected direction.
   */
  function assertOrderedById(entries, direction) {
    if (entries.length < 2) return; // can't test tiebreaker with < 2 same-ts entries

    // Collect timestamps – group by created_at
    const groups = {};
    for (const e of entries) {
      const ts = e.created_at;
      if (!groups[ts]) groups[ts] = [];
      groups[ts].push(e);
    }

    // Find a group with at least 2 entries to test the tiebreaker
    const multiGroups = Object.values(groups).filter((g) => g.length >= 2);
    assert.ok(
      multiGroups.length > 0,
      `Expected at least 2 entries to share the same created_at. ` +
        `Created timestamps: ${JSON.stringify(Object.keys(groups))}, ` +
        `group sizes: ${JSON.stringify(Object.values(groups).map((g) => g.length))}`,
    );

    for (const group of multiGroups) {
      const ids = group.map((e) => e.id);
      const expected =
        direction === 'DESC' ? [...ids].sort((a, b) => b - a) : [...ids].sort((a, b) => a - b);
      assert.deepStrictEqual(
        ids,
        expected,
        `Entries with created_at=${group[0].created_at} should be ordered by id ${direction}. ` +
          `Got ids: ${JSON.stringify(ids)}, expected: ${JSON.stringify(expected)}`,
      );
    }
  }

  // -------------------------------------------------------
  // Test 1: sort=newest — id DESC tiebreaker
  // -------------------------------------------------------
  describe('sort=newest (id DESC tiebreaker)', function () {
    it('returns higher id first among entries with same created_at', async function () {
      // Create 4 entries rapidly — likely same second timestamp
      await createTbEntry('D');
      await createTbEntry('C');
      await createTbEntry('B');
      await createTbEntry('A');

      const entries = await fetchTbEntries('sort=newest');
      assert.strictEqual(entries.length, 4, 'Should find all 4 tiebreaker entries');

      assertOrderedById(entries, 'DESC');
    });
  });

  // -------------------------------------------------------
  // Test 2: sort=oldest — id ASC tiebreaker
  // -------------------------------------------------------
  describe('sort=oldest (id ASC tiebreaker)', function () {
    it('returns lower id first among entries with same created_at', async function () {
      await createTbEntry('D');
      await createTbEntry('C');
      await createTbEntry('B');
      await createTbEntry('A');

      const entries = await fetchTbEntries('sort=oldest');
      assert.strictEqual(entries.length, 4, 'Should find all 4 tiebreaker entries');

      assertOrderedById(entries, 'ASC');
    });
  });

  // -------------------------------------------------------
  // Test 3: sort=popular with max_usage===0 — id DESC tiebreaker
  // -------------------------------------------------------
  describe('sort=popular (no usage data, max_usage===0)', function () {
    it('uses id DESC tiebreaker when no entries have been viewed', async function () {
      await createTbEntry('D');
      await createTbEntry('C');
      await createTbEntry('B');
      await createTbEntry('A');

      // Do NOT view any entries — usage_count remains 0 for all
      const entries = await fetchTbEntries('sort=popular');
      assert.strictEqual(entries.length, 4, 'Should find all 4 tiebreaker entries');

      assertOrderedById(entries, 'DESC');
    });
  });

  // -------------------------------------------------------
  // Test 4: sort=popular with usage data — id DESC tiebreaker within same bucket
  // -------------------------------------------------------
  describe('sort=popular (with usage data, same bucket)', function () {
    it('uses id DESC tiebreaker within same popularity bucket', async function () {
      // Create 5 entries (rapidly → same created_at, auto-increment ids)
      const eA = await createTbEntry('A'); // highest id (created last)
      const eB = await createTbEntry('B');
      const eC = await createTbEntry('C');
      const eD = await createTbEntry('D');
      const eE = await createTbEntry('E'); // lowest id (created first)

      // View eE 20 times → usage_count=20, bucketSize = ceil(20/10)=2, bucket = 1+floor(19/2)=10
      // View eD 20 times → same high bucket
      // All others usage=0 → bucket 1 (the constant)
      for (let i = 0; i < 20; i++) {
        await request('GET', `/api/qa/${eE.id}`, { cookie });
        await request('GET', `/api/qa/${eD.id}`, { cookie });
      }

      const entries = await fetchTbEntries('sort=popular');
      assert.strictEqual(entries.length, 5, 'Should find all 5 tiebreaker entries');

      // High-bucket entries (usage=20): D and E — within same bucket and same created_at, id DESC → D then E
      const titles = entries.map((e) => stripPrefix(e.title));

      // Verify the high-bucket entries appear first with id DESC within the bucket
      const highBucket = entries.filter((e) => e.usage_count >= 20);
      assert.strictEqual(highBucket.length, 2, 'Should have 2 high-usage entries');
      // Within high bucket: same created_at, id DESC → higher id first (D before E)
      assert.strictEqual(
        highBucket[0].id > highBucket[1].id,
        true,
        `High-bucket entries: higher id (${highBucket[0].id}) should come before lower id (${highBucket[1].id})`,
      );

      // Low-bucket entries (usage=0): A, B, C — within same bucket and same created_at, id DESC
      const lowBucket = entries.filter((e) => e.usage_count === 0);
      assert.strictEqual(lowBucket.length, 3, 'Should have 3 zero-usage entries');
      // Within low bucket: same created_at, id DESC → A(id highest), B, C(id lowest)
      assert.strictEqual(
        lowBucket[0].id > lowBucket[1].id && lowBucket[1].id > lowBucket[2].id,
        true,
        `Low-bucket entries: expected id DESC order, got ids ${JSON.stringify(lowBucket.map((e) => e.id))}`,
      );
    });
  });
});
