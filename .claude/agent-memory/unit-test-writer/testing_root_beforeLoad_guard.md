---
name: testing-root-beforeLoad-guard
description: How to unit-test a beforeLoad guard on __root.tsx (or any route) when the global vitest.setup.ts mock for @tanstack/react-router stubs out createRootRouteWithContext/redirect as no-ops
metadata:
  type: project
---

`src/vitest.setup.ts` globally mocks `@tanstack/react-router` with only
`useNavigate`, `useLocation`, `useMatches`, `createFileRoute` (returns
`(options) => ({ options })`), `lazyRouteComponent`, `Navigate`, `Outlet`,
`Link`. It does NOT export `createRootRouteWithContext` or `redirect`, so any
file that imports a route module using those (e.g. `src/routes/__root.tsx`)
will throw at import time with the default global mock in place.

**Pattern that works** (see `src/routes/-__root.test.tsx`): add a *local*
`vi.mock('@tanstack/react-router', async (importOriginal) => ({ ...(await
importOriginal()) }))` at the top of the test file. Per-file vi.mock calls
override the setupFiles-level mock for that test file only, and
`importOriginal()` pulls in the real, un-mocked module — so you get real
`createRootRouteWithContext`/`redirect` while every other test file in the
suite keeps using the lightweight global stub.

Two follow-on gotchas hit when doing this for `__root.tsx` specifically:
1. `~/lib/i18n` calls `i18n.use(initReactI18next).init(...)` at module load
   time. The global `react-i18next` mock only stubs `useTranslation`, so you
   must also locally override `react-i18next` in the same test file to add
   `initReactI18next: { type: '3rdParty', init: vi.fn() }` — otherwise import
   fails with "No initReactI18next export is defined on the mock".
2. Also mock `@convex-dev/react-query`'s `convexQuery` (e.g. `vi.fn((fn,
   args) => ({ fn, args }))`) since it's not globally mocked and the real one
   needs a live Convex client.

Once the module imports cleanly, `beforeLoad` is just a plain async function
on `(Route as any).options.beforeLoad` — call it directly with a mocked
`{ context: { queryClient: { ensureQueryData: vi.fn().mockResolvedValue(bool) } }, location: { pathname } }`
and assert with `.resolves.toBeUndefined()` / `.rejects.toMatchObject({ options: { to: '...' } })`
(the real `redirect()` throws an object shaped `{ options: { to } }`).

Note: `src/routes/__root.tsx` is excluded from the coverage `include`/config
in `vitest.config.ts`, so this test doesn't affect coverage thresholds — it's
purely a regression-safety test for the guard logic. Worth adding anyway when
a route's `beforeLoad` has real branching logic, per user request in
2026-07-06 setup-bootstrap task.

See also [[convex_useQuery_mocking]] for the general per-query-name mock
pattern used elsewhere in this repo.
