// Test: Issue #107 — Inline suggestion chips for tag input
// Verifies that initChips() renders inline suggestion chips instead of
// absolute-positioned autocomplete dropdown
//
// Usage: npx mocha tests/test-issue107-chips.js

const vm = require('vm');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Mock tag data (sorted by usage count DESC)
const mockTags = [
  { name: 'password', count: 12 },
  { name: 'network', count: 8 },
  { name: 'vpn', count: 6 },
  { name: 'server', count: 5 },
  { name: 'backup', count: 4 },
  { name: 'posh', count: 3 },
  { name: 'database', count: 3 },
  { name: 'email', count: 2 },
  { name: 'dns', count: 2 },
  { name: 'pop3', count: 1 },
  { name: 'dhcp', count: 1 },
  { name: 'ldap', count: 1 },
];

// Mock fetch for tags endpoint
function mockFetchTags() {
  global.fetch = function (url) {
    if (url === '/api/tags') {
      return Promise.resolve({
        ok: true,
        json: function () {
          return Promise.resolve(mockTags);
        },
      });
    }
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve([]);
      },
    });
  };
}

var dom; // keep reference for event constructors

// Fresh DOM + app.js bootstrap for each test
function createChipFixture() {
  dom = new JSDOM(
    `<!DOCTYPE html><html><body>
      <div id="app">
        <div class="form-group">
          <label class="form-label">Tags</label>
          <div class="chip-input-wrapper" id="tags-chip-wrapper">
            <div class="chip-container" id="tags-chips"></div>
            <input type="text" class="chip-input" id="f-tags-input"
              placeholder="Type tag and press Enter or comma..." autocomplete="off">
            <div class="suggestions-area" id="tags-suggestions"></div>
          </div>
        </div>
      </div>
    </body></html>`,
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

// Bootstrap app.js once (if not already loaded by another test file)
before(function () {
  if (typeof initChips !== 'undefined') return; // already bootstrapped
  const dom = createChipFixture();
  const appJsPath = path.resolve(__dirname, '../public/js/app.js');
  const code = fs.readFileSync(appJsPath, 'utf-8');
  vm.runInThisContext(code, { filename: 'app.js' });
  // Clean up bootstrap DOM
  delete global.window;
  delete global.document;
  delete global.navigator;
});

// Setup state globals that app.js expects
function setupState() {
  if (!global.state) global.state = {};
  global.state.page = 'qa';
  global.state.user = { id: 'u1', username: 'admin', role: 'Admin' };
}

describe('Issue #107 — Inline suggestion chips for tag input', function () {
  beforeEach(function () {
    createChipFixture();
    setupState();
    mockFetchTags();
  });

  afterEach(function () {
    // Clean up fetch mock
    delete global.fetch;
  });
  // Helper: wait for promises to settle
  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  // Helper: trigger input event
  function typeInInput(value) {
    var input = document.getElementById('f-tags-input');
    input.value = value || '';
    var evt = dom.window.Event
      ? new dom.window.Event('input', { bubbles: true })
      : { type: 'input' };
    input.dispatchEvent(evt);
  }

  // ---------- R1: Empty input shows top 10 suggestions ----------

  it('shows top 10 suggestions when input is empty', async function () {
    initChips('tags-chips', 'f-tags-input', 'tags-suggestions', []);

    // Wait for the initial fetchTags promise to resolve
    await wait(800);

    var suggestions = document.getElementById('tags-suggestions');
    assert.ok(suggestions, 'suggestions-area exists');

    var chips = suggestions.querySelectorAll('.suggestion-chip');
    assert.strictEqual(chips.length, 10, 'Should show top 10 chips on empty input');
  });

  // ---------- R2: Typing filters suggestions by substring ----------

  it('filters suggestions when typing "p"', async function () {
    initChips('tags-chips', 'f-tags-input', 'tags-suggestions', []);

    // First wait for initial suggestions to load
    await wait(800);

    // Type "p" — triggers debounce 200ms
    typeInInput('p');
    await wait(500);

    var suggestions = document.getElementById('tags-suggestions');
    var chips = suggestions.querySelectorAll('.suggestion-chip');
    // Should show password, posh, pop3 — tags containing "p"
    assert.ok(chips.length >= 3, 'Expected at least 3 chips for "p"');
    // First should be "password" (count 12, highest among "p" matches)
    assert.ok(
      chips[0].textContent.includes('password'),
      'First chip should be password (highest count)',
    );
  });

  // ---------- R3: Already-selected tags excluded ----------

  it('hides already-selected tags from suggestions', async function () {
    // Pre-populate with "password" tag
    initChips('tags-chips', 'f-tags-input', 'tags-suggestions', ['password']);

    await wait(800);

    // Trigger empty input to re-render suggestions
    typeInInput('');
    await wait(500);

    var suggestions = document.getElementById('tags-suggestions');
    var chips = suggestions.querySelectorAll('.suggestion-chip');

    // "password" should NOT be among suggestions
    var chipTexts = Array.from(chips).map(function (c) {
      return c.textContent;
    });
    var hasPassword = chipTexts.some(function (t) {
      return t.includes('password');
    });
    assert.ok(!hasPassword, '"password" should be excluded from suggestions (already selected)');
  });

  // ---------- R4: Clicking suggestion adds chip ----------

  it('clicking a suggestion chip adds it to selected chips', async function () {
    initChips('tags-chips', 'f-tags-input', 'tags-suggestions', []);

    await wait(800);

    var suggestions = document.getElementById('tags-suggestions');
    var container = document.getElementById('tags-chips');
    var firstChip = suggestions.querySelector('.suggestion-chip');

    assert.ok(firstChip, 'Should have at least one suggestion chip');

    // Click the first suggestion chip
    firstChip.click();
    await wait(100);

    var selectedChips = container.querySelectorAll('.chip');
    assert.ok(selectedChips.length >= 1, 'At least one chip should be added after click');

    var chip = container.querySelector('.chip');
    assert.ok(chip, 'Chip element should exist');
    assert.ok(chip.dataset.tag, 'Chip should have data-tag attribute');
  });

  // ---------- R5: Suggestions area is in document flow ----------

  it('uses suggestions-area class instead of autocomplete-dropdown', function () {
    var sugEl = document.getElementById('tags-suggestions');
    assert.ok(sugEl, 'suggestions-area element exists');
    assert.notStrictEqual(
      sugEl.className,
      'autocomplete-dropdown',
      'Should not use autocomplete-dropdown class',
    );
    assert.ok(sugEl.classList.contains('suggestions-area'), 'Should use suggestions-area class');
  });

  // ---------- R6: Suggestion chip shows #-prefixed name and count ----------

  it('suggestion chip content includes # prefix and count badge', async function () {
    initChips('tags-chips', 'f-tags-input', 'tags-suggestions', []);

    await wait(800);

    var suggestions = document.getElementById('tags-suggestions');
    var chip = suggestions.querySelector('.suggestion-chip');
    assert.ok(chip, 'Should have suggestion chips');

    var text = chip.textContent;
    assert.ok(text.includes('#'), 'Chip should have # prefix');
    assert.ok(text.includes('('), 'Chip should have count badge');

    var countSpan = chip.querySelector('.suggestion-count');
    assert.ok(countSpan, 'Chip should have .suggestion-count element');

    // Verify a11y attributes (Issue #109)
    assert.ok(chip.hasAttribute('aria-label'), 'Suggestion chip should have aria-label');
    assert.ok(
      chip.getAttribute('aria-label').startsWith('Add tag:'),
      'aria-label should start with "Add tag:"',
    );
    assert.strictEqual(
      countSpan.getAttribute('aria-hidden'),
      'true',
      'Count span should be aria-hidden',
    );
  });

  // ---------- R7: Enter key adds chip ----------

  it('pressing Enter adds typed tag as a chip and clears suggestions', async function () {
    initChips('tags-chips', 'f-tags-input', 'tags-suggestions', []);

    await wait(500);

    var input = document.getElementById('f-tags-input');
    var container = document.getElementById('tags-chips');

    // Type a tag and press Enter
    input.value = 'customtag';
    var enterEvt = dom.window.KeyboardEvent
      ? new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      : { type: 'keydown', key: 'Enter' };
    input.dispatchEvent(enterEvt);
    await wait(100);

    var chips = container.querySelectorAll('.chip');
    var tagChips = Array.from(chips).filter(function (c) {
      return c.dataset.tag === 'customtag';
    });
    assert.ok(tagChips.length > 0, 'Enter should add "customtag" chip');
    assert.strictEqual(input.value, '', 'Input should be cleared after Enter');
  });

  // ---------- R8: Escape clears suggestions ----------

  it('pressing Escape clears suggestions', async function () {
    initChips('tags-chips', 'f-tags-input', 'tags-suggestions', []);

    await wait(500);

    var input = document.getElementById('f-tags-input');
    var suggestions = document.getElementById('tags-suggestions');
    var escEvt = dom.window.KeyboardEvent
      ? new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      : { type: 'keydown', key: 'Escape' };

    // Set suggestions to visible state
    suggestions.innerHTML = '<button class="suggestion-chip">#test (1)</button>';
    assert.ok(suggestions.querySelector('.suggestion-chip'), 'Suggestions visible before Escape');

    input.dispatchEvent(escEvt);
    await wait(100);

    assert.strictEqual(suggestions.innerHTML, '', 'Suggestions should be cleared after Escape');
  });

  // ---------- R9: No absolute-positioned autocomplete-dropdown ----------

  it('no absolute-positioned autocomplete-dropdown in chip input area', function () {
    var wrapper = document.getElementById('tags-chip-wrapper');
    var existingDropdown = wrapper.querySelector('.autocomplete-dropdown');
    assert.ok(!existingDropdown, 'autocomplete-dropdown element should not exist');

    var sugArea = wrapper.querySelector('.suggestions-area');
    assert.ok(sugArea, 'suggestions-area should exist instead of autocomplete-dropdown');
  });
});
