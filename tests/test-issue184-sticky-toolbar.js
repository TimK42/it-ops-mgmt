// Test: Issue #184 - Sticky toolbar (table-toolbar moved from .content to .main)
// Verifies that renderQA, renderCategories, and renderUsers all produce
// the correct DOM structure: .table-toolbar as child of .main, list/table inside .content.
//
// Usage: npx mocha tests/test-issue184-sticky-toolbar.js

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
    title: 'Entry 1',
    question: 'Q1?',
    answer: 'A1',
    status: 'Published',
    category_name: 'Network',
    category_color: '#6366f1',
    category_icon: '🌐',
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
    category_icon: '🖥',
    tags: [],
    created_at: '2026-01-03T00:00:00.000Z',
    updated_at: '2026-01-04T00:00:00.000Z',
  },
];

const mockCategories = [
  { id: 1, name: 'Network', icon: '🌐', color: '#6366f1', qa_count: 5 },
  { id: 2, name: 'Server', icon: '🖥', color: '#ef4444', qa_count: 3 },
  { id: 3, name: 'Security', icon: '🔒', color: '#10b981', qa_count: 0 },
];

const mockUsers = [
  {
    id: 'u1',
    username: 'admin',
    role: 'Admin',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'u2',
    username: 'viewer1',
    role: 'Viewer',
    status: 'active',
    created_at: '2026-01-05T00:00:00.000Z',
  },
  {
    id: 'u3',
    username: 'contrib1',
    role: 'Editor',
    status: 'active',
    created_at: '2026-01-10T00:00:00.000Z',
  },
];

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

// ============================================================
// Helpers
// ============================================================

function setupQA(opts = {}) {
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

  global.loadQA = async () => {
    return { data: state.qaEntries, total: state.qaTotal, page: state.qaPage };
  };
  global.loadQATotalCount = async () => {
    state.qaTotalCount = null;
  };
  global.toast = () => {};
}

function setupCategories(opts = {}) {
  state.page = 'categories';
  state.user = opts.user || { id: 'u1', username: 'admin', role: 'Admin' };
  state.categories = opts.categories ? [...opts.categories] : [...mockCategories];
  state.qaEntries = [];
  state.users = null;
  document.getElementById('page-content').innerHTML = '';

  global.loadCategories = async () => {
    // loadCategories sets state.categories via API call; already set above
  };
  global.toast = () => {};
}

function setupUsers(opts = {}) {
  state.page = 'users';
  state.user = opts.user || { id: 'u1', username: 'admin', role: 'Admin' };
  state.users = opts.users ? [...opts.users] : [...mockUsers];
  state.usersPage = 1;
  state.usersPerPage = 20;
  state.usersSearch = opts.search || '';
  state.qaEntries = [];
  document.getElementById('page-content').innerHTML = '';

  global.loadUsers = async () => {};
  global.toast = () => {};
}

// ============================================================
// Tests
// ============================================================

