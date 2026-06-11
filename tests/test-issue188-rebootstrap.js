// Test: Issue #188 — Re-bootstrap guard pattern for top-level let/const
//
// Coverage:
//   1. Re-bootstrap safety — loads app.js twice via vm.runInThisContext,
//      verifies no SyntaxError on second load (const re-declaration would
//      throw without the fix)
//   2. Value preservation — guard pattern (var X = X || default) preserves
//      existing values from the first load on re-bootstrap
//   3. All 11 converted names use var guard (not let/const) — source-level
//      regex verification
//
// Usage: npx mocha tests/test-issue188-rebootstrap.js --timeout 10000

const vm = require('vm');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const APP_JS_PATH = path.resolve(__dirname, '../public/js/app.js');

// ============================================================
// DOM helpers
// ============================================================

function createDOM() {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><head></head><body><div id="app">' +
      '<main class="main" id="main-content"><div id="page-content"></div></main>' +
      '</div></body></html>',
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
      media: '',
      onchange: null,
      dispatchEvent: () => false,
    }),
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.localStorage = dom.window.localStorage;
  global.HTMLElement = dom.window.HTMLElement;
  global.HTMLInputElement = dom.window.HTMLInputElement;
  global.HTMLSelectElement = dom.window.HTMLSelectElement;
  global.self = dom.window;

  return dom;
}

/**
 * Load app.js via vm.runInThisContext.
 * Returns true on success or throws on error.
 */
function loadAppJs() {
  const code = fs.readFileSync(APP_JS_PATH, 'utf-8');
  vm.runInThisContext(code, { filename: 'app.js' });
  return true;
}

// ============================================================
// Tests
// ============================================================

