// Tests for Issues #138, #139, #140, #141
// #138 — Login page <main> landmark + skip-to-content link
// #139 — Login background theme-aware (CSS custom properties)
// #140 — Login card responsive padding
// #141 — Login font sizes

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
  state.page = 'login';
  state.user = null;
  state.sessionExpired = false;
});

// ============================================================
// Issue #138: Login page <main> landmark + skip-to-content link
// ============================================================

describe('Issue #138 — Login page skip-link and main landmark', function () {
  it('renders skip-to-content link with correct href and class', function () {
    renderLogin();
    var html = document.getElementById('app').innerHTML;
    assert.ok(html.indexOf('class="skip-link"') !== -1, 'Should contain skip-link class');
    assert.ok(html.indexOf('href="#main-content"') !== -1, 'Should link to #main-content');
    assert.ok(html.indexOf('Skip to content') !== -1, 'Should say "Skip to content"');
  });

  it('renders <main> landmark with id="main-content"', function () {
    renderLogin();
    var html = document.getElementById('app').innerHTML;
    assert.ok(
      html.indexOf('<main id="main-content"') !== -1,
      'Should contain <main id="main-content">',
    );
    assert.ok(html.indexOf('class="main"') !== -1, 'Main element should have class="main"');
  });

  it('sets tabindex="-1" on the main element', function () {
    renderLogin();
    var html = document.getElementById('app').innerHTML;
    assert.ok(html.indexOf('tabindex="-1"') !== -1, 'Main element should have tabindex="-1"');
  });

  it('wraps login form inside <main> tags', function () {
    renderLogin();
    var html = document.getElementById('app').innerHTML;
    var openIdx = html.indexOf('<main id="main-content"');
    var closeIdx = html.indexOf('</main>');
    var formStart = html.indexOf('<form');
    var formEnd = html.indexOf('</form>');
    assert.ok(openIdx < formStart, '<main> should open before <form>');
    assert.ok(formEnd < closeIdx, '</form> should close before </main>');
  });

  it('skip-link appears before <main> tag', function () {
    renderLogin();
    var html = document.getElementById('app').innerHTML;
    var skipIdx = html.indexOf('Skip to content');
    var mainIdx = html.indexOf('<main');
    assert.ok(skipIdx < mainIdx && skipIdx !== -1, 'Skip link should appear before <main> element');
  });
});

// ============================================================
// Issue #139: Login background theme-aware CSS
// ============================================================

describe('Issue #139 — Login background theme-aware CSS', function () {
  var css;

  before(function () {
    css = fs.readFileSync(path.resolve(__dirname, '../public/css/style.css'), 'utf-8');
  });

  it(':root declares --login-bg-start', function () {
    assert.ok(
      css.indexOf('--login-bg-start: #eef2ff') !== -1,
      ':root should declare --login-bg-start',
    );
  });

  it(':root declares --login-bg-end', function () {
    assert.ok(css.indexOf('--login-bg-end: #e0e7ff') !== -1, ':root should declare --login-bg-end');
  });

  it("[data-theme='dark'] declares --login-bg-start", function () {
    assert.ok(
      css.indexOf('--login-bg-start: #1a1a2e') !== -1,
      "[data-theme='dark'] should declare --login-bg-start",
    );
  });

  it("[data-theme='dark'] declares --login-bg-end", function () {
    assert.ok(
      css.indexOf('--login-bg-end: #16213e') !== -1,
      "[data-theme='dark'] should declare --login-bg-end",
    );
  });

  it('.login-page uses var(--login-bg-start) and var(--login-bg-end)', function () {
    assert.ok(
      css.indexOf('var(--login-bg-start)') !== -1,
      'CSS should reference var(--login-bg-start) in gradient',
    );
    assert.ok(
      css.indexOf('var(--login-bg-end)') !== -1,
      'CSS should reference var(--login-bg-end) in gradient',
    );
  });

  it('.login-page gradient no longer uses hardcoded color values', function () {
    // Should NOT contain the old hardcoded colors for the login gradient
    var oldPattern = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)';
    assert.ok(
      css.indexOf(oldPattern) === -1,
      'Should NOT contain hardcoded gradient colors in .login-page',
    );
  });
});

// ============================================================
// Issue #140: Login card responsive padding
// ============================================================

describe('Issue #140 — Login card responsive padding', function () {
  var css;

  before(function () {
    css = fs.readFileSync(path.resolve(__dirname, '../public/css/style.css'), 'utf-8');
  });

  it('has @media (max-width: 480px) rule', function () {
    assert.ok(
      css.indexOf('@media (max-width: 480px)') !== -1,
      'CSS should contain @media (max-width: 480px) rule',
    );
  });

  it('media rule sets .login-card padding: 24px', function () {
    // Find the media block and extract its boundaries via brace matching
    var mediaStart = css.indexOf('@media (max-width: 480px)');
    assert.ok(mediaStart !== -1, '@media block must exist');

    var blockStart = css.indexOf('{', mediaStart);
    assert.ok(blockStart !== -1, '@media opening brace must exist');

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
    // Search only within the extracted media block to avoid false positives
    assert.ok(
      mediaBlock.indexOf('.login-card') !== -1 && mediaBlock.indexOf('padding: 24px') !== -1,
      '@media block should set .login-card { padding: 24px }',
    );
  });
});

// ============================================================
// Issue #141: Login font sizes
// ============================================================

describe('Issue #141 — Login font sizes', function () {
  var css;

  before(function () {
    css = fs.readFileSync(path.resolve(__dirname, '../public/css/style.css'), 'utf-8');
  });

  it('.login-card .login-sub font-size is 14px', function () {
    assert.ok(css.indexOf('.login-card .login-sub') !== -1, '.login-card .login-sub should exist');
    assert.ok(css.indexOf('font-size: 14px') !== -1, 'Should have font-size: 14px');

    // Confirm it's inside the .login-card .login-sub block, not somewhere else
    var subIdx = css.indexOf('.login-card .login-sub');
    var subBlock = css.slice(subIdx, subIdx + 200);
    assert.ok(
      subBlock.indexOf('font-size: 14px') !== -1,
      '.login-card .login-sub block should set font-size: 14px',
    );
  });

  it('.login-link font-size is 14px', function () {
    // Use '.login-link {' to skip earlier '.login-link a' occurrences
    var linkIdx = css.indexOf('.login-link {');
    assert.ok(linkIdx !== -1, '.login-link block should exist');

    var linkBlock = css.slice(linkIdx, linkIdx + 200);
    assert.ok(
      linkBlock.indexOf('font-size: 14px') !== -1,
      '.login-link block should set font-size: 14px',
    );
  });

  it('.login-card .login-sub is NOT 13px (old value)', function () {
    var subIdx = css.indexOf('.login-card .login-sub');
    var subBlock = css.slice(subIdx, subIdx + 200);
    assert.ok(
      subBlock.indexOf('font-size: 13px') === -1,
      '.login-card .login-sub should NOT have font-size: 13px',
    );
  });

  it('.login-link is NOT 12px (old value)', function () {
    var linkIdx = css.indexOf('.login-link {');
    assert.ok(linkIdx !== -1, '.login-link block should exist');
    var linkBlock = css.slice(linkIdx, linkIdx + 200);
    assert.ok(
      linkBlock.indexOf('font-size: 12px') === -1,
      '.login-link should NOT have font-size: 12px',
    );
  });
});
