// Tests for Issue #163 — Screen flash on all component clicks
// Six root causes fixed:
//   1. restoreTheme() — add guard to avoid setting data-theme when unchanged
//   2. .content — add background: var(--bg) to prevent transparent flash
//   3. body transition — change 0.3s to 0.1s
//   4. Duplicate theme-color meta tags — remove one
//   5. updateThemeColor() — add guard to avoid writing identical value
//   6. showQADetail() — reorder: build content before opening modal

const fs = require('fs');
const path = require('path');
const assert = require('assert');

var css, js, html;

before(function () {
  css = fs.readFileSync(path.resolve(__dirname, '../public/css/style.css'), 'utf-8');
  js = fs.readFileSync(path.resolve(__dirname, '../public/js/app.js'), 'utf-8');
  html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf-8');
});

// Helper: extract a CSS/JS block between { } given the start index of the selector
function extractBlock(content, startIdx) {
  var blockStart = content.indexOf('{', startIdx);
  assert.ok(blockStart !== -1, 'Opening brace should exist at index ' + startIdx);
  var depth = 1;
  var blockEnd = -1;
  for (var i = blockStart + 1; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) {
        blockEnd = i;
        break;
      }
    }
  }
  assert.ok(blockEnd !== -1, 'Closing brace should exist');
  return content.slice(startIdx, blockEnd + 1);
}

// Helper: extract a JS function block from its 'function name(' signature
function extractJSBlock(content, funcName) {
  var funcIdx = content.indexOf('async function ' + funcName + '(');
  if (funcIdx === -1) funcIdx = content.indexOf('function ' + funcName + '(');
  assert.ok(funcIdx !== -1, 'Function ' + funcName + ' should exist in app.js');
  return extractBlock(content, funcIdx);
}

// ============================================================
// Issue #163: Screen flash on all component clicks
// ============================================================

describe('Issue #163 — Screen flash on all component clicks', function () {
  // ============================================================
  // CSS fixes (root causes #2, #3)
  // ============================================================

  describe('CSS fixes — background fill and transition speed', function () {
    it('.content has background: var(--bg) to prevent transparent flash (#2)', function () {
      var idx = css.indexOf('.content {');
      assert.ok(idx !== -1, '.content { block should exist');

      var block = extractBlock(css, idx);
      assert.ok(
        block.indexOf('background: var(--bg)') !== -1,
        '.content block should set background: var(--bg)',
      );
    });

    it('body transitions use 0.1s instead of 0.3s to reduce flash duration (#3)', function () {
      var idx = css.indexOf('body {');
      assert.ok(idx !== -1, 'body { block should exist');

      var block = extractBlock(css, idx);
      assert.ok(block.indexOf('0.1s') !== -1, 'body block should contain 0.1s transition');
      assert.ok(block.indexOf('0.3s') === -1, 'body block should NOT contain 0.3s transition');
    });
  });

  // ============================================================
  // HTML fixes (root cause #4)
  // ============================================================

  describe('HTML fixes — duplicate theme-color meta tags', function () {
    it('only ONE theme-color meta tag exists in index.html (#4)', function () {
      var matches = html.match(/<meta name="theme-color"/g);
      assert.ok(matches !== null, 'theme-color meta tag should exist');
      assert.strictEqual(
        matches.length,
        1,
        'Only one theme-color meta tag should exist (was ' + matches.length + ')',
      );
    });

    it('remaining theme-color meta tag has no media attribute', function () {
      var tagStart = html.indexOf('<meta name="theme-color"');
      assert.ok(tagStart !== -1, 'theme-color meta tag should exist');

      var tagEnd = html.indexOf('>', tagStart);
      var tag = html.slice(tagStart, tagEnd + 1);

      assert.ok(
        tag.indexOf('media=') === -1,
        'theme-color meta tag should NOT have a media attribute',
      );
    });
  });

  // ============================================================
  // JS fixes (root causes #1, #5, #6)
  // ============================================================

  describe('JS fixes — guards and reordering', function () {
    it('updateThemeColor has guard checking current content before setting (#5)', function () {
      var funcBlock = extractJSBlock(js, 'updateThemeColor');

      assert.ok(
        funcBlock.indexOf("getAttribute('content')") !== -1,
        'updateThemeColor should check meta.getAttribute("content") before setting',
      );
    });

    it('restoreTheme has guard comparing data-theme !== theme before setting (#1)', function () {
      var funcBlock = extractJSBlock(js, 'restoreTheme');

      assert.ok(
        funcBlock.indexOf("getAttribute('data-theme') !== theme") !== -1,
        'restoreTheme should have guard checking data-theme !== theme before setting',
      );
    });

    it('showQADetail calls openModal AFTER building modal content (#6)', function () {
      var funcBlock = extractJSBlock(js, 'showQADetail');

      var lastOpenModal = funcBlock.lastIndexOf("openModal('detail-modal')");
      assert.ok(lastOpenModal !== -1, "showQADetail should contain openModal('detail-modal')");

      // The full modal content template includes "modal-footer".
      // The loading template does not. So modal-footer is a reliable marker
      // for the content-building section.
      var modalFooterPos = funcBlock.indexOf('modal-footer');
      assert.ok(
        modalFooterPos !== -1,
        'showQADetail should build modal content containing modal-footer',
      );

      assert.ok(
        lastOpenModal > modalFooterPos,
        'openModal should be called AFTER building modal content (after modal-footer in template)',
      );
    });

    it('showQADetail uses isConnected guard instead of classList.contains("open")', function () {
      var funcBlock = extractJSBlock(js, 'showQADetail');

      assert.ok(
        funcBlock.indexOf('isConnected') !== -1,
        'showQADetail should use .isConnected guard',
      );
      assert.ok(
        funcBlock.indexOf('classList.contains') === -1,
        'showQADetail should NOT use classList.contains guard (changed to .isConnected)',
      );
    });
  });
});
