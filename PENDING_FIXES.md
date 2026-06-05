# Pending Fixes — Issue #94

## Completed

- [x] Split `renderQA` / `renderUsers` to preserve search DOM on re-render
- [x] Integration tests for search DOM preservation
- [x] Sync search input value from state on subsequent `renderUsers` calls
- [x] Add `mocha` devDependency for test runner compatibility

## Remaining

- [ ] CI: verify `jsdom@^29.1.1` Node engine requirements are met on ubuntu-24.04 runners
