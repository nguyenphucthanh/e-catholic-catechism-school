---
name: convex-usequery-mocking
description: How this project mocks convex/react's useQuery in frontend unit tests, including the multi-query-per-component pattern.
metadata:
  type: project
---

`convex/react` is globally mocked in `src/vitest.setup.ts`:

```ts
vi.mock('convex/react', () => ({
  useMutation: vi.fn(() => vi.fn()),
  useQuery: vi.fn(),
}))
```

`useAuth` (`~/lib/auth`) is also globally mocked there, returning `{ login, logout, user: null }` by default — override per-test with `vi.mocked(useAuth).mockReturnValue(...)`.

**Single query per component**: just `vi.mocked(useQuery).mockReturnValue(...)`.

**Multiple distinct queries in one component/hook** (e.g. a provider that calls both `api.academicYears.getActive` and `api.academicYears.list`): you cannot use a single `mockReturnValue` — instead branch on the Convex function reference inside `mockImplementation`, keyed by `Symbol.for('functionName')`:

```ts
vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
  const path = queryRef?.[Symbol.for('functionName')]
  if (path === 'academicYears:getActive') return active
  if (path === 'academicYears:list') return list
  return undefined
})
```

The string is `"<module>:<exportName>"` matching the Convex API path. This pattern is established in `src/routes/_authenticated/profile.test.tsx` (3-way branch on `catechists:getMyProfile` / `getMyAddress` / `getMyContacts`) and was reused for `src/lib/academic-year.test.tsx`.

Reference files to mirror for new frontend unit tests:

- `src/components/year-switcher.test.tsx` — single-query component, also shows mocking `~/lib/academic-year`'s `useSelectedAcademicYear` hook directly via `vi.mock('~/lib/academic-year', () => ({ useSelectedAcademicYear: vi.fn() }))`.
- `src/routes/_authenticated/profile.test.tsx` — multi-query component using the `Symbol.for('functionName')` branch pattern.
- `src/lib/academic-year.test.tsx` — Context provider + hook test combining `render`+`screen`+`waitFor` for DOM-level assertions and `renderHook`+`act` for direct hook-state assertions (e.g. exercising `setSelectedYearId`).

Gotcha: when a provider has an effect that auto-corrects state based on a query result (e.g. "if no active year is selected, fall back to the active year"), calling the setter to `null` may get immediately overwritten by that effect on the next render if the mocked "active year" query still returns a value. To test the setter's null-clearing behavior in isolation, mock the active-year query to return `null`/falsy so the auto-fallback effect has nothing to apply.

No sibling test file exists for `src/lib/auth.tsx` (`AuthProvider`/`useAuth`) as of 2026-06-30 — only mocked, not tested directly. If asked to test it, there's no existing pattern to mirror for that specific file; `academic-year.test.tsx` is now the closest analogous Context-provider test to mirror instead.
