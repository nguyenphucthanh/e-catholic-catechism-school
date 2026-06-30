import { defineConfig } from 'vitest/config'
import tsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.venv/**',
      '**/.output/**',
      '**/.git/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}', 'convex/**/*.ts'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/.venv/**',
        '**/.output/**',
        '**/convex/_generated/**',
        // Shadcn-generated UI component wrappers — thin @base-ui/react adapters with no business logic
        'src/components/ui/**',
        // Demo/example files and boilerplate / scaffolding / generated files
        'src/components/custom/data-table-demo.tsx',
        'src/routeTree.gen.ts',
        'src/vitest.setup.ts',
        'src/lib/breadcrumbs.ts',
        'src/router.tsx',
        'src/routes/__root.tsx',
        'src/routes/anotherPage.tsx',
        'src/routes/index.tsx',
        'src/components/app-sidebar.tsx',
        'convex/myFunctions.ts',
        'convex/schema.ts',
        'convex/seed.ts',
        'vite.config.ts',
        'vitest.config.ts',
      ],
      thresholds: {
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85,
      },
    },
    projects: [
      {
        plugins: [
          tsConfigPaths({
            projects: ['./tsconfig.json'],
          }),
        ],
        test: {
          name: 'frontend',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./src/vitest.setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
        },
      },
      {
        test: {
          name: 'backend',
          environment: 'edge-runtime',
          globals: true,
          include: ['convex/**/*.test.ts'],
          // bcrypt password hashing in convex/lib/password.ts is CPU-bound and
          // can exceed the default 5s timeout under edge-runtime, especially
          // when multiple hash calls happen in a single test (login + changePassword).
          testTimeout: 15000,
        },
      },
    ],
  },
})
