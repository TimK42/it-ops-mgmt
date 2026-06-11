// Test: Issue #197 — Dashboard toolbar cleanup & status distribution bar
//
// Coverage:
//   1. Toolbar NOT present on Dashboard (regression fix)
//   2. Toolbar is cleaned up when navigating from QA Library → Dashboard
//   3. QA Library STILL has toolbar after returning from Dashboard
//   4. Status distribution section renders on Dashboard
//   5. Status distribution section has correct structure (segments + labels)
//
// Usage: npx mocha tests/test-issue197-dashboard.js --timeout 15000

const vm = require('vm');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// ============================================================
// Mock data
// ============================================================

const mockQAEntries = [
  {
    id: 1,
    qa_number: 'QA-001',
    title: 'Entry 1',
    question: 'Q1?',
    answer: 'A1',
    status: 'Published',
    category_name: 'Network',
    category_color: '#6366f1',
    category_icon: '\u{1F310}',
    tags: ['t1'],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 2,
    qa_number: 'QA-002',
    title: 'Entry 2',
    question: 'Q2?',
    answer: 'A2',
    status: 'Draft',
    category_name: 'Server',
    category_color: '#ef4444',
    category_icon: '\u{1F5A5}',
    tags: [],
    created_at: '2026-01-03T00:00:00.000Z',
    updated_at: '2026-01-04T00:00:00.000Z',
  },
];

const VALID_STATUSES = ['Published', 'Draft', 'Archived'];

// ============================================================
// resetDOM — fresh JSDOM with <main> wrapper for each test
// ============================================================

function resetDOM() {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="app"><main class="main" id="main-content"><div id="page-content"></div></main></div></body></html>',
    {
      url: 'http://localhost:3199',
      pretendToBeVisual: true,
      runScripts: 'dangerously',
    },
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
  global.self = dom.window;

  return dom;
}

// Bootstrap app.js once before all tests
before(function () {
  if (typeof state === 'undefined') {
    resetDOM();
    const appJsPath = path.resolve(__dirname, '../public/js/app.js');
    const code = fs.readFileSync(appJsPath, 'utf-8');
    vm.runInThisContext(code, { filename: 'app.js' });
    delete global.window;
    delete global.document;
    delete global.navigator;
  }
});

// ============================================================
// Helpers
// ============================================================

function setupDashboard(role, apiMocks) {
  state.page = 'dashboard';
  state.user = { id: 'u1', username: 'user', role: role };
  state.qaEntries = [];
  state.categories = [];
  state.qaFilters = { status: null, search: '' };
  state.sessionExpired = false;
  document.getElementById('page-content').innerHTML = '';

  global.api = async function (url, opts) {
    if (apiMocks && apiMocks[url]) {
      if (typeof apiMocks[url] === 'function') return apiMocks[url](url, opts);
      return apiMocks[url];
    }
    if (url === '/api/stats') {
      return { qa: { total: 0, published: 0, draft: 0, archived: 0 }, categories: 0 };
    }
    if (url === '/api/qa?_per_page=5&sort=newest') {
      return { data: [] };
    }
    if (url === '/api/categories') {
      return [];
    }
    return {};
  };
  global.toast = function () {};
}

function setupQA(opts) {
  opts = opts || {};
  state.page = 'qa';
  state.user = opts.user || { id: 'u1', username: 'admin', role: 'Admin' };
  state.qaEntries = opts.qaEntries ? [...opts.qaEntries] : [...mockQAEntries];
  state.qaTotal = state.qaEntries.length;
  state.qaPage = 1;
  state.categories = [];
  state.qaStatuses = [...VALID_STATUSES];
  state.qaFilters = { status: opts.status || 'Published', search: opts.search || '' };
  state.qaSort = opts.sort || 'popular';
  state.sessionExpired = false;
  state.users = null;
  document.getElementById('page-content').innerHTML = '';

  global.loadQA = async function () {
    return { data: state.qaEntries, total: state.qaTotal, page: state.qaPage };
  };
  global.loadQATotalCount = async function () {
    state.qaTotalCount = null;
  };
  global.toast = function () {};
}

