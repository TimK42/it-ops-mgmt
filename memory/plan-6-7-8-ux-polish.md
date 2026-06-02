# Plan: UX Polish Round 1 — Issues #6, #7, #8

## Branch

`fix-6-7-8-manager-loop` (from main)

## Files changed

- `public/index.html`
- `public/css/style.css`
- `public/js/app.js`
- `server.js` (CSP update for self-hosted font)
- `public/fonts/` (new — Inter font woff2 + CSS)

## Planned changes

### Issue #6 — Session Timeout Warning

- **app.js**: Track idle activity (mousemove, keydown, click, scroll)
- **app.js**: Show "Session expired" banner on login page when 401 occurs
- **app.js**: Warning modal ~30 min before 16h idle expiry with "Stay Logged In" button
- **app.js**: Session keepalive via `/api/auth/me` on "Stay Logged In"

### Issue #7 — UX Polish

- **app.js/style.css**: `.pagination-btn` class for bordered pagination buttons
- **app.js/style.css**: `showConfirm(title, message, onConfirm)` custom modal replacing `confirm()`
- **app.js**: Empty state for search results (distinct from "no entries")

### Issue #8 — Meta Polish

- **index.html**: `<meta name="description">`
- **index.html**: SVG favicon (inline data URI)
- **index.html**: Self-host Inter font (download woff2 → public/fonts/)
- **server.js**: Update CSP for self-hosted font domain
- **app.js/style.css**: Footer bar with version info
- **app.js**: Replace 👤 emoji with SVG icon / "Admin" text

## Order of implementation

1. Download Inter font → public/fonts/
2. Edit index.html (meta, favicon, font CSS)
3. Edit style.css (pagination-btn, confirm-modal, footer, session-warning, search-empty)
4. Edit app.js (all features)
5. Edit server.js (CSP)
6. Run tests
7. Review all changes
8. Commit + push
9. Create PR with Copilot reviewer
10. Watch + resolve review comments
11. Merge
