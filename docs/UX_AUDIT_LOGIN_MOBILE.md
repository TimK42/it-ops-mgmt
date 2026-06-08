# Login / Register Page — Mobile RWD Audit

**Date:** 2026-06-08  
**Viewport tested:** 355×631px (effective mobile), 416×902px (iPhone 13-like)  
**Browser:** Chrome via CDP  
**Auth:** Unauthenticated (login page as SPA renders it)

---

## Previously Fixed Items ✅ (Verified Working)

These were flagged in UX_AUDIT_MOBILE.md Round 5 as login touch targets and are now confirmed fixed:

| #   | Issue                      | Before | After                         | Status                          |
| --- | -------------------------- | ------ | ----------------------------- | ------------------------------- |
| 1   | Input font-size            | 13px   | **16px** ✅                   | Fixed                           |
| 2   | Input height               | ~33px  | **43px** ✅                   | Acceptable (close to 44px)      |
| 3   | Sign In button height      | ~37px  | **44px** ✅                   | Fixed                           |
| 4   | Create account link height | ~14px  | **44px** ✅                   | Fixed                           |
| 5   | Remember me label height   | ~14px  | **44px** ✅                   | Fixed (CSS: `min-height: 44px`) |
| 6   | No horizontal overflow     | —      | **scrollWidth = viewport** ✅ | Fixed                           |

**Measurement at 355×631px (iPhone SE-like):**

| Element             | Width | Height | Font-size | Notes                     |
| ------------------- | ----- | ------ | --------- | ------------------------- |
| Login card          | 320px | 425px  | —         | `max-width: 90vw` scaling |
| Content area        | 240px | —      | —         | 40px padding on each side |
| Username input      | 239px | 43px   | 16px      | ✅                        |
| Password input      | 239px | 43px   | 16px      | ✅                        |
| Sign In button      | 240px | 44px   | 14px      | ✅ ≥44px                  |
| Create account link | 104px | 44px   | 12px      | ✅ ≥44px                  |

---

## New Issues Found ❌

### 1. PWA Install Banner Overlaps Register Page (High)

**Severity: High**

- **Login page:** No overlap (card bottom 528px, banner starts at 552px — 24px gap)
- **Register page:** **56px overlap** (card bottom 608px, banner starts at 552px)
- **Impact:** Register page bottom content (confirm password, "← Back to sign in" link, role selector) is covered by the PWA install banner
- **Fix:** Add `padding-bottom: 80px` to `.login-card` when PWA banner is visible, or give the form `min-height: calc(100vh - 90px)` and add bottom padding

### 2. Missing `<main>` Landmark on SPA Login (Medium)

**Severity: Medium** | WCAG 2.4.1

- The SPA `renderLogin()` uses `document.getElementById('app').innerHTML = \`<form class="login-page">...\``which **removes the server-rendered`<main id="main-content">`\*\* element
- This means no `<main>` landmark exists on the login page for screen readers
- **Fix:** Add `<main>` wrapper in the SPA template or keep the server-rendered `<main>` intact

### 3. Missing Skip-to-Content Link on SPA Login (Medium)

**Severity: Medium** | WCAG 2.4.1

- The server HTML includes `<a href="#main-content" class="skip-link">Skip to content</a>` but the SPA **removes it**
- Keyboard users can't skip the navigation block (though there's no nav, they'd skip the form)
- **Fix:** Include the skip link in the SPA template or make it persist across SPA renders

### 4. Login Page Background Always Dark (Low)

**Severity: Low**

- `.login-page` CSS: `background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)` — **hardcoded dark gradient**
- The card background uses `var(--surface)` and respects light/dark themes, but the surrounding gradient stays dark
- In light mode, white card on dark gradient background creates visual disconnect
- **Fix:** Use CSS variables for the gradient colors, or show a light gradient in light mode

### 5. Generous Card Padding on Small Viewports (Low)

**Severity: Low**

- Login card has `padding: 40px` on all sides
- At 355px viewport: card = 320px, content area = 240px (80px lost to padding)
- At 320px viewport: card = 288px, content area = 208px (73% padding overhead)
- Single field inputs and a button fit, but feels cramped
- **Fix:** Reduce padding to 24px at `max-width: 480px` via media query

### 6. 1px Body Overflow on Some Viewports (Low)

**Severity: Low**

- `document.body.scrollWidth` exceeds `document.documentElement.scrollWidth` by 1px in some viewport sizes
- Doesn't affect usability but indicates a stray margin/padding somewhere
- **Fix:** Add `overflow-x: hidden` to body

### 7. Login-sub and Link Font Sizes Small (Low)

**Severity: Low**

- `.login-sub` ("Knowledge Base", "Register for access"): **13px** — small for mobile readability
- `.login-link a` ("Create account", "← Back to sign in"): **12px** — small, though target area is 44px tall
- Not iOS auto-zoom level (which only triggers on inputs <16px), but below recommended 14px minimum for body text
- **Fix:** Bump to 14px minimum

---

## Register Page Specific Findings

| Item                     | Value                                 | Notes                                 |
| ------------------------ | ------------------------------------- | ------------------------------------- |
| Card height              | 585px                                 | At 355×631 viewport                   |
| Card bottom              | 608px                                 | Nearly hits bottom                    |
| Card fits?               | Just barely (cards ends at 608/631px) |                                       |
| PWA banner overlap       | **56px overlap**                      | Banner covers bottom of card          |
| Input font sizes         | 16px                                  | ✅                                    |
| Register button          | 240×44px                              | ✅ ≥44px                              |
| Role selector            | Present                               | Select, not degraded on mobile        |
| "← Back to sign in" link | 115×44px                              | ✅ ≥44px (but covered by PWA banner!) |

---

## Dark Mode Verification

| Element       | Light Mode                 | Dark Mode            |
| ------------- | -------------------------- | -------------------- |
| Login page bg | Always dark gradient       | Always dark gradient |
| Card bg       | `#ffffff`                  | `#1a1a2e`            |
| Body text     | `#e0e0e0` (inherited dark) | `#e0e0e0`            |
| Input bg      | `#ffffff`                  | `#1a1a2e`            |
| Input text    | `#1a1a2e`                  | `#e0e0e0`            |
| Button bg     | `#4f46e5` (indigo)         | `#4f46e5` (indigo)   |
| Button text   | `#ffffff`                  | `#ffffff`            |

**Note:** Force-setting `data-theme="light"` doesn't work well because:

1. Login page gradient is hardcoded dark
2. Body text inherits from a default that's dark-mode-optimized
3. The theme toggle doesn't exist on the login page (only in the app shell)

---

## Summary

| Severity  | Count | Key Items                                                                        |
| --------- | ----- | -------------------------------------------------------------------------------- |
| ✅ Fixed  | 6     | Touch targets, font sizes, no overflow                                           |
| 🔴 High   | 1     | Register page PWA banner 56px overlap                                            |
| 🟡 Medium | 2     | Missing `<main>` landmark, missing skip-link on SPA login                        |
| 🟢 Low    | 4     | Dark gradient in light mode, generous padding, 1px overflow, small subtitle font |

**Overall assessment:** Login page RWD is **adequate** for basic mobile use. The card scales correctly via `max-width: 90vw`, touch targets pass WCAG, and there's no content overflow. The main actionable issue is the **register page PWA install banner overlap**.