// ============================================================
// Tests
// ============================================================

describe('Issue #197 — Dashboard toolbar cleanup & status distribution', function () {
  beforeEach(function () {
    resetDOM();
  });

  // ============================================================
  // Toolbar cleanup
  // ============================================================

  describe('Toolbar cleanup on Dashboard', function () {
    it('Dashboard renders WITHOUT .table-toolbar in the DOM', async function () {
      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 10, published: 5, draft: 3, archived: 2 }, categories: 4 },
        '/api/qa?_per_page=5&sort=newest': { data: [] },
        '/api/categories': [],
      });
      const el = document.getElementById('page-content');
      await renderDashboard(el);

      // Wait for async microtasks to settle
      await new Promise(function (r) { return setTimeout(r, 50); });

      // No toolbar anywhere in the document
      const toolbar = document.querySelector('.table-toolbar');
      assert.strictEqual(toolbar, null, 'Dashboard should NOT have .table-toolbar in the DOM');
    });

    it('Dashboard removes existing toolbar when navigating from QA Library', async function () {
      // Step 1: First render QA Library (which creates the toolbar)
      setupQA();
      const el = document.getElementById('page-content');
      await renderQA(el);

      // Confirm toolbar exists after QA render
      let toolbar = document.querySelector('.main > .table-toolbar');
      assert.ok(toolbar, 'QA Library toolbar should exist in .main');

      // Step 2: Now navigate to Dashboard
      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 10, published: 5, draft: 3, archived: 2 }, categories: 4 },
        '/api/qa?_per_page=5&sort=newest': { data: [] },
        '/api/categories': [],
      });
      await renderDashboard(el);

      // Wait for async microtasks to settle
      await new Promise(function (r) { return setTimeout(r, 50); });

      // Toolbar should be gone
      toolbar = document.querySelector('.table-toolbar');
      assert.strictEqual(toolbar, null, 'Dashboard should NOT have .table-toolbar after navigation from QA Library');
    });

    it('QA Library STILL has toolbar after returning from Dashboard', async function () {
      // Step 1: Render QA Library
      setupQA();
      const el = document.getElementById('page-content');
      await renderQA(el);

      const toolbarBefore = document.querySelector('.main > .table-toolbar');
      assert.ok(toolbarBefore, 'QA Library should have toolbar initially');

      // Step 2: Navigate to Dashboard (this should clean up the toolbar)
      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 10, published: 5, draft: 3, archived: 2 }, categories: 4 },
        '/api/qa?_per_page=5&sort=newest': { data: [] },
        '/api/categories': [],
      });
      await renderDashboard(el);
      await new Promise(function (r) { return setTimeout(r, 50); });

      // Step 3: Return to QA Library — toolbar should be recreated
      setupQA();
      await renderQA(el);

      const toolbarAfter = document.querySelector('.main > .table-toolbar');
      assert.ok(toolbarAfter, 'QA Library should STILL have toolbar after returning from Dashboard');
      assert.strictEqual(
        toolbarAfter.parentElement.className,
        'main',
        'Toolbar should be child of .main after returning from Dashboard',
      );

      // Verify toolbar functionality: buttons are present
      const exportBtn = toolbarAfter.querySelector('[data-action="export-csv"]');
      assert.ok(exportBtn, 'Export button should exist in toolbar after returning from Dashboard');
    });

    it('Multiple navigations QA→Dashboard→QA→Dashboard do not leak toolbars', async function () {
      const el = document.getElementById('page-content');

      // QA → Dashboard → QA → Dashboard
      for (var i = 0; i < 2; i++) {
        setupQA();
        await renderQA(el);

        var toolbarQa = document.querySelectorAll('.table-toolbar').length;
        assert.strictEqual(toolbarQa, 1, 'QA should have exactly 1 toolbar (iteration ' + i + ')');

        setupDashboard('Admin', {
          '/api/stats': { qa: { total: 10, published: 5, draft: 3, archived: 2 }, categories: 4 },
          '/api/qa?_per_page=5&sort=newest': { data: [] },
          '/api/categories': [],
        });
        await renderDashboard(el);
        await new Promise(function (r) { return setTimeout(r, 50); });

        var toolbarDash = document.querySelectorAll('.table-toolbar').length;
        assert.strictEqual(toolbarDash, 0, 'Dashboard should have 0 toolbars (iteration ' + i + ')');
      }
    });
  });

  // ============================================================
  // Status distribution bar
  // ============================================================

  describe('Status distribution bar', function () {
    it('Dashboard renders status distribution section', async function () {
      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 10, published: 5, draft: 3, archived: 2 }, categories: 4 },
        '/api/qa?_per_page=5&sort=newest': { data: [] },
        '/api/categories': [],
      });
      const el = document.getElementById('page-content');
      await renderDashboard(el);

      // Wait for async microtasks to settle
      await new Promise(function (r) { return setTimeout(r, 50); });

      const statusDist = document.querySelector('.status-distribution');
      assert.ok(statusDist, 'Dashboard should have .status-distribution element');
    });

    it('Status distribution contains .distribution-bar and .distribution-labels', async function () {
      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 10, published: 5, draft: 3, archived: 2 }, categories: 4 },
        '/api/qa?_per_page=5&sort=newest': { data: [] },
        '/api/categories': [],
      });
      const el = document.getElementById('page-content');
      await renderDashboard(el);

      await new Promise(function (r) { return setTimeout(r, 50); });

      var dist = document.querySelector('.status-distribution');
      assert.ok(dist, 'Status distribution container exists');

      var bar = dist.querySelector('.distribution-bar');
      assert.ok(bar, 'Status distribution should have .distribution-bar');

      var labels = dist.querySelector('.distribution-labels');
      assert.ok(labels, 'Status distribution should have .distribution-labels');
    });

    it('Distribution bar has three segments (Published, Draft, Archived)', async function () {
      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 10, published: 5, draft: 3, archived: 2 }, categories: 4 },
        '/api/qa?_per_page=5&sort=newest': { data: [] },
        '/api/categories': [],
      });
      const el = document.getElementById('page-content');
      await renderDashboard(el);

      await new Promise(function (r) { return setTimeout(r, 50); });

      var bar = document.querySelector('.distribution-bar');
      var segments = bar.querySelectorAll('.dist-segment');
      assert.strictEqual(segments.length, 3, 'Distribution bar should have 3 segments');

      // Check segment CSS classes
      var classNames = Array.from(segments).map(function (s) { return s.className; });
      assert.ok(classNames.some(function (c) { return c.indexOf('dist-published') !== -1; }), 'Should have .dist-published segment');
      assert.ok(classNames.some(function (c) { return c.indexOf('dist-draft') !== -1; }), 'Should have .dist-draft segment');
      assert.ok(classNames.some(function (c) { return c.indexOf('dist-archived') !== -1; }), 'Should have .dist-archived segment');
    });

    it('Distribution labels show Published, Draft, Archived with percentages', async function () {
      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 10, published: 5, draft: 3, archived: 2 }, categories: 4 },
        '/api/qa?_per_page=5&sort=newest': { data: [] },
        '/api/categories': [],
      });
      const el = document.getElementById('page-content');
      await renderDashboard(el);

      await new Promise(function (r) { return setTimeout(r, 50); });

      var labels = document.querySelector('.distribution-labels');
      var labelText = labels.textContent;

      assert.ok(labelText.indexOf('Published') !== -1, 'Labels should include Published');
      assert.ok(labelText.indexOf('Draft') !== -1, 'Labels should include Draft');
      assert.ok(labelText.indexOf('Archived') !== -1, 'Labels should include Archived');
      assert.ok(labelText.indexOf('50%') !== -1, 'Labels should show 50% for Published');
      assert.ok(labelText.indexOf('30%') !== -1, 'Labels should show 30% for Draft');
      assert.ok(labelText.indexOf('20%') !== -1, 'Labels should show 20% for Archived');
    });

    it('Status distribution shows section title "Status Distribution"', async function () {
      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 10, published: 5, draft: 3, archived: 2 }, categories: 4 },
        '/api/qa?_per_page=5&sort=newest': { data: [] },
        '/api/categories': [],
      });
      const el = document.getElementById('page-content');
      await renderDashboard(el);

      await new Promise(function (r) { return setTimeout(r, 50); });

      var dist = document.querySelector('.status-distribution');
      var html = dist.innerHTML;
      assert.ok(
        html.indexOf('Status Distribution') !== -1,
        'Status distribution should have "Status Distribution" heading'
      );
    });
  });

  // ============================================================
  // CSS verification (static)
  // ============================================================

  describe('CSS — status distribution classes', function () {
    var css;

    before(function () {
      css = fs.readFileSync(path.resolve(__dirname, '../public/css/style.css'), 'utf-8');
    });

    it('CSS has .status-distribution class', function () {
      assert.ok(css.indexOf('.status-distribution') !== -1, 'CSS should define .status-distribution');
    });

    it('CSS has .distribution-bar class', function () {
      assert.ok(css.indexOf('.distribution-bar') !== -1, 'CSS should define .distribution-bar');
    });

    it('CSS has .dist-segment class', function () {
      assert.ok(css.indexOf('.dist-segment') !== -1, 'CSS should define .dist-segment');
    });

    it('CSS has .distribution-labels class', function () {
      assert.ok(css.indexOf('.distribution-labels') !== -1, 'CSS should define .distribution-labels');
    });

    it('CSS .distribution-bar has border-radius: 6px', function () {
      // Match the exact rule block
      var idx = css.indexOf('.distribution-bar');
      if (idx !== -1) {
        // Find the next { and then the properties
        var blockStart = css.indexOf('{', idx);
        var blockEnd = css.indexOf('}', blockStart);
        var block = css.slice(blockStart, blockEnd + 1);
        assert.ok(block.indexOf('border-radius') !== -1, '.distribution-bar should have border-radius');
        assert.ok(block.indexOf('6px') !== -1, '.distribution-bar border-radius should be 6px');
      } else {
        assert.fail('.distribution-bar CSS rule not found');
      }
    });
  });

  // ============================================================
  // Stats card regression: cards still render correctly
  // ============================================================

  describe('Dashboard stats cards — regression check', function () {
    it('5 stat cards still render on Dashboard', async function () {
      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 10, published: 5, draft: 3, archived: 2 }, categories: 4 },
        '/api/qa?_per_page=5&sort=newest': { data: [] },
        '/api/categories': [],
      });
      const el = document.getElementById('page-content');
      await renderDashboard(el);

      await new Promise(function (r) { return setTimeout(r, 50); });

      var grid = document.getElementById('dash-stats');
      assert(grid, 'dash-stats element should exist');
      var cards = grid.querySelectorAll('.stat-card');
      assert.strictEqual(cards.length, 5, 'Should have 5 stat cards');
    });

    it('stats cards show correct Total, Published, Draft, Archived, Sub-Systems labels', async function () {
      setupDashboard('Admin', {
        '/api/stats': { qa: { total: 42, published: 20, draft: 15, archived: 7 }, categories: 8 },
        '/api/qa?_per_page=5&sort=newest': { data: [] },
        '/api/categories': [],
      });
      const el = document.getElementById('page-content');
      await renderDashboard(el);

      await new Promise(function (r) { return setTimeout(r, 50); });

      var numbers = document.querySelectorAll('.stat-number');
      var numTexts = Array.from(numbers).map(function (n) { return n.textContent.trim(); });

      assert.ok(numTexts.indexOf('42') !== -1, 'Total should show 42');
      assert.ok(numTexts.indexOf('20') !== -1, 'Published should show 20');
      assert.ok(numTexts.indexOf('15') !== -1, 'Draft should show 15');
      assert.ok(numTexts.indexOf('7') !== -1, 'Archived should show 7');
      assert.ok(numTexts.indexOf('8') !== -1, 'Sub-Systems should show 8');
    });
  });
});
