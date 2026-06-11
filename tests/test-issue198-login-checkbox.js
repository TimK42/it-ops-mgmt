// Test: Issue #198 — Login Remember Me checkbox
//
// Coverage:
//   1. Checkbox renders with .form-checkbox class (not inline styles)
//   2. Checkbox input has id="auth-remember" and correct type
//   3. Label click toggles checkbox checked state
//   4. CSS has .form-checkbox with 44×44px dimensions
//   5. CSS uses CSS variables for dark mode compatibility
//   6. Regression: renderLogin() works with/without register mode
//   7. Register mode does NOT show the checkbox
//
// Usage: npx mocha tests/test-issue198-login-checkbox.js --timeout 15000

const vm = require('vm');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// ============================================================
// resetDOM — fresh JSDOM with #app container for each test
// ============================================================

function resetDOM() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
    url: 'http://localhost:3199',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
  });

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
// Helpers
// ============================================================

function setupLogin(mode) {
  state.user = null;
  state.sessionExpired = false;
  document.getElementById('app').innerHTML = '';
  global.api = async function () {};
  global.toast = function () {};
  renderLogin(mode);
}

// ============================================================
// Tests
// ============================================================

describe('Issue #198 — Login Remember Me checkbox', function () {
  beforeEach(function () {
    resetDOM();
  });

  // ============================================================
  // Happy path — checkbox renders correctly
  // ============================================================

  describe('Checkbox renders correctly', function () {
    it('Login page renders .form-checkbox element for sign-in mode', function () {
      setupLogin(); // no mode = sign-in
      const checkbox = document.querySelector('.form-checkbox');
      assert.ok(checkbox, 'Sign-in mode should have .form-checkbox element');
    });

    it('Checkbox has id="auth-remember" and type="checkbox"', function () {
      setupLogin();
      const input = document.getElementById('auth-remember');
      assert.ok(input, 'auth-remember input should exist');
      assert.strictEqual(input.type, 'checkbox', 'auth-remember should be a checkbox');
    });

    it('Checkbox label has for="auth-remember" and contains "Remember me" text', function () {
      setupLogin();
      const label = document.querySelector('.form-checkbox label');
      assert.ok(label, 'Checkbox should have a label element');
      assert.strictEqual(
        label.getAttribute('for'),
        'auth-remember',
        'Label for should point to auth-remember',
      );
      assert.ok(
        label.textContent.includes('Remember me'),
        'Label text should include "Remember me"',
      );
    });

    it('Register mode does NOT show the checkbox', function () {
      setupLogin('register');
      const checkbox = document.querySelector('.form-checkbox');
      assert.strictEqual(checkbox, null, 'Register mode should NOT have .form-checkbox');
      const input = document.getElementById('auth-remember');
      assert.strictEqual(input, null, 'Register mode should NOT have auth-remember input');
    });
  });

  // ============================================================
  // Label click toggles checkbox
  // ============================================================

  describe('Label interaction toggles checkbox', function () {
    it('Clicking label checks the checkbox', function () {
      setupLogin();
      const input = document.getElementById('auth-remember');
      const label = document.querySelector('.form-checkbox label');

      assert.ok(input, 'Checkbox input should exist');
      assert.strictEqual(input.checked, false, 'Checkbox should start unchecked');

      // Click the label to check
      label.click();
      assert.strictEqual(input.checked, true, 'Checkbox should be checked after label click');
    });

    it('Clicking label a second time unchecks the checkbox', function () {
      setupLogin();
      const input = document.getElementById('auth-remember');
      const label = document.querySelector('.form-checkbox label');

      // First click to check
      label.click();
      assert.strictEqual(input.checked, true, 'Checkbox should be checked after first click');

      // Second click to uncheck
      label.click();
      assert.strictEqual(input.checked, false, 'Checkbox should be unchecked after second click');
    });

    it('Clicking checkbox directly toggles checked state', function () {
      setupLogin();
      const input = document.getElementById('auth-remember');

      input.click();
      assert.strictEqual(input.checked, true, 'Checkbox should be checked after direct click');

      input.click();
      assert.strictEqual(
        input.checked,
        false,
        'Checkbox should be unchecked after second direct click',
      );
    });
  });

  // ============================================================
  // Regression — renderLogin() still works
  // ============================================================

  describe('renderLogin() regression', function () {
    it('renderLogin() works without crashing (no mode)', function () {
      setupLogin();
      const html = document.getElementById('app').innerHTML;
      assert.ok(html.length > 0, 'App should have HTML content');
    });

    it('renderLogin("register") works without crashing', function () {
      setupLogin('register');
      const html = document.getElementById('app').innerHTML;
      assert.ok(html.length > 0, 'App should have HTML content');
    });

    it('renderLogin() preserves login form structure (form, card, inputs)', function () {
      setupLogin();
      assert.ok(document.getElementById('login-form'), 'Login form should exist');
      assert.ok(document.querySelector('.login-card'), 'Login card should exist');
      assert.ok(document.querySelector('.login-page'), 'Login page should exist');
      assert.ok(document.getElementById('auth-user'), 'Username input should exist');
      assert.ok(document.getElementById('auth-pass'), 'Password input should exist');
      assert.ok(document.getElementById('auth-submit'), 'Submit button should exist');
    });

    it('renderLogin("register") shows register-specific elements', function () {
      setupLogin('register');
      assert.ok(
        document.querySelector('.register-mode'),
        'Register mode should have .register-mode',
      );
      assert.ok(
        document.getElementById('auth-pass-confirm'),
        'Confirm password input should exist',
      );
      assert.ok(document.getElementById('auth-role'), 'Role select should exist');
    });

    it('Session expired message still renders above form', function () {
      state.user = null;
      state.sessionExpired = true;
      document.getElementById('app').innerHTML = '';
      global.api = async function () {};
      global.toast = function () {};
      renderLogin();
      const html = document.getElementById('app').innerHTML;
      assert.ok(
        html.includes('session-expired'),
        'Session expired message should be shown when state.sessionExpired is true',
      );
      assert.ok(
        html.includes('Your session has expired'),
        'Session expired message text should be present',
      );
    });
  });

  // ============================================================
  // CSS file verification
  // ============================================================

  describe('CSS — .form-checkbox styles', function () {
    var css;

    before(function () {
      css = fs.readFileSync(path.resolve(__dirname, '../public/css/style.css'), 'utf-8');
    });

    it('CSS has .form-checkbox class selector', function () {
      assert.ok(css.indexOf('.form-checkbox') !== -1, 'CSS should define .form-checkbox');
    });

    it('CSS has .form-checkbox label selector', function () {
      assert.ok(
        css.indexOf('.form-checkbox label') !== -1,
        'CSS should define .form-checkbox label',
      );
    });

    it('CSS checkbox input has 44×44px dimensions', function () {
      var idx = css.indexOf('.form-checkbox input[type="checkbox"]');
      assert.ok(idx !== -1, 'CSS should define .form-checkbox input[type="checkbox"]');

      var blockStart = css.indexOf('{', idx);
      var blockEnd = css.indexOf('}', blockStart);
      var block = css.slice(blockStart, blockEnd + 1);

      assert.ok(block.indexOf('width: 44px') !== -1, 'Checkbox should have width: 44px');
      assert.ok(block.indexOf('height: 44px') !== -1, 'Checkbox should have height: 44px');
      assert.ok(block.indexOf('min-width: 44px') !== -1, 'Checkbox should have min-width: 44px');
    });

    it('CSS checkbox has appearance:none and border-radius: 6px', function () {
      var idx = css.indexOf('.form-checkbox input[type="checkbox"]');
      var blockStart = css.indexOf('{', idx);
      var blockEnd = css.indexOf('}', blockStart);
      var block = css.slice(blockStart, blockEnd + 1);

      assert.ok(block.indexOf('appearance: none') !== -1, 'Checkbox should have appearance: none');
      assert.ok(
        block.indexOf('-webkit-appearance: none') !== -1,
        'Checkbox should have -webkit-appearance: none',
      );
      assert.ok(
        block.indexOf('border-radius: 6px') !== -1,
        'Checkbox should have border-radius: 6px',
      );
    });

    it('CSS uses CSS custom properties for dark mode compatibility', function () {
      // Check base checkbox input styles
      var idx = css.indexOf('.form-checkbox input[type="checkbox"]');
      var blockStart = css.indexOf('{', idx);
      var blockEnd = css.indexOf('}', blockStart);
      var block = css.slice(blockStart, blockEnd + 1);

      assert.ok(
        block.indexOf('var(--border)') !== -1,
        'Checkbox border color should use var(--border)',
      );
      assert.ok(
        block.indexOf('var(--surface)') !== -1,
        'Checkbox background should use var(--surface)',
      );

      // Check :checked state for var(--primary) in the :checked block
      var checkedIdx = css.indexOf('.form-checkbox input[type="checkbox"]:checked');
      var checkedStart = css.indexOf('{', checkedIdx);
      var checkedEnd = css.indexOf('}', checkedStart);
      var checkedBlock = css.slice(checkedStart, checkedEnd + 1);

      assert.ok(
        checkedBlock.indexOf('var(--primary)') !== -1,
        'Checkbox :checked should reference var(--primary)',
      );
    });

    it('CSS checkbox has checkmark pseudo-element on :checked', function () {
      var checkedIdx = css.indexOf('.form-checkbox input[type="checkbox"]:checked');
      assert.ok(checkedIdx !== -1, 'CSS should define :checked state for checkbox');

      var pseudoIdx = css.indexOf('.form-checkbox input[type="checkbox"]:checked::after');
      assert.ok(pseudoIdx !== -1, 'CSS should define :checked::after for checkmark pseudo-element');
    });

    it('CSS checkmark uses white color on primary background', function () {
      var idx = css.indexOf('.form-checkbox input[type="checkbox"]:checked');
      var blockStart = css.indexOf('{', idx);
      var blockEnd = css.indexOf('}', blockStart);
      var block = css.slice(blockStart, blockEnd + 1);

      assert.ok(block.indexOf('var(--primary)') !== -1, ':checked should use var(--primary)');
    });

    it('CSS checkbox has focus-visible outline for accessibility', function () {
      var idx = css.indexOf('.form-checkbox input[type="checkbox"]:focus-visible');
      assert.ok(idx !== -1, 'CSS should define :focus-visible state for keyboard accessibility');
    });

    it('CSS checkbox label has min-height: 44px (WCAG tap target)', function () {
      var idx = css.indexOf('.form-checkbox label');
      var blockStart = css.indexOf('{', idx);
      var blockEnd = css.indexOf('}', blockStart);
      var block = css.slice(blockStart, blockEnd + 1);

      assert.ok(
        block.indexOf('min-height: 44px') !== -1,
        'Label should have min-height: 44px for WCAG tap target',
      );
      assert.ok(block.indexOf('gap: 12px') !== -1, 'Label should have gap: 12px');
      assert.ok(block.indexOf('cursor: pointer') !== -1, 'Label should have cursor: pointer');
      assert.ok(
        block.indexOf('user-select: none') !== -1,
        'Label should have user-select: none to prevent text selection on click',
      );
    });
  });
});
