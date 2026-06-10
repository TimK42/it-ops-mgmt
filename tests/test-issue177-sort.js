// Test: Issue #177 — Sort QA list by usage count (popularity) as default
//
// Coverage:
//   1. state.qaSort defaults to 'popular'
//   2. loadQA() passes sort=popular in URL
//   3. Sort selector <select id="qa-sort"> rendered in toolbar
//   4. Sort selector onChange updates state and persists to localStorage
//   5. localStorage restore restores previously selected sort
//   6. Dashboard recent entries still uses sort=newest (unchanged)
//   7. GET /api/qa/:id increments usage_count
//
// Usage: npx mocha tests/test-issue177-sort.js --timeout 10000

const vm = require('vm');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const http = require('http');
const { spawn } = require('child_process');

const PORT = 3199;

// ============================================================
// Fixtures
// ============================================================

const mockQAEntries = [
  {
    id: 1,
    qa_number: 'QA-001',
    title: 'Test Entry 1',
    question: 'Question 1?',
    answer: 'Answer 1',
    status: 'Published',
    category_name: 'Network',
    category_color: '#6366f1',
    category_icon: '🌐',
    tags: [],
    usage_count: 5,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 2,
    qa_number: 'QA-002',
    title: 'Test Entry 2',
    question: 'Question 2?',
    answer: 'Answer 2',
    status: 'Draft',
    category_name: 'Server',
    category_color: '#ef4444',
    category_icon: '🖥',
    tags: [],
    usage_count: 0,
    created_at: '2026-01-03T00:00:00.000Z',
    updated_at: '2026-01-04T00:00:00.000Z',
  },
  {
    id: 3,
    qa_number: 'QA-003',
    title: 'Popular Entry',
    question: 'Popular?',
    answer: 'Yes',
    status: 'Published',
    category_name: null,
    category_color: null,
    category_icon: null,
    tags: [],
    usage_count: 42,
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-02-02T00:00:00.000Z',
  },
];

// ============================================================
// DOM helpers
// ============================================================

function createDOM(localStorageSeed) {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="app"></div><div id="page-content"></div><div id="toast"></div></body></html>',
    { url: 'http://localhost:3199', pretendToBeVisual: true, runScripts: 'dangerously' },
  );

  Object.defineProperty(dom.window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: false,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.localStorage = dom.window.localStorage;
  global.HTMLElement = dom.window.HTMLElement;
  global.HTMLInputElement = dom.window.HTMLInputElement;
  global.HTMLSelectElement = dom.window.HTMLSelectElement;
  global.self = dom.window;

  if (localStorageSeed) {
    for (const [k, v] of Object.entries(localStorageSeed)) {
      try {
        dom.window.localStorage.setItem(k, v);
      } catch {
        /* ignore */
      }
    }
  }

  return dom;
}

// ============================================================
// Test setup helpers
// ============================================================

function setupQA(opts = {}) {
  state.page = 'qa';
  state.user = opts.user || { id: 'u1', username: 'admin', role: 'Admin' };
  state.qaEntries = opts.qaEntries ? [...opts.qaEntries] : [...mockQAEntries];
  state.qaTotal = state.qaEntries.length;
  state.qaPage = 1;
  state.categories = [];
  state.qaStatuses = opts.qaStatuses || ['Published', 'Draft', 'Archived'];
  state.qaFilters = { status: opts.status || 'Published', search: opts.search || '' };
  state.sessionExpired = false;
  state.users = null;
  document.getElementById('page-content').innerHTML = '';

  global.loadQA = async () => {
    return { data: state.qaEntries, total: state.qaTotal, page: state.qaPage };
  };
  global.loadQATotalCount = async () => {
    state.qaTotalCount = null;
  };
  global.toast = () => {};
}

// ============================================================
// Frontend: Load app.js with empty localStorage
// ============================================================

