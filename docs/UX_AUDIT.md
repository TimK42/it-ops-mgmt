# IT Ops Management — UI/UX Audit Report

> **Conducted:** 2026-06-02 23:00 HKT · via curl + DOM/JS analysis  
> **Pages audited:** Login, Register, QA Library, QA Detail, QA Create/Edit, Categories, Users, Dashboard, 404  
> **Roles tested:** Admin (admin), Contributor (tester11), Viewer (tester21)  
> **Round:** 1

---

## 🔴 Critical Issues

### C1. No Semantic HTML Structure

**Severity:** Critical · **Pages:** All  
No `<nav>`, `<main>`, `<header>`, `<footer>`, `<section>`, or `<article>` tags — everything is `<div>`.

**Fix:** Wrap sidebar in `<nav>`, content area in `<main id="main-content">`, topbar in `<header>`.

### C2. No ARIA or Accessibility Attributes

**Severity:** Critical · **Pages:** All  
Zero `aria-label`, `aria-role`, `aria-describedby`, or `role` attributes. Screen readers get no structure.

**Fix:** Add `aria-label` to icon-only buttons (search, sidebar toggle), `role="navigation"` on sidebar, `role="button"` on `<div>` clickable items.

### C3. No Keyboard Navigation or Focus Indication

**Severity:** Critical · **Pages:** All

- Sidebar items are `<div onclick>` — not focusable via Tab key
- Only form inputs have `:focus` styling (ring), no `:focus-visible` on buttons/links
- No skip-to-content link

**Fix:** Use `<button>` or `<a>` for interactive elements. Add `:focus-visible` outline. Add skip link as first focusable element.

### C4. Missing Security Headers

**Severity:** Critical · **Pages:** All  
No CSP, X-Frame-Options, Referrer-Policy, or Cross-Origin headers. Only `X-Content-Type-Options: nosniff` is present.

**Fix:** Add `helmet` middleware to Express, or manual headers for CSP/X-Frame-Options/Referrer-Policy.

---

## 🟧 High Issues

### H1. No Dark Mode

**Severity:** High · **Pages:** All  
No `prefers-color-scheme` support, no dark theme toggle. Sidebar is always dark blue, main content always light.

**Fix:** Add CSS custom properties for light/dark and a `data-theme` toggle. Low priority for internal tool but significant for eye comfort.

### H2. Missing `autocomplete` Attributes on Login Form

**Severity:** High · **Pages:** Login, Register, Create User  
Password fields lack `autocomplete="current-password"` / `new-password"`. Username lacks `autocomplete="username"`. Password managers cannot auto-fill properly.

```html
<!-- Current -->
<input
  class="form-input"
  type="password"
  id="auth-pass"
  placeholder="Password"
/>

<!-- Should be -->
<input
  class="form-input"
  type="password"
  id="auth-pass"
  placeholder="Password"
  autocomplete="current-password"
/>
```

### H3. No Heading Hierarchy on Content Pages

**Severity:** High · **Pages:** QA Library, Categories, Users, Dashboard  
Only heading is `<h1>` on login card. Content pages have zero semantic headings — page titles use `<div class="topbar-title">`.

**Fix:** Make page titles `<h1>`. Use `<h2>` for section headers (e.g., "QA Entries", "Sub-Systems table").

### H4. 404 Page is Express Default

**Severity:** High · **Pages:** 404  
Non-existent routes return Express default HTML error page — no app shell, no nav, no way back.

```
Cannot POST /api/users/create
```

**Fix:** Add custom 404 in SPA routing or server-side catch-all that renders a styled error component.

### H5. No Session Timeout Warning

**Severity:** High · **Pages:** All  
16h session idle — session expires silently. User gets 401 on next API call and gets kicked to login with no warning.

**Fix:** Add a warning modal ~5 minutes before expiry, or show a "Session expired" message on login redirect.

---

## 🟨 Medium Issues

### M1. Navigation Items are `<div>`, Not `<button>` or `<a>`

**Severity:** Medium · **Pages:** All  
Sidebar nav and pagination are clickable `<div>` elements. Not reachable via keyboard, no `Enter`/`Space` activation, no `role` attribute.

