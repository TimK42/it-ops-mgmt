# Issue #16 — ESLint flat config + Prettier + CI lint job

## Current State

- ESLint v10.4.1, Prettier v3.8.3, `@eslint/js`, `globals`, `eslint-config-prettier` already installed
- `package.json` has scripts: `lint`, `lint:fix`, `format` (prettier --check), `format:fix` (prettier --write)
- Existing CI workflow `.github/workflows/ci.yml` runs tests only — no lint/format step
- NO eslint.config.mjs, NO .prettierrc, NO .prettierignore exist

## Tasks

1. **eslint.config.mjs** — flat config for Node.js/CommonJS
   - `@eslint/js` recommended rules
   - `globals` for Node.js + CommonJS `require/module/__dirname`
   - `eslint-config-prettier` to disable style rules that conflict with Prettier
   - Ignore patterns: `node_modules/`, `coverage/`, `.git/`

2. **.prettierrc** — project standard formatting
   - singleQuote: true
   - trailingComma: "all"
   - tabWidth: 2
   - semi: true
   - printWidth: 100

3. **.prettierignore** — similar to .gitignore (node_modules, coverage)

4. **Update CI workflow** — add lint + format:check steps to `.github/workflows/ci.yml`

5. **Format existing codebase** — `npx prettier --write .`

6. **Fix ESLint violations** — `npx eslint . --fix` then manual fix for remaining violations

## Acceptance Criteria

- [ ] `npm run lint` passes with zero errors
- [ ] `npm run format` passes (Prettier check)
- [ ] CI runs lint + format on PR/push to main
- [ ] Workflow blocks merge on failure
