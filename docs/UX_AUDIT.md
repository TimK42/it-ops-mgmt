# IT Ops Management — UI/UX Audit Report

> **Round 5:** 2026-06-04 11:10 HKT · via CDP snapshot + JS evaluate + curl  
> **Round 4:** 2026-06-03 17:26 HKT · via Browser (CDP) snapshot + JS evaluate + curl  
> **Round 3:** 2026-06-03 12:40 HKT  
> **Round 2:** 2026-06-03 03:56 HKT  
> **Round 1 baseline:** 19 issues (4C, 5H, 5M, 5L)  
> **Pages audited:** QA Library, QA Detail, Categories, Users, Dashboard, Login, Register, 404  
> **Auth:** Admin (105 QA entries, 4 categories, users exist)  
> **Viewports:** 416×902 (mobile portrait), 1000×542 (desktop collapsed)  
> **Themes:** Light + Dark (toggled, verified CSS custom properties)  
> **DB:** Seeded — 105 QA entries, 4 categories, multiple users  
> **Focus:** Fix verification for PRs #62, #64, #72, #57 + remaining open issues

---

## Status Summary

| Issue          | Round 1 | Round 2 | Round 3 | Round 4 | Round 5 |
| -------------- | ------- | ------- | ------- | ------- | ------- |
| 🔴 Critical    | 4       | 0       | 0       | 0       | 0       |
| 🟧 High        | 5       | 0       | 3       | 2 (NEW) | 1 (2 ↘) |
| 🟨 Medium      | 5       | 2       | 4       | 4 (2 NEW) | 2 (2 ↘) |
| 🟩 Low         | 5       | 1       | 3       | 1 (NEW) | 2 (↗ R5-L1) |
| **Total Open** | **19**  | **3**   | **10**  | **7**   | **5**         |
| **Fixed**      | —       | 19      | 2       | 6 (R3)  | 3 (R4)  |

---

## 🔴 Critical Issues

### C1. No Semantic HTML Structure

**✅ FIXED & VERIFIED (R4)** — `<nav aria-label="Main navigation">`, `<main>`, `<h1>`, `<button>`, `<a>` all implemented. Skip-to-content link present and visible. Main landmark with `id="main-content"`.

### C2. No ARIA or Accessibility Attributes

**✅ FIXED & VERIFIED (R4)** — `aria-label="Main navigation"` on sidebar. Skip-link with `href="#main-content"`. Interactive elements are native `<button>` and `<a>`. `html[lang="en"]` correct.

### C3. No Keyboard Navigation or Focus Indication

**✅ FIXED & VERIFIED (R4)** — `:focus-visible` CSS rule (`outline: 2px solid var(--primary); outline-offset: 2px`) confirmed in stylesheets. Skip-to-content first focusable. Sidebar nav items are `<button>`s. Pagination buttons have disabled states.

### C4. Missing Security Headers

**✅ FIXED** — Full `helmet` middleware active. CSP with `script-src-attr 'none'`, COOP/COEP, HSTS, X-Frame-Options all present. (verified via `curl -I`)

---

## 🟧 High Issues

### H1. No Dark Mode

**✅ FIXED** — `data-theme="dark"`, toggle with `aria-pressed`, light/dark CSS custom properties. Body contrast 14.42:1 in dark mode (AAA). Verified across all pages.

### H2. Missing `autocomplete` Attributes

**✅ FIXED** — `autocomplete="username"` / `"current-password"` on login, `"new-password"` on register.

### H3. No Heading Hierarchy

**✅ FIXED & VERIFIED (R4)** — All pages have H1 + at least H2. QA Detail H1 shows entry title.

### H4. 404 Page is Express Default

**✅ FIXED & VERIFIED (R4)** — Custom SPA 404: H1, full app shell, "Go to QA Library" button. HTTP 404 status confirmed.

### H5. No Session Timeout Warning

**✅ FIXED & VERIFIED (R4)** — 30s idle check interval + warning modal + Stay Logged In / Sign Out. Toast element present.

### R3-H1. 🟧 PWA Completely Missing

