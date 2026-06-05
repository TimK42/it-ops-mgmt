// Test: Issue #95 - Mobile scrollbar layout shift fix
// Verifies scrollbar-gutter: stable is applied to body and .content in style.css
//
// Usage: npx mocha tests/test-issue95-scrollbar-gutter.js --timeout 10000

const fs = require('fs');
const path = require('path');
const assert = require('assert');

describe('Issue #95 - Mobile scrollbar-gutter fix', function () {
  let css;

  before(function () {
    const cssPath = path.resolve(__dirname, '../public/css/style.css');
    css = fs.readFileSync(cssPath, 'utf-8');
  });

  /**
   * Extract a CSS rule block by selector name.
   * Returns the text between the opening { and matching closing } for the first
   * occurrence of the given selector at the global scope (not inside @media).
   */
  function extractRule(selector) {
    const idx = css.indexOf(selector);
    if (idx === -1) return null;
    const braceOpen = css.indexOf('{', idx);
    if (braceOpen === -1) return null;
    let depth = 1;
    let pos = braceOpen + 1;
    while (depth > 0 && pos < css.length) {
      if (css[pos] === '{') depth++;
      else if (css[pos] === '}') depth--;
      pos++;
    }
    if (depth > 0) return null;
    return css.slice(braceOpen + 1, pos - 1);
  }

  it('should have scrollbar-gutter: stable in body rule', function () {
    const bodyRule = extractRule('body {');
    assert.ok(bodyRule, 'body rule block must exist');
    assert.ok(
      bodyRule.includes('scrollbar-gutter: stable'),
      'body rule must contain scrollbar-gutter: stable',
    );
  });

  it('should have scrollbar-gutter: stable in .content rule', function () {
    // Find the first (non-media-query) .content block
    const contentIdx = css.indexOf('.content {');
    assert.ok(contentIdx >= 0, '.content selector must exist');

    const braceOpen = css.indexOf('{', contentIdx);
    assert.ok(braceOpen >= 0, '.content opening brace must exist');

    let depth = 1;
    let pos = braceOpen + 1;
    while (depth > 0 && pos < css.length) {
      if (css[pos] === '{') depth++;
      else if (css[pos] === '}') depth--;
      pos++;
    }
    assert.strictEqual(depth, 0, '.content closing brace must exist');

    const contentBlock = css.slice(braceOpen + 1, pos - 1);
    assert.ok(
      contentBlock.includes('scrollbar-gutter: stable'),
      '.content rule must contain scrollbar-gutter: stable',
    );
  });

  it('should serve CSS with scrollbar-gutter from HTTP endpoint', function (done) {
    // Start server, fetch style.css, confirm scrollbar-gutter present
    const { spawn } = require('child_process');
    const server = spawn(
      'node',
      ['-e', "require('./server').listen(3199,'127.0.0.1',()=>console.log('ready'))"],
      {
        cwd: path.join(__dirname, '..'),
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let output = '';
    server.stdout.on('data', (d) => {
      output += d.toString();
      if (output.includes('ready')) {
        const http = require('http');
        http
          .get('http://127.0.0.1:3199/css/style.css', (res) => {
            let body = '';
            res.on('data', (c) => (body += c));
            res.on('end', () => {
              try {
                assert.strictEqual(res.statusCode, 200, 'GET /css/style.css => 200');
                assert.ok(
                  (res.headers['content-type'] || '').includes('css') ||
                    (res.headers['content-type'] || '').includes('text'),
                  'Content-Type includes css or text',
                );
                assert.ok(
                  body.includes('scrollbar-gutter: stable'),
                  'Served CSS must contain scrollbar-gutter: stable',
                );
                server.kill();
                done();
              } catch (err) {
                server.kill();
                done(err);
              }
            });
          })
          .on('error', (err) => {
            server.kill();
            done(err);
          });
      }
    });

    server.on('error', (err) => done(err));
  });
});
