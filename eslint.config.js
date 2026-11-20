import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'android', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    // Core must stay DOM-free so it is unit-testable and can simulate offline progress.
    files: ['src/core/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'navigator'],
      'no-restricted-imports': ['error', { patterns: ['**/platform', '**/platform/*', '**/ui/*'] }],
    },
  },
  {
    // Only src/platform may touch Capacitor, so native code paths live in one place.
    files: ['src/**/*.ts'],
    ignores: ['src/platform/**', 'src/core/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['@capacitor/*'] }],
    },
  },
);