describe('Issue #184 - Sticky toolbar DOM structure', function () {
  beforeEach(function () {
    resetDOM();
  });

  // ---------- QA toolbar DOM structure ----------

  it('QA: .table-toolbar is child of .main (not .content) after renderQA()', async function () {
    setupQA();
    const el = document.getElementById('page-content');

    await renderQA(el);

    // Toolbar should be a child of .main, NOT inside .content
    const toolbar = document.querySelector('.main > .table-toolbar');
    assert.ok(toolbar, 'Toolbar should exist as direct child of .main');
    assert.ok(toolbar.parentElement.classList.contains('main'), 'Toolbar parent is .main');

    // Toolbar should NOT be inside #page-content
    const toolbarInContent = el.querySelector('.table-toolbar');
    assert.strictEqual(toolbarInContent, null, 'Toolbar should NOT be inside .content');

    // qa-list should be inside .content
    const qaList = el.querySelector('.qa-list, #qa-list');
    assert.ok(qaList, 'qa-list should exist inside .content');
    assert.ok(el.contains(qaList), 'qa-list is inside #page-content');
  });

  // ---------- Categories toolbar DOM structure ----------

  it('Categories: .table-toolbar is child of .main, table inside .content after renderCategories()', async function () {
    setupCategories();
    const el = document.getElementById('page-content');

    await renderCategories(el);

    // Toolbar should be child of .main
    const toolbar = document.querySelector('.main > .table-toolbar');
    assert.ok(toolbar, 'Categories toolbar should exist as direct child of .main');
    assert.ok(toolbar.parentElement.classList.contains('main'), 'Toolbar parent is .main');

    // Toolbar should NOT be inside #page-content
    const toolbarInContent = el.querySelector('.table-toolbar');
    assert.strictEqual(toolbarInContent, null, 'Categories toolbar should NOT be inside .content');

    // Table should be inside .content
    const table = el.querySelector('.table-container, table');
    assert.ok(table, 'Table should exist inside .content');
    assert.ok(el.contains(table), 'Table is inside #page-content');

    // Toolbar should show category count
    const infoText = toolbar.textContent;
    assert.ok(
      infoText.includes('3 sub-systems'),
      `Toolbar should show "3 sub-systems", got "${infoText}"`,
    );
  });

  // ---------- Users toolbar DOM structure ----------

  it('Users: .table-toolbar is child of .main, table inside .content after renderUsers()', async function () {
    setupUsers();
    const el = document.getElementById('page-content');

    await renderUsers(el);

    // Toolbar should be child of .main
    const toolbar = document.querySelector('.main > .table-toolbar');
    assert.ok(toolbar, 'Users toolbar should exist as direct child of .main');
    assert.ok(toolbar.parentElement.classList.contains('main'), 'Toolbar parent is .main');

    // Toolbar should NOT be inside #page-content
    const toolbarInContent = el.querySelector('.table-toolbar');
    assert.strictEqual(toolbarInContent, null, 'Users toolbar should NOT be inside .content');

    // Results container should be inside .content
    const resultsContainer = el.querySelector('#users-results-container');
    assert.ok(resultsContainer, 'Users results container should exist inside .content');
    assert.ok(el.contains(resultsContainer), 'Users results container is inside #page-content');

    // Toolbar should show user count
    const infoText = toolbar.textContent;
    assert.ok(infoText.includes('3 users'), `Toolbar should show "3 users", got "${infoText}"`);
  });

  // ---------- Toolbar re-render (QA) ----------

  it('QA: toolbar persists as child of .main on re-render and is not duplicated', async function () {
    setupQA();
    const el = document.getElementById('page-content');

    // First render
    await renderQA(el);

    const toolbarCount1 = document.querySelectorAll('.main > .table-toolbar').length;
    assert.strictEqual(toolbarCount1, 1, 'Exactly 1 toolbar in .main after first render');

    const toolbar1 = document.querySelector('.main > .table-toolbar');
    assert.ok(toolbar1, 'Toolbar exists after first render');

    // Second render (subsequent - different filter)
    state.qaFilters.status = 'Draft';
    state.qaEntries = mockQAEntries.filter((e) => e.status === 'Draft');
    state.qaTotal = state.qaEntries.length;
    global.loadQA = async () => ({ data: state.qaEntries, total: state.qaTotal, page: 1 });

    await renderQA(el);

    // Still exactly 1 toolbar (not duplicated)
    const toolbarCount2 = document.querySelectorAll('.main > .table-toolbar').length;
    assert.strictEqual(
      toolbarCount2,
      1,
      'Exactly 1 toolbar in .main after re-render (no duplicates)',
    );

    const toolbar2 = document.querySelector('.main > .table-toolbar');
    assert.ok(toolbar2, 'Toolbar still exists after re-render');

    // Same toolbar DOM node (not replaced)
    assert.strictEqual(toolbar2, toolbar1, 'Same toolbar DOM node, not recreated');

    // Toolbar still NOT inside .content
    const toolbarInContent = el.querySelector('.table-toolbar');
    assert.strictEqual(toolbarInContent, null, 'Toolbar still NOT inside .content after re-render');
  });

  // ---------- Users re-render ----------

  it('Users: toolbar info text updates on re-render, toolbar stays as child of .main', async function () {
    setupUsers();
    const el = document.getElementById('page-content');

    // First render
    await renderUsers(el);

    const toolbar1 = document.querySelector('.main > .table-toolbar');
    assert.ok(toolbar1, 'Toolbar exists after first render');
    assert.ok(toolbar1.textContent.includes('3 users'), 'Shows 3 users');

    // Simulate removing a user and re-rendering
    state.users = mockUsers.slice(0, 1); // Only 'admin'
    state.usersSearch = '';

    await renderUsers(el);

    // Toolbar still child of .main
    const toolbar2 = document.querySelector('.main > .table-toolbar');
    assert.ok(toolbar2, 'Toolbar exists after re-render');
    assert.strictEqual(toolbar2.parentElement.className, 'main', 'Toolbar parent still .main');

    // Toolbar info updated
    assert.ok(
      toolbar2.textContent.includes('1 user'),
      `Toolbar should show "1 user", got "${toolbar2.textContent}"`,
    );

    // Still exactly 1 toolbar (no duplicates)
    const count = document.querySelectorAll('.main > .table-toolbar').length;
    assert.strictEqual(count, 1, 'No duplicate toolbars');

    // Toolbar NOT inside .content
    const toolbarInContent = el.querySelector('.table-toolbar');
    assert.strictEqual(toolbarInContent, null, 'Toolbar still NOT inside .content');
  });

  // ---------- Edge case: empty categories ----------

  it('Categories: renders toolbar correctly even with 0 categories', async function () {
    setupCategories({ categories: [] });
    const el = document.getElementById('page-content');

    await renderCategories(el);

    // Toolbar should still exist as child of .main
    const toolbar = document.querySelector('.main > .table-toolbar');
    assert.ok(toolbar, 'Toolbar should exist even with 0 categories');
    assert.ok(toolbar.parentElement.classList.contains('main'), 'Toolbar parent is .main');

    // Toolbar shows 0
    assert.ok(
      toolbar.textContent.includes('0 sub-systems'),
      `Toolbar should show "0 sub-systems", got "${toolbar.textContent}"`,
    );

    // Toolbar should still have the create button
    const createBtn = toolbar.querySelector('[data-action="create-category"]');
    assert.ok(createBtn, 'Create category button should exist in toolbar even with 0 categories');

    // Content should have table (possibly empty)
    const table = el.querySelector('.table-container, table');
    assert.ok(table, 'Table container should exist inside .content even with 0 categories');

    // Toolbar NOT inside .content
    const toolbarInContent = el.querySelector('.table-toolbar');
    assert.strictEqual(toolbarInContent, null, 'Toolbar should NOT be inside .content');
  });

  // ---------- Button delegation: buttons still in toolbar ----------

  it('QA: export and create buttons are still in the toolbar (.main > .table-toolbar)', async function () {
    setupQA();
    const el = document.getElementById('page-content');

    await renderQA(el);

    const toolbar = document.querySelector('.main > .table-toolbar');
    assert.ok(toolbar, 'Toolbar exists');

    // Export button should be in toolbar
    const exportBtn = toolbar.querySelector('[data-action="export-csv"]');
    assert.ok(exportBtn, 'Export button should be in toolbar');

    // Create QA button should be in toolbar
    const createBtn = toolbar.querySelector('[data-action="create-qa"]');
    assert.ok(createBtn, 'Create QA button should be in toolbar');

    // Buttons should NOT be inside .content
    const exportInContent = el.querySelector('[data-action="export-csv"]');
    assert.strictEqual(exportInContent, null, 'Export button should NOT be inside .content');

    const createInContent = el.querySelector('[data-action="create-qa"]');
    assert.strictEqual(createInContent, null, 'Create button should NOT be inside .content');
  });
});
