// Test: Archive button visibility by role (Issue #121-123)
// Admin sees Delete, Editor sees Archive, Viewer sees neither
// Runs against real app.js code in JSDOM context

const vm = require('vm');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// ============================================================
// Mock data
// ============================================================

const mockQAEntry = {
  id: 1,
  qa_number: 'QA-0001',
  title: 'Test Entry',
  question: 'Test question?',
  answer: 'Test answer',
  status: 'Published',
  category_name: 'CAD',
  category_color: '#6366f1',
  category_icon: '📐',
  tags: ['test'],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

// ============================================================
// Fresh DOM for each test
// ============================================================

function resetDOM() {
  var dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="app"></div><div id="page-content"></div><div id="detail-modal"></div><div id="page-title"></div></body></html>',
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
  if (typeof state === 'undefined') {
    var dom = resetDOM();
    var appJsPath = path.resolve(__dirname, '../public/js/app.js');
    var code = fs.readFileSync(appJsPath, 'utf-8');
    vm.runInThisContext(code, { filename: 'app.js' });
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

function setupDetail(role) {
  state.page = 'qa';
  state.user = { id: 'u1', username: 'user', role: role };
  state.qaEntries = [mockQAEntry];
  state.qaTotal = 1;
  state.categories = [];
  state.qaFilters = { status: null, search: '' };
  state.sessionExpired = false;
  state.users = null;

  global.loadQA = async function () {
    return { data: state.qaEntries, total: 1, page: 1 };
  };
  global.loadQATotalCount = async function () {
    state.qaTotalCount = null;
  };
  global.toast = function () {};
  global.api = async function (url) {
    if (url === '/api/qa/1') return JSON.parse(JSON.stringify(mockQAEntry));
    return {};
  };

  var dm = document.getElementById('detail-modal');
  if (dm) {
    dm.classList.add('open');
    dm.innerHTML = '';
  }
}

// ============================================================
// Tests
// ============================================================

describe('Archive button visibility by role', function () {
  it('Admin sees Delete button, no Archive button', async function () {
    setupDetail('Admin');
    await showQADetail(1);
    var html = document.getElementById('detail-modal').innerHTML;
    assert.ok(html.indexOf('data-action="delete-qa"') !== -1, 'Admin should see Delete button');
    assert.ok(
      html.indexOf('data-action="archive-qa"') === -1,
      'Admin should NOT see Archive button',
    );
  });

  it('Editor sees Archive button, no Delete button', async function () {
    setupDetail('Editor');
    await showQADetail(1);
    var html = document.getElementById('detail-modal').innerHTML;
    assert.ok(html.indexOf('data-action="archive-qa"') !== -1, 'Editor should see Archive button');
    assert.ok(
      html.indexOf('data-action="delete-qa"') === -1,
      'Editor should NOT see Delete button',
    );
  });

  it('Viewer sees neither Archive nor Delete nor Edit button', async function () {
    setupDetail('Viewer');
    await showQADetail(1);
    var html = document.getElementById('detail-modal').innerHTML;
    assert.ok(
      html.indexOf('data-action="delete-qa"') === -1,
      'Viewer should NOT see Delete button',
    );
    assert.ok(
      html.indexOf('data-action="archive-qa"') === -1,
      'Viewer should NOT see Archive button',
    );
    assert.ok(html.indexOf('data-action="edit-qa"') === -1, 'Viewer should NOT see Edit button');
  });

  it('Editor still sees Edit button', async function () {
    setupDetail('Editor');
    await showQADetail(1);
    var html = document.getElementById('detail-modal').innerHTML;
    assert.ok(html.indexOf('data-action="edit-qa"') !== -1, 'Editor should see Edit button');
  });
});
