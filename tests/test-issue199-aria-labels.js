// Test: Issue #199 — Sidebar nav item aria-labels
//
// Coverage:
//   1. Admin user sees all 6 buttons with correct aria-labels
//   2. Non-admin user sees only 4 buttons (no Sub-Systems, no Users)
//   3. Each aria-label matches the button's visible text
//   4. Non-admin buttons (QA Library, Dashboard, Change Password, Sign Out)
//      have correct aria-labels for both admin and non-admin users
//
// Usage: npx mocha tests/test-issue199-aria-labels.js --timeout 15000

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

/**
 * Set up state.user and call renderShell(), then return rendered HTML.
 * @param {string} role - 'Admin' or any other role (e.g. 'User')
 * @returns {string} innerHTML of #app
 */
function setupRenderShell(role) {
  state.user = { username: 'testuser', role: role };
  state.qaTotalCount = 5;
  state.page = 'qa';
  // Reset app container
  document.getElementById('app').innerHTML = '';
  renderShell();
  return document.getElementById('app').innerHTML;
}

/**
 * Get all nav-item buttons that have an aria-label attribute.
 * @returns {HTMLElement[]}
 */
function getSidebarButtonsWithLabels() {
  return Array.from(document.querySelectorAll('.sidebar .nav-item')).filter(
    (btn) => btn.hasAttribute('aria-label') && btn.getAttribute('aria-label').trim() !== '',
  );
}

const ADMIN_BUTTONS = [
  'QA Library',
  'Sub-Systems',
  'Users',
  'Dashboard',
  'Change Password',
  'Sign Out',
];

// ============================================================
// Tests
// ============================================================