```html
<!-- Current -->
<div class="nav-item active" data-nav="qa" onclick="navigate('qa')">
  <!-- Should be -->
  <button class="nav-item active" onclick="navigate('qa')"></button>
</div>
```

### M2. Pagination Buttons Styled as Filter Tabs

**Severity:** Medium · **Pages:** QA Library  
Prev/Next buttons use `.filter-tab` CSS class — visually identical to status filter tabs (All/Published/Draft/Archived). Confusing affordance.

**Fix:** Give pagination buttons their own visual style (e.g., bordered, distinct from filter tabs).

### M3. Confirmation Dialogs Use `window.confirm()`

**Severity:** Medium · **Pages:** QA Delete, Category Remove, User Reject  
Browser-native `confirm()` is unstyled, inconsistent with app design. Text is terse ("Delete?", "Remove?").

**Fix:** Custom confirmation modal or at minimum improve confirm text: "Delete QA-0001? This cannot be undone."

### M4. No Empty-State for Search with No Results

**Severity:** Medium · **Pages:** QA Library (search active)  
When search filter returns zero results, the QA list renders empty — no "No results found" message.

**Fix:** Add empty state: "No QA entries match your search. Try different keywords."

### M5. QA Card Uses `<div onclick>` Instead of `<a>`

**Severity:** Medium · **Pages:** QA Library  
Clicking a QA card opens detail modal — but cards are generic `<div onclick>`. Can't right-click → open in new tab, can't Ctrl+click, can't keyboard-navigate.

**Fix:** Wrap card content in `<a href="#" onclick="...">` or add `tabindex="0"` + `role="button"` + keyboard handler.

---

## 🟩 Low Issues

### L1. No `<meta name="description">`

**Severity:** Low · **Pages:** All  
No SEO description tag. Low impact for internal tool.

### L2. No Favicon

**Severity:** Low · **Pages:** All  
No `<link rel="icon">`. Shows default browser favicon.

### L3. Google Fonts External Dependency

**Severity:** Low · **Pages:** All  
`Inter` loaded from Google Fonts CDN. Privacy concern for internal tool (external request on every page load). Consider self-hosting.

### L4. No Footer

**Severity:** Low · **Pages:** All  
No footer with version, links, or copyright info.

### L5. Sidebar User Info Uses Emoji

**Severity:** Low · **Pages:** Sidebar  
`👤 admin (Admin)` — emoji rendering varies across OS. An icon or text-based label would be more consistent.

---

## ✅ Positive Findings

- **Role-based access control** works correctly — Contributor blocked from Categories/Users, Viewer read-only for QA
- **API error handling** is consistent — 401 → logout, 403 for forbidden, proper error messages
- **Form validation** exists — required fields, min length, password match checks
- **Loading states** present on page transitions ("Loading..." text)
- **Toast notifications** provide feedback for create/update/delete actions
- **Responsive layout** — sidebar collapses on mobile (≤768px), modal adapts to viewport
- **Semantic table structure** — proper `<thead>/<tbody>` with `<th>` headers
- **CSS custom properties** well-organized (variables for colors, radii)
- **Client-side XSS prevention** via `esc()` function for user-generated content
- **Session cookie** uses `httpOnly: true` and `sameSite: 'lax'`

---

## Summary

| Severity    | Count  | Issues |
| ----------- | ------ | ------ |
| 🔴 Critical | 4      | C1–C4  |
| 🟧 High     | 5      | H1–H5  |
| 🟨 Medium   | 5      | M1–M5  |
| 🟩 Low      | 5      | L1–L5  |
| **Total**   | **19** |        |

### Priority Order for Fixes

1. **C1+C2+C3** (semantic HTML + ARIA + keyboard) — one pass, same files
2. **C4** (security headers) — `helmet` middleware, 5 min
3. **H2** (autocomplete) — add to 4 input fields
4. **H3** (headings) — convert title divs to h1/h2
5. **M1+M5** (button elements) — replace `onclick` divs with buttons/links
6. **H4** (custom 404)
7. **H5** (session timeout warning)
