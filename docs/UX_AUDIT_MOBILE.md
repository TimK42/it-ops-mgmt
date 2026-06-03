# UX Audit Report — Mobile Portrait (355×812)

**App:** it-ops-mgmt (IT Operations Knowledge Base) v1.1.0  
**Date:** 2026-06-03 (updated with quantitative measurements)  
**Viewport:** 355×812 (iPhone SE / Portrait)  
**Auth:** test-user / test-password-placeholder  
**Sidebar:** Collapsed by default (`display: none` at this viewport)  
**Theme tested:** Light and Dark  
**Methodology:** Automated measurements + visual inspection

---

## 1. QA Library List Page

### Visual

- Cards layout with QA number, title, category badge (colored), status badge, tags, dates
- Vertical stacking within 355px — good readability
- 20 cards per page (42 total), pagination at bottom
- Cards width: ~307px, card heights: 138–175px — good tap targets

### Issues

| #   | Issue                                  | Severity   | Detail                                                                              |
| --- | -------------------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| 1   | Filter pill tap targets                | **Medium** | All 4 filters <44px height: All 39×24, Published 81×24, Draft 52×24, Archived 75×24 |
| 2   | Export button too small                | **Medium** | 75×26px — height <44px                                                              |
| 3   | Search input font 13px (needs ≥16px)   | **High**   | iOS auto-zooms input fields with <16px font; height also only 30px                  |
| 4   | Prev/Next pagination buttons too small | **Medium** | ‹ Prev 59×26, Next › 60×26 — height <44px                                           |
| 5   | Hamburger menu button too small        | **High**   | ☰ button only 15×19 — both dimensions dramatically <44px                           |
| 6   | Theme toggle button borderline         | **Low**    | 42×32 — width just under 44px, height significantly <44px                           |
| 7   | "＋ New Entry" button too small        | **Medium** | 91×25 — height <44px                                                                |
| 8   | No "clear search" button               | **Low**    | User must manually delete text to clear                                             |
| 9   | QA entry link cards: fine              | None       | ~307×175 — good tap targets with titles and metadata                                |

### Positives

- Cards stack vertically — no horizontal overflow
- Search box full-width (268px)
- QA links have good tap target size

---

## 2. QA Detail Modal

### Visual

- Full-screen overlay on mobile
- Fields stacked: Question, Answer, Status, Sub-System, Tags, Created, Modified
- Bottom actions: Close, Edit, Delete buttons
- Closes ✕ (top-right), Close (bottom), Edit, Delete

### Issues

| #   | Issue                                 | Severity   | Detail                                    |
| --- | ------------------------------------- | ---------- | ----------------------------------------- |
| 10  | Close ✕ button too small              | **High**   | 23×31 — barely tappable                   |
| 11  | Close (second) button                 | **Medium** | 54×24 — height <44px                      |
| 12  | Edit button too small                 | **Medium** | 42×24 — both <44px                        |
| 13  | Delete button too small               | **Medium** | 58×24 — height <44px                      |
| 14  | Horizontal overflow                   | **High**   | Body scrollWidth > viewport               |
| 15  | Heading hierarchy: only H1            | **Low**    | No H2 sections for structured content     |
| 16  | Bottom buttons may overlap below fold | **Low**    | On short screens (<650px) buttons cut off |

### Positives

- Good vertical form layout
- Tags displayed as chips
- Category/Status badges visible
- QA-0095 heading clear

---

## 3. New QA Entry Form (Modal)

### Visual

- Modal overlay (320px wide at 355px viewport)
- Fields: Title*, Question*, Answer, Sub-System (dropdown), Status (dropdown), Tags
- Actions: ✕ Close, Cancel, Create

### Issues

