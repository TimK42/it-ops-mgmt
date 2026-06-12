// Test: Issues #205, #206, #208 — Dashboard heading hierarchy, touch targets, login theme persistence
//
// Coverage:
//   #205: renderDashboard() no longer emits <h2 class="sr-only">Dashboard</h2>
//   #206: CSS min-height: 44px on .section-title a and .recent-entry-title
//   #208: renderLogin() calls restoreTheme(), renders theme toggle, toggle click persists to localStorage
//
// Usage: npx mocha tests/test-issue205-208-integration.js --timeout 15000

const vm = require('vm');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// ============================================================
// resetDOM — fresh JSDOM for each test
// ============================================================

function resetDOM() {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><head></head><body><div id="app"><main class="main" id="main-content"><div id="page-content"></div></main></div></body></html>',
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
  global.HTMLLIElement = dom.window.HTMLLIElement;
  global.self = dom.window;
  global.history = dom.window.history;

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
// Issue #205 — Dashboard heading hierarchy
// ============================================================

describe('Issue #205 — Dashboard heading hierarchy', function () {
  beforeEach(function () {
    resetDOM();
  });

  describe('renderDashboard() — heading structure', function () {
    beforeEach(function () {
      state.page = 'dashboard';
      state.user = { id: 'u1', username: 'admin', role: 'Admin' };
      state.qaEntries = [];
      state.categories = [];
      state.qaFilters = { status: null, search: '' };
      state.sessionExpired = false;
      document.getElementById('page-content').innerHTML = '';

      global.api = async function (url) {
        if (url === '/api/stats') {
          return { qa: { total: 10, published: 5, draft: 3, archived: 2 }, categories: 4 };
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
    });

    it('renderDashboard() output does NOT contain <h2 class="sr-only">Dashboard</h2>', async function () {
      const el = document.getElementById('page-content');
      await renderDashboard(el);

      // Target only the specific element from the bug: duplicate sr-only Dashboard heading
      const srOnlyHeading = el.querySelector('h2.sr-only');
      assert.strictEqual(srOnlyHeading, null, 'renderDashboard() output should not contain sr-only Dashboard heading');
    });

    it('renderDashboard() starts with dash-stats div (no leading heading)', async function () {
      const el = document.getElementById('page-content');
      await renderDashboard(el);

      // The initial innerHTML must start with the dash-stats div, not a heading
      assert.ok(
        el.innerHTML.indexOf('<div id="dash-stats"') !== -1,
        'renderDashboard() output should contain dash-stats div',
      );
      // There should be no heading elements directly in page-content
      const headings = el.querySelectorAll('h1, h2, h3');
      const headingCount = headings.length;
      assert.strictEqual(headingCount, 0, 'page-content should have 0 heading elements');
    });

    it('renderDashboard() still works — dash-stats and recent section are present', async function () {
      const el = document.getElementById('page-content');
      await renderDashboard(el);

      // Wait for async microtasks to settle
      await new Promise(function (r) {
        return setTimeout(r, 50);
      });

      const stats = document.getElementById('dash-stats');
      assert.ok(stats, 'dash-stats element should exist');
      assert.ok(
        stats.innerHTML.indexOf('stat-card') !== -1,
        'dash-stats should contain stat cards',
      );

      const recent = document.getElementById('dash-recent');
      assert.ok(recent, 'dash-recent section should exist');
    });
  });
});

// ============================================================
// Issue #206 — Dashboard link touch targets
// ============================================================

describe('Issue #206 — Dashboard link touch targets (min-height: 44px)', function () {
  var css;

  before(function () {
    css = fs.readFileSync(path.resolve(__dirname, '../public/css/style.css'), 'utf-8');
  });

  describe('.section-title a — min-height: 44px', function () {
    it('CSS defines .section-title a selector', function () {
      var idx = css.indexOf('.section-title a');
      assert.ok(idx !== -1, 'CSS should define .section-title a');
    });

    it('.section-title a has min-height: 44px', function () {
      var idx = css.indexOf('.section-title a');
      var blockStart = css.indexOf('{', idx);
      var blockEnd = css.indexOf('}', blockStart);
      var block = css.slice(blockStart, blockEnd + 1);

      assert.ok(
        block.indexOf('min-height: 44px') !== -1,
        '.section-title a should have min-height: 44px',
      );
    });

    it('.section-title a has display: inline-flex and align-items: center for vertical centering', function () {
      var idx = css.indexOf('.section-title a');
      var blockStart = css.indexOf('{', idx);
      var blockEnd = css.indexOf('}', blockStart);
      var block = css.slice(blockStart, blockEnd + 1);

      assert.ok(
        block.indexOf('display: inline-flex') !== -1,
        '.section-title a should have display: inline-flex',
      );
      assert.ok(
        block.indexOf('align-items: center') !== -1,
        '.section-title a should have align-items: center',
      );
    });
  });

  describe('.recent-entry-title — min-height: 44px', function () {
    it('CSS defines .recent-entry-title selector', function () {
      var idx = css.indexOf('.recent-entry-title');
      assert.ok(idx !== -1, 'CSS should define .recent-entry-title');
    });

    it('.recent-entry-title has min-height: 44px', function () {
      var idx = css.indexOf('.recent-entry-title');
      var blockStart = css.indexOf('{', idx);
      var blockEnd = css.indexOf('}', blockStart);
      var block = css.slice(blockStart, blockEnd + 1);

      assert.ok(
        block.indexOf('min-height: 44px') !== -1,
        '.recent-entry-title should have min-height: 44px',
      );
    });

    it('.recent-entry-title has display: flex and align-items: center for vertical centering', function () {
      var idx = css.indexOf('.recent-entry-title');
      var blockStart = css.indexOf('{', idx);
      var blockEnd = css.indexOf('}', blockStart);
      var block = css.slice(blockStart, blockEnd + 1);

      assert.ok(
        block.indexOf('display: flex') !== -1,
        '.recent-entry-title should have display: flex',
      );
      assert.ok(
        block.indexOf('align-items: center') !== -1,
        '.recent-entry-title should have align-items: center',
      );
    });
  });

  describe('Render-time — dashboard links exist', function () {
    beforeEach(function () {
      resetDOM();
      state.page = 'dashboard';
      state.user = { id: 'u1', username: 'admin', role: 'Admin' };
      state.qaEntries = [];
      state.categories = [];
      state.qaFilters = { status: null, search: '' };
      state.sessionExpired = false;
      document.getElementById('page-content').innerHTML = '';

      global.api = async function (url) {
        if (url === '/api/stats') {
          return { qa: { total: 10, published: 5, draft: 3, archived: 2 }, categories: 4 };
        }
        if (url === '/api/qa?_per_page=5&sort=newest') {
          return {
            data: [
              {
                id: 1,
                qa_number: 'QA-001',
                title: 'Network Outage',
                question: 'How to fix network?',
                answer: 'Restart router',
                status: 'Published',
                category_name: 'Network',
                category_color: '#6366f1',
                category_icon: '\u{1F310}',
                tags: [],
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-02T00:00:00.000Z',
              },
            ],
          };
        }
        if (url === '/api/categories') {
          return [];
        }
        return {};
      };
      global.toast = function () {};
    });

    it('Dashboard renders .section-title a link (View All)', async function () {
      const el = document.getElementById('page-content');
      await renderDashboard(el);

      await new Promise(function (r) {
        return setTimeout(r, 50);
      });

      const viewAllLinks = el.querySelectorAll('.section-title a');
      assert.ok(viewAllLinks.length > 0, 'Dashboard should have .section-title a links');
    });

    it('Dashboard renders .recent-entry-title link(s) when entries exist', async function () {
      const el = document.getElementById('page-content');
      await renderDashboard(el);

      await new Promise(function (r) {
        return setTimeout(r, 50);
      });

      const recentTitles = el.querySelectorAll('.recent-entry-title');
      assert.ok(recentTitles.length > 0, 'Dashboard should have .recent-entry-title links');
    });
  });
});

// ============================================================
// Issue #208 — Login/Register theme persistence
// ============================================================

describe('Issue #208 — Login/Register theme persistence', function () {
  beforeEach(function () {
    resetDOM();
  });

  describe('renderLogin() calls restoreTheme()', function () {
    beforeEach(function () {
      state.user = null;
      state.sessionExpired = false;
      document.getElementById('app').innerHTML = '';
      global.api = async function () {};
      global.toast = function () {};
    });

    it('renderLogin() applies dark theme when localStorage.theme="dark"', function () {
      // Ensure default is light
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'dark');

      renderLogin();

      assert.strictEqual(
        document.documentElement.getAttribute('data-theme'),
        'dark',
        'renderLogin() should apply dark theme via restoreTheme() when localStorage.theme="dark"',
      );
    });

    it('renderLogin() applies light theme when localStorage.theme="light"', function () {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'light');

      renderLogin();

      assert.strictEqual(
        document.documentElement.getAttribute('data-theme'),
        'light',
        'renderLogin() should apply light theme when localStorage.theme="light"',
      );
    });
  });

  describe('renderLogin() renders theme toggle button', function () {
    beforeEach(function () {
      state.user = null;
      state.sessionExpired = false;
      document.getElementById('app').innerHTML = '';
      global.api = async function () {};
      global.toast = function () {};
    });

    it('renderLogin() renders a button with id="theme-toggle"', function () {
      renderLogin();
      const toggle = document.getElementById('theme-toggle');
      assert.ok(toggle, 'theme-toggle button should exist in login page');
      assert.strictEqual(toggle.tagName, 'BUTTON', 'theme-toggle should be a <button>');
    });

    it('theme toggle button has data-action="theme-toggle" for event delegation', function () {
      renderLogin();
      const toggle = document.getElementById('theme-toggle');
      assert.ok(toggle, 'theme-toggle button should exist');
      assert.strictEqual(
        toggle.getAttribute('data-action'),
        'theme-toggle',
        'theme-toggle should have data-action="theme-toggle"',
      );
    });

    it('theme toggle button shows moon emoji when theme is light', function () {
      localStorage.setItem('theme', 'light');
      document.documentElement.setAttribute('data-theme', 'light');

      renderLogin();
      const toggle = document.getElementById('theme-toggle');

      // In light mode, the button should show moon emoji (to indicate "click to switch to dark")
      assert.ok(
        toggle.textContent.includes('\u{1F319}') || toggle.textContent.includes('🌙'),
        'theme toggle should show moon emoji in light mode',
      );
      assert.strictEqual(
        toggle.getAttribute('aria-pressed'),
        'false',
        'aria-pressed should be false in light mode',
      );
    });

    it('theme toggle button shows sun emoji when theme is dark', function () {
      localStorage.setItem('theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');

      renderLogin();
      const toggle = document.getElementById('theme-toggle');

      // In dark mode, the button should show sun emoji
      assert.ok(
        toggle.textContent.includes('\u{2600}') || toggle.textContent.includes('☀'),
        'theme toggle should show sun emoji in dark mode',
      );
      assert.strictEqual(
        toggle.getAttribute('aria-pressed'),
        'true',
        'aria-pressed should be true in dark mode',
      );
    });
  });

  describe('Clicking theme toggle changes theme', function () {
    beforeEach(function () {
      state.user = null;
      state.sessionExpired = false;
      document.getElementById('app').innerHTML = '';
      global.api = async function () {};
      global.toast = function () {};

      // Attach click delegation (same pattern as app.js line 288-315)
      document.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        var action = btn.getAttribute('data-action');
        if (action === 'theme-toggle') {
          toggleTheme();
        }
      });
    });

    it('Clicking theme toggle toggles data-theme from light to dark', function () {
      localStorage.setItem('theme', 'light');
      document.documentElement.setAttribute('data-theme', 'light');

      renderLogin();
      const toggle = document.getElementById('theme-toggle');
      assert.ok(toggle, 'theme-toggle button should exist');

      toggle.click();

      assert.strictEqual(
        document.documentElement.getAttribute('data-theme'),
        'dark',
        'data-theme should be dark after clicking toggle',
      );
      assert.strictEqual(
        localStorage.getItem('theme'),
        'dark',
        'localStorage.theme should be dark after clicking toggle',
      );
    });

    it('Clicking theme toggle toggles data-theme from dark to light', function () {
      localStorage.setItem('theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');

      renderLogin();
      const toggle = document.getElementById('theme-toggle');
      assert.ok(toggle, 'theme-toggle button should exist');

      toggle.click();

      assert.strictEqual(
        document.documentElement.getAttribute('data-theme'),
        'light',
        'data-theme should be light after clicking toggle',
      );
      assert.strictEqual(
        localStorage.getItem('theme'),
        'light',
        'localStorage.theme should be light after clicking toggle',
      );
    });

    it('Clicking theme toggle updates the button text and aria-pressed', function () {
      localStorage.setItem('theme', 'light');
      document.documentElement.setAttribute('data-theme', 'light');

      renderLogin();
      const toggle = document.getElementById('theme-toggle');
      assert.ok(toggle, 'theme-toggle button should exist');

      // Start with moon (light mode)
      assert.ok(
        toggle.textContent.includes('\u{1F319}') || toggle.textContent.includes('🌙'),
        'initial: moon emoji for light mode',
      );
      assert.strictEqual(toggle.getAttribute('aria-pressed'), 'false');

      toggle.click();

      // After click: sun (dark mode)
      assert.ok(
        toggle.textContent.includes('\u{2600}') || toggle.textContent.includes('☀'),
        'after click: sun emoji for dark mode',
      );
      assert.strictEqual(toggle.getAttribute('aria-pressed'), 'true');

      toggle.click();

      // Back to light
      assert.ok(
        toggle.textContent.includes('\u{1F319}') || toggle.textContent.includes('🌙'),
        'second click: moon emoji again',
      );
      assert.strictEqual(toggle.getAttribute('aria-pressed'), 'false');
    });
  });

  describe('Regression — renderLogin() works without localStorage set', function () {
    beforeEach(function () {
      state.user = null;
      state.sessionExpired = false;
      document.getElementById('app').innerHTML = '';
      global.api = async function () {};
      global.toast = function () {};
    });

    it('renderLogin() defaults to light theme when no localStorage and no dark preference', function () {
      localStorage.removeItem('theme');
      document.documentElement.removeAttribute('data-theme');

      renderLogin();

      assert.strictEqual(
        document.documentElement.getAttribute('data-theme'),
        'light',
        'should default to light when no localStorage and no system dark preference',
      );
    });

    it('renderLogin() renders form structure alongside the toggle button', function () {
      renderLogin();

      const form = document.getElementById('login-form');
      const card = document.querySelector('.login-card');
      const userInput = document.getElementById('auth-user');
      const passInput = document.getElementById('auth-pass');
      const submitBtn = document.getElementById('auth-submit');
      const toggle = document.getElementById('theme-toggle');

      assert.ok(form, 'Login form should exist');
      assert.ok(card, 'Login card should exist');
      assert.ok(userInput, 'Username input should exist');
      assert.ok(passInput, 'Password input should exist');
      assert.ok(submitBtn, 'Submit button should exist');
      assert.ok(toggle, 'Theme toggle should exist in login page');
    });

    it('renderLogin("register") renders theme toggle and register form', function () {
      renderLogin('register');

      const toggle = document.getElementById('theme-toggle');
      assert.ok(toggle, 'Theme toggle should exist in register mode');

      const form = document.getElementById('login-form');
      assert.ok(form, 'Register form should exist');
      assert.ok(
        document.querySelector('.register-mode'),
        'Register mode should have .register-mode',
      );
      assert.ok(
        document.getElementById('auth-pass-confirm'),
        'Confirm password input should exist in register mode',
      );
    });
  });
});
