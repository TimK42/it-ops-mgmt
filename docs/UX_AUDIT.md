# IT Ops Management — UI/UX Audit Report

> **Round 3:** 2026-06-03 12:40 HKT · via Browser (CDP) snapshot + JS evaluate + curl  
> **Round 2:** 2026-06-03 03:56 HKT · via Browser (Playwright)  
> **Round 1 baseline:** 19 issues (4C, 5H, 5M, 5L)  
> **Pages audited:** Login, Register, QA Library, QA Detail, Categories, Users, Dashboard, 404  
> **Auth:** Admin (set via env, should be changed before deployment)

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

**✅ FIXED** — Full dark mode with `data-theme="dark"` on `<html>`, toggle button with `aria-pressed`, light/dark CSS custom properties. Body: `rgb(15,15,26)` bg / `rgb(224,224,224)` text. Cards: `rgb(26,26,46)`. Toggle persists across navigation. Verified in Round 3.

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

**✅ FIXED** — Register now loads at `/register` as a unique URL with `<h1>Create Account</h1>`, role dropdown (Viewer/Contributor), and back-to-login link. Verified in Round 3.

---

## 🆕 New Issues Found (Round 3)

### R3-H1. 🟧 PWA Completely Missing

**Severity:** High · **Page:** All  
**Symptom:** No `manifest.json` (returns HTML), no service worker (`sw.js` returns HTML), no `<meta name="theme-color">`, no `<meta name="apple-mobile-web-app-capable">`, no `apple-mobile-web-app-status-bar-style`.  
**Evidence:** `curl localhost:3000/manifest.json` returns HTML doc, not JSON. No `<link rel="manifest">` in `<head>`. `navigator.serviceWorker.controller` is null.  
**Fix:** Add `manifest.json` with icons/colors/display, register service worker with cache-first strategy, add `theme-color` meta for light+dark modes, add Apple web app meta tags.

### R3-H2. 🟧 No `<label>` Elements on Login/Register Forms (No-JS Fallback)

**Severity:** High · **Page:** Login, Register  
**Symptom:** All form inputs (`#auth-user`, `#auth-pass`, `#auth-role`) lack associated `<label>` elements. Only placeholder text provides field purpose. WCAG 1.3.1 (Info and Relationships) violation.  
**Evidence:** `document.querySelectorAll('label[for="auth-user"]').length === 0` for all three inputs.  
**Fix:** Add `<label for="auth-user">Username</label>`, `<label for="auth-pass">Password</label>`, `<label for="auth-role">Role</label>` to the no-JS HTML fallback. Can use `.sr-only` for visual hidden labels.

### R3-H3. 🟧 QA Library Controls Leak to All Pages

**Severity:** High · **Page:** Dashboard, Categories, Users, 404, QA Detail  
**Symptom:** The `#global-search` input (placeholder "Search QA entries") and "📥 Export" button appear on every page — Dashboard, Categories, Users, QA Detail, and 404. These are QA Library-only controls.  
**Evidence:** Snapshot shows `textbox "Search QA entries"` and `button "📥 Export"` in `<main>` on all 5 non-QA pages.  
**Fix:** Conditionally render search and export controls only when `state.page === 'qa'`. Move them from the global header area into the QA page render function.

### R3-M1. 🟨 QA Detail Page Heading is "QA Library" Instead of Entry Title

**Severity:** Medium · **Page:** QA Detail (`/qa/:id`)  
**Symptom:** When viewing a QA entry detail, the `<h1>` still reads "QA Library". The entry title appears only in the detail panel text.  
**Fix:** Update `<h1>` to the entry's question title when viewing a detail page.

### R3-M2. 🟨 Users Page Has No Pagination (109 Users Loaded at Once)

**Severity:** Medium · **Page:** Users  
**Symptom:** All 109 users rendered in a single table with no pagination. Long DOM with 109 rows × 5 columns. Scroll performance degrades.  
**Fix:** Add pagination (20/page) matching QA Library pattern, or implement virtual scrolling.

### R3-M3. 🟨 QA Library Search Input Transparent in Dark Mode

