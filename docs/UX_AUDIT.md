# IT Ops Management — UI/UX Audit Report

> **Round 2:** 2026-06-03 03:56 HKT · via Browser (Playwright) snapshot + curl + source inspection  
> **Round 1 baseline:** 19 issues (4C, 5H, 5M, 5L) — see below for per-issue status  
> **Auth:** Admin (admin/0000)

---

## 🔴 Critical Issues (Round 1 → Status)

### C1. No Semantic HTML Structure

**✅ FIXED** — `<nav aria-label="Main navigation">`, `<main>`, `<h1>`, `<button>`, `<a>` all implemented. Sidebar wrapped in `<nav>`, content in `<main>`. Skip-to-content link present.

### C2. No ARIA or Accessibility Attributes

**✅ FIXED** — `aria-label="Main navigation"` on sidebar. Skip-link with `href="#main-content"`. Interactive elements are native `<button>` and `<a>` with built-in accessibility.

### C3. No Keyboard Navigation or Focus Indication

**✅ FIXED** — Skip-to-content link (first focusable element). Sidebar items are `<button>` focusable via Tab. `:focus-visible` styling present. QA cards are `<a>` links. Form inputs use `autofocus`.

### C4. Missing Security Headers

**✅ FIXED** — Full `helmet` middleware:

```
Content-Security-Policy: default-src 'self'; ...
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
```

---

## 🟧 High Issues (Round 1 → Status)

### H1. No Dark Mode

**❌ UNFIXED** — No `prefers-color-scheme` support, no `data-theme` toggle, no dark variant in CSS. This is the only remaining Round 1 high-priority issue.

### H2. Missing `autocomplete` Attributes

**✅ FIXED** — Login form uses `autocomplete="username"` and `autocomplete="current-password"` (dynamic per login vs register). Password managers can auto-fill.

### H3. No Heading Hierarchy

**✅ FIXED** — All page titles now render as `<h1>` (QA Library, Categories, Users, Dashboard, 404, Login).

### H4. 404 Page is Express Default

**✅ FIXED** — Custom SPA 404: `<h1>Page Not Found</h1>` with full app shell (nav, search, "Go to QA Library" button).

### H5. No Session Timeout Warning

**✅ FIXED** — Full idle monitoring: 30s check interval, warning modal before expiry, expired session message on login redirect. `startSessionMonitoring()` / `stopSessionMonitoring()` lifecycle.

---

## 🟨 Medium Issues (Round 1 → Status)

### M1. Navigation Items are `<div>` Not `<button>`

**✅ FIXED** — All sidebar nav items are native `<button>` elements. Pagination uses `<button>`.

### M2. Pagination Styled as Filter Tabs

**🟡 PARTIAL** — `.pagination-btn` has separate CSS class but visual style could still be more distinct from `.filter-tab`. Low impact.

### M3. Confirmation Dialogs Use `window.confirm()`

**✅ FIXED** — Custom confirmation modal (`#confirm-modal`) with title, message, OK/Cancel buttons. `confirmCallback` pattern.

### M4. No Empty-State for Search

**✅ FIXED** — `empty-state` with `📭` icon and context-aware text: `"No results found"` (with search active) / `"No QA entries"` (no search).

### M5. QA Card Uses `<div onclick>`

**✅ FIXED** — QA cards are `<a href="/qa/{id}">` elements. Right-click → open in new tab, Ctrl+click, keyboard navigation all work.

---

## 🟩 Low Issues (Round 1 → Status)

### L1. No `<meta name="description">`

**✅ FIXED** — `<meta name="description" content="IT Operations Knowledge Base - QA Library" />` in `<head>`.

### L2. No Favicon

**✅ FIXED** — Inline SVG data URI favicon (`🔧` wrench emoji).

### L3. Google Fonts External Dependency

**✅ FIXED** — Inter font self-hosted (4 woff2 files + `inter.css` in `/public/fonts/`). Zero external requests.

### L4. No Footer

**✅ FIXED** — Sidebar footer shows `IT Operations KB v${appVersion}`. Version is dynamic from package.json.

### L5. Sidebar Emoji

**✅ FIXED by design choice** — `👤 admin (Admin)` kept as-is. Acceptable for internal tool; emoji is universally understood.

---

## 🆕 New Issues Found (Round 2)

### R2-1. 🟨 Sidebar QA Count Resets to 0 on Non-QA Pages

**Severity:** Medium · **Page:** Sidebar (global)  
**Symptom:** Sidebar shows `❓ QA Library 42` on QA page but `❓ QA Library 0` on Categories, Users, Dashboard, and 404 pages.  
**Root cause:** QA count in sidebar is tied to filtered list state, not total count. Navigating away resets the filter state.  
**Fix:** Store total QA count independently from page-level filter state. Use a dedicated `state.qaTotalCount` that doesn't get reset on navigation.

### R2-2. 🟨 Dashboard is Very Sparse

**Severity:** Medium · **Page:** Dashboard  
**Symptom:** Dashboard only shows "105 QA Entries 4 Sub-Systems" as plain text. No charts, graphs, recent activity, or useful metrics.  
**Fix:** Add at minimum: recent QA entries, per-category breakdown, activity timeline, or entry status distribution.

### R2-3. 🟩 Register Form Uses Same URL as Login

**Severity:** Low · **Page:** Login/Register  
Both login and register forms render on `http://localhost:3000/#` with toggle link "Create account". No unique URL for registration — can't link directly to registration page.

---

## ✅ Positive Findings (Round 2, new since Round 1)

- **Self-hosted Inter font** — zero external requests, good for internal/air-gapped deployment
- **Custom confirmation modal** — consistent with app design, replaces browser native `confirm()`
- **Skip-to-content link** — first focusable element on every page
- **QA cards as semantic links** — `<a href="/qa/{id}">` with proper right-click behavior
- **Full security headers** via helmet, including CSP with strict directives
- **Session idle monitoring** — proactive warning, not just silent expiration
- **404 inside app shell** — user can navigate away without losing context
- **Dynamic autocomplete attributes** — `current-password` for login, `new-password` for register

---

## Summary

| Issue          | Round 1 | Round 2        |
| -------------- | ------- | -------------- |
| 🔴 Critical    | 4       | 0              |
| 🟧 High        | 5       | 1 (H1)         |
| 🟨 Medium      | 5       | 2 (R2-1, R2-2) |
| 🟩 Low         | 5       | 1 (R2-3)       |
| **Total Open** | **19**  | **4**          |
| **Fixed**      | —       | **18**         |

### Priority for Next Round

1. **H1** — Dark mode (CSS custom properties + data-theme toggle)
2. **R2-1** — Fix sidebar QA count bug
3. **R2-2** — Dashboard content improvement
4. **R2-3** — Register page URL (nice to have)
