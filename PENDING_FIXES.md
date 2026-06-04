# 73 fixes

## What was fixed

- **Horizontal overflow (Users table):** `.table-container` now uses `overflow-x: auto` instead of `overflow: hidden`, allowing horizontal scrolling without cutting off content. (Applied globally, not scoped to a media query.)
- **QA Detail title overflow:** `.topbar-title` now uses `white-space: normal`, `word-break: break-word`, and `overflow-wrap: break-word` on mobile to allow long titles to wrap naturally.
- **Page switch right-edge shift:** `body` has `overflow-x: hidden` and `.content` has `max-width: 100vw` + `overflow-x: hidden` on mobile to prevent viewport scroll when navigating between pages.

## Test verification

All CSS changes are verified via assertions in `tests/test.js`.