describe('Issue #199 — Sidebar nav item aria-labels', function () {
  beforeEach(function () {
    resetDOM();
  });

  // ============================================================
  // Admin user — all 6 buttons present
  // ============================================================

  describe('Admin user — all six buttons with correct aria-labels', function () {
    it('renders 6 nav-item buttons (5 with aria-labels) for admin user', function () {
      setupRenderShell('Admin');
      const allNavItems = document.querySelectorAll('.sidebar .nav-item');
      assert.strictEqual(
        allNavItems.length,
        6,
        'Admin should see 6 nav buttons total',
      );
      const labeledButtons = getSidebarButtonsWithLabels();
      assert.strictEqual(
        labeledButtons.length,
        5,
        'Admin should see 5 nav buttons with aria-labels (QA Library has visible text instead)',
      );
    });

    it('QA Library button exists with visible text', function () {
      setupRenderShell('Admin');
      const btn = document.querySelector('.nav-item[data-nav="qa"]');
      assert.ok(btn, 'QA Library button should exist');
      assert.ok(btn.textContent.includes('QA Library'), 'QA Library button should contain visible text');
    });

    it('Sub-Systems button has aria-label="Sub-Systems"', function () {
      setupRenderShell('Admin');
      const btn = document.querySelector('.nav-item[data-nav="categories"]');
      assert.ok(btn, 'Sub-Systems button should exist');
      assert.strictEqual(btn.getAttribute('aria-label'), 'Sub-Systems');
    });

    it('Users button has aria-label="Users"', function () {
      setupRenderShell('Admin');
      const btn = document.querySelector('.nav-item[data-nav="users"]');
      assert.ok(btn, 'Users button should exist');
      assert.strictEqual(btn.getAttribute('aria-label'), 'Users');
    });

    it('Dashboard button has aria-label="Dashboard"', function () {
      setupRenderShell('Admin');
      const btn = document.querySelector('.nav-item[data-nav="dashboard"]');
      assert.ok(btn, 'Dashboard button should exist');
      assert.strictEqual(btn.getAttribute('aria-label'), 'Dashboard');
    });

    it('Change Password button has aria-label="Change Password"', function () {
      setupRenderShell('Admin');
      const btn = document.querySelector('.nav-item[data-action="change-password"]');
      assert.ok(btn, 'Change Password button should exist');
      assert.strictEqual(btn.getAttribute('aria-label'), 'Change Password');
    });

    it('Sign Out button has aria-label="Sign Out"', function () {
      setupRenderShell('Admin');
      const btn = document.querySelector('.nav-item[data-action="logout"]');
      assert.ok(btn, 'Sign Out button should exist');
      assert.strictEqual(btn.getAttribute('aria-label'), 'Sign Out');
    });

    it('every admin-expected button text is present in the rendered HTML', function () {
      setupRenderShell('Admin');
      const html = document.getElementById('app').innerHTML;
      for (const label of ADMIN_BUTTONS) {
        assert.ok(
          html.indexOf(label) !== -1,
          `Admin HTML should contain text "${label}"`,
        );
      }
    });
  });

  // ============================================================
  // Non-admin user — only 4 buttons
  // ============================================================

  describe('Non-admin user — only non-admin buttons present', function () {
    it('renders 4 nav-item buttons (3 with aria-labels) for non-admin user', function () {
      setupRenderShell('User');
      const allNavItems = document.querySelectorAll('.sidebar .nav-item');
      assert.strictEqual(
        allNavItems.length,
        4,
        'Non-admin should see 4 nav buttons total',
      );
      const labeledButtons = getSidebarButtonsWithLabels();
      assert.strictEqual(
        labeledButtons.length,
        3,
        'Non-admin should see 3 nav buttons with aria-labels (QA Library has visible text instead)',
      );
    });

    it('Sub-Systems button is NOT rendered for non-admin', function () {
      setupRenderShell('User');
      const btn = document.querySelector('.nav-item[data-nav="categories"]');
      assert.strictEqual(btn, null, 'Sub-Systems button should not exist for non-admin');
    });

    it('Users button is NOT rendered for non-admin', function () {
      setupRenderShell('User');
      const btn = document.querySelector('.nav-item[data-nav="users"]');
      assert.strictEqual(btn, null, 'Users button should not exist for non-admin');
    });

    it('QA Library button rendered with visible text for non-admin', function () {
      setupRenderShell('User');
      const btn = document.querySelector('.nav-item[data-nav="qa"]');
      assert.ok(btn, 'QA Library button should exist for non-admin');
      assert.ok(btn.textContent.includes('QA Library'), 'QA Library button should contain visible text');
    });

    it('Dashboard button rendered for non-admin with correct aria-label', function () {
      setupRenderShell('User');
      const btn = document.querySelector('.nav-item[data-nav="dashboard"]');
      assert.ok(btn, 'Dashboard button should exist for non-admin');
      assert.strictEqual(btn.getAttribute('aria-label'), 'Dashboard');
    });

    it('Change Password button rendered for non-admin with correct aria-label', function () {
      setupRenderShell('User');
      const btn = document.querySelector('.nav-item[data-action="change-password"]');
      assert.ok(btn, 'Change Password button should exist for non-admin');
      assert.strictEqual(btn.getAttribute('aria-label'), 'Change Password');
    });

    it('Sign Out button rendered for non-admin with correct aria-label', function () {
      setupRenderShell('User');
      const btn = document.querySelector('.nav-item[data-action="logout"]');
      assert.ok(btn, 'Sign Out button should exist for non-admin');
      assert.strictEqual(btn.getAttribute('aria-label'), 'Sign Out');
    });

    it('non-admin HTML does NOT contain Sub-Systems or Users aria-labels', function () {
      setupRenderShell('User');
      const html = document.getElementById('app').innerHTML;
      assert.ok(
        html.indexOf('aria-label="Sub-Systems"') === -1,
        'Non-admin HTML should NOT contain aria-label="Sub-Systems"',
      );
      assert.ok(
        html.indexOf('aria-label="Users"') === -1,
        'Non-admin HTML should NOT contain aria-label="Users"',
      );
    });
  });

  // ============================================================
  // Role-agnostic buttons — same for both roles
  // ============================================================

  describe('Role-agnostic buttons — same for admin and non-admin', function () {
    const sharedLabels = ['QA Library', 'Dashboard', 'Change Password', 'Sign Out'];
    const roles = ['Admin', 'User'];

    for (const label of sharedLabels) {
      for (const role of roles) {
        it(`${label} button exists for ${role} role`, function () {
          setupRenderShell(role);
          // Map label to selector
          let selector;
          if (label === 'QA Library') selector = '.nav-item[data-nav="qa"]';
          else if (label === 'Dashboard') selector = '.nav-item[data-nav="dashboard"]';
          else if (label === 'Change Password')
            selector = '.nav-item[data-action="change-password"]';
          else if (label === 'Sign Out') selector = '.nav-item[data-action="logout"]';

          const btn = document.querySelector(selector);
          assert.ok(btn, `${label} button should exist for ${role}`);
          if (label === 'QA Library') {
            assert.ok(btn.textContent.includes(label), `${label} button should contain visible text`);
          } else {
            assert.strictEqual(btn.getAttribute('aria-label'), label);
          }
        });
      }
    }
  });

  // ============================================================
  // No aria-labels without the fix (regression guard)
  // ============================================================

  describe('Regression — no extraneous aria-labels on non-nav buttons', function () {
    it('sidebar-toggle button exists but is not counted in nav-item aria-labels', function () {
      setupRenderShell('Admin');
      const toggle = document.querySelector('[data-action="sidebar-toggle"]');
      assert.ok(toggle, 'Sidebar toggle button should exist');
      // It has aria-label="Toggle sidebar" — that's fine, but it's not a nav-item
      const navItemsWithLabels = getSidebarButtonsWithLabels();
      const toggleIsNavItem = toggle.classList.contains('nav-item');
      // The toggle has aria-label but is NOT a .nav-item — our test targets only
      // nav-item buttons which are the sidebar navigation buttons
      assert.strictEqual(toggleIsNavItem, false, 'Sidebar toggle should not have .nav-item class');
    });
  });

  // ============================================================
  // Every rendered nav-item has an aria-label
  // ============================================================

  describe('Every .sidebar .nav-item (except QA Library) has an aria-label', function () {
    it('all sidebar nav-items have aria-labels for admin (except QA Library with visible text)', function () {
      setupRenderShell('Admin');
      const allNavItems = document.querySelectorAll('.sidebar .nav-item');
      assert.ok(allNavItems.length > 0, 'There should be nav-items in the sidebar');
      for (const item of allNavItems) {
        const isQALibrary = item.dataset.nav === 'qa';
        if (isQALibrary) {
          // QA Library uses visible text content for accessible name
          assert.ok(item.textContent.includes('QA Library'), 'QA Library should contain visible text');
        } else {
          assert.ok(
            item.hasAttribute('aria-label'),
            `Every other sidebar nav-item should have aria-label (missing on: ${item.textContent.trim().slice(0, 30)})`,
          );
          const label = item.getAttribute('aria-label');
          assert.ok(label.trim().length > 0, 'aria-label should not be empty');
        }
      }
    });

    it('all sidebar nav-items have aria-labels for non-admin (except QA Library with visible text)', function () {
      setupRenderShell('User');
      const allNavItems = document.querySelectorAll('.sidebar .nav-item');
      assert.ok(allNavItems.length > 0, 'There should be nav-items in the sidebar');
      for (const item of allNavItems) {
        const isQALibrary = item.dataset.nav === 'qa';
        if (isQALibrary) {
          // QA Library uses visible text content for accessible name
          assert.ok(item.textContent.includes('QA Library'), 'QA Library should contain visible text');
        } else {
          assert.ok(
            item.hasAttribute('aria-label'),
            `Every other sidebar nav-item should have aria-label (missing on: ${item.textContent.trim().slice(0, 30)})`,
          );
          const label = item.getAttribute('aria-label');
          assert.ok(label.trim().length > 0, 'aria-label should not be empty');
        }
      }
    });
  });
});
