import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  { ignores: ['node_modules/', 'coverage/', '.git/'] },
  {
    files: ['**/*.js'],
    ignores: ['public/js/**'],
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
];