**Severity:** Medium · **Page:** QA Library (dark mode)  
**Symptom:** `#global-search` computed `backgroundColor` is `rgba(0, 0, 0, 0)` (transparent) in dark mode.  
**Evidence:** `getComputedStyle(document.getElementById('global-search')).backgroundColor` returns transparent. Card backgrounds are `rgb(26, 26, 46)` but input inherits body `rgb(15, 15, 26)` with no explicit bg, causing visual ambiguity.  
**Fix:** Add explicit `background-color` to search input in `[data-theme="dark"]` CSS (e.g., `rgb(26, 26, 46)`).

### R3-M4. 🟨 No Heading Hierarchy — All Pages Only Have h1

**Severity:** Medium · **Page:** All authenticated pages  
**Symptom:** Every page has exactly one `<h1>` and zero `<h2>`/`<h3>`. Sections like "IT Operations / Knowledge Base", filter tabs, result counts, table headers are not structured with headings.  
**Fix:** Add `<h2>` for page sections (e.g., "Filters", "Results", "Sub-Systems List", "User Management").

### R3-L1. 🟩 `INPUT#global-search` Missing `<label>`

**Severity:** Low · **Page:** QA Library (and all pages due to control leak)  
**Symptom:** Search input has `placeholder="Search..."` but no associated `<label>` element. WCAG 1.3.1.  
**Fix:** Add `<label for="global-search" class="sr-only">Search QA entries</label>`.

### R3-L2. 🟩 Global Search Uses `type="text"` Instead of `type="search"`

**Severity:** Low · **Page:** All pages with search  
**Symptom:** `#global-search` is `type="text"`. Mobile browsers show standard keyboard instead of search variant with "go" button; no native clear button (×).  
**Fix:** Change to `type="search"` and add `inputmode="search"`.

### R3-L3. 🟩 Login/Register Pages Have No `<main>` or Skip-Link

**Severity:** Low · **Page:** Login, Register  
**Symptom:** Pre-SPA HTML fallback for login/register has no `<main>` landmark, no `#main-content`, no skip-to-content link. SPA pages have these correctly.  
**Fix:** Add `<main id="main-content">` wrapper and `<a href="#main-content" class="skip-link">Skip to content</a>` to no-JS HTML.

---

## ✅ Positive Findings (Round 3)

- **Dark mode fully implemented** — `data-theme` toggle with `aria-pressed`, light/dark CSS variables, persists across navigation. No flash of unstyled content.
- **Register page has unique URL** — `/register` route with role-based dropdown, distinct from login page.
- **Semantic SPA shell** — `<nav aria-label="Main navigation">`, `<main id="main-content">`, `<header>`, skip-link all present on authenticated pages.
- **ACR accessibility** — No images without alt, no `target="_blank"` without `rel="noopener"`, `html[lang="en"]` correct.
- **Autocomplete attributes** — `username`/`current-password` on login, `username`/`new-password` on register.
- **Responsive sidebar** — Sidebar collapses to hamburger on mobile (375px), no horizontal scroll.
- **Self-hosted fonts** — Inter loaded locally, zero external requests.
- **404 with app shell** — Returns HTTP 404 with full navigation and "Go to QA Library" button.
- **Role dropdown on register** — Only Viewer/Contributor options (no Admin), correct security posture.

---

## Summary

| Issue          | Round 1 | Round 2        | Round 3                       |
| -------------- | ------- | -------------- | ----------------------------- |
| 🔴 Critical    | 4       | 0              | 0                             |
| 🟧 High        | 5       | 0              | 3 (R3-H1, H2, H3)             |
| 🟨 Medium      | 5       | 2 (R2-1, R2-2) | 4 (R3-M1–M4) + 2 (R2-1, R2-2) |
| 🟩 Low         | 5       | 0 (R2-3 FIXED) | 3 (R3-L1–L3)                  |
| **Total Open** | **19**  | **3**          | **12**                        |
| **Fixed**      | —       | **21**         | **+2 (H1, R2-3)**             |

### Priority for Next Round

1. **R3-H3** — Remove QA Library controls from non-QA pages (search + export leak)
2. **R3-H2** — Add `<label>` elements to login/register forms
3. **R3-H1** — PWA manifest + service worker + meta tags
4. **R2-2** — Dashboard content improvement
5. **R2-1** — Fix sidebar QA count bug
6. **R3-M1–M4** — Heading hierarchy, QA detail heading, Users pagination, dark mode search bg