| #   | Issue                                             | Severity   | Detail                                                                   |
| --- | ------------------------------------------------- | ---------- | ------------------------------------------------------------------------ |
| 17  | All inputs use 13px font                          | **High**   | Every text input, textarea, and select has 13px font — triggers iOS zoom |
| 18  | All inputs too short                              | **High**   | Inputs 33–34px height — should be ≥44px for touch                        |
| 19  | Close ✕ button too small                          | **High**   | 23×31                                                                    |
| 20  | Cancel button too small                           | **Medium** | 61×24                                                                    |
| 21  | Create button too small                           | **Medium** | 58×24                                                                    |
| 22  | Modal width 320px at 355px viewport               | **Low**    | 35px gap on each side — feels cramped for form inputs                    |
| 23  | No inline validation                              | **Low**    | Title/Question marked \* but no real-time validation                     |
| 24  | Tags field: "comma separated" only in placeholder | **Low**    | No explicit delimiter instructions                                       |

### Positives

- Labels above inputs — good mobile pattern
- Dropdowns functional
- Form fits within single scroll

---

## 4. Users Page

### Visual

- Table: Username | Role | Status | Created | Actions (Approve / Reject)
- 20 users per page

### Issues

| #   | Issue                            | Severity   | Detail                                     |
| --- | -------------------------------- | ---------- | ------------------------------------------ |
| 25  | Table horizontal overflow        | **High**   | 5 columns at 355px force horizontal scroll |
| 26  | "＋ New User" button too small   | **Medium** | 91×25 — height <44px                       |
| 27  | Approve / Reject tiny text links | **Medium** | Text links, not buttons — easy to mis-tap  |
| 28  | No filter/search on 164 users    | **Low**    | Must paginate through 9 pages              |

### Positives

- Pagination works (Prev/Next)
- User initials avatar provides visual anchor

---

## 5. Dashboard Page

### Visual

- Breadcrumb + Heading "Dashboard"
- Stats cards: 105 QA Entries, 4 Sub-Systems (side-by-side, fits 355px)
- Bar chart visualization
- Table/list per sub-system

### Issues

| #   | Issue                     | Severity   | Detail                                    |
| --- | ------------------------- | ---------- | ----------------------------------------- |
| 29  | Header controls too small | **Medium** | ☰ hamburger 15×19, ☀️ theme toggle 42×32 |
| 30  | Dashboard is sparse       | **Low**    | No trends, recent activity, user metrics  |

### Positives

- Cards scale well at 355px
- Chart readable
- Good visual hierarchy

---

## 6. Categories (Sub-Systems) Page

### Visual

- Table: Icon | Name | Color | QA Count | Remove (button)
- 4 sub-systems: ACOS, CAD, GIS, PVNS

### Issues

| #   | Issue                                | Severity   | Detail                                          |
| --- | ------------------------------------ | ---------- | ----------------------------------------------- |
| 31  | All "Remove" buttons too small       | **Medium** | 67×24 (4 instances) — height <44px              |
| 32  | "＋ Add Sub-System" button too small | **Medium** | 132×25 — height <44px                           |
| 33  | Table horizontal overflow            | **Medium** | Color hex values (e.g., `#7c3aed`) are long     |
| 34  | No confirmation dialog for Remove    | **Medium** | Remove immediately deletes — no "Are you sure?" |

### Positives

- ＋ Add Sub-System button visible
- Categories listed with color badges

---

## 7. Login Page

### Visual

- Centered card layout
- Heading: "IT Operations"
- Fields: Username, Password, Remember me checkbox, Sign In button, Create account link

### Issues

| #   | Issue                              | Severity   | Detail                                        |
| --- | ---------------------------------- | ---------- | --------------------------------------------- |
| 35  | Username/Password inputs 33px tall | **High**   | 240×33 — height <44px, font 13px (→ iOS zoom) |
| 36  | "Sign In" button 37px tall         | **High**   | 240×37 — height <44px                         |
| 37  | "Create account" link tiny         | **High**   | 88×14 — both dimensions far below 44px        |
| 38  | Checkbox 13×13                     | **High**   | Cannot tap precisely                          |
| 39  | Horizontal overflow                | **Medium** | Body wider than viewport                      |

### Positives

