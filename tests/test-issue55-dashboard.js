// Tests for Issue #55 — Dashboard improvements
// Changes:
//   1. server.js — GET /api/stats extended with published/draft/archived counts
//   2. public/js/app.js — renderDashboard() rewritten with 5 stat cards, toolbar,
//      recent entries section, sub-system coverage bar chart
//   3. public/css/style.css — Added dashboard CSS classes + CSS variables

const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const { spawn } = require('child_process');

// ============================================================
// Helper: HTTP request
// ============================================================

function req(method, urlPath, opts = {}) {
  return new Promise((resolve) => {
    const headers = {};
    if (opts.body) {
      headers['Content-Type'] = opts.contentType || 'application/json';
    }
    if (opts.cookie) headers['Cookie'] = opts.cookie;

    const r = http.request(
      {
        hostname: '127.0.0.1',
        port: 1399,
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
    r.on('error', (e) => resolve({ status: 0, body: e.message, json: null, ok: false }));
    if (opts.body) r.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    r.end();
  });
}

async function login(username, password) {
  const r = await req('POST', '/api/auth/login', {
    body: { username, password },
  });
  const setCookie = r.headers['set-cookie'] || [];
  const cookie = Array.isArray(setCookie)
    ? setCookie
        .map(function (c) {
          return c.split(';')[0];
        })
        .join('; ')
    : setCookie.split(';')[0];
  return cookie;
}

// ============================================================
// Fresh DOM for each test
// ============================================================

var jsCode;

function resetDOM() {
  var dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="app"><div id="page-content"></div></div><div id="detail-modal"></div><div id="form-modal"><div class="modal-title"></div><div class="modal-body"></div><div class="modal-footer"></div></div><div id="toast"></div></body></html>',
    {
      url: 'http://localhost:3199',
      pretendToBeVisual: true,
      runScripts: 'dangerously',
    },
  );

  Object.defineProperty(dom.window, 'matchMedia', {
    writable: true,
    value: function () {
      return {
        matches: false,
        addListener: function () {},
        removeListener: function () {},
        addEventListener: function () {},
        removeEventListener: function () {},
      };
    },
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.localStorage = dom.window.localStorage;
  global.HTMLElement = dom.window.HTMLElement;
  global.HTMLInputElement = dom.window.HTMLInputElement;
  global.self = dom.window;
  global.history = dom.window.history;

  return dom;
}

// Bootstrap app.js once (if not already loaded by another test file)
before(function () {
  if (typeof renderDashboard !== 'undefined') return; // already bootstrapped
  var appJsPath = path.resolve(__dirname, '../public/js/app.js');
  jsCode = fs.readFileSync(appJsPath, 'utf-8');
  resetDOM();
  vm.runInThisContext(jsCode, { filename: 'app.js' });
  delete global.window;
  delete global.document;
  delete global.navigator;
});

// ============================================================
// Setup helpers for JSDOM tests
// ============================================================

function setupDashboard(role, apiMocks) {
  state.page = 'dashboard';
  state.user = { id: 'u1', username: 'user', role: role };
  state.qaEntries = [];
  state.categories = [];
  state.qaFilters = { status: null, search: '' };
  state.sessionExpired = false;

  // Default api mock that returns empty data
  global.api = async function (url, opts) {
    if (apiMocks && apiMocks[url]) {
      if (typeof apiMocks[url] === 'function') return apiMocks[url](url, opts);
      return apiMocks[url];
    }
    // Default handlers
    if (url === '/api/stats') {
      return { qa: { total: 0, published: 0, draft: 0, archived: 0 }, categories: 0 };
    }
    if (url === '/api/qa?_per_page=5&sort=newest') {
      return [];
    }
    if (url === '/api/categories') {
      return [];
    }
    return {};
  };
  global.toast = function () {};
}

// ============================================================
// Integration Tests (server-based)
// ============================================================

describe('Issue #55 — Dashboard improvements', function () {
  // ============================================================
  // Stats API response shape (server integration)
  // ============================================================

  describe('Stats API — extended response shape', function () {
    let server, cookie;

    before(async function () {
      server = spawn(
        'node',
        ['-e', "require('./server').listen(1399,'127.0.0.1',()=>console.log('ready'))"],
        {
          cwd: path.join(__dirname, '..'),
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      await new Promise((ok, fail) => {
        server.stdout.on('data', (d) => {
          if (d.toString().includes('ready')) ok();
        });
        server.on('error', (e) => fail(e));
        server.on('exit', (code) => {
          if (code !== null) fail(new Error('Server exited early with code ' + code));
        });
        var timeout = setTimeout(() => fail(new Error('Server start timeout (10s)')), 10000);
        server.stdout.on('data', function (d) {
          if (d.toString().includes('ready')) {
            clearTimeout(timeout);
          }
        });
        server.on('error', function () {
          clearTimeout(timeout);
        });
        server.on('exit', function () {
          clearTimeout(timeout);
        });
      });

      cookie = await login('admin', '0000');
    });

    after(function () {
      if (server) server.kill();
    });

    it('GET /api/stats returns qa.total as a number', async function () {
      var r = await req('GET', '/api/stats', { cookie });
      assert.strictEqual(r.status, 200, 'GET /api/stats => 200');
      assert(r.json, 'Response should be JSON');
      assert.strictEqual(typeof r.json.qa.total, 'number', 'qa.total should be a number');
    });

    it('GET /api/stats returns qa.published, qa.draft, qa.archived as numbers', async function () {
      var r = await req('GET', '/api/stats', { cookie });
      assert.strictEqual(typeof r.json.qa.published, 'number', 'qa.published should be a number');
      assert.strictEqual(typeof r.json.qa.draft, 'number', 'qa.draft should be a number');
      assert.strictEqual(typeof r.json.qa.archived, 'number', 'qa.archived should be a number');
    });

    it('GET /api/stats returns categories as a number', async function () {
      var r = await req('GET', '/api/stats', { cookie });
      assert.strictEqual(typeof r.json.categories, 'number', 'categories should be a number');
    });

    it('GET /api/stats status counts are non-negative', async function () {
      var r = await req('GET', '/api/stats', { cookie });
      assert.ok(r.json.qa.published >= 0, 'published count should be >= 0');
      assert.ok(r.json.qa.draft >= 0, 'draft count should be >= 0');
      assert.ok(r.json.qa.archived >= 0, 'archived count should be >= 0');
    });

    it('GET /api/stats status sub-counts sum does not exceed total', async function () {
      var r = await req('GET', '/api/stats', { cookie });
      var sum = (r.json.qa.published || 0) + (r.json.qa.draft || 0) + (r.json.qa.archived || 0);
      assert.ok(
        sum <= r.json.qa.total,
        'Sum of published + draft + archived (' +
          sum +
          ') should not exceed total (' +
          r.json.qa.total +
          ')',
      );
    });

    it('GET /api/stats returns all expected top-level keys', async function () {
      var r = await req('GET', '/api/stats', { cookie });
      assert.ok('qa' in r.json, 'Response should have "qa" key');
      assert.ok('categories' in r.json, 'Response should have "categories" key');
    });

    it('GET /api/stats returns all expected nested keys in qa', async function () {
      var r = await req('GET', '/api/stats', { cookie });
      assert.ok('total' in r.json.qa, 'qa should have "total" key');
      assert.ok('published' in r.json.qa, 'qa should have "published" key');
      assert.ok('draft' in r.json.qa, 'qa should have "draft" key');
      assert.ok('archived' in r.json.qa, 'qa should have "archived" key');
    });
  });

  // ============================================================
  // Frontend: Dashboard rendering (JSDOM)
  // ============================================================

  describe('Dashboard rendering — stats cards', function () {
    beforeEach(function () {
      resetDOM();
    });
    it('renderDashboard creates 5 stat cards in the stats grid', async function () {
      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 10, published: 5, draft: 3, archived: 2 }, categories: 4 },
        '/api/qa?_per_page=5&sort=newest': [],
        '/api/categories': [],
      });
      var el = document.getElementById('page-content');
      await renderDashboard(el);

      var grid = document.getElementById('dash-stats');
      assert(grid, 'dash-stats element should exist');
      var cards = grid.querySelectorAll('.stat-card');
      assert.strictEqual(cards.length, 5, 'Should have 5 stat cards');
    });

    it('stats cards display Total, Published, Draft, Archived, Sub-Systems labels', async function () {
      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 10, published: 5, draft: 3, archived: 2 }, categories: 4 },
        '/api/qa?_per_page=5&sort=newest': [],
        '/api/categories': [],
      });
      var el = document.getElementById('page-content');
      await renderDashboard(el);

      var grid = document.getElementById('dash-stats');
      var labels = grid.querySelectorAll('.stat-label');
      var labelTexts = Array.from(labels).map(function (l) {
        return l.textContent.trim();
      });

      assert.ok(
        labelTexts.indexOf('Total QA Entries') !== -1,
        'Should have "Total QA Entries" card',
      );
      assert.ok(labelTexts.indexOf('Published') !== -1, 'Should have "Published" card');
      assert.ok(labelTexts.indexOf('Draft') !== -1, 'Should have "Draft" card');
      assert.ok(labelTexts.indexOf('Archived') !== -1, 'Should have "Archived" card');
      assert.ok(labelTexts.indexOf('Sub-Systems') !== -1, 'Should have "Sub-Systems" card');
    });

    it('stats cards display correct numeric values', async function () {
      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 42, published: 20, draft: 15, archived: 7 }, categories: 8 },
        '/api/qa?_per_page=5&sort=newest': [],
        '/api/categories': [],
      });
      var el = document.getElementById('page-content');
      await renderDashboard(el);

      var grid = document.getElementById('dash-stats');
      var numbers = grid.querySelectorAll('.stat-number');
      var numTexts = Array.from(numbers).map(function (n) {
        return n.textContent.trim();
      });

      assert.ok(numTexts.indexOf('42') !== -1, 'Total should show 42');
      assert.ok(numTexts.indexOf('20') !== -1, 'Published should show 20');
      assert.ok(numTexts.indexOf('15') !== -1, 'Draft should show 15');
      assert.ok(numTexts.indexOf('7') !== -1, 'Archived should show 7');
      assert.ok(numTexts.indexOf('8') !== -1, 'Sub-Systems should show 8');
    });

    it('stats cards use correct CSS color vars for Published (success)', async function () {
      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 10, published: 5, draft: 3, archived: 2 }, categories: 4 },
        '/api/qa?_per_page=5&sort=newest': [],
        '/api/categories': [],
      });
      var el = document.getElementById('page-content');
      await renderDashboard(el);

      var grid = document.getElementById('dash-stats');
      var numbers = grid.querySelectorAll('.stat-number');
      // Published card is index 1 (0=Total, 1=Published, 2=Draft, 3=Archived, 4=Sub-Systems)
      var publishedNum = numbers[1];
      assert.ok(
        publishedNum.getAttribute('style').indexOf('var(--success)') !== -1,
        'Published card should use --success color',
      );
    });
  });

  describe('Dashboard rendering — toolbar', function () {
    beforeEach(function () {
      resetDOM();
    });
    it('Admin sees ＋ New Entry button in toolbar', async function () {
      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 0, published: 0, draft: 0, archived: 0 }, categories: 0 },
        '/api/qa?_per_page=5&sort=newest': [],
        '/api/categories': [],
      });
      var el = document.getElementById('page-content');
      await renderDashboard(el);

      var html = el.innerHTML;
      assert.ok(html.indexOf('New Entry') !== -1, 'Admin should see New Entry button');
      assert.ok(html.indexOf('Export All') !== -1, 'Admin should see Export All button');
    });

    it('Editor sees ＋ New Entry button in toolbar', async function () {
      setupDashboard('Editor', {
        '/api/stats': { qa: { total: 0, published: 0, draft: 0, archived: 0 }, categories: 0 },
        '/api/qa?_per_page=5&sort=newest': [],
        '/api/categories': [],
      });
      var el = document.getElementById('page-content');
      await renderDashboard(el);

      var html = el.innerHTML;
      assert.ok(html.indexOf('New Entry') !== -1, 'Editor should see New Entry button');
    });

    it('Viewer does NOT see ＋ New Entry button in toolbar', async function () {
      setupDashboard('Viewer', {
        '/api/stats': { qa: { total: 0, published: 0, draft: 0, archived: 0 }, categories: 0 },
        '/api/qa?_per_page=5&sort=newest': [],
        '/api/categories': [],
      });
      var el = document.getElementById('page-content');
      await renderDashboard(el);

      var html = el.innerHTML;
      assert.ok(html.indexOf('New Entry') === -1, 'Viewer should NOT see New Entry button');
    });
  });

  describe('Dashboard rendering — recent entries', function () {
    beforeEach(function () {
      resetDOM();
    });
    it('recent entries section renders with loaded data', async function () {
      var entries = [
        {
          id: 1,
          title: 'First Entry',
          status: 'Published',
          category_name: 'CAD',
          category_color: '#6366f1',
          category_icon: '\u{1F4D0}',
        },
        {
          id: 2,
          title: 'Second Entry',
          status: 'Draft',
          category_name: 'Network',
          category_color: '#ef4444',
          category_icon: '\u{1F4F6}',
        },
      ];

      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 2, published: 1, draft: 1, archived: 0 }, categories: 2 },
        '/api/qa?_per_page=5&sort=newest': { data: entries },
        '/api/categories': [],
      });
      var el = document.getElementById('page-content');
      await renderDashboard(el);

      var recentSection = document.getElementById('dash-recent');
      assert(recentSection, 'dash-recent element should exist');

      var recentEntries = recentSection.querySelectorAll('.recent-entry');
      assert.strictEqual(recentEntries.length, 2, 'Should render 2 recent entries');

      var firstTitle = recentEntries[0].querySelector('.recent-entry-title');
      assert(firstTitle, 'Entry should have title element');
      assert.strictEqual(
        firstTitle.textContent.trim(),
        'First Entry',
        'First entry title should match',
      );
    });

    it('recent entries shows empty state when no entries', async function () {
      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 0, published: 0, draft: 0, archived: 0 }, categories: 0 },
        '/api/qa?_per_page=5&sort=newest': { data: [] },
        '/api/categories': [],
      });
      var el = document.getElementById('page-content');
      await renderDashboard(el);

      var recentSection = document.getElementById('dash-recent');
      assert(recentSection, 'dash-recent should exist');
      var html = recentSection.innerHTML;
      assert.ok(html.indexOf('No entries yet') !== -1, 'Empty state should show "No entries yet"');
    });

    it('recent entries section title has "View All" link', async function () {
      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 0, published: 0, draft: 0, archived: 0 }, categories: 0 },
        '/api/qa?_per_page=5&sort=newest': { data: [] },
        '/api/categories': [],
      });
      var el = document.getElementById('page-content');
      await renderDashboard(el);

      var recentSection = document.getElementById('dash-recent');
      var html = recentSection.innerHTML;
      assert.ok(html.indexOf('View All') !== -1, 'Should have "View All" link');
    });
  });

  describe('Dashboard rendering — sub-system coverage bar chart', function () {
    beforeEach(function () {
      resetDOM();
    });
    it('bar chart section renders category coverage', async function () {
      var categories = [
        { name: 'CAD', icon: '\u{1F4D0}', qa_count: 10, color: '#6366f1' },
        { name: 'Network', icon: '\u{1F4F6}', qa_count: 5, color: '#ef4444' },
        { name: 'Security', icon: '\u{1F512}', qa_count: 3, color: '#22c55e' },
      ];

      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 18, published: 10, draft: 5, archived: 3 }, categories: 3 },
        '/api/qa?_per_page=5&sort=newest': { data: [] },
        '/api/categories': categories,
      });
      var el = document.getElementById('page-content');
      await renderDashboard(el);

      var barSection = document.getElementById('dash-bars');
      assert(barSection, 'dash-bars element should exist');

      var barRows = barSection.querySelectorAll('.bar-row');
      assert.strictEqual(barRows.length, 3, 'Should render 3 category bars');

      var firstCount = barRows[0].querySelector('.bar-count');
      assert.strictEqual(firstCount.textContent.trim(), '10', 'First bar count should be 10');
    });

    it('bar chart shows empty state when no categories', async function () {
      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 0, published: 0, draft: 0, archived: 0 }, categories: 0 },
        '/api/qa?_per_page=5&sort=newest': { data: [] },
        '/api/categories': [],
      });
      var el = document.getElementById('page-content');
      await renderDashboard(el);

      var barSection = document.getElementById('dash-bars');
      assert(barSection, 'dash-bars should exist');
      var html = barSection.innerHTML;
      assert.ok(
        html.indexOf('No sub-systems configured') !== -1,
        'Empty state should show "No sub-systems configured"',
      );
    });
  });

  describe('Dashboard rendering — error handling', function () {
    beforeEach(function () {
      resetDOM();
    });
    it('stats API failure shows error message', async function () {
      setupDashboard('Admin', {
        '/api/stats': function () {
          return Promise.reject(new Error('API error'));
        },
        '/api/qa?_per_page=5&sort=newest': { data: [] },
        '/api/categories': [],
      });
      var el = document.getElementById('page-content');
      await renderDashboard(el);

      // Wait for async microtasks to settle
      await new Promise((r) => setTimeout(r, 50));

      var dashStats = document.getElementById('dash-stats');
      if (dashStats) {
        var html = dashStats.innerHTML;
        assert.ok(
          html.indexOf('Failed to load stats') !== -1,
          'Stats error should show "Failed to load stats"',
        );
      }
    });

    it('recent entries API failure shows error message', async function () {
      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 0, published: 0, draft: 0, archived: 0 }, categories: 0 },
        '/api/qa?_per_page=5&sort=newest': function () {
          return Promise.reject(new Error('API error'));
        },
        '/api/categories': [],
      });
      var el = document.getElementById('page-content');
      await renderDashboard(el);

      // Wait for async microtasks to settle
      await new Promise((r) => setTimeout(r, 50));

      var recentSection = document.getElementById('dash-recent');
      if (recentSection) {
        var html = recentSection.innerHTML;
        assert.ok(
          html.indexOf('Failed to load recent entries') !== -1,
          'Recent entries error should show "Failed to load recent entries"',
        );
      }
    });

    it('categories API failure shows error message', async function () {
      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 0, published: 0, draft: 0, archived: 0 }, categories: 0 },
        '/api/qa?_per_page=5&sort=newest': { data: [] },
        '/api/categories': function () {
          return Promise.reject(new Error('API error'));
        },
      });
      var el = document.getElementById('page-content');
      await renderDashboard(el);

      // Wait for async microtasks to settle
      await new Promise((r) => setTimeout(r, 50));

      var barSection = document.getElementById('dash-bars');
      if (barSection) {
        var html = barSection.innerHTML;
        assert.ok(
          html.indexOf('Failed to load coverage data') !== -1,
          'Categories error should show "Failed to load coverage data"',
        );
      }
    });

    it('one API failure does not cascade to other sections', async function () {
      setupDashboard('Admin', {
        '/api/stats': function () {
          return Promise.reject(new Error('Stats fail'));
        },
        '/api/qa?_per_page=5&sort=newest': {
          data: [{ id: 1, title: 'Test', status: 'Published' }],
        },
        '/api/categories': [{ name: 'CAD', icon: '\u{1F4D0}', qa_count: 5, color: '#6366f1' }],
      });
      var el = document.getElementById('page-content');
      await renderDashboard(el);

      // Wait for async microtasks to settle
      await new Promise((r) => setTimeout(r, 50));

      var dashStats = document.getElementById('dash-stats');
      if (dashStats) {
        assert.ok(
          dashStats.innerHTML.indexOf('Failed to load stats') !== -1,
          'Stats should show error',
        );
      }

      var recentSection = document.getElementById('dash-recent');
      if (recentSection) {
        assert.ok(
          recentSection.innerHTML.indexOf('Test') !== -1,
          'Recent entries should still load despite stats failure',
        );
      }

      var barSection = document.getElementById('dash-bars');
      if (barSection) {
        assert.ok(
          barSection.innerHTML.indexOf('CAD') !== -1,
          'Bar chart should still load despite stats failure',
        );
      }
    });
  });

  // ============================================================
  // CSS changes verification
  // ============================================================

  describe('CSS — dashboard classes and variables', function () {
    var css;

    before(function () {
      css = fs.readFileSync(path.resolve(__dirname, '../public/css/style.css'), 'utf-8');
    });

    it('CSS has --success variable', function () {
      assert.ok(css.indexOf('--success:') !== -1, 'CSS should define --success variable');
    });

    it('CSS has --warning variable', function () {
      assert.ok(css.indexOf('--warning:') !== -1, 'CSS should define --warning variable');
    });

    it('CSS has --link variable', function () {
      assert.ok(css.indexOf('--link:') !== -1, 'CSS should define --link variable');
    });

    it('CSS has --radius-md variable', function () {
      assert.ok(css.indexOf('--radius-md:') !== -1, 'CSS should define --radius-md variable');
    });

    it('CSS has .section-title class', function () {
      assert.ok(css.indexOf('.section-title') !== -1, 'CSS should define .section-title');
    });

    it('CSS has .recent-list class', function () {
      assert.ok(css.indexOf('.recent-list') !== -1, 'CSS should define .recent-list');
    });

    it('CSS has .recent-entry class', function () {
      assert.ok(css.indexOf('.recent-entry') !== -1, 'CSS should define .recent-entry');
    });

    it('CSS has .bar-chart class', function () {
      assert.ok(css.indexOf('.bar-chart') !== -1, 'CSS should define .bar-chart');
    });

    it('CSS has .bar-row class', function () {
      assert.ok(css.indexOf('.bar-row') !== -1, 'CSS should define .bar-row');
    });

    it('CSS has .bar-fill class', function () {
      assert.ok(css.indexOf('.bar-fill') !== -1, 'CSS should define .bar-fill');
    });

    it('CSS has mobile responsive @media query for dashboard', function () {
      // The dashboard @media block is the last one — verify it contains dashboard-specific selectors
      var lastMediaIdx = css.lastIndexOf('@media (max-width: 768px)');
      assert.ok(lastMediaIdx !== -1, 'CSS should have mobile @media query');

      var block = css.slice(lastMediaIdx);
      assert.ok(block.indexOf('.recent-entry') !== -1, 'Mobile @media should target .recent-entry');
      assert.ok(block.indexOf('.bar-label') !== -1, 'Mobile @media should target .bar-label');
    });
  });
});
