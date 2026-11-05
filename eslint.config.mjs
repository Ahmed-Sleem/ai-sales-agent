import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  globalIgnores([
    '.next/**', 'out/**', 'node_modules/**', 'coverage/**',
    'playwright-report/**', 'test-results/**', '_working_docs/**',
  ]),
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      // Existing prototype patterns are covered for cleanup in the UI rebuild; keep visible as warnings meanwhile.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
]);
