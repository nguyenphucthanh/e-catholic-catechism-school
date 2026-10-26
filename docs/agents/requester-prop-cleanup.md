# Task: remove client-side `requesterId` prop-drilling

Frontend-only cleanup. No behaviour change, no security change.

## Background

The server no longer trusts a client-supplied requester. Every Convex function derives the caller from the session JWT (`requireCatechistId` / `requireStudentId` / `requireRequester` in `convex/lib/authz.ts`), and no public function accepts `requesterId`, `studentRequesterId` or `requester` args. Sending one fails Convex argument validation.

The UI still carries the current user's id through props and locals named `requesterId` / `requester`. None of it reaches the server any more; it survives only as a **gate** or as **data**. This task removes the drilling so each component that needs the current user reads it itself.

## Vocabulary

Classify every `requesterId` / `requester` use with exactly one of these:

- **gate** — only decides _whether_ a query/hook runs: `requesterId ? {…} : 'skip'`, `if (!requesterId) return`, `requesterId && selectedYearId ? … : 'skip'`.
- **data** — the value feeds real UI logic: ownership (`program.createdBy === requesterId`), "is this me" (`catechistId === requesterId`), choosing the catechist vs student view (`requester.accountType === 'catechist'`).
- **dead** — read nowhere.
- **drilled prop** — a `requesterId={…}` / `requester={…}` JSX attribute plus the matching props-type field.

## Rules

- **Gate inside `/_authenticated`** — delete the requester term. `AuthProvider` (`src/lib/auth.tsx`) renders nothing until the server confirms the session, and the `_authenticated` layout redirects when there is no user, so the user always exists there. Keep every other condition: `requesterId && selectedYearId ? { … } : 'skip'` becomes `selectedYearId ? { … } : 'skip'`. `requesterId ? {} : 'skip'` becomes `{}`.
- **Gate outside `/_authenticated`** — keep the gate, sourced from `useAuth().user` inside the component. Known cases: `src/routes/classes.$id.photobooth.tsx`, and `AcademicYearProvider` in `src/lib/academic-year.tsx` (mounted in `__root`, so it also renders on `/login`).
- **Data** — keep the logic; read the user locally with `useAuth()` (`user.userDocId`, `user.accountType`, cast with `as Id<'catechists'>` / `Id<'students'>` like existing code) or `useRequester()` from `src/lib/requester.ts`.
- **Dead** — delete.
- **Drilled prop** — remove the attribute from every caller and the field from the props type. The child switches to a local `useAuth()` / `useRequester()` read only if it still has a **gate outside `/_authenticated`** or **data** use.
- Hooks taking the id as a parameter (`useAttendanceSync`, `useEnrollProgram`) follow the same rules: drop the parameter when it is only a gate inside `/_authenticated`. `useAttendanceSync` builds its replay payload field by field, so the offline queue never contains a requester — no migration needed.
- `src/lib/requester.ts`: delete `toRequester` / `useRequester` (and their test) if nothing uses them at the end; otherwise keep.

Out of scope: anything under `convex/`, and `src/components/ui/*` (shadcn-generated, never edited).

## Steps

1. **Inventory.** Run:
   ```sh
   grep -rnE "\b(requesterId|studentRequesterId|requester)\b" src --include='*.ts' --include='*.tsx' | grep -v '\.test\.' | grep -v '/-'
   ```
   Classify every hit (gate in/outside `/_authenticated`, data, dead, drilled prop). Done when every hit has a class.
2. **Edit leaf components first, then their callers**, so each drilled prop disappears in one pass. Work one component tree at a time and run `npx tsc --noEmit` after each — a removed prop that a caller still passes shows up as a `TS2322` on the caller; a field still read shows up as `TS2304`/`TS2339`. Done when `npx tsc --noEmit` reports 0 errors.
3. **Tests.** Per `CLAUDE.md`, test changes go through the `unit-test-writer` agent. Typical updates: drop `requesterId` props from renders; components that now call `useAuth()` need `vi.mocked(useAuth).mockReturnValue({ user: … })` (`src/vitest.setup.ts` mocks `~/lib/auth` globally; fixtures need `sessionId` and `sessionSecret`). Done when `npx vitest run` is fully green and every touched file clears 75% coverage (`npx vitest run <files> --coverage --coverage.include=<file>`).
4. **Lint and format** every changed file: `npx eslint --fix <files>` then `npx prettier --write <files>`. Done when both are clean.
5. **Final inventory.** Re-run the step-1 grep. Done when every remaining hit is a gate outside `/_authenticated` or a data use read locally, and none is a drilled prop.

## Report

Finish with a table of every file from the step-1 inventory: path, class, action taken (removed / gate dropped / now reads `useAuth()` / kept with reason). Then the final `tsc`, `vitest` and `eslint` results.