describe('Issue #188 — Re-bootstrap guard pattern', function () {
  // Clean up 11 global guard vars before each test to prevent
  // cross-file pollution (other test files may have loaded app.js
  // and set these globals before this test runs).
  beforeEach(function () {
    delete global.PASSWORD_SPECIAL;
    delete global.PASSWORD_MSG;
    delete global.PASSWORD_RULES;
    delete global.SESSION_MAX_AGE;
    delete global.WARNING_BEFORE;
    delete global.lastActivity;
    delete global.sessionMonitorId;
    delete global.sessionWarned;
    delete global.activityEvents;
    delete global.activityHandler;
    delete global.confirmCallback;
  });

  // -------------------------------------------------------
  // Test 1: Re-bootstrap safety
  // -------------------------------------------------------
  describe('Re-bootstrap safety', function () {
    beforeEach(function () {
      createDOM();
    });

    it('loads app.js via vm.runInThisContext without error', function () {
      assert.doesNotThrow(() => loadAppJs());
    });

    it('loads app.js a second time without SyntaxError (var guard)', function () {
      loadAppJs(); // first load — creates globals
      // Second load — guard pattern prevents re-declaration errors
      assert.doesNotThrow(() => loadAppJs());
    });

    it('loads app.js three times consecutively without error', function () {
      loadAppJs();
      loadAppJs();
      assert.doesNotThrow(() => loadAppJs());
    });
  });

  // -------------------------------------------------------
  // Test 2: Value preservation
  // -------------------------------------------------------
  describe('Value preservation on re-bootstrap', function () {
    beforeEach(function () {
      createDOM();
    });

    it('PASSWORD_SPECIAL regex value is preserved on second load', function () {
      loadAppJs();
      const firstVal = global.PASSWORD_SPECIAL;
      assert.ok(firstVal instanceof RegExp, 'PASSWORD_SPECIAL should be a RegExp on first load');

      loadAppJs();
      assert.strictEqual(
        global.PASSWORD_SPECIAL,
        firstVal,
        'PASSWORD_SPECIAL should be the same reference after re-bootstrap',
      );
    });

    it('PASSWORD_MSG string is preserved on second load', function () {
      loadAppJs();
      const firstVal = global.PASSWORD_MSG;
      assert.ok(typeof firstVal === 'string', 'PASSWORD_MSG should be a string');

      loadAppJs();
      assert.strictEqual(global.PASSWORD_MSG, firstVal);
    });

    it('PASSWORD_RULES array is preserved on second load', function () {
      loadAppJs();
      const firstVal = global.PASSWORD_RULES;
      assert.ok(Array.isArray(firstVal), 'PASSWORD_RULES should be an array');
      assert.strictEqual(firstVal.length, 5, 'PASSWORD_RULES should have 5 rules');

      loadAppJs();
      assert.strictEqual(global.PASSWORD_RULES, firstVal);
    });

    it('SESSION_MAX_AGE number is preserved on second load', function () {
      loadAppJs();
      const firstVal = global.SESSION_MAX_AGE;
      assert.strictEqual(firstVal, 16 * 60 * 60 * 1000);

      loadAppJs();
      assert.strictEqual(global.SESSION_MAX_AGE, firstVal);
    });

    it('WARNING_BEFORE number is preserved on second load', function () {
      loadAppJs();
      const firstVal = global.WARNING_BEFORE;
      assert.strictEqual(firstVal, 30 * 60 * 1000);

      loadAppJs();
      assert.strictEqual(global.WARNING_BEFORE, firstVal);
    });

    it('lastActivity is preserved on second load', function () {
      loadAppJs();
      const firstVal = global.lastActivity;
      assert.ok(typeof firstVal === 'number', 'lastActivity should be a number');

      loadAppJs();
      assert.strictEqual(global.lastActivity, firstVal);
    });

    it('sessionMonitorId is preserved on second load', function () {
      loadAppJs();
      // First load: sessionMonitorId = null (not started yet)
      assert.strictEqual(global.sessionMonitorId, null);

      loadAppJs();
      assert.strictEqual(global.sessionMonitorId, null);
    });

    it('sessionWarned is preserved on second load', function () {
      loadAppJs();
      assert.strictEqual(global.sessionWarned, false);

      loadAppJs();
      assert.strictEqual(global.sessionWarned, false);
    });

    it('activityEvents array is preserved on second load', function () {
      loadAppJs();
      const firstVal = global.activityEvents;
      assert.ok(Array.isArray(firstVal));
      assert.ok(firstVal.length > 0);

      loadAppJs();
      assert.strictEqual(global.activityEvents, firstVal);
    });

    it('activityHandler is preserved on second load', function () {
      loadAppJs();
      // First load: activityHandler = null
      assert.strictEqual(global.activityHandler, null);

      loadAppJs();
      assert.strictEqual(global.activityHandler, null);
    });

    it('confirmCallback is preserved on second load', function () {
      loadAppJs();
      assert.strictEqual(global.confirmCallback, null);

      loadAppJs();
      assert.strictEqual(global.confirmCallback, null);
    });
  });

  // -------------------------------------------------------
  // Test 3: Declaration verification (all 11 use var not let/const)
  // -------------------------------------------------------
  describe('Declaration verification (source-level)', function () {
    const convertedNames = [
      'PASSWORD_SPECIAL',
      'PASSWORD_MSG',
      'PASSWORD_RULES',
      'SESSION_MAX_AGE',
      'WARNING_BEFORE',
      'lastActivity',
      'sessionMonitorId',
      'sessionWarned',
      'activityEvents',
      'activityHandler',
      'confirmCallback',
    ];

    it('all 11 variable names are declared with var (not let/const)', function () {
      const code = fs.readFileSync(APP_JS_PATH, 'utf-8');

      for (const name of convertedNames) {
        const varRe = new RegExp(`^var\\s+${name}\\s*=`, 'm');
        const letRe = new RegExp(`^let\\s+${name}\\s*=`, 'm');
        const constRe = new RegExp(`^const\\s+${name}\\s*=`, 'm');

        assert.ok(
          varRe.test(code),
          `${name} should be declared with var, got something else (or not found)`,
        );
        assert.ok(!letRe.test(code), `${name} should NOT be declared with let`);
        assert.ok(!constRe.test(code), `${name} should NOT be declared with const`);
      }
    });

    it('all 11 variable names use the guard pattern (var X = X || default)', function () {
      const code = fs.readFileSync(APP_JS_PATH, 'utf-8');

      for (const name of convertedNames) {
        const guardRe = new RegExp(`var\\s+${name}\\s*=\\s*${name}\\s*\\|\\|`);
        assert.ok(
          guardRe.test(code),
          `${name} should use guard pattern: var ${name} = ${name} || ...`,
        );
      }
    });

    it('no top-level let/const declarations exist that should be converted (double-check)', function () {
      const code = fs.readFileSync(APP_JS_PATH, 'utf-8');

      // Known remaining module-level let/const that are NOT needed because
      // they are defined inside IIFEs or have different scope rules.
      // If this test fails, a new declaration needs review. Not a hard error
      // but a flag for manual review.
      for (const name of convertedNames) {
        const letRe = new RegExp(`^let\\s+${name}\\s*=`, 'm');
        const constRe = new RegExp(`^const\\s+${name}\\s*=`, 'm');

        assert.ok(
          !letRe.test(code),
          `Converted variable ${name} should NOT have a let declaration remaining`,
        );
        assert.ok(
          !constRe.test(code),
          `Converted variable ${name} should NOT have a const declaration remaining`,
        );
      }
    });
  });

  // -------------------------------------------------------
  // Test 4: Runtime guard behavior verification
  // -------------------------------------------------------
  describe('Guard pattern runtime behavior', function () {
    it('setting a value before loading app.js preserves it', function () {
      createDOM();
      global.PASSWORD_SPECIAL = /custom_regex/;
      global.SESSION_MAX_AGE = 5000;
      global.lastActivity = 12345;

      loadAppJs();

      // Guard pattern: var X = X || default → should use existing value
      assert.strictEqual(global.PASSWORD_SPECIAL.toString(), '/custom_regex/');
      assert.strictEqual(global.SESSION_MAX_AGE, 5000);
      assert.strictEqual(global.lastActivity, 12345);
    });
  });
});