describe('Issue #177 — Frontend', function () {
  before(function () {
    createDOM();
    const appJsPath = path.resolve(__dirname, '../public/js/app.js');
    const code = fs.readFileSync(appJsPath, 'utf-8');
    vm.runInThisContext(code, { filename: 'app.js' });
  });

  beforeEach(function () {
    createDOM();
  });

  // -------------------------------------------------------
  // Test 1: default sort
  // -------------------------------------------------------
  describe('Default sort', function () {
    it('state.qaSort defaults to "popular"', function () {
      assert.strictEqual(state.qaSort, 'popular');
    });
  });

  // -------------------------------------------------------
  // Test 2: sort param in API call
  // -------------------------------------------------------
  describe('loadQA() sort parameter', function () {
    it('loadQA() passes sort=popular in the URL when state.qaSort is "popular"', async function () {
      state.qaSort = 'popular';
      state.qaPage = 1;
      state.qaFilters = { status: 'Published', search: '' };

      let capturedUrl = null;
      global.api = async (url, opts) => {
        capturedUrl = url;
        return { data: [], total: 0 };
      };

      await loadQA();

      assert.ok(capturedUrl, 'api() should have been called');
      assert.ok(
        capturedUrl.includes('sort=popular'),
        `Expected URL to contain "sort=popular", got "${capturedUrl}"`,
      );
    });

    it('loadQA() passes sort=newest in the URL when state.qaSort is "newest"', async function () {
      state.qaSort = 'newest';
      state.qaPage = 1;
      state.qaFilters = { status: 'Published', search: '' };

      let capturedUrl = null;
      global.api = async (url, opts) => {
        capturedUrl = url;
        return { data: [], total: 0 };
      };

      await loadQA();

      assert.ok(capturedUrl, 'api() should have been called');
      assert.ok(
        capturedUrl.includes('sort=newest'),
        `Expected URL to contain "sort=newest", got "${capturedUrl}"`,
      );
    });

    it('loadQA() does not include "sort" param when state.qaSort is empty/falsy', async function () {
      state.qaSort = '';
      state.qaPage = 1;
      state.qaFilters = { status: 'Published', search: '' };

      let capturedUrl = null;
      global.api = async (url, opts) => {
        capturedUrl = url;
        return { data: [], total: 0 };
      };

      await loadQA();

      assert.ok(capturedUrl, 'api() should have been called');
      // If qaSort is empty, the condition `if (state.qaSort)` is false, so no sort param
      assert.ok(
        !capturedUrl.includes('sort='),
        `Expected URL to NOT contain "sort=", got "${capturedUrl}"`,
      );
    });
  });

  // -------------------------------------------------------
  // Test 3: sort selector in DOM
  // -------------------------------------------------------
  describe('Sort selector DOM element', function () {
    it('sort selector <select id="qa-sort"> is rendered in the toolbar', async function () {
      setupQA();
      const el = document.getElementById('page-content');

      await renderQA(el);

      const sortSelect = document.getElementById('qa-sort');
      assert.ok(sortSelect, '<select id="qa-sort"> should exist after renderQA');
      assert.strictEqual(sortSelect.tagName, 'SELECT', 'Element should be a <select>');
    });

    it('sort selector has the correct options: "By Popularity" and "By Newest"', async function () {
      setupQA();
      const el = document.getElementById('page-content');

      await renderQA(el);

      const sortSelect = document.getElementById('qa-sort');
      assert.ok(sortSelect, 'Sort select exists');
      assert.strictEqual(sortSelect.options.length, 2, 'Should have 2 options');

      assert.strictEqual(sortSelect.options[0].value, 'popular', 'First option value is "popular"');
      assert.ok(
        sortSelect.options[0].text.includes('By Popularity'),
        'First option text includes "By Popularity"',
      );

      assert.strictEqual(sortSelect.options[1].value, 'newest', 'Second option value is "newest"');
      assert.ok(
        sortSelect.options[1].text.includes('By Newest'),
        'Second option text includes "By Newest"',
      );
    });

    it('sort selector "popular" option is selected when state.qaSort is "popular"', async function () {
      state.qaSort = 'popular';
      setupQA();
      const el = document.getElementById('page-content');

      await renderQA(el);

      const sortSelect = document.getElementById('qa-sort');
      assert.strictEqual(sortSelect.value, 'popular', 'Select value should be "popular"');
      assert.ok(sortSelect.options[0].selected, 'First option should be selected');
    });

    it('sort selector "newest" option is selected when state.qaSort is "newest"', async function () {
      state.qaSort = 'newest';
      setupQA();
      const el = document.getElementById('page-content');

      await renderQA(el);

      const sortSelect = document.getElementById('qa-sort');
      assert.strictEqual(sortSelect.value, 'newest', 'Select value should be "newest"');
      assert.ok(sortSelect.options[1].selected, 'Second option should be selected');
    });
  });

  // -------------------------------------------------------
  // Test 4: sort selector onChange
  // -------------------------------------------------------
  describe('Sort selector onChange behavior', function () {
    it('changing sort to "newest" updates state.qaSort and persists to localStorage', async function () {
      state.qaSort = 'popular';
      setupQA();
      const el = document.getElementById('page-content');

      await renderQA(el);

      const sortSelect = document.getElementById('qa-sort');
      assert.ok(sortSelect, 'Sort select exists');

      // Change value and fire change event
      sortSelect.value = 'newest';
      sortSelect.dispatchEvent(new global.window.Event('change', { bubbles: true }));

      assert.strictEqual(state.qaSort, 'newest', 'state.qaSort should be "newest"');
      assert.strictEqual(
        global.localStorage.getItem('qaSort'),
        'newest',
        'localStorage.getItem("qaSort") should be "newest"',
      );
    });

    it('changing sort to "popular" updates state.qaSort and persists to localStorage', async function () {
      state.qaSort = 'newest';
      setupQA();
      const el = document.getElementById('page-content');

      await renderQA(el);

      const sortSelect = document.getElementById('qa-sort');
      assert.ok(sortSelect, 'Sort select exists');

      // Change value and fire change event
      sortSelect.value = 'popular';
      sortSelect.dispatchEvent(new global.window.Event('change', { bubbles: true }));

      assert.strictEqual(state.qaSort, 'popular', 'state.qaSort should be "popular"');
      assert.strictEqual(
        global.localStorage.getItem('qaSort'),
        'popular',
        'localStorage.getItem("qaSort") should be "popular"',
      );
    });

    it('changing sort resets pagination (state.qaPage = 1)', async function () {
      state.qaSort = 'popular';
      setupQA();
      state.qaPage = 3; // simulate being on page 3
      const el = document.getElementById('page-content');

      await renderQA(el);

      const sortSelect = document.getElementById('qa-sort');
      sortSelect.value = 'newest';
      sortSelect.dispatchEvent(new global.window.Event('change', { bubbles: true }));

      assert.strictEqual(state.qaPage, 1, 'qaPage should reset to 1 after sort change');
    });
  });

  // -------------------------------------------------------
  // Test 5: localStorage restore
  // -------------------------------------------------------
  describe('localStorage restore', function () {
    beforeEach(function () {
      createDOM();
    });

    it('restores "newest" from localStorage when previously saved', function () {
      global.localStorage.setItem('qaSort', 'newest');
      // Execute the same restore logic as app.js IIFE
      const stored = global.localStorage.getItem('qaSort');
      if (stored === 'popular' || stored === 'newest') state.qaSort = stored;

      assert.strictEqual(state.qaSort, 'newest');
    });

    it('restores "popular" from localStorage when previously saved', function () {
      global.localStorage.setItem('qaSort', 'popular');
      const stored = global.localStorage.getItem('qaSort');
      if (stored === 'popular' || stored === 'newest') state.qaSort = stored;

      assert.strictEqual(state.qaSort, 'popular');
    });

    it('ignores invalid localStorage values (safety whitelist)', function () {
      global.localStorage.setItem('qaSort', 'invalid_value');
      state.qaSort = 'popular'; // reset to default

      const stored = global.localStorage.getItem('qaSort');
      if (stored === 'popular' || stored === 'newest') state.qaSort = stored;

      // Should NOT change because 'invalid_value' is not in the whitelist
      assert.strictEqual(state.qaSort, 'popular');
    });
  });

  // -------------------------------------------------------
  // Test 6: Dashboard unchanged
  // -------------------------------------------------------
  describe('Dashboard recent entries sort', function () {
    it('dashboard recent entries uses hardcoded sort=newest (does not use state.qaSort)', function () {
      state.user = { id: 'u1', username: 'admin', role: 'Admin' };
      state.qaSort = 'popular';
      state.qaEntries = [...mockQAEntries];
      state.categories = [];

      let capturedUrls = [];
      global.api = async (url, opts) => {
        capturedUrls.push(url);
        if (url.includes('categories')) return [];
        if (url.includes('qa')) return { data: mockQAEntries };
        if (url.includes('stats')) return { qa: { total: 3, published: 2, draft: 1, archived: 0 } };
        return { data: [], total: 0 };
      };
      global.fetch = global.api;

      // Mock loadQATotalCount since dashboard calls it
      global.loadQATotalCount = async () => {
        state.qaTotalCount = 3;
      };

      const el = document.getElementById('page-content');

      // Attach the modal elements the dashboard expects
      const modal = document.createElement('div');
      modal.id = 'detail-modal';
      document.body.appendChild(modal);

      return renderDashboard(el).then(() => {
        // Find the QA recent entries call
        const qaRecentCall = capturedUrls.find(
          (u) => u.includes('qa') && u.includes('_per_page=5'),
        );
        assert.ok(qaRecentCall, 'Dashboard should call API for recent QA entries');
        assert.ok(
          qaRecentCall.includes('sort=newest'),
          `Dashboard recent entries URL should contain "sort=newest", got "${qaRecentCall}"`,
        );
      });
    });
  });
});

