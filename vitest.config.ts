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
      'src/components/ui/**',
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
        'src/components/app-sidebar.tsx',
        'convex/myFunctions.ts',
        'convex/schema.ts',
        'convex/seed.ts',
        'convex/migrations/**',
        // Barrel, layout, and pure type files
        'src/lib/export/index.ts',
        'src/lib/export/types.ts',
        'src/routes/_authenticated/_catechist.tsx',
        'src/routes/_authenticated/_catechist/**',
        'src/routes/_authenticated/_student.tsx',
        'src/routes/help.index.tsx',
        'src/components/ui/addon-big-calendar.ts',
        'src/components/ui/addon-big-calendar/**',
        'vite.config.ts',
        'vitest.config.ts',
      ],
      thresholds: {
        statements: 75,
        branches: 75,
        functions: 75,
        lines: 75,
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
