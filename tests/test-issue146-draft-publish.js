// Test: QA Draft/Publish workflow (Issue #146)
// New QA entries default to Draft. Admin-only Publish button when Draft.
// Unarchive sends status='Draft'. Publish button calls PUT with 'Published'.

const vm = require('vm');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');
const { spawn } = require('child_process');

// ============================================================
// Helper: HTTP request (for integration tests)
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
  const cookie = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
  return cookie;
}

// ============================================================
// Mock QA entries
// ============================================================

const draftQA = {
  id: 1,
  qa_number: 'QA-0001',
  title: 'Draft Entry',
  question: 'Is this a draft?',
  answer: 'Yes',
  status: 'Draft',
  category_name: 'CAD',
  category_color: '#6366f1',
  category_icon: '\u{1F4D0}',
  tags: ['test'],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

const publishedQA = {
  ...draftQA,
  id: 2,
  qa_number: 'QA-0002',
  title: 'Published Entry',
  status: 'Published',
};

const archivedQA = {
  ...draftQA,
  id: 3,
  qa_number: 'QA-0003',
  title: 'Archived Entry',
  status: 'Archived',
};

// ============================================================
// Fresh DOM for each test
// ============================================================

function resetDOM() {
  var dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="app"></div><div id="page-content"></div><div id="detail-modal"></div><div id="page-title"></div><div id="form-modal"><div class="modal-title"></div><div class="modal-body"></div><div class="modal-footer"></div></div></body></html>',
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
// Helpers for JSDOM tests
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

function setupCreateForm() {
  state.page = 'qa';
  state.user = { id: 'u1', username: 'user', role: 'Admin' };
  state.qaEntries = [];
  state.categories = [{ id: 1, name: 'CAD' }];
  state.qaFilters = { status: null, search: '' };
  state.sessionExpired = false;
  state.users = null;
  global.toast = function () {};
  global.api = async function () {
    return {};
  };
  global.navigate = function () {};
  global.closeModal = function () {};
}

function setupEditForm(editData) {
  state.page = 'qa';
  state.user = { id: 'u1', username: 'user', role: 'Admin' };
  state.qaEntries = [editData];
  state.categories = [{ id: 1, name: 'CAD' }];
  state.qaFilters = { status: null, search: '' };
  state.sessionExpired = false;
  state.users = null;
  global.toast = function () {};
  global.api = async function () {
    return {};
  };
  global.navigate = function () {};
  global.closeModal = function () {};
  global.showQADetail = async function () {};
}

// ============================================================
// Integration Tests (server-based)
// ============================================================

describe('POST /api/qa — draft vs published default', function () {
  let server, cookie;

  before(async function () {
    // Start server on port 1399
    server = spawn(
      'node',
      ['-e', "require('./server').listen(1399,'127.0.0.1',()=>console.log('ready'))"],
      {
        cwd: path.join(__dirname, '..'),
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    await new Promise((ok) => {
      server.stdout.on('data', (d) => {
        if (d.toString().includes('ready')) ok();
      });
    });

    cookie = await login('admin', '0000');
  });

  after(function () {
    if (server) server.kill();
  });

  it('POST /api/qa without status creates Draft', async function () {
    var r = await req('POST', '/api/qa', {
      cookie,
      body: { title: 'Default Draft', question: 'Q?' },
    });
    assert.strictEqual(r.status, 201, 'QA POST => 201');
    var id = r.json?.id;
    assert(id, 'Has id');

    // Fetch the entry to check its status
    r = await req('GET', '/api/qa/' + id, { cookie });
    assert.strictEqual(r.status, 200, 'GET /api/qa/:id => 200');
    assert.strictEqual(r.json?.status, 'Draft', 'No status => defaults to Draft');
  });

  it('POST /api/qa with status=Published creates Published', async function () {
    var r = await req('POST', '/api/qa', {
      cookie,
      body: { title: 'Explicit Published', question: 'Q?', status: 'Published' },
    });
    assert.strictEqual(r.status, 201, 'QA POST with Published => 201');
    var id = r.json?.id;
    assert(id, 'Has id');

    r = await req('GET', '/api/qa/' + id, { cookie });
    assert.strictEqual(r.status, 200, 'GET /api/qa/:id => 200');
    assert.strictEqual(r.json?.status, 'Published', 'Explicit Published => Published');
  });
});

// ============================================================
// Frontend Tests (JSDOM)
// ============================================================

describe('Create QA form — no Status dropdown', function () {
  it('showCreateQA() without data does NOT render f-q-status', async function () {
    setupCreateForm();
    await showCreateQA();
    var body = document.querySelector('#form-modal .modal-body');
    var statusEl = body.querySelector('#f-q-status');
    assert.strictEqual(statusEl, null, 'Create form should NOT have Status dropdown');
  });

  it('showCreateQA() without data does not include Status label', async function () {
    setupCreateForm();
    await showCreateQA();
    var html = document.querySelector('#form-modal .modal-body').innerHTML;
    assert.ok(html.indexOf('Status') === -1, 'Create form should not contain Status label');
  });
});

describe('Publish button visibility', function () {
  it('Draft QA detail shows Publish button for Admin', async function () {
    setupDetail('Admin', draftQA);
    await showQADetail(1);
    var html = document.getElementById('detail-modal').innerHTML;
    assert.ok(
      html.indexOf('data-action="publish-qa"') !== -1,
      'Admin should see Publish button for Draft',
    );
  });

  it('Published QA detail hides Publish button for Admin', async function () {
    setupDetail('Admin', publishedQA);
    await showQADetail(2);
    var html = document.getElementById('detail-modal').innerHTML;
    assert.ok(
      html.indexOf('data-action="publish-qa"') === -1,
      'Admin should NOT see Publish button for Published',
    );
  });

  it('Draft QA detail hides Publish button for Editor', async function () {
    setupDetail('Editor', draftQA);
    await showQADetail(1);
    var html = document.getElementById('detail-modal').innerHTML;
    assert.ok(
      html.indexOf('data-action="publish-qa"') === -1,
      'Editor should NOT see Publish button for Draft',
    );
  });

  it('Draft QA detail hides Publish button for Viewer', async function () {
    setupDetail('Viewer', draftQA);
    await showQADetail(1);
    var html = document.getElementById('detail-modal').innerHTML;
    assert.ok(
      html.indexOf('data-action="publish-qa"') === -1,
      'Viewer should NOT see Publish button',
    );
  });
});

describe('Edit form — Status dropdown preserved', function () {
  it('showCreateQA() with edit data renders Status dropdown', async function () {
    setupEditForm(publishedQA);
    await showCreateQA(publishedQA);
    var body = document.querySelector('#form-modal .modal-body');
    var statusEl = body.querySelector('#f-q-status');
    assert.ok(statusEl !== null, 'Edit form should have Status dropdown');
  });

  it('showCreateQA() with edit data shows correct status value', async function () {
    setupEditForm(publishedQA);
    await showCreateQA(publishedQA);
    var statusEl = document.querySelector('#form-modal .modal-body #f-q-status');
    assert.strictEqual(statusEl.value, 'Published', 'Status dropdown should show "Published"');
  });

  it('showCreateQA() with Draft edit data shows Draft status', async function () {
    setupEditForm(draftQA);
    await showCreateQA(draftQA);
    var statusEl = document.querySelector('#form-modal .modal-body #f-q-status');
    assert.strictEqual(statusEl.value, 'Draft', 'Status dropdown should show "Draft"');
  });
});

describe('Unarchive sends status=Draft', function () {
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

    await unarchiveQA(3);

    assert.strictEqual(calledUrl, '/api/qa/3', 'API URL should be /api/qa/3');
    assert.strictEqual(calledOpts.method, 'PUT', 'Should use PUT method');
    var body = JSON.parse(calledOpts.body);
    assert.strictEqual(body.status, 'Draft', 'Should set status to Draft');
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

    await unarchiveQA(3);

    assert.strictEqual(toastMsg, 'Unarchived', 'Toast should say "Unarchived"');
  });
});

describe('publishQA function', function () {
  it('publishQA is a function', function () {
    assert.strictEqual(typeof publishQA, 'function', 'publishQA should be a function');
  });

  it('publishQA calls PUT with status=Published', async function () {
    setupDetail('Admin', draftQA);
    let calledUrl, calledOpts;

    global.api = async function (url, opts) {
      calledUrl = url;
      calledOpts = opts;
      return {};
    };
    global.toast = function () {};
    global.showQADetail = async function () {};
    global.renderQA = async function () {};

    await publishQA(1);

    assert.strictEqual(calledUrl, '/api/qa/1', 'API URL should be /api/qa/1');
    assert.strictEqual(calledOpts.method, 'PUT', 'Should use PUT method');
    var body = JSON.parse(calledOpts.body);
    assert.strictEqual(body.status, 'Published', 'Should set status to Published');
  });

  it('publishQA calls toast("Published") on success', async function () {
    setupDetail('Admin', draftQA);
    let toastMsg;

    global.api = async function () {
      return {};
    };
    global.toast = function (msg) {
      toastMsg = msg;
    };
    global.showQADetail = async function () {};
    global.renderQA = async function () {};

    await publishQA(1);

    assert.strictEqual(toastMsg, 'Published', 'Toast should say "Published"');
  });

  it('publishQA calls showQADetail and renderQA on success', async function () {
    setupDetail('Admin', draftQA);
    let calledShowDetail = false;
    let calledRenderQA = false;

    global.api = async function () {
      return {};
    };
    global.toast = function () {};
    global.showQADetail = async function (id) {
      calledShowDetail = true;
    };
    global.renderQA = async function () {
      calledRenderQA = true;
    };

    await publishQA(1);

    assert.strictEqual(calledShowDetail, true, 'showQADetail should be called');
    assert.strictEqual(calledRenderQA, true, 'renderQA should be called');
  });
});
