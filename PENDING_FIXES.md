# Pending Fixes — Issue #94

This file tracks remaining work related to the mobile search keyboard dismiss
fix (#94) that is deferred to future PRs or CI validation cycles.

## Completed

- [x] Split `renderQA` / `renderUsers` to preserve search DOM on re-render
- [x] Integration tests for search DOM preservation
- [x] Preserve search input DOM across re-renders (input value is the source of truth; state is updated via debounced input handler, not synced back from state)
- [x] Add `mocha` devDependency for test runner compatibility
- [x] Update `npm run test:mocha` run included in CI workflow
- [x] Add `engines` field to `package.json` matching jsdom's Node requirement

## Remaining (next PR)

- [ ] CI validation: confirm `npm run test:mocha` passes on ubuntu-24.04 with
      Node 20 and 22 after the workflow update is merged
- [ ] Monitor `jsdom` transitive dependency engine requirements on future
      `npm audit` / `npm ci` runs

## Future considerations

- If the test file grows, consider splitting into a dedicated `tests/unit/` directory
  and using a test file convention so ESLint config stays simple
