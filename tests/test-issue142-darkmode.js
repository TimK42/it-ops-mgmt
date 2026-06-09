// Tests for Issue #142 — Dark mode resets on SPA page navigation
// #142 — restoreTheme() re-applies data-theme on <html> during navigate()

const vm = require('vm');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// ============================================================
// Fresh DOM for each test
// ============================================================

function resetDOM() {
  var dom = new JSDOM(
    '<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>',
    {
      url: 'http://localhost:3199',
      pretendToBeVisual: true,
      runScripts: 'dangerously',
    },
  );

  Object.defineProperty(dom.window, 'matchMedia', {
    writable: true,
    value: function () {
      return { matches: false, addListener: function () {}, removeListener: function () {} };
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

// ============================================================
// Load app.js once — defines restoreTheme() and navigate()
// ============================================================

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

describe('Issue #142 — Dark mode resets on SPA page navigation', function () {
  describe('restoreTheme() — localStorage', function () {
    beforeEach(function () {
      resetDOM();
      state.page = 'qa';
      state.user = null;
      state.sessionExpired = false;
    });

    it('reads localStorage.theme="dark" and sets data-theme="dark" on <html>', function () {
      localStorage.setItem('theme', 'dark');
      restoreTheme();
      assert.strictEqual(
        document.documentElement.getAttribute('data-theme'),
        'dark',
        'data-theme should be "dark" when localStorage.theme is "dark"',
      );
    });

    it('reads localStorage.theme="light" and sets data-theme="light" on <html>', function () {
      localStorage.setItem('theme', 'light');
      restoreTheme();
      assert.strictEqual(
        document.documentElement.getAttribute('data-theme'),
        'light',
        'data-theme should be "light" when localStorage.theme is "light"',
      );
    });
  });

  describe('restoreTheme() — fallback to system preference', function () {
    beforeEach(function () {
      resetDOM();
      state.page = 'qa';
      state.user = null;
      state.sessionExpired = false;
    });

    it('falls back to system preference (dark) when no localStorage, matchMedia matches', function () {
      document.defaultView.matchMedia = function () {
        return { matches: true };
      };
      restoreTheme();
      assert.strictEqual(
        document.documentElement.getAttribute('data-theme'),
        'dark',
        'should use system preference (dark) when no localStorage and prefers-color-scheme: dark',
      );
    });

    it('falls back to "light" when no localStorage and system preference is light', function () {
      // matchMedia returns matches: false by default in resetDOM
      localStorage.removeItem('theme');
      restoreTheme();
      assert.strictEqual(
        document.documentElement.getAttribute('data-theme'),
        'light',
        'should default to "light" when no localStorage and no dark system preference',
      );
    });
  });

  describe('restoreTheme() — theme-color meta tag', function () {
    beforeEach(function () {
      resetDOM();
      state.page = 'qa';
      state.user = null;
      state.sessionExpired = false;
    });

    it('updates meta[name="theme-color"] content for dark theme', function () {
      var meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      meta.setAttribute('content', '#4f46e5');
      document.head.appendChild(meta);

      localStorage.setItem('theme', 'dark');
      restoreTheme();

      var metas = document.querySelectorAll('meta[name="theme-color"]');
      assert.ok(metas.length > 0, 'meta[name="theme-color"] should exist');
      assert.strictEqual(metas[0].getAttribute('content'), '#0f0f1a');
    });

    it('updates meta[name="theme-color"] content for light theme', function () {
      var meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      meta.setAttribute('content', '#0f0f1a');
      document.head.appendChild(meta);

      localStorage.setItem('theme', 'light');
      restoreTheme();

      var metas = document.querySelectorAll('meta[name="theme-color"]');
      assert.ok(metas.length > 0, 'meta[name="theme-color"] should exist');
      assert.strictEqual(metas[0].getAttribute('content'), '#4f46e5');
    });
  });

  describe('navigate() — theme preservation', function () {
    beforeEach(function () {
      resetDOM();
      state.page = 'qa';
      state.user = null;
      state.sessionExpired = false;

      // Ensure DOM has nav items that navigate() expects
      var nav = document.createElement('nav');
      nav.innerHTML =
        '<a class="nav-item active" data-nav="qa" href="#">QA</a>' +
        '<a class="nav-item" data-nav="categories" href="#">Categories</a>';
      document.body.appendChild(nav);

      var pageTitle = document.createElement('h1');
      pageTitle.id = 'page-title';
      pageTitle.textContent = 'QA Library';
      document.body.appendChild(pageTitle);

      var pageContent = document.createElement('div');
      pageContent.id = 'page-content';
      document.body.appendChild(pageContent);

      closeModal = function () {};
      closeSidebar = function () {};
    });

    it('applies localStorage.theme="dark" to <html> via navigate() calling restoreTheme()', function () {
      localStorage.setItem('theme', 'dark');
      // Do NOT call restoreTheme() directly — rely on navigate() calling it
      navigate('categories');
      assert.strictEqual(
        document.documentElement.getAttribute('data-theme'),
        'dark',
        'navigate() should apply dark theme via restoreTheme() when localStorage.theme="dark"',
      );
    });

    it('applies localStorage.theme="light" to <html> via navigate() calling restoreTheme()', function () {
      localStorage.setItem('theme', 'light');
      navigate('categories');
      assert.strictEqual(
        document.documentElement.getAttribute('data-theme'),
        'light',
        'navigate() should apply light theme via restoreTheme() when localStorage.theme="light"',
      );
    });

    it('falls back to system preference during navigate() when no localStorage', function () {
      localStorage.removeItem('theme');
      navigate('categories');
      assert.strictEqual(
        document.documentElement.getAttribute('data-theme'),
        'light',
        'navigate() should fall back to light theme when no localStorage and no dark preference',
      );
    });
  });
});
