// Test: Issue #117 - Hide export button for viewer role
// Verifies that the Export CSV button is only rendered for Admin/Contributor roles
//
// Usage: npx mocha tests/test-issue117-export.js

const vm = require('vm');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { VALID_STATUSES } = require('../shared/qa-status-constants');

// ============================================================
// Mock data
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
    tags: ['tag1', 'tag2'],
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
    created_at: '2026-01-03T00:00:00.000Z',
    updated_at: '2026-01-04T00:00:00.000Z',
  },
  {
    id: 3,
    qa_number: 'QA-003',
    title: 'Search Result',
    question: 'Found?',
    answer: 'Yes',
    status: 'Published',
    category_name: null,
    category_color: null,
    category_icon: null,
    tags: [],
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-02-02T00:00:00.000Z',
  },
];

// ============================================================
// Fresh DOM for each test
// ============================================================

function resetDOM() {
  var dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="app"></div><div id="page-content"></div></body></html>',
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

  return dom;
}

// Bootstrap app.js once before all tests
before(function () {
  // Only bootstrap if not already loaded by a preceding test (same process)
  if (typeof state === 'undefined') {
    resetDOM();
    var appJsPath = path.resolve(__dirname, '../public/js/app.js');
    var code = fs.readFileSync(appJsPath, 'utf-8');
    vm.runInThisContext(code, { filename: 'app.js' });
    // Clean up the bootstrap DOM
    delete global.window;
    delete global.document;
    delete global.navigator;
  }
});

beforeEach(function () {
  resetDOM();
});

// ============================================================
// Helpers
// ============================================================

function setupQA(opts) {
  opts = opts || {};
  state.page = 'qa';
  state.user = opts.user || { id: 'u1', username: 'admin', role: 'Admin' };
  state.qaEntries = opts.qaEntries ? opts.qaEntries.slice() : mockQAEntries.slice();
  state.qaTotal = state.qaEntries.length;
  state.qaPage = 1;
  state.categories = [];
  state.qaStatuses = [...VALID_STATUSES];
  state.qaFilters = { status: opts.status || 'Published', search: opts.search || '' };
  state.sessionExpired = false;
  state.users = null;
  document.getElementById('page-content').innerHTML = '';

  // Mock helpers
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

describe('Issue #117 - Hide export button for viewer role', function () {
  it('hides export button for Viewer role', async function () {
    setupQA({
      user: { id: 'u2', username: 'viewer1', role: 'Viewer' },
    });
    var el = document.getElementById('page-content');

    await renderQA(el);

    var html = el.innerHTML;
    var hasExport = html.indexOf('data-action="export-csv"') !== -1;
    assert.ok(!hasExport, 'Export button should NOT be rendered for Viewer role');
  });

  it('shows export button for Admin role', async function () {
    setupQA({
      user: { id: 'u1', username: 'admin', role: 'Admin' },
    });
    var el = document.getElementById('page-content');

    await renderQA(el);

    var html = el.innerHTML;
    var hasExport = html.indexOf('data-action="export-csv"') !== -1;
    assert.ok(hasExport, 'Export button should be rendered for Admin role');
  });

  it('shows export button for Editor role', async function () {
    setupQA({
      user: { id: 'u3', username: 'editor1', role: 'Editor' },
    });
    var el = document.getElementById('page-content');

    await renderQA(el);

    var html = el.innerHTML;
    var hasExport = html.indexOf('data-action="export-csv"') !== -1;
    assert.ok(hasExport, 'Export button should be rendered for Editor role');
  });

  it('New Entry button also respects role (side-effect check)', async function () {
    // Viewer: neither export nor new entry buttons
    setupQA({
      user: { id: 'u2', username: 'viewer1', role: 'Viewer' },
    });
    var el = document.getElementById('page-content');

    await renderQA(el);

    var html = el.innerHTML;
    var hasExport = html.indexOf('data-action="export-csv"') !== -1;
    var hasCreate = html.indexOf('data-action="create-qa"') !== -1;
    assert.ok(!hasExport, 'Export button hidden for Viewer');
    assert.ok(!hasCreate, 'New Entry button hidden for Viewer (existing guard)');
  });
});
