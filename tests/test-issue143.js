// Tests for Issue #143 and #144
// #143 — WCAG 2.5.5 touch target: .chip-input min-height 28px → 44px
// #144 — WCAG 2.5.5 touch target: #form-modal .form-input min-height 44px

const fs = require('fs');
const path = require('path');
const assert = require('assert');

var css;

before(function () {
  css = fs.readFileSync(path.resolve(__dirname, '../public/css/style.css'), 'utf-8');
});

// ============================================================
// Issue #143: WCAG 2.5.5 — .chip-input touch target size
// ============================================================

describe('Issue #143 — .chip-input touch target min-height 44px', function () {
  it('.chip-input has min-height: 44px', function () {
    var chipIdx = css.indexOf('.chip-input {');
    assert.ok(chipIdx !== -1, '.chip-input block should exist');

    // Extract the block after .chip-input { up to the closing }
    var blockStart = css.indexOf('{', chipIdx);
    var depth = 1;
    var blockEnd = -1;
    for (var i = blockStart + 1; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) {
          blockEnd = i;
          break;
        }
      }
    }
    assert.ok(blockEnd !== -1, '.chip-input closing brace should exist');

    var chipBlock = css.slice(chipIdx, blockEnd + 1);
    assert.ok(
      chipBlock.indexOf('min-height: 44px') !== -1,
      '.chip-input block should set min-height: 44px',
    );
  });

  it('.chip-input does NOT have min-height: 28px (old value)', function () {
    var chipIdx = css.indexOf('.chip-input {');
    assert.ok(chipIdx !== -1, '.chip-input block should exist');

    var blockStart = css.indexOf('{', chipIdx);
    var depth = 1;
    var blockEnd = -1;
    for (var i = blockStart + 1; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) {
          blockEnd = i;
          break;
        }
      }
    }
    assert.ok(blockEnd !== -1, '.chip-input closing brace should exist');

    var chipBlock = css.slice(chipIdx, blockEnd + 1);
    assert.ok(
      chipBlock.indexOf('min-height: 28px') === -1,
      '.chip-input block should NOT have min-height: 28px',
    );
  });
});

// ============================================================
// Issue #144: WCAG 2.5.5 — #form-modal .form-input touch target size
// ============================================================

describe('Issue #144 — #form-modal .form-input touch target min-height 44px', function () {
  it('#form-modal .form-input has min-height: 44px', function () {
    var modalIdx = css.indexOf('#form-modal .form-input {');
    assert.ok(modalIdx !== -1, '#form-modal .form-input block should exist');

    // Extract the block after the selector up to the closing }
    var blockStart = css.indexOf('{', modalIdx);
    var depth = 1;
    var blockEnd = -1;
    for (var i = blockStart + 1; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) {
          blockEnd = i;
          break;
        }
      }
    }
    assert.ok(blockEnd !== -1, '#form-modal .form-input closing brace should exist');

    var modalBlock = css.slice(modalIdx, blockEnd + 1);
    assert.ok(
      modalBlock.indexOf('min-height: 44px') !== -1,
      '#form-modal .form-input block should set min-height: 44px',
    );
  });
});

// ============================================================
// No regressions: base .form-input should NOT have min-height
// (only inside the mobile @media query at line ~865)
// ============================================================

describe('No regression — base .form-input', function () {
  it('base .form-input rule (outside @media) does NOT set min-height', function () {
    // Find the first occurrence of ".form-input," which is the base-level rule
    var firstIdx = css.indexOf('.form-input,');
    assert.ok(firstIdx !== -1, 'Base .form-input rule should exist');

    // Confirm this is before the mobile media query (line ~811), not reduced-motion one
    var mobileMediaIdx = css.indexOf('@media (max-width: 768px)');
    assert.ok(firstIdx < mobileMediaIdx, 'Base .form-input should appear before mobile @media');

    // Extract the block
    var blockStart = css.indexOf('{', firstIdx);
    var depth = 1;
    var blockEnd = -1;
    for (var i = blockStart + 1; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) {
          blockEnd = i;
          break;
        }
      }
    }
    assert.ok(blockEnd !== -1, 'Base .form-input closing brace should exist');

    var baseBlock = css.slice(firstIdx, blockEnd + 1);
    assert.ok(
      baseBlock.indexOf('min-height') === -1,
      'Base .form-input block should NOT set any min-height',
    );
  });
});
