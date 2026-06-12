// Test: Issue #207 - QA Library search has no clear button
// Verifies that the search-clear button (×) exists on the QA page
// and that clicking it clears the search input and re-renders results.
//
// Usage: npx mocha tests/test-issue207-search-clear.js

const vm = require('vm');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const mockQAEntries = [
  {
    id: 1,
    qa_number: 'QA-001',
    title: 'Network Issue',
    question: 'Network down?',
    answer: 'Restart router',
    status: 'Published',
    category_name: 'Network',
    category_color: '#6366f1',
    category_icon: '🌐',
    tags: ['tag1'],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 2,
    qa_number: 'QA-002',
    title: 'Server Issue',
    question: 'Server slow?',
    answer: 'Reboot',
    status: 'Published',
    category_name: 'Server',
    category_color: '#ef4444',
    category_icon: '🖥',
    tags: [],
    created_at: '2026-01-03T00:00:00.000Z',
    updated_at: '2026-01-04T00:00:00.000Z',
  },
];

function resetDOM() {
  // Match the DOM structure used by all other test files:
  // #app and #page-content are siblings inside <main>
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><main class="main" id="main-content"><div id="app"></div><div id="page-content"></div><div id="detail-modal"></div><div id="page-title"></div></main></body></html>',
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
  global.self = dom.window;
  return dom;
}

// Match the bootstrap pattern used by all other test files.
// Only load app.js once (when state is undefined), then clean up globals
// so stale async handlers from the DOMContentLoaded listener don't
// fire during later test files and corrupt their DOM.
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

beforeEach(function () {
  resetDOM();
});

function setupQA(searchValue = '') {
  state.page = 'qa';
  state.user = { id: 'u1', username: 'admin', role: 'Admin' };
  state.qaEntries = [...mockQAEntries];
  state.qaTotal = state.qaEntries.length;
  state.qaPage = 1;
  state.categories = [];
  state.qaFilters = { status: 'Published', search: searchValue };
  state.sessionExpired = false;
  state.users = null;
  document.getElementById('page-content').innerHTML = '';
  global.loadQA = async () => ({ data: state.qaEntries, total: state.qaTotal, page: 1 });
  global.loadQATotalCount = async () => {
    state.qaTotalCount = null;
  };
  global.toast = () => {};
}

describe('Issue #207 - QA Library search clear button', function () {
  it('QA: search-clear button exists in the toolbar after render', async function () {
    setupQA();
    const el = document.getElementById('page-content');
    await renderQA(el);
    const clearBtn = document.getElementById('search-clear');
    assert.ok(clearBtn, 'search-clear button should exist');
    assert.strictEqual(clearBtn.tagName, 'BUTTON');
    assert.ok(
      clearBtn.textContent.includes('×') || clearBtn.textContent.includes('✕'),
      'Button should show ×',
    );
  });

  it('QA: search-clear button is hidden when input is empty', async function () {
    setupQA('');
    const el = document.getElementById('page-content');
    await renderQA(el);
    const clearBtn = document.getElementById('search-clear');
    assert.ok(clearBtn, 'search-clear button exists');
    assert.strictEqual(
      clearBtn.style.display,
      'none',
      'Clear button should be hidden when input is empty',
    );
  });

  it('QA: search-clear button is visible when input has text', async function () {
    setupQA('network');
    const el = document.getElementById('page-content');
    await renderQA(el);
    const clearBtn = document.getElementById('search-clear');
    assert.ok(clearBtn, 'search-clear button exists');
    assert.notStrictEqual(
      clearBtn.style.display,
      'none',
      'Clear button should be visible when input has text',
    );
  });

  it('QA: clicking search-clear button clears search and re-renders', async function () {
    setupQA('network');
    const el = document.getElementById('page-content');
    await renderQA(el);

    const searchInput = document.getElementById('global-search');
    const clearBtn = document.getElementById('search-clear');
    assert.ok(searchInput, 'search input exists');
    assert.ok(clearBtn, 'clear button exists');

    // Simulate click on clear button
    clearBtn.click();

    // After click, search should be empty
    assert.strictEqual(searchInput.value, '', 'Search input should be cleared');
    assert.strictEqual(state.qaFilters.search, '', 'State search should be cleared');
    assert.strictEqual(state.qaPage, 1, 'Page should reset to 1');

    // Clear button should be hidden after clearing
    assert.strictEqual(
      clearBtn.style.display,
      'none',
      'Clear button should be hidden after clearing',
    );
  });

  it('QA: input event listener shows/hides clear button', async function () {
    setupQA('');
    const el = document.getElementById('page-content');
    await renderQA(el);

    const searchInput = document.getElementById('global-search');
    const clearBtn = document.getElementById('search-clear');
    assert.ok(searchInput);
    assert.ok(clearBtn);

    // Initially hidden
    assert.strictEqual(clearBtn.style.display, 'none', 'Hidden initially');

    // Simulate typing by dispatching input event (debounced, so must set value first)
    searchInput.value = 'test';
    const inputEvent = new global.window.Event('input');
    searchInput.dispatchEvent(inputEvent);

    // Wait for debounce
    await new Promise((r) => setTimeout(r, 400));

    assert.strictEqual(state.qaFilters.search, 'test', 'State updated with search value');
    assert.notStrictEqual(
      clearBtn.style.display,
      'none',
      'Clear button should be visible after typing',
    );
  });

  it('QA: subsequent render preserves clear button visibility state', async function () {
    setupQA('server');
    const el = document.getElementById('page-content');
    await renderQA(el);

    const clearBtn = document.getElementById('search-clear');
    assert.notStrictEqual(
      clearBtn.style.display,
      'none',
      'Clear button visible after first render',
    );

    // Re-render
    await renderQA(el);

    const clearBtn2 = document.getElementById('search-clear');
    assert.strictEqual(clearBtn2, clearBtn, 'Same DOM node preserved');
    assert.notStrictEqual(
      clearBtn2.style.display,
      'none',
      'Clear button still visible after re-render',
    );
  });
});