- Card centers properly at 355px
- Input fields full-width
- Error messages inline
- "Remember me" checkbox visible

---

## 8. Register Page

### Visual

- Card layout matching login style
- Fields: Username, Password, Role (Viewer/Contributor), Register button, ← Back to sign in

### Issues

| #   | Issue                             | Severity | Detail                 |
| --- | --------------------------------- | -------- | ---------------------- |
| 40  | Input fields 33px tall, 13px font | **High** | Same issues as login   |
| 41  | "Register" button 37px tall       | **High** | 240×37                 |
| 42  | "← Back to sign in" link tiny     | **High** | 99×14 — far below 44px |
| 43  | No password confirmation field    | **Low**  | Typo-prone             |

### Positives

- Consistent styling with login
- Role dropdown works on mobile
- "Back to sign in" link visible

---

## 9. 404 Page

### Visual

- Empty state: 🔍 icon + "Page Not Found" + "Go to QA Library" button

### Issues

| #   | Issue                                | Severity   | Detail                                     |
| --- | ------------------------------------ | ---------- | ------------------------------------------ |
| 44  | "Go to QA Library" button too small  | **Medium** | 131×30 — height <44px                      |
| 45  | Page title briefly shows "Dashboard" | **Low**    | `navigate()` fallback before `render404()` |

### Positives

- Clear empty state with navigation button
- Breadcrumb still visible
- Theme toggle works on 404 page

---

## 10. Sidebar Navigation

### Visual

- Overlay sidebar (hides with `display: none` at mobile)
- Items: QA Library, Sub-Systems, Users, Dashboard, Sign Out
- User name and role shown at bottom

### Issues

| #   | Issue                                 | Severity     | Detail                                                           |
| --- | ------------------------------------- | ------------ | ---------------------------------------------------------------- |
| 46  | Hamburger toggle too small            | **Critical** | ☰ button 15×19 — nearly impossible to tap accurately on a phone |
| 47  | No backdrop (scrim) when sidebar open | **Medium**   | No dark overlay behind sidebar                                   |
| 48  | Sidebar doesn't auto-close after nav  | **Low**      | Extra tap to close after navigation                              |

### Positives

- Hamburger clearly visible (top-left)
- Navigation items good size when expanded
- User role/name at bottom
- "Skip to content" link present

---

## 11. Dark Mode

### Visual

- Toggle via ☀️/🌙 button (top-right of main area)
- Theme persisted in localStorage
- Respects system `prefers-color-scheme` on first load

### Issues

| #   | Issue               | Severity   | Detail                                       |
| --- | ------------------- | ---------- | -------------------------------------------- |
| 49  | Theme toggle small  | **Medium** | 42×32 — both <44px                           |
| 50  | No accessible label | **Low**    | "sun with rays emoji" read by screen readers |

### Positives

