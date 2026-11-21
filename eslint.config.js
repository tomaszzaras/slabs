import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['netlify/functions/**', '.vercel/**', '**/dist/**', '**/node_modules/**', 'fixtures/**', 'docs/**', 'packages/web/e2e/**', 'scripts/**', '.claude/**', '.impeccable/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
