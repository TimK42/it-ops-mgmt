// Tests for Issue #137 — PWA install banner overlaps register page content on mobile
// #137 — register-mode class on <form> + padding-bottom: 80px in CSS @media

const vm = require('vm');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// ============================================================
// Fresh DOM for each test
// ============================================================

function resetDOM() {
  var dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
    url: 'http://localhost:3199',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
  });

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
  global.self = dom.window;
  global.history = dom.window.history;

  return dom;
}

// ============================================================
// Load app.js once — defines renderLogin() and state
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

describe('Issue #137 — PWA install banner overlap fix', function () {
  // ============================================================
  // CSS Test — .login-page.register-mode inside @media
  // ============================================================

  describe('CSS — .login-page.register-mode padding-bottom: 80px', function () {
    var css;

    before(function () {
      css = fs.readFileSync(path.resolve(__dirname, '../public/css/style.css'), 'utf-8');
    });

    it('.login-page.register-mode has padding-bottom: 80px inside @media (max-width: 480px)', function () {
      var mediaStart = css.indexOf('@media (max-width: 480px)');
      assert.ok(mediaStart !== -1, '@media (max-width: 480px) block must exist');

      var blockStart = css.indexOf('{', mediaStart);
      assert.ok(blockStart !== -1, '@media opening brace must exist');

      // Find matching closing brace respecting nesting
      var depth = 0;
      var blockEnd = -1;
      for (var i = blockStart; i < css.length; i++) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') {
          depth--;
          if (depth === 0) {
            blockEnd = i;
            break;
          }
        }
      }
      assert.ok(blockEnd !== -1, '@media closing brace must exist');

      var mediaBlock = css.slice(mediaStart, blockEnd + 1);
      assert.ok(
        mediaBlock.indexOf('.login-page.register-mode') !== -1,
        '@media block should contain .login-page.register-mode selector',
      );
      assert.ok(
        mediaBlock.indexOf('padding-bottom: 80px') !== -1,
        '@media block should contain padding-bottom: 80px rule',
      );
    });

    it('.login-page.register-mode appears inside @media block, not as base rule', function () {
      var mediaStart = css.indexOf('@media (max-width: 480px)');
      assert.ok(mediaStart !== -1, '@media (max-width: 480px) block must exist');

      var registerIdx = css.indexOf('.login-page.register-mode');
      assert.ok(registerIdx !== -1, '.login-page.register-mode must exist in CSS');

      // The selector must appear after the @media block starts
      assert.ok(
        registerIdx > mediaStart,
        '.login-page.register-mode should appear AFTER @media (max-width: 480px)',
      );
    });
  });

  // ============================================================
  // JS Test — register-mode class on <form> via renderLogin()
  // ============================================================

  describe('JS — register-mode class on form', function () {
    beforeEach(function () {
      resetDOM();
      state.page = 'login';
      state.user = null;
      state.sessionExpired = false;
    });

    it('renderLogin("register") adds register-mode class to form', function () {
      renderLogin('register');
      var form = document.getElementById('login-form');
      assert.ok(form, 'form#login-form must exist');
      assert.ok(
        form.classList.contains('register-mode'),
        'form should have register-mode class when mode === "register"',
      );
    });

    it('renderLogin() (login mode) does NOT add register-mode class to form', function () {
      renderLogin();
      var form = document.getElementById('login-form');
      assert.ok(form, 'form#login-form must exist');
      assert.ok(
        !form.classList.contains('register-mode'),
        'form should NOT have register-mode class in login mode',
      );
    });

    it('renderLogin always preserves login-page class on form', function () {
      renderLogin('register');
      var form = document.getElementById('login-form');
      assert.ok(
        form.classList.contains('login-page'),
        'form should always have login-page class in register mode',
      );

      resetDOM();
      state.page = 'login';
      state.user = null;
      state.sessionExpired = false;
      renderLogin();
      form = document.getElementById('login-form');
      assert.ok(
        form.classList.contains('login-page'),
        'form should always have login-page class in login mode',
      );
    });
  });
});