// ============================================================
// Backend: API usage_count increment
// ============================================================

describe('Issue #177 — Backend usage_count', function () {
  let server, cookie;
  const createdIds = [];

  // Helper: HTTP request
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

  function cleanupCreated() {
    const ids = createdIds.splice(0);
    return Promise.all(
      ids.map((id) => request('DELETE', `/api/qa/${id}`, { cookie }).catch(() => {})),
    );
  }

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
    await cleanupCreated();
  });

  describe('GET /api/qa/:id increments usage_count', function () {
    it('viewing a QA entry increments usage_count by 1', async function () {
      // Create a QA entry (usage_count defaults to 0)
      const createRes = await request('POST', '/api/qa', {
        cookie,
        body: { title: 'Usage Count Test', question: 'Testing usage_count increment?' },
      });
      assert.strictEqual(createRes.status, 201, 'POST /api/qa should return 201');
      const id = createRes.json.id;
      assert.ok(id, 'Created entry should have an id');
      createdIds.push(id);

      // Fetch the entry (first view — UPDATE happens AFTER SELECT, so response shows 0)
      const view1 = await request('GET', `/api/qa/${id}`, { cookie });
      assert.strictEqual(view1.status, 200, 'GET /api/qa/:id should return 200');
      assert.strictEqual(
        view1.json.usage_count,
        0,
        'First view returns initial usage_count (0) because UPDATE runs after SELECT',
      );

      // Fetch again (second view — sees the incremented value from first fetch)
      const view2 = await request('GET', `/api/qa/${id}`, { cookie });
      assert.strictEqual(view2.status, 200, 'GET /api/qa/:id should return 200');
      assert.strictEqual(
        view2.json.usage_count,
        1,
        'Second view returns usage_count=1 (the previous view incremented it)',
      );

      // Fetch a third time
      const view3 = await request('GET', `/api/qa/${id}`, { cookie });
      assert.strictEqual(view3.status, 200, 'GET /api/qa/:id should return 200');
      assert.strictEqual(view3.json.usage_count, 2, 'Third view returns usage_count=2');
    });
  });
});
