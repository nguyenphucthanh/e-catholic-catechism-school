import { defineConfig, globalIgnores } from 'eslint/config'
import { tanstackConfig } from '@tanstack/eslint-config'
import convexPlugin from '@convex-dev/eslint-plugin'

export default defineConfig([
  ...tanstackConfig,
  ...convexPlugin.configs.recommended,
  {
    files: ['convex/**/*.test.ts', 'convex/**/*.test.tsx'],
    rules: {
      '@convex-dev/no-process-env': 'off',
    },
  },
  globalIgnores([
    'convex/_generated',
    'src/components/ui/**',
    '.venv/**',
    '.output/**',
    'public/**',
    '.design-sync/**',
    'ds-bundle/**',
  ]),
])
