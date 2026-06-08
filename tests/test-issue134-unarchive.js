// Test: Unarchive button replaces Archive when status is Archived (Issue #134)
// Admin/Editor sees Unarchive button when status=Archived
// Admin/Editor sees Archive button when status=Published/Draft
// Viewer sees neither Archive nor Unarchive

const vm = require('vm');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// ============================================================
// Mock QA entries
// ============================================================

const publishedQA = {
  id: 1,
  qa_number: 'QA-0001',
  title: 'Published Entry',
  question: 'Test question?',
  answer: 'Test answer',
  status: 'Published',
  category_name: 'CAD',
  category_color: '#6366f1',
  category_icon: '\u{1F4D0}',
  tags: ['test'],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

const archivedQA = {
  ...publishedQA,
  id: 2,
  qa_number: 'QA-0002',
  title: 'Archived Entry',
  status: 'Archived',
};

const draftQA = {
  ...publishedQA,
  id: 3,
  qa_number: 'QA-0003',
  title: 'Draft Entry',
  status: 'Draft',
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
  global.history = dom.window.history;

  return dom;
}

// Bootstrap app.js once before all tests
before(function () {
  if (typeof state === 'undefined') {
    resetDOM();
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

function setupDetail(role, qaEntry) {
  state.page = 'qa';
  state.user = { id: 'u1', username: 'user', role: role };
  state.qaEntries = [qaEntry];
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
    if (url === '/api/qa/1' || url === '/api/qa/2' || url === '/api/qa/3')
      return JSON.parse(JSON.stringify(qaEntry));
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

describe('Unarchive button visibility by status and role', function () {
  it('Admin sees Unarchive button (not Archive) when status is Archived', async function () {
    setupDetail('Admin', archivedQA);
    await showQADetail(2);
    var html = document.getElementById('detail-modal').innerHTML;
    assert.ok(
      html.indexOf('data-action="unarchive-qa"') !== -1,
      'Admin should see Unarchive button when Archived',
    );
    assert.ok(
      html.indexOf('data-action="archive-qa"') === -1,
      'Admin should NOT see Archive button when Archived',
    );
  });

  it('Admin sees Archive button (not Unarchive) when status is Published', async function () {
    setupDetail('Admin', publishedQA);
    await showQADetail(1);
    var html = document.getElementById('detail-modal').innerHTML;
    assert.ok(
      html.indexOf('data-action="archive-qa"') !== -1,
      'Admin should see Archive button when Published',
    );
    assert.ok(
      html.indexOf('data-action="unarchive-qa"') === -1,
      'Admin should NOT see Unarchive button when Published',
    );
  });

  it('Admin sees Archive button (not Unarchive) when status is Draft', async function () {
    setupDetail('Admin', draftQA);
    await showQADetail(3);
    var html = document.getElementById('detail-modal').innerHTML;
    assert.ok(
      html.indexOf('data-action="archive-qa"') !== -1,
      'Admin should see Archive button when Draft',
    );
    assert.ok(
      html.indexOf('data-action="unarchive-qa"') === -1,
      'Admin should NOT see Unarchive button when Draft',
    );
  });

  it('Editor sees Unarchive button (not Archive) when status is Archived', async function () {
    setupDetail('Editor', archivedQA);
    await showQADetail(2);
    var html = document.getElementById('detail-modal').innerHTML;
    assert.ok(
      html.indexOf('data-action="unarchive-qa"') !== -1,
      'Editor should see Unarchive button when Archived',
    );
    assert.ok(
      html.indexOf('data-action="archive-qa"') === -1,
      'Editor should NOT see Archive button when Archived',
    );
  });

  it('Editor sees Archive button when status is Published', async function () {
    setupDetail('Editor', publishedQA);
    await showQADetail(1);
    var html = document.getElementById('detail-modal').innerHTML;
    assert.ok(
      html.indexOf('data-action="archive-qa"') !== -1,
      'Editor should see Archive button when Published',
    );
    assert.ok(
      html.indexOf('data-action="unarchive-qa"') === -1,
      'Editor should NOT see Unarchive button when Published',
    );
  });

  it('Viewer does NOT see Unarchive button on Archived entry', async function () {
    setupDetail('Viewer', archivedQA);
    await showQADetail(2);
    var html = document.getElementById('detail-modal').innerHTML;
    assert.ok(
      html.indexOf('data-action="unarchive-qa"') === -1,
      'Viewer should NOT see Unarchive button',
    );
    assert.ok(
      html.indexOf('data-action="archive-qa"') === -1,
      'Viewer should NOT see Archive button',
    );
  });

  it('Unarchive button has correct label text', async function () {
    setupDetail('Admin', archivedQA);
    await showQADetail(2);
    var html = document.getElementById('detail-modal').innerHTML;
    assert.ok(
      html.indexOf('>Unarchive</button>') !== -1,
      'Unarchive button should say "Unarchive"',
    );
  });
});

describe('Unarchive API call', function () {
  it('calling unarchiveQA sends PUT with status=Draft', async function () {
    setupDetail('Admin', archivedQA);
    let calledUrl, calledOpts;

    global.api = async function (url, opts) {
      calledUrl = url;
      calledOpts = opts;
      return {};
    };
    global.toast = function () {};
    global.navigate = function () {};

    await unarchiveQA(2);

    assert.strictEqual(calledUrl, '/api/qa/2', 'API URL should be /api/qa/2');
    assert.strictEqual(calledOpts.method, 'PUT', 'Should use PUT method');
    var body = JSON.parse(calledOpts.body);
    assert.strictEqual(body.status, 'Draft', 'Should set status to Draft (Issue #146: Unarchive→Draft)');
  });

  it('toast is called with "Unarchived" on success', async function () {
    setupDetail('Admin', archivedQA);
    let toastMsg;

    global.api = async function () {
      return {};
    };
    global.toast = function (msg) {
      toastMsg = msg;
    };
    global.navigate = function () {};

    await unarchiveQA(2);

    assert.strictEqual(toastMsg, 'Unarchived', 'Toast should say "Unarchived"');
  });
});
