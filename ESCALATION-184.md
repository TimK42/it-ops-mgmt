# Issue #184 — Escalated Copilot Review Comments

## PR #185 | Branch: fix-184-manager-loop | Commit: f158c579

These Copilot comments require non-trivial code changes and are escalated for manual review:

---

### [1] Thread: PRRT_kwDOSu-eYM6IsL6z — isFirstRender logic
**Problem:** `isFirstRender` derives from `document.querySelector('#users-search')`. If users toolbar is left behind after navigating away, `#users-search` still exists and the render takes the "subsequent render" path, leaving Users page blank.
**Fix:** Determine first-render based on content structure (e.g., presence of `#users-results-container` inside `el`).

### [2] Thread: PRRT_kwDOSu-eYM6IsL7F — Toolbar cleanup on navigation
**Problem:** `renderQA` inserts `.table-toolbar` as child of `.main`, but no cleanup when navigating to non-toolbar pages (Dashboard/404). Leftover toolbar visible on other pages and can break renders.
**Fix:** Remove existing `.main > .table-toolbar` during `navigate()` or at start of non-toolbar renders.

### [3] Thread: PRRT_kwDOSu-eYM6IsL7S — renderCategories toolbar removal ordering
**Problem:** `renderCategories()` removes previous toolbar only after `await loadCategories()`. Old toolbar visible during loading.
**Fix:** Remove any existing `.table-toolbar` before awaiting data for immediate layout consistency.

---

### [4] Thread: PRRT_kwDOSu-eYM6IsL7i — Test file not in test suite (FIXED)
**Fix applied:** Added `tests/test-issue184-sticky-toolbar.js` to `test:mocha` script in package.json.
