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
        },
      },
    ],
  },
})
