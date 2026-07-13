---
name: csv-export-testing-pattern
description: How to unit-test the "Xuất CSV" export buttons/handlers added to board components (score-grid-board, evaluations-board, attendance-grid-board, attendance-summary-report), including the import/order eslint gotcha it triggers.
metadata:
  type: project
---

All four board components (`src/components/custom/score-grid-board.tsx`,
`evaluations-board.tsx`, `attendance-grid-board.tsx`,
`attendance-summary-report.tsx`) build `exportHeaders`/`exportRows` and call
`exportCsv(exportRows, '<file>.csv', exportHeaders)` from `~/lib/export`
(real implementation lives in `src/lib/export/{index,csv,blob,pdf,types}.ts`,
built on `papaparse`) when the "Xuất CSV" button (`t('classes.export.csv')`)
is clicked.

**Test pattern**: mock the whole module rather than spying on the real
export pipeline (which would touch a real `Blob`/anchor-click download):

```ts
vi.mock('~/lib/export', () => ({ exportCsv: vi.fn() }))
```

then in each test: `fireEvent.click(screen.getByText('classes.export.csv'))`,
`expect(exportCsv).toHaveBeenCalledTimes(1)`, and destructure
`const [rows, filename, headers] = vi.mocked(exportCsv).mock.calls[0]` to
assert filename, header array, and spot-checked row values/keys (row objects
are keyed by the *header string*, e.g. `rows[0]['exams.grid.studentName']`,
since `row[exportHeaders[i]] = value` — remember `t()` is globally mocked to
return the raw key, so headers built from `t('some.key')` literally equal
`'some.key'` in assertions, not a human string).

**To verify the name-sort behavior specifically**: declare the fixture's
`students` array in the *opposite* of alphabetical order (e.g. student B
before student A) and assert `rows[0]` is the alphabetically-first student
regardless of declaration order — this actually exercises the
`[...list].sort(...)` call rather than coincidentally matching an
already-sorted fixture. All four export tests use this trick.

**`score-grid-board.tsx` had no prior test file at all** as of 2026-07-06 —
created `score-grid-board.test.tsx` from scratch but scoped strictly to the
CSV-export describe block per the task ("not full component re-tests"), so
its own coverage sits around 43%/32%/36%/45% (stmts/branch/func/lines) —
well below the project's 75% CLAUDE.md threshold. This is an intentional,
task-scoped gap, not an oversight; a future task that asks for *full*
coverage on this file will need substantially more tests (loading state,
popover interactions, column CRUD, cell save flow, etc.), mirroring
`attendance-grid-board.test.tsx`'s structure.

**Eslint `import/order` gotcha**: adding `import { exportCsv } from
'~/lib/export'` after an existing `import type { Id } from
'../../../convex/_generated/dataModel'` line trips `import/order` ("type
import should occur before import of '~/lib/export'") — the rule wants the
relative-path type import ordered before the `~/`-aliased value import.
`npx eslint --fix` on the test file resolves it by reordering; just run fix
rather than manually guessing the required order when adding a new `~/`
import next to an existing relative `../../../convex/...` import in these
test files.

See [[convex_useQuery_mocking]] for the `useQuery`/`useMutation` mock
scaffolding these export tests are layered on top of, and
[[baseui_interaction_gotchas]] for the `t()`-returns-raw-key behavior these
header/row assertions rely on.

**A second, backend-query-driven export pattern exists** (distinct from the
board-component pattern above): `convex/catechists.ts`'s `exportList` and
`convex/students.ts`'s `exportList` (added 2026-07-13, mirroring catechists'
exactly) are real Convex `query`s — not client-side aggregation — called via
`useConvex().query(...)` from a page component's `handleExport`, not
`useQuery`. Test this shape as two independent layers:

- **Backend** (`convex/students.test.ts`, `describe('exportList query', ...)`):
  standard [[convex_backend_test_pattern]] `convexTest` tests. Key behavior to
  assert: the query computes the TRUE active academic year server-side (via
  its own `getActiveAcademicYearId` helper) and checks board-member/admin
  permission against *that*, ignoring a client-supplied `academicYearId` for
  the auth check (that arg only narrows filters). Prove the trust boundary
  holds with a test where the requester passes a spoofed `academicYearId` from
  a year they WERE board member of in the past (now `isActive: false`) — must
  still reject with the `*_EXPORT_UNAUTHORIZED` error code.
- **Frontend** (`-students.test.tsx`, `describe('StudentsPage export CSV', ...)`,
  mirrors `-catechists.test.tsx`'s block exactly): mock `useConvex` (global
  mock in `src/vitest.setup.ts` is `useConvex: vi.fn(() => ({ query: vi.fn() }))`
  as of 2026-07-13) per-test via
  `vi.mocked(useConvex).mockReturnValue({ query: mockConvexQuery } as any)`,
  and separately mock `~/lib/export`'s `exportCsv` as above. `canExport` in
  these page components is driven by two extra `useQuery` calls
  (`academicYears:getActive` then `catechistPermissions:getPermissions`
  keyed off it) — extend the file's existing `setupQueries` helper to accept
  a `permissions` param and branch on those two paths via
  `Symbol.for('functionName')` (see [[convex_useQuery_mocking]]). Assert the
  export button's visibility for admin/board-member/plain-catechist, that
  clicking it calls `convex.query(api.students.exportList, {...currentFilterState})`
  with the exact filter args the page currently holds (including
  `academicYearId: selectedYearId`, distinct from the backend's internal
  active-year check), and that a rejected promise shows
  `toast.error(t('<domain>.export.unauthorized'))` via `sonner`'s mocked
  `toast` instead of throwing.
