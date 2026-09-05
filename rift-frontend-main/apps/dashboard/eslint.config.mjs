import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

/**
 * Lint config for the dashboard.
 *
 * It exists because `next lint` with no config does not fail — it drops into an
 * interactive "how would you like to configure ESLint?" prompt, which in CI
 * hangs or exits non-zero with nothing useful said. A lint step that has never
 * once run is worse than no lint step, because the pipeline reports a check it
 * is not performing.
 */
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
];
