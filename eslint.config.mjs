import { defineConfig } from '@vben/eslint-config';

export default defineConfig([
  {
    ignores: ['**/pnpm-workspace.yaml', 'packages/**', 'internal/**'],
  },
  {
    rules: {
      'pnpm/yaml-no-unused-catalog-item': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-quotes': 'off',
      'unicorn/no-nested-ternary': 'off',
    },
  },
]);