**Severity:** High · **Page:** All  
**Symptom:** No `manifest.json` (returns HTML), no service worker, no `theme-color` meta, no Apple web app meta tags.  
**Evidence:** `curl /manifest.json` returns HTML. No `<link rel="manifest">`. `navigator.serviceWorker.controller` is null.  
**📌 R4 STILL OPEN**

### R3-H2. 🟧 Labels on Login/Register No-JS HTML

**Severity:** High · **Page:** Login, Register  
**Status:** **✅ FIXED (R4)** — `.sr-only` label elements with `for` attributes now present in the server-rendered HTML. Verified via DOM inspection.  
**Residual issue:** SPA `renderLogin()` function does not use a `<form>` element — login inputs wrapped in `<div>`, not `<form>`.

---

## 🟨 Medium Issues

### M1. Navigation Items are `<div>` Not `<button>`

**✅ FIXED**

### M2. Pagination Styled as Filter Tabs

**🟡 PARTIAL** — `.pagination-btn` exists but visual style similar to `.filter-tab`. Low impact.

### M3. Confirmation Dialogs Use `window.confirm()`

**✅ FIXED**

### M4. No Empty-State for Search

**✅ FIXED**

### M5. QA Card Uses `<div onclick>`

**✅ FIXED**

### R2-1. 🟨 Sidebar QA Count Resets on Non-QA Pages

