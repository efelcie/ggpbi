import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      // Allow explicit any at D3/Power BI boundaries (pragmatic)
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow unused vars prefixed with _
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Consistent returns
      'no-fallthrough': 'error',
      // No console.log in production code (warn OK)
      'no-console': ['error', { allow: ['warn', 'error'] }],
      // Allow @ts-ignore for Power BI SDK import (ts-expect-error fails in strict build)
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': 'allow-with-description' }],
    },
  },
  {
    ignores: ['dist/', 'demo/', 'node_modules/', '*.js', '!eslint.config.js'],
  },
);
