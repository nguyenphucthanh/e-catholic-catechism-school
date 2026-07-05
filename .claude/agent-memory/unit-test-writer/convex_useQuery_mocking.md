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

**The same `Symbol.for('functionName')` branch pattern works for `useMutation`,
not just `useQuery`.** When a component calls `useMutation` more than once
(one call per distinct mutation), a single `mockReturnValue` makes every call
return the same spy. Branch on the resolved path instead, e.g. in
`src/components/custom/attendance-grid-board.test.tsx` (component calls
`useMutation` for `attendance.saveGridAttendance`, `classSessions.update`,
`classSessions.softDelete`, `attendance.bulkSaveGridAttendance`):

```ts
let saveAttendanceMock: ReturnType<typeof vi.fn>
// ...one `let` per mutation, reassigned fresh in beforeEach...
vi.mocked(useMutation).mockImplementation(((fnRef: any) => {
  const path = fnRef?.[Symbol.for('functionName')]
  if (path === 'attendance:saveGridAttendance') return saveAttendanceMock
  if (path === 'classSessions:update') return updateSessionMock
  if (path === 'classSessions:softDelete') return deleteSessionMock
  if (path === 'attendance:bulkSaveGridAttendance') return bulkSaveMock
  return vi.fn().mockResolvedValue(undefined)
}) as any)
```

No need to import the real `api` object for `===` reference-equality checks —
`convex/server`'s `anyApi` Proxy (used by the unmocked `convex/_generated/api`
module) computes `functionReference[Symbol.for('functionName')]` on the fly as
`"<moduleFile>:<exportName>"` (see
`node_modules/convex/dist/esm/server/api.js`'s `createApi` handler), so the
string-branch approach above works without any extra import. Verified working
end to end (tests + `tsc --noEmit` + eslint clean) as of 2026-07-03.

**When a component conditionally passes `'skip'` as the args argument** (e.g.
`useQuery(api.grading.listAnnualResults, requesterId ? {...} : 'skip')`, seen
in `evaluations-board.tsx`), a mock keyed only on the query path (ignoring the
second `args` param) can't exercise that branch correctly — it'll keep
returning fixture data even when the component *thinks* it skipped the query,
making a "stays in loading state when the query is skipped" test falsely pass
or fail depending on what you assert. Make the mock args-aware for that one
query: `if (path === 'grading:listAnnualResults') return args === 'skip' ?
undefined : annualResults`. See
`src/components/custom/evaluations-board.test.tsx`'s `mockQueries()` helper
and its "requesterId skip behavior" test.

**When a component has only ONE `useQuery` call that conditionally passes
`'skip'`** (e.g. `my-classes-widget.tsx`'s
`useQuery(api.classes.listMyClasses, academicYearId ? {...} : 'skip')`), skip
the `Symbol.for('functionName')` branch entirely — just assert the mock was
called with `'skip'` as the second argument directly:
`expect(useQuery).toHaveBeenCalledWith(expect.anything(), 'skip')`, while
`vi.mocked(useQuery).mockReturnValue(undefined)` covers what the component
sees. Confirmed working in `src/components/custom/my-classes-widget.test.tsx`
as of 2026-07-05, and reused identically in
`src/components/custom/today-this-week-widget.test.tsx` the same day (that
component also needs fake timers for its internal `new Date()`-derived
`today`/week-range — see [[date-mocking-fake-timers]]).

**Mocking `Link` from `@tanstack/react-router` to assert `params`/`search`
props** (not just `href`): `Link` is globally mocked in `src/vitest.setup.ts`
as `({ to, children, ...props }) => <a href={to} {...props}>{children}</a>` —
spreading object-valued props like `params`/`search` onto a real `<a>` does
NOT render them as inspectable DOM attributes (React drops non-string/number
values with a dev warning). To assert on `params`/`search` (e.g. distinguish
two `Link`s to the same route where one has an extra `search` param), override
the mock locally in the test file:
```ts
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    Link: ({ children, to, params, search, className }: any) => (
      <a
        href={to}
        data-params={JSON.stringify(params)}
        data-search={JSON.stringify(search)}
        className={className}
      >
        {children}
      </a>
    ),
  }
})
```
This pattern originates in
`src/routes/_authenticated/_catechist/-classes_.$id.test.tsx` and was reused
in `src/components/custom/my-classes-widget.test.tsx`. Note `JSON.stringify(undefined)`
returns `undefined` (not the string `"undefined"`), so a `Link` with no
`search` prop renders with `data-search` attribute entirely absent — assert
`.not.toHaveAttribute('data-search')` on it rather than expecting the literal
string `'undefined'`.
