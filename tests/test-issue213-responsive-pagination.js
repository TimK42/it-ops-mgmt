// Test: Issue #213 — Responsive QA list per-page count
//
// Coverage:
//   1. getPerPage() returns 20 when viewport >= 768px (desktop)
//   2. getPerPage() returns 10 when viewport < 768px (mobile)
//   3. loadQA() uses dynamic _per_page via getPerPage()
//   4. renderQA() pagination display uses dynamic perPage for mobile and desktop
//
// Usage: npx mocha tests/test-issue213-responsive-pagination.js --timeout 15000
/* global getPerPage */

const vm = require('vm');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// ============================================================
// resetDOM — fresh JSDOM for each test, with configurable width
// ============================================================

function resetDOM(width) {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><head></head><body><div id="app"><main class="main" id="main-content"><div id="page-content"><div class="content"></div></div></main></div></body></html>',
    {
      url: 'http://localhost:3199',
      pretendToBeVisual: true,
      runScripts: 'dangerously',
    },
  );

  Object.defineProperty(dom.window, 'matchMedia', {
    writable: true,
    value: function (q) {
      var matches = false;
      if (q.indexOf('max-width') !== -1) {
        var maxW = parseInt(q.match(/(\d+)/), 10);
        matches = width < maxW;
      }
      return {
        matches: matches,
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
  global.HTMLLIElement = dom.window.HTMLLIElement;
  global.self = dom.window;
  global.history = dom.window.history;

  return dom;
}

// Bootstrap app.js once before all tests
before(function () {
  if (typeof state === 'undefined') {
    resetDOM(1024);
    var appJsPath = path.resolve(__dirname, '../public/js/app.js');
    var code = fs.readFileSync(appJsPath, 'utf-8');
    vm.runInThisContext(code, { filename: 'app.js' });
    delete global.window;
    delete global.document;
    delete global.navigator;
  }
});

// ============================================================
// Issue #213 — getPerPage()
// ============================================================

describe('Issue #213 — Responsive QA pagination', function () {
  describe('getPerPage() — viewport-dependent return value', function () {
    it('returns 20 when window.innerWidth is >= 768 (desktop)', function () {
      resetDOM(1024);
      Object.defineProperty(global.window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
      assert.strictEqual(getPerPage(), 20, 'getPerPage() should be 20 at 1024px width');
    });

    it('returns 10 when window.innerWidth is exactly 767 (mobile)', function () {
      resetDOM(767);
      Object.defineProperty(global.window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 767,
      });
      assert.strictEqual(getPerPage(), 10, 'getPerPage() should be 10 at 767px width');
    });

    it('returns 10 when window.innerWidth is 414 (iPhone viewport)', function () {
      resetDOM(414);
      Object.defineProperty(global.window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 414,
      });
      assert.strictEqual(getPerPage(), 10, 'getPerPage() should be 10 at 414px width');
    });

    it('returns 20 when window.innerWidth is exactly 768 (at breakpoint, not below)', function () {
      resetDOM(768);
      Object.defineProperty(global.window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });
      assert.strictEqual(getPerPage(), 20, 'getPerPage() should be 20 at 768px (at breakpoint)');
    });
  });

  // ============================================================
  // loadQA() — uses dynamic _per_page
  // ============================================================

  describe('loadQA() — _per_page parameter', function () {
    var capturedUrls;

    beforeEach(function () {
      capturedUrls = [];

      // Reset state before each test
      state.page = 'qa';
      state.user = { id: 'u1', username: 'admin', role: 'Admin' };
      state.qaEntries = [];
      state.qaCategories = [];
      state.qaStatuses = [];
      state.qaFilters = { status: null, search: '' };
      state.qaSort = 'newest';
      state.qaPage = 1;
      state.qaTotal = 0;
      state.sessionExpired = false;

      global.toast = function () {};

      // Capture the URL passed to api()
      global.api = async function (url) {
        capturedUrls.push(url);
        return { data: [], total: 0, page: 1 };
      };
    });

    it('loadQA() passes _per_page=20 when viewport is desktop width', async function () {
      resetDOM(1024);
      Object.defineProperty(global.window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
      global.api = async function (url) {
        capturedUrls.push(url);
        return { data: [], total: 0, page: 1 };
      };

      await loadQA(new AbortController().signal);

      assert.ok(capturedUrls.length >= 1, 'api() should have been called by loadQA');
      var qp = new URL(capturedUrls[0], 'http://localhost:3199').searchParams;
      assert.strictEqual(qp.get('_page'), '1', '_page should be 1');
      assert.strictEqual(qp.get('_per_page'), '20', '_per_page should be 20 at desktop width');
    });

    it('loadQA() passes _per_page=10 when viewport is mobile width', async function () {
      resetDOM(414);
      Object.defineProperty(global.window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 414,
      });
      global.api = async function (url) {
        capturedUrls.push(url);
        return { data: [], total: 0, page: 1 };
      };

      await loadQA(new AbortController().signal);

      assert.ok(capturedUrls.length >= 1, 'api() should have been called by loadQA');
      var qp = new URL(capturedUrls[0], 'http://localhost:3199').searchParams;
      assert.strictEqual(qp.get('_per_page'), '10', '_per_page should be 10 at mobile width');
    });
  });

  // ============================================================
  // renderQA() — pagination display uses dynamic perPage
  // ============================================================

  describe('renderQA() — pagination display', function () {
    // Helper: generate fake QA entries
    function makeEntries(n) {
      var entries = [];
      for (var i = 1; i <= n; i++) {
        entries.push({
          id: i,
          qa_number: 'QA-' + String(i).padStart(3, '0'),
          title: 'Test Entry ' + i,
          question: 'Question ' + i,
          answer: 'Answer ' + i,
          status: 'Published',
          category_name: 'Network',
          category_color: '#6366f1',
          category_icon: '🌐',
          tags: [],
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        });
      }
      return entries;
    }

    beforeEach(function () {
      state.page = 'qa';
      state.user = { id: 'u1', username: 'admin', role: 'Admin' };
      state.qaEntries = [];
      state.qaStatuses = ['Published', 'Draft', 'Archived'];
      state.qaCategories = [];
      state.qaFilters = { status: null, search: '' };
      state.qaSort = 'newest';
      state.qaPage = 1;
      state.qaTotal = 45;
      state.sessionExpired = false;

      global.toast = function () {};

      global.api = async function (url) {
        return { data: makeEntries(20), total: 45, page: 1 };
      };
    });

    it('renderQA() shows correct totalPages for desktop (20 per page, 45 total = 3 pages)', async function () {
      resetDOM(1024);
      Object.defineProperty(global.window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      // Re-bootstrap api mock after resetDOM clears it
      // Uses beforeEach mock returning entries
      var el = document.getElementById('page-content');
      await renderQA(el);

      // Wait for async rendering to complete
      await new Promise(function (r) {
        return setTimeout(r, 50);
      });

      var pagination = el.querySelector('.pagination');
      assert.ok(pagination, 'Pagination element should be rendered');

      var paginationInfo = pagination.querySelector('.pagination-info');
      assert.ok(paginationInfo, 'Pagination info should exist');

      // Desktop: 20 per page, 45 total should show "1–20 of 45" on page 1
      assert.ok(
        paginationInfo.textContent.indexOf('Showing 1') !== -1,
        'Pagination info should show "Showing 1"',
      );
      assert.ok(
        paginationInfo.textContent.indexOf('of 45') !== -1,
        'Pagination info should show "of 45"',
      );

      // Check page indicator shows "1 / 3" for 45 items at 20/page
      var paginationText = pagination.textContent;
      assert.ok(
        paginationText.indexOf('1 / 3') !== -1,
        'Desktop pagination should show "1 / 3" for 45 items at 20 per page',
      );
    });

    it('renderQA() shows correct totalPages for mobile (10 per page, 45 total = 5 pages)', async function () {
      resetDOM(414);
      Object.defineProperty(global.window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 414,
      });

      // Uses beforeEach mock returning entries
      var el = document.getElementById('page-content');
      await renderQA(el);

      // Wait for async rendering to complete
      await new Promise(function (r) {
        return setTimeout(r, 50);
      });

      var pagination = el.querySelector('.pagination');
      assert.ok(pagination, 'Pagination element should be rendered');

      var paginationText = pagination.textContent;

      // Mobile: 10 per page, 45 total should show "1 / 5"
      assert.ok(
        paginationText.indexOf('1 / 5') !== -1,
        'Mobile pagination should show "1 / 5" for 45 items at 10 per page',
      );

      // Mobile: pagination info should show "Showing 1–10 of 45"
      assert.ok(
        paginationText.indexOf('1\u201310') !== -1 || paginationText.indexOf('1–10') !== -1,
        'Mobile pagination info should show "1–10" range',
      );
    });

    it('renderQA() on page 2 shows correct offset for mobile (10 per page)', async function () {
      resetDOM(414);
      Object.defineProperty(global.window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 414,
      });

      state.qaPage = 2;

      global.api = async function () {
        return { data: makeEntries(20), total: 45, page: 2 };
      };
      global.toast = function () {};

      var el = document.getElementById('page-content');
      await renderQA(el);

      await new Promise(function (r) {
        return setTimeout(r, 50);
      });

      var pagination = el.querySelector('.pagination');
      assert.ok(pagination, 'Pagination element should be rendered');

      var paginationText = pagination.textContent;

      // Page 2 on mobile: 10 per page, showing 11–20 of 45
      assert.ok(
        paginationText.indexOf('11\u201320') !== -1 || paginationText.indexOf('11–20') !== -1,
        'Mobile page 2 should show "11–20" range',
      );

      // Page indicator: 2 / 5
      assert.ok(paginationText.indexOf('2 / 5') !== -1, 'Mobile page 2 should show "2 / 5"');
    });

    it('renderQA() on last page for mobile shows correct remainder (10 per page, 45 total, page 5 = 41–45)', async function () {
      resetDOM(414);
      Object.defineProperty(global.window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 414,
      });

      state.qaPage = 5;

      global.api = async function () {
        return { data: makeEntries(5), total: 45, page: 5 };
      };
      global.toast = function () {};

      var el = document.getElementById('page-content');
      await renderQA(el);

      await new Promise(function (r) {
        return setTimeout(r, 50);
      });

      var pagination = el.querySelector('.pagination');
      assert.ok(pagination, 'Pagination element should be rendered');

      var paginationText = pagination.textContent;

      // Page 5 on mobile: 10 per page, showing 41–45 of 45 (remainder)
      assert.ok(
        paginationText.indexOf('41\u201345') !== -1 || paginationText.indexOf('41–45') !== -1,
        'Mobile page 5 should show "41–45" range (remainder)',
      );

      // Page indicator: 5 / 5
      assert.ok(paginationText.indexOf('5 / 5') !== -1, 'Mobile page 5 should show "5 / 5"');
    });
  });
});