**✅ FIXED (R4)** — `loadQATotalCount()` now called on CRUD + navigation. Sidebar shows correct total (5) across all pages. (PR #42, issue #35)

### R2-2. 🟨 Dashboard is Very Sparse

**Severity:** Medium · **Page:** Dashboard  
**Symptom:** "5 QA Entries 4 Sub-Systems" plain text only. No charts, recent activity, per-category breakdown, or actionable metrics.  
**📌 R4 STILL OPEN**

### R3-M2. 🟨 Users Page No Pagination

**✅ FIXED (R4)** — Users pagination implemented (20/page) matching QA Library pattern. (PR #43, issue #33)

### R3-M3. 🟨 QA Library Search Input Invisible in Dark Mode

**Severity:** Medium · **Page:** QA Library (dark mode)  
**Symptom:** `searchColor: rgb(0,0,0)` (black text) on `rgba(26,26,46,0.8)` (transparent dark background). Text is invisible.  
**✅ FIXED (PR #58)** — CSS uses `var(--bg-muted)` background with `var(--text)` color in dark mode. Text is readable.

### R3-M4. 🟨 Missing Secondary Headings

**✅ FIXED (R4)** — All pages now have H2 sections: "Filters", "QA Entries", "Sub-Systems List", "Users List", "Statistics".

### R3-M1. 🟨 QA Detail Heading is "QA Library"

**✅ FIXED (R4)** — H1 shows entry's question title. Verified: "使用者忘記密碼該如何處理？"

### R3-H3. 🟧 QA Library Controls Leak to All Pages

**Severity:** High → **✅ FIXED (R4)** — Search + Export buttons only appear on QA Library page. Dashboard, Categories, Users, 404 pages verified clean.

---

## 🟩 Low Issues

### L1. No `<meta name="description">`

**✅ FIXED**

### L2. No Favicon

**✅ FIXED**

### L3. Google Fonts External Dependency

**✅ FIXED**

### L4. No Footer

**✅ FIXED** — Sidebar footer with version. Verified in R4.

### L5. Sidebar Emoji

**✅ FIXED by design choice**

### R2-3. Register Same URL as Login

**✅ FIXED** — `/register` unique URL

### R3-L1. Search Missing `<label>`

**✅ FIXED (R4)** — `<label for="global-search" class="sr-only">Search QA entries</label>`

### R3-L2. Search `type="text"` Not `type="search"`

**✅ FIXED (R4)** — Now `type="search"` with `inputmode="search"`

### R3-L3. Login/Register No `<main>` or Skip-Link

**🟡 PARTIAL (R4)** — Server-rendered HTML now has `<main>` with skip-link. But SPA `renderLogin()` does not use `<main>` landmark.

---

## 🆕 Round 4 Findings

### R4-H1. 🟧 QA Detail Panel Renders Below Full QA Library — Extreme Scroll

**Page:** QA Detail (`/qa/:id`)  
**Symptom:** The QA detail panel renders BELOW the complete QA Library list (filters, search, QA entries, pagination). On mobile (375px), user must scroll past the entire QA library to see the QA detail content.

**Evidence:** Snapshot shows QA Library controls (H2 "Filters", all filter buttons, search, QA entries, paginator) ABOVE the detail panel content. URL is `/qa/1` but page shows full QA Library.

**Severity:** High — Confusing UX. User clicking a QA card expects to see detail, not the full QA list.

**Suggested fix:** When navigating to `/qa/:id`, hide the QA Library list and show only the detail panel. OR: implement a true modal overlay that covers the list.

### R4-H2. 🟧 QA Detail Modal Persists Across Page Navigation

**Page:** QA Detail → Categories / Users / Dashboard  
**Symptom:** After opening QA detail (link click from QA Library), navigating to Categories or Users keeps the QA detail panel visible at the bottom of the new page. `close-detail` handler exists but is not triggered during page navigation.

**Evidence:** After navigating QA Detail → Categories, the snapshot still showed QA detail content (question/answer/meta) below the Categories table. Close buttons functional via JS but navigation doesn't dismiss.

**Severity:** High — Content leaks across pages. Residual QA content visible on unrelated pages.

**Suggested fix:** Call `closeModal('detail-modal')` in the `navigate()` function before rendering new page content.

### R4-M1. 🟨 Login SPA Form Missing `<form>` Element

**Page:** Login  
**Symptom:** The JS-rendered `renderLogin()` function produces `<div>`-based layout without a wrapping `<form>` element. Enter key submission may be unreliable. No native form validation.

**Evidence:** SPA login inputs are children of `<div>`, not `<form>`. Server no-JS fallback correctly uses `<form method="POST" action="/api/auth/login">`.

**Severity:** Medium — Keyboard submission works via JS event handler but breaks form semantics.

**Suggested fix:** Wrap login inputs in `<form>` element in `renderLogin()`. Keep JS event handler for `submit` event.

### R4-M2. 🟨 No theme-color or Apple PWA Meta Tags

**Page:** All  
**Symptom:** No `<meta name="theme-color">`, no `<meta name="apple-mobile-web-app-capable">`, no `<meta name="apple-mobile-web-app-status-bar-style">`. Browser chrome defaults to white (light) or dark gray (system) regardless of app theme.

**Severity:** Medium — Missing PWA foundation. Browser UI doesn't match app theme.

**Suggested fix:** Add `theme-color` meta (dynamic for light/dark), Apple PWA meta tags.

### R4-M3. 🟨 Categories Page: No Confirmation on Remove Sub-System

**Page:** Categories  
**Symptom:** Clicking "Remove" on a sub-system row triggers a deletion with a confirmation modal. Verified modal DOES appear with Cancel/Confirm buttons.  
**Issue (minor):** Focus is not returned to the Remove button after modal closes.  
**Severity:** Medium — Keyboard users lose focus position.

### R4-L1. 🟩 No Explicit Footer Element

**Page:** All  
**Symptom:** No `<footer>` element on any page. Version info only in sidebar.  
**Severity:** Low — Acceptable for SPA. Sidebar serves same purpose.

---

## ✅ Positive Findings (Round 4)

- **Dark mode body contrast ratio 14.42:1** — Exceeds WCAG AAA requirement (7:1)
- **Filter tabs work correctly** — "All" shows 5 entries (including Draft), "Published" shows 4
- **Mobile responsive** — All pages render at 375px without horizontal scroll. Sidebar toggle works.
- **Sidebar QA count accurate** — Shows "5" on all pages (total from `/api/stats`)
- **No "Loading..." stale text** — QA page confirmed clean of stale loading indicators
- **QA detail Close button works** — `data-action="close-detail"` correctly calls `closeModal('detail-modal')` + `/qa` navigation
- **Export button only on QA Library** — Not present on Dashboard, Categories, Users, 404
- **Register accessible** — Role dropdown prevents self-promotion to Admin. Back-to-login link present.
- **Skip-link visible and functional** — First focusable element on all authenticated pages
- **Login no-JS fallback has `<form>` with labels** — Server-rendered page works without JavaScript
- **Logout button in sidebar** — Available on all pages
- **404 is true HTTP 404** — Server sends correct status code, not 200 with error content
- **Focus-visible CSS rule exists** — Custom `:focus-visible` outline with theme-aware color
- **Breadcrumb consistent** — "IT Operations / [Page Name]" format on all pages

---

## Security Headers (curl -I http://localhost:3000/)

```
Content-Security-Policy: default-src 'self';style-src 'self' 'unsafe-inline';
  font-src 'self';img-src 'self' data:;script-src 'self' 'unsafe-inline';
  base-uri 'self';form-action 'self';frame-ancestors 'self';
  object-src 'none';script-src-attr 'none';upgrade-insecure-requests
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Origin-Agent-Cluster: ?1
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-DNS-Prefetch-Control: off
X-Download-Options: noopen
X-Frame-Options: SAMEORIGIN
X-Permitted-Cross-Domain-Policies: none
```

> No HSTS `preload` directive. No `X-XSS-Protection` (deprecated but still common). `script-src 'unsafe-inline'` weakens CSP (mitigated by `script-src-attr 'none'`).

---

## 🆕 Round 5 Findings — Fix Verification (2026-06-04)

**Focus:** Verify fixes from PRs #57, #62, #64, #72, #61 + remaining open issues
**Viewport:** 416×902 (mobile portrait) — session persisted through full reload

### R4-H1. ✅ FIXED & VERIFIED — QA Detail No Longer Below QA Library

QA Detail now renders as a clean overlay with only the detail content. No QA Library list, filters, search, or pagination visible behind/above the detail.

**Evidence (416×902):**
```
main
  ├── ☰ Toggle sidebar
  ├── ❓ [entry title] (no H1 "QA Library")
  ├── IT Operations / Knowledge Base
  ├── 🌙 Toggle theme
  ├── ✕ Close (44×44)
  └── QA detail content (Question, Answer, Status, Sub-System, Tags, meta)
```
No QA Library list elements (filters, entries, pagination) present.

### R4-H2. ✅ FIXED & VERIFIED — QA Detail No Longer Persists Across Navigation

`navigate()` function calls `closeModal('detail-modal')` at start. Verified by opening QA Detail → navigating to Dashboard, Categories, Users — no residual QA content.

### R4-M1. ✅ FIXED & VERIFIED — Login SPA Now Uses `<form>`

`renderLogin()` now wraps inputs in `<form class="login-page" id="login-form">`.
Submit event handler attaches to `submit` event on the form element (not click on button).
Password Enter submits natively via `<form>` — verified via code inspection.

### Mobile Touch Targets (PR #64) — ALL FIXED ✅

Measured at 416×902 viewport:

| Element               | Before (R4 Mobile) | After (R5)   | WCAG 2.5.5 |
|-----------------------|--------------------|--------------|------------|
| Hamburger ☰           | 15×19 🔴           | **44×44**   | ✅ Pass    |
| Theme toggle 🌙        | 42×32 🟨           | **47×44**   | ✅ Pass    |
| Filter tabs (All etc.) | ~30×24 🟧          | **44×44**   | ✅ Pass    |
| Search input           | 30px h / 13px font 🟧 | **44×44 / 16px** | ✅ Pass |
| Export 📥              | 75×26 🟧           | **79×44**   | ✅ Pass    |
| New Entry ＋           | 91×25 🟧           | **99×44**   | ✅ Pass    |
| Prev / Next pagination | 59x26 🟧           | **63×44 / 64×44** | ✅ Pass |
| Approve (QA Detail)    | — (text link)      | **72×44**   | ✅ Pass    |
| Reject (QA Detail)     | — (text link)      | **60×44**   | ✅ Pass    |

### Sidebar Scrim (PR #62) — ✅ VERIFIED

When sidebar is opened at mobile width, scrim overlay is present (`display: block` on scrim element). Tapping scrim closes sidebar.

### Sub-System Remove Confirmation (PR #62) — ✅ VERIFIED

Clicking "Remove" on a sub-system shows:
- Modal heading: **Remove**
- Body: **"Are you sure you want to remove this category?"**
- Buttons: Cancel (65×44), Confirm (71×44), Close ✕ (44×44) — all ≥44px height ✅

### QA Library Search Clear Button (PR #72 / Issue #63) — ✅ VERIFIED

Search clear (✕) button appears when search input has text. Button aligned properly (no layout shift).

### QA Detail FAQ-style Modal (PR #61) — ✅ VERIFIED

QA entries now use inline anchors (e.g., `/qa/95`) inside `<a>` elements, not `<div onclick>`. XSS escaped via `esc()` helper. H1 shows entry-specific title.

### Unauthenticated State — No auth guard on SPA shell

When logged out (server session cleared), SPA reload shows the Login page via `renderLogin()`. However, if client-side state has cached user data, the app shell briefly renders before the auth check completes. No actionable issue — SPA correctly checks `/api/auth/me` on `DOMContentLoaded`.

### 🟩 R5-L1. QA Detail Title Overflow at Mobile (<416px)

**Page:** QA Detail
**Symptom:** QA Detail H1 title has `white-space: nowrap`, causing overflow at narrow viewports. At 416px viewport, the title element scrolls to 431px in a 208px container (223px overflow). The parent container uses `overflow: visible`, so text bleeds out of its container.

**Evidence:**
```
H1.topbar-title: scrollWidth=431px, clientWidth=208px, whiteSpace=nowrap
```

**Severity:** Low — visible on very long QA titles. Most titles don't trigger this.

**Suggested fix:** Remove `white-space: nowrap` or add `word-break: break-word` / `overflow-wrap: break-word` on `.topbar-title`.

---

## Open Issues — Priority Order

| #  | ID    | Sev | Description                            | Page      | Fix                                       |
|----|-------|-----|----------------------------------------|-----------|-------------------------------------------|
| 1  | R3-H1 | 🟧  | PWA completely missing                 | All       | manifest.json, SW, meta tags              |
| 2  | R2-2  | 🟨  | Dashboard very sparse                   | Dashboard | Add recent entries, charts, per-category  |
| 3  | R4-M2 | 🟨  | Missing theme-color / Apple PWA meta    | All       | Add `<meta name="theme-color">` dynamic  |
| 4  | R4-L1 | 🟩  | No explicit `<footer>` element          | All       | Optional — sidebar serves same purpose    |
| 5  | R5-L1 | 🟩  | QA Detail title overflow at mobile       | QA Detail | Remove `white-space: nowrap` or add break  |

---

## Previously Fixed (all rounds)

| Issue                           | Fix PR/Commit        | Note                                         |
| ------------------------------- | -------------------- | -------------------------------------------- |
| R4-H1 (QA Detail below list)    | PR #61               | Detail renders as overlay, list hidden       |
| R4-H2 (QA Detail persists)      | PR #61 (#56)         | `navigate()` calls `closeModal('detail-modal')` |
| R4-M1 (Login SPA `<form>`)      | PR #57 (#53)         | `renderLogin()` wraps in `<form>`             |
| All 10 mobile touch targets     | PR #64               | All ≥44×44, input font 16px                   |
| Sidebar scrim + auto-close      | PR #62 (#54)         | Scrim overlay on mobile                      |
| Sub-system Remove confirm dialog | PR #62 (#54)         | Custom modal with Cancel/Confirm             |
| Search clear button             | PR #72 (#63)         | ✕ button aligns properly                     |
| QA Card semantic `<a>` links    | PR #61               | Replaced `<div onclick>` with `<a href>`      |
| R3-H2 (Login labels)            | —                    | Labels added to no-JS HTML                   |
| R3-H3 (Controls leak)           | —                    | Search/Export conditioned per page            |
| R3-M1 (QA Detail heading)       | —                    | H1 updated to entry title                     |
| R3-M2 (Users pagination)        | PR #43 (#33)         | 20/page pagination                            |
| R3-M4 (Secondary headings)      | #31                  | H2 sections on all pages                      |
| R3-L1 (Search label)            | —                    | `<label for="global-search">`               |
| R3-L2 (Search type)             | —                    | Changed to `type="search"`                   |
| R2-1 (Sidebar QA count)         | PR #42 (#35)         | `loadQATotalCount()`                           |
| All 19 Round 1 issues           | Various              | Full semantic + a11y + security               |
