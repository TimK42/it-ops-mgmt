// Tests for Issue #221 — Login/Register page theme script in index.html
// #221 — Add <script> in <head> that sets data-theme on <html> before CSS loads
//
// The fix adds a script block to public/index.html that:
//   1. Reads localStorage.theme (dark or light)
//   2. Falls back to system preference (prefers-color-scheme)
//   3. Defaults to 'light'
//   4. Sets data-theme on document.documentElement before CSS renders

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

  // matchMedia stub — test code controls the return value
  Object.defineProperty(dom.window, 'matchMedia', {
    writable: true,
    value: function () {
      return {
        matches: false,
        addListener: function () {},
        removeListener: function () {},
      };
    },
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.localStorage = dom.window.localStorage;
  global.HTMLElement = dom.window.HTMLElement;
  global.self = dom.window;

  return dom;
}

// ============================================================
// Extract the theme script from index.html source
// ============================================================

function getThemeScript() {
  var htmlPath = path.resolve(__dirname, '..', 'public', 'index.html');
  var html = fs.readFileSync(htmlPath, 'utf-8');
  // Extract the script content by finding the theme bootstrap script
  // (identified by its localStorage.getItem('theme') call, unique in <head>)
  var idx = html.indexOf("localStorage.getItem('theme')");
  assert.ok(idx >= 0, 'index.html should contain the theme script in <head>');
  // Find the opening <script> tag before this position
  var scriptStart = html.lastIndexOf('<script>', idx);
  assert.ok(scriptStart >= 0, 'theme script should have opening <script> tag');
  // Find the closing </script> tag after this position
  var scriptEnd = html.indexOf('</script>', idx);
  assert.ok(scriptEnd >= 0, 'theme script should have closing </script> tag');
  return html.substring(scriptStart + '<script>'.length, scriptEnd).trim();
}

// ============================================================
// Tests
// ============================================================

describe('Issue #221 — Theme script in index.html', function () {
  describe('Script presence in HTML', function () {
    it('index.html contains the theme initialization script block', function () {
      var htmlPath = path.resolve(__dirname, '..', 'public', 'index.html');
      var html = fs.readFileSync(htmlPath, 'utf-8');
      assert.ok(
        html.includes("localStorage.getItem('theme')"),
        'index.html script should read localStorage theme',
      );
      assert.ok(
        html.includes("document.documentElement.setAttribute('data-theme'"),
        'index.html script should set data-theme on <html>',
      );
      assert.ok(
        html.includes('prefers-color-scheme'),
        'index.html script should check prefers-color-scheme: dark',
      );
    });

    it('theme script appears before CSS <link> tags (prevents flash)', function () {
      var htmlPath = path.resolve(__dirname, '..', 'public', 'index.html');
      var html = fs.readFileSync(htmlPath, 'utf-8');
      var scriptIdx = html.indexOf('<script>');
      var cssIdx = html.indexOf('/css/style.css');
      assert.ok(
        scriptIdx >= 0 && cssIdx >= 0 && scriptIdx < cssIdx,
        'theme script must appear before CSS to prevent flash of wrong theme',
      );
    });
  });

  describe('Script behavior — localStorage theme', function () {
    beforeEach(function () {
      resetDOM();
    });

    it('sets data-theme="dark" when localStorage.theme is "dark"', function () {
      localStorage.setItem('theme', 'dark');
      vm.runInThisContext(getThemeScript());
      assert.strictEqual(
        document.documentElement.getAttribute('data-theme'),
        'dark',
        'data-theme should be "dark" when localStorage.theme is "dark"',
      );
    });

    it('sets data-theme="light" when localStorage.theme is "light"', function () {
      localStorage.setItem('theme', 'light');
      vm.runInThisContext(getThemeScript());
      assert.strictEqual(
        document.documentElement.getAttribute('data-theme'),
        'light',
        'data-theme should be "light" when localStorage.theme is "light"',
      );
    });
  });

  describe('Script behavior — system preference fallback', function () {
    beforeEach(function () {
      resetDOM();
    });

    it('falls back to system dark when no localStorage and matchMedia matches', function () {
      document.defaultView.matchMedia = function () {
        return { matches: true };
      };
      localStorage.removeItem('theme');
      vm.runInThisContext(getThemeScript());
      assert.strictEqual(
        document.documentElement.getAttribute('data-theme'),
        'dark',
        'should use system preference (dark) when no localStorage and prefers-color-scheme: dark',
      );
    });

    it('falls back to "light" when no localStorage and matchMedia does not match', function () {
      // matchMedia returns matches: false by default in resetDOM
      localStorage.removeItem('theme');
      vm.runInThisContext(getThemeScript());
      assert.strictEqual(
        document.documentElement.getAttribute('data-theme'),
        'light',
        'should default to "light" when no localStorage and no dark system preference',
      );
    });
  });

  describe('Script behavior — invalid localStorage value', function () {
    beforeEach(function () {
      resetDOM();
    });

    it('falls back to matchMedia when localStorage has invalid value', function () {
      localStorage.setItem('theme', 'invalid');
      document.defaultView.matchMedia = function () {
        return { matches: true };
      };
      vm.runInThisContext(getThemeScript());
      assert.strictEqual(
        document.documentElement.getAttribute('data-theme'),
        'dark',
        'invalid localStorage value should fall back to matchMedia (system preference)',
      );
    });
  });

  describe('Script behavior — error handling', function () {
    beforeEach(function () {
      resetDOM();
    });

    it('does not throw when localStorage is unavailable, falls back to matchMedia', function () {
      // Save original localStorage and replace with one that throws
      var origLs = global.localStorage;
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: function () {
            throw new Error('localStorage unavailable');
          },
        },
        writable: true,
      });
      // Set matchMedia to dark mode
      document.defaultView.matchMedia = function () {
        return { matches: true };
      };
      // Reset document state
      document.documentElement.removeAttribute('data-theme');
      var threw = false;
      try {
        vm.runInThisContext(getThemeScript());
      } catch (err) {
        threw = true;
      }
      assert.ok(!threw, 'should not throw when localStorage is unavailable');
      assert.strictEqual(
        document.documentElement.getAttribute('data-theme'),
        'dark',
        'should fall back to system preference (dark) when localStorage is unavailable',
      );
      global.localStorage = origLs;
    });
  });
});
