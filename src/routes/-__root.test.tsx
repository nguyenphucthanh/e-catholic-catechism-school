import { describe, expect, test, vi } from 'vitest'

import { Route } from './__root'

// Override the global @tanstack/react-router mock for this file only: we need
// real `createRootRouteWithContext` (to get a real Route.options object) and a
// real `redirect` (to assert on the thrown redirect shape) while keeping the
// rest of the real module intact. The project-wide mock in vitest.setup.ts
// stubs these to no-ops, which would make `beforeLoad` impossible to exercise.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
  }
})

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: vi.fn((fn: unknown, args: unknown) => ({ fn, args })),
}))

// `~/lib/i18n` calls `i18n.use(initReactI18next).init(...)` at module load
// time. The global react-i18next mock in vitest.setup.ts only stubs
// `useTranslation`, so importing `__root.tsx` (which imports `~/lib/i18n`)
// needs `initReactI18next` too.
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({ t: (key: string) => key })),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

describe('__root beforeLoad guard', () => {
  test('no admin + pathname is /setup -> does not redirect', async () => {
    const ctx = {
      queryClient: { ensureQueryData: vi.fn().mockResolvedValue(false) },
    }

    await expect(
      (Route as any).options.beforeLoad({
        context: ctx,
        location: { pathname: '/setup' },
      }),
    ).resolves.toBeUndefined()
  })

  test('no admin + pathname other than /setup -> throws redirect to /setup', async () => {
    const ctx = {
      queryClient: { ensureQueryData: vi.fn().mockResolvedValue(false) },
    }

    await expect(
      (Route as any).options.beforeLoad({
        context: ctx,
        location: { pathname: '/dashboard' },
      }),
    ).rejects.toMatchObject({ options: { to: '/setup' } })
  })

  test('admin exists + pathname is /setup -> throws redirect to /login', async () => {
    const ctx = {
      queryClient: { ensureQueryData: vi.fn().mockResolvedValue(true) },
    }

    await expect(
      (Route as any).options.beforeLoad({
        context: ctx,
        location: { pathname: '/setup' },
      }),
    ).rejects.toMatchObject({ options: { to: '/login' } })
  })

  test('admin exists + pathname other than /setup -> does not redirect', async () => {
    const ctx = {
      queryClient: { ensureQueryData: vi.fn().mockResolvedValue(true) },
    }

    await expect(
      (Route as any).options.beforeLoad({
        context: ctx,
        location: { pathname: '/dashboard' },
      }),
    ).resolves.toBeUndefined()
  })
})
