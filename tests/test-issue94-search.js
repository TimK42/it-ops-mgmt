// Test: Issue #94 - Mobile search keyboard dismiss fix
// Verifies that renderQA/renderUsers preserves search input DOM element on re-render
//
// Usage: npx mocha tests/test-issue94-search.js

const vm = require('vm');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { VALID_STATUSES } = require('../shared/qa-status-constants');

// ============================================================
// One-time bootstrap: load app.js in a shared context
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
  {
    id: 'u4',
    username: 'pending1',
    role: 'Viewer',
    status: 'pending',
    created_at: '2026-02-01T00:00:00.000Z',
  },
  {
    id: 'u5',
    username: 'disabled1',
    role: 'Viewer',
    status: 'disabled',
    created_at: '2026-03-01T00:00:00.000Z',
  },
];

// Fresh DOM for each test (reuses shared app.js globals)
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
  resetDOM();
  const appJsPath = path.resolve(__dirname, '../public/js/app.js');
  const code = fs.readFileSync(appJsPath, 'utf-8');
  vm.runInThisContext(code, { filename: 'app.js' });
});

beforeEach(function () {
  resetDOM();
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
  state.sessionExpired = false;
  state.users = null;
  document.getElementById('page-content').innerHTML = '';

  // Mock helpers
  global.loadQA = async () => {
    return { data: state.qaEntries, total: state.qaTotal, page: state.qaPage };
  };
  global.loadQATotalCount = async () => {
    state.qaTotalCount = null;
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

describe('Issue #94 - Mobile search keyboard dismiss fix', function () {
  // ---------- renderQA: Search DOM Preservation ----------

  it('QA: search input element is preserved after re-render', async function () {
    setupQA();
    const el = document.getElementById('page-content');

    // First render
    await renderQA(el);
    const searchInput1 = document.getElementById('global-search');
    assert.ok(searchInput1, 'Search input should exist after first render');
    assert.strictEqual(searchInput1.tagName, 'INPUT');

    // Set value and trigger second render
    searchInput1.value = 'test search';
    state.qaFilters.search = 'test search';

    await renderQA(el);

    const searchInput2 = document.getElementById('global-search');
    assert.ok(searchInput2, 'Search input should still exist after re-render');
    assert.strictEqual(searchInput2.value, 'test search', 'Input value preserved');
    assert.strictEqual(searchInput2, searchInput1, 'Same DOM node, not replaced');
  });

  it('QA: search input value restored from state after first render', async function () {
    setupQA({ search: 'network' });
    const el = document.getElementById('page-content');

    await renderQA(el);

    const searchInput = document.getElementById('global-search');
    assert.ok(searchInput, 'Search input should exist');
    assert.strictEqual(searchInput.value, 'network', 'Value restored from state');
  });

  // ---------- renderQA: Results Area Updates ----------

  it('QA: results area content changes on re-render with different data', async function () {
    setupQA();
    const el = document.getElementById('page-content');

    await renderQA(el);
    const qaList1 = document.getElementById('qa-list');
    assert.ok(qaList1, 'qa-list exists after first render');
    const firstContent = qaList1.innerHTML;

    // Switch to Draft (only 1 entry)
    state.qaFilters.status = 'Draft';
    state.qaEntries = mockQAEntries.filter((e) => e.status === 'Draft');
    state.qaTotal = state.qaEntries.length;
    global.loadQA = async () => ({ data: state.qaEntries, total: state.qaTotal, page: 1 });

    await renderQA(el);

    const qaList2 = document.getElementById('qa-list');
    assert.ok(qaList2, 'qa-list exists after re-render');
    assert.notStrictEqual(qaList2.innerHTML, firstContent, 'Results changed with different filter');
  });

  // ---------- renderQA: First vs Subsequent Render ----------

  it('QA: first render creates toolbar DOM, subsequent renders preserve it', async function () {
    setupQA();
    const el = document.getElementById('page-content');

    await renderQA(el);

    const searchBefore = document.getElementById('global-search');
    assert.ok(searchBefore, 'Search input after first render');

    const toolbarBefore = document.querySelector('.main > .table-toolbar');
    assert.ok(toolbarBefore, 'Toolbar after first render');

    await renderQA(el);

    const searchAfter = document.getElementById('global-search');
    assert.ok(searchAfter, 'Search input after second render');
    assert.strictEqual(searchAfter, searchBefore, 'Same DOM node for search input');

    const toolbarAfter = document.querySelector('.main > .table-toolbar');
    assert.ok(toolbarAfter, 'Toolbar after second render');
  });

  it('QA: filter tab active state updates without destroying search input', async function () {
    setupQA();
    const el = document.getElementById('page-content');

    await renderQA(el);

    const pubBtn = document.querySelector('[data-qf="Published"]');
    assert.ok(pubBtn, 'Published tab exists');
    assert.ok(pubBtn.classList.contains('active'), 'Published active initially');

    // Switch to All
    state.qaFilters.status = null;

    await renderQA(el);

    const searchInput = document.getElementById('global-search');
    assert.ok(searchInput, 'Search input still exists after filter change');

    assert.ok(pubBtn.classList.contains('active') === false, 'Published tab no longer active');
    const allBtn = document.querySelector('[data-qf=""]');
    assert.ok(allBtn, 'All tab exists');
    assert.ok(allBtn.classList.contains('active'), 'All tab is active');
  });

  // ---------- renderQA: Empty State ----------

  it('QA: empty state renders in qa-list without destroying search input (no results)', async function () {
    setupQA({ qaEntries: [] });
    const el = document.getElementById('page-content');

    await renderQA(el);

    const qaList = document.getElementById('qa-list');
    assert.ok(qaList, 'qa-list exists');
    assert.ok(qaList.innerHTML.includes('No QA entries'), 'Empty state shown');

    const searchInput = document.getElementById('global-search');
    assert.ok(searchInput, 'Search input still exists with empty state');
  });

  // ---------- renderUsers: Search DOM Preservation ----------

  it('Users: search input element is preserved after re-render', async function () {
    setupUsers();
    const el = document.getElementById('page-content');

    await renderUsers(el);
    const searchInput1 = document.getElementById('users-search');
    assert.ok(searchInput1, 'Users search input after first render');
    assert.strictEqual(searchInput1.tagName, 'INPUT');

    searchInput1.value = 'admin';
    state.usersSearch = 'admin';
    state.usersPage = 1;

    await renderUsers(el);

    const searchInput2 = document.getElementById('users-search');
    assert.ok(searchInput2, 'Users search input after re-render');
    assert.strictEqual(searchInput2.value, 'admin', 'Value preserved');
    assert.strictEqual(searchInput2, searchInput1, 'Same DOM node');
  });

  // ---------- renderUsers: Results Updates ----------

  it('Users: results tbody updates on re-render without destroying search input', async function () {
    setupUsers();
    const el = document.getElementById('page-content');

    await renderUsers(el);

    const tbody1 = document.getElementById('users-results-container').querySelector('tbody');
    assert.ok(tbody1, 'tbody exists after first render');
    assert.ok(tbody1.children.length > 0, 'Has rows');

    // Simulate user typing a search term in the DOM
    const searchInput = document.getElementById('users-search');
    searchInput.value = 'viewer1';
    state.usersSearch = 'viewer1';
    state.usersPage = 1;

    await renderUsers(el);

    // After re-render, the search input DOM node should be preserved
    const searchInput2 = document.getElementById('users-search');
    assert.ok(searchInput2, 'Search input exists after re-render');
    assert.strictEqual(searchInput2, searchInput, 'Same DOM node, not replaced');
    // User-typed value should be preserved (DOM not destroyed)
    assert.strictEqual(searchInput2.value, 'viewer1', 'User-typed search value preserved');

    // Results should update based on state
    const rc2 = document.getElementById('users-results-container');
    const tbody2 = rc2.querySelector('tbody');
    assert.ok(tbody2, 'tbody exists after re-render');
    assert.strictEqual(tbody2.children.length, 1, '1 matching user (viewer1)');

    // Verify filter count in toolbar
    const infoEl = document.querySelector('.table-toolbar > div:first-child');
    assert.ok(infoEl, 'Toolbar info exists');
    assert.ok(infoEl.textContent.includes('filtered'), 'Should show filtered count');
  });

  // ---------- renderUsers: Pagination ----------

  it('Users: pagination updates correctly without destroying search input', async function () {
    setupUsers();
    const el = document.getElementById('page-content');

    state.usersPerPage = 2; // 5 users → 3 pages

    await renderUsers(el);

    const pagination1 = el.querySelector('.pagination-bar');
    assert.ok(pagination1, 'Pagination bar exists');
    assert.ok(pagination1.textContent.includes('1'), 'Page 1 shown');

    const searchInput1 = document.getElementById('users-search');
    assert.ok(searchInput1, 'Search input exists');

    state.usersPage = 2;

    await renderUsers(el);

    const searchInput2 = document.getElementById('users-search');
    assert.ok(searchInput2, 'Search input after pagination change');

    const pagination2 = el.querySelector('.pagination-bar');
    assert.ok(pagination2, 'Pagination bar after page change');
    assert.ok(pagination2.textContent.includes('2'), 'Page 2 shown');
  });

  // ---------- renderUsers: First render vs subsequent ----------

  it('Users: first render creates toolbar, subsequent render preserves search input DOM node', async function () {
    setupUsers();
    const el = document.getElementById('page-content');

    await renderUsers(el);

    const searchBefore = document.getElementById('users-search');
    assert.ok(searchBefore);

    await renderUsers(el);

    const searchAfter = document.getElementById('users-search');
    assert.ok(searchAfter);
    assert.strictEqual(searchAfter, searchBefore, 'Same DOM node');
  });

  it('Users: toolbar info text updates on re-render without destroying search input', async function () {
    setupUsers();
    const el = document.getElementById('page-content');

    await renderUsers(el);

    const infoEl = document.querySelector('.table-toolbar > div:first-child');
    assert.ok(infoEl, 'Toolbar info exists');
    assert.ok(infoEl.textContent.includes('5 users'), 'Shows 5 users');

    // Remove some users (simulates delete)
    state.users = mockUsers.slice(0, 2);
    state.usersSearch = '';

    await renderUsers(el);

    const searchInput = document.getElementById('users-search');
    assert.ok(searchInput, 'Search input still exists');

    const infoEl2 = document.querySelector('.table-toolbar > div:first-child');
    assert.ok(infoEl2, 'Toolbar info after update');
    assert.ok(
      infoEl2.textContent.includes('2 users'),
      `Shows 2 users, got "${infoEl2.textContent}"`,
    );
  });
});