- Instant toggle, no page reload
- Good contrast in both modes (light: #f5f5f5, dark: #0f0f1a)
- Properly switches all page content

---

## Summary of Issues

| Severity | Count | IDs                                                                                            |
| -------- | ----- | ---------------------------------------------------------------------------------------------- |
| Critical | 1     | #46                                                                                            |
| High     | 15    | #3, #5, #10, #14, #17, #18, #19, #25, #35, #36, #37, #38, #40, #41, #42                        |
| Medium   | 20    | #1, #2, #4, #7, #11, #12, #13, #20, #21, #26, #27, #29, #31, #32, #33, #34, #39, #44, #47, #49 |
| Low      | 13    | #6, #8, #15, #16, #22, #23, #24, #28, #30, #43, #45, #48, #50                                  |

---

## Consolidated Touch Target Size Report (355px viewport)

| Element                 | Size    | ≥44×44?   | Page                  |
| ----------------------- | ------- | --------- | --------------------- |
| Hamburger ☰            | 15×19   | ❌ Both   | All authenticated     |
| Close ✕                 | 23×31   | ❌ Both   | QA Detail / New Entry |
| Edit button             | 42×24   | ❌ Both   | QA Detail             |
| Delete button           | 58×24   | ❌ Height | QA Detail             |
| Cancel button           | 61×24   | ❌ Height | New Entry Form        |
| Create button           | 58×24   | ❌ Height | New Entry Form        |
| Close (bottom)          | 54×24   | ❌ Height | QA Detail             |
| Filter "All"            | 39×24   | ❌ Both   | QA Library            |
| Filter "Published"      | 81×24   | ❌ Height | QA Library            |
| Filter "Draft"          | 52×24   | ❌ Height | QA Library            |
| Filter "Archived"       | 75×24   | ❌ Height | QA Library            |
| Search input            | 268×30  | ❌ Height | QA Library            |
| Export                  | 75×26   | ❌ Height | QA Library            |
| ＋ New Entry            | 91×25   | ❌ Height | QA Library            |
| ‹ Prev                  | 59×26   | ❌ Height | QA Library            |
| Next ›                  | 60×26   | ❌ Height | QA Library            |
| Theme toggle            | 42×32   | ❌ Both   | All pages             |
| ＋ Add Sub-System       | 132×25  | ❌ Height | Categories            |
| Remove (×4)             | 67×24   | ❌ Height | Categories            |
| ＋ New User             | 91×25   | ❌ Height | Users                 |
| Username/Password input | 240×33  | ❌ Height | Login                 |
| Sign In button          | 240×37  | ❌ Height | Login                 |
| Create account link     | 88×14   | ❌ Both   | Login                 |
| Checkbox                | 13×13   | ❌ Both   | Login                 |
| Register button         | 240×37  | ❌ Height | Register              |
| ← Back link             | 99×14   | ❌ Both   | Register              |
| Go to QA Library        | 131×30  | ❌ Height | 404                   |
| Skip to content         | 131×33  | ❌ Height | All pages             |
| QA entry links          | 307×138 | ✅        | QA Library            |

---

## Input Font Size Report (≥16px required for iOS)

| Input Field        | Font Size | Page           |
| ------------------ | --------- | -------------- |
| Search             | 13px ❌   | QA Library     |
| New Entry Title    | 13px ❌   | New Entry Form |
| New Entry Question | 13px ❌   | New Entry Form |
| New Entry Answer   | 13px ❌   | New Entry Form |
| New Entry Tags     | 13px ❌   | New Entry Form |
| Select dropdowns   | 13px ❌   | New Entry Form |
| Login Username     | 13px ❌   | Login          |
| Login Password     | 13px ❌   | Login          |
| Register fields    | 13px ❌   | Register       |

---

## Key Recommendations (Priority Order)

1. **Increase hamburger menu size** (Critical #46) — ☰ must be ≥44×44. Currently 15×19. Use 32–44px font or larger tap area via padding.
2. **Fix all input font sizes to ≥16px** (High #3, #17, #35, #40) — Every input/textarea/select uses 13px. iOS Safari zooms in on any field with <16px font. Single CSS rule could fix all.
3. **Increase button/link touch targets to ≥44px height** (High #5, #10, #18, #19, #35–38, #40–42, Medium #2, #4, #7, #11–13, #20, #21, #26, #29, #31, #32, #44) — Nearly every interactive element on mobile is below the WCAG 2.5.5 minimum.
4. **Fix horizontal overflow on QA Detail** (High #14) — Investigate which element causes body scrollWidth > viewport.
5. **Fix Users table overflow** (High #25) — Use responsive card layout or horizontal scroll wrapper at small viewports.
6. **Add sidebar backdrop scrim** (Medium #47) — Darken main content when sidebar is open.
7. **Add confirmation dialog for Remove** (Medium #34) — Prevent accidental destructive actions on Categories.
8. **Fix close ✕ button sizing** (High #10, #19) — 23×31 is nearly impossible to tap on mobile.
9. **Add inline validation to forms** (Low #23) — Real-time feedback for required fields.
10. **Auto-close sidebar after nav** (Low #48) — Reduce extra tap for mobile users.
