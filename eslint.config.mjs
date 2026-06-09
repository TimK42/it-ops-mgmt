import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  { ignores: ['node_modules/', 'coverage/', '.git/'] },
  {
    files: ['**/*.js'],
    ignores: ['public/js/**', 'public/sw.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.commonjs,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...eslintConfigPrettier.rules,
    },
  },
  {
    files: ['tests/**'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.commonjs,
        ...globals.mocha,
        ...globals.browser,
        state: 'readonly',
        renderQA: 'readonly',
        renderUsers: 'readonly',
        renderLogin: 'readonly',
        loadQA: 'readonly',
        loadQATotalCount: 'readonly',
        toast: 'readonly',
        debounce: 'readonly',
        initChips: 'readonly',
        showQADetail: 'readonly',
        api: 'readonly',
        navigate: 'readonly',
        restoreTheme: 'readonly',
        closeModal: 'readonly',
        closeSidebar: 'readonly',
        showCreateQA: 'readonly',
        unarchiveQA: 'readonly',
        publishQA: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...eslintConfigPrettier.rules,
      'no-unused-vars': 'warn',
    },
  },
  {
    files: ['public/js/app.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...eslintConfigPrettier.rules,
      'no-empty': 'warn',
      'no-unused-vars': 'warn',
      'no-useless-assignment': 'warn',
    },
  },
  {
    files: ['public/sw.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...eslintConfigPrettier.rules,
    },
  },
];
