---
name: no_dirty_tracking_resave_bug
description: EvaluationsBoard's local edit-buffer pattern (and its sem1/sem2 predecessor) has no dirty-row tracking, so handleSaveAll resends every ever-loaded row, and the load-merge effect permanently shadows fresh server data for any key already seen — a lost-update risk across concurrent catechists
metadata:
  type: project
---

`src/components/custom/evaluations-board.tsx` buffers server-loaded
`semesterResults`/`annualResults` into local `useState` (`semesterState`,
`annualState`) so users can edit multiple cells before one batched "Save
All". Two compounding issues, confirmed by reading the code directly (not
just inferred) — both predate the 2026-07 refactor from hardcoded
sem1/sem2 to arbitrary N semesters (verified via `git diff`), just scaled
up to more semesters:

1. **Merge effect permanently shadows fresh data.** The
   `useEffect(() => { ... }, [semesterResults])` that hydrates local state
   does `merged[semesterId] = { ...state[semesterId] /* fresh */, ...rows
   /* prev, spread last so it wins */ }` for every semesterId already in
   `prev`. Since the very first successful load seeds `prev` with an entry
   for every row the query returned, every subsequent reactive update from
   Convex (e.g. another catechist's edit) is silently discarded for any
   row this client has ever seen — the local cache freezes at first-load
   value (or this client's own last edit) and never re-syncs. Same pattern
   in the flat `annualState` effin annualResults effect.
2. **`handleSaveAll` has no dirty-flag tracking.** It iterates
   `Object.entries(semesterState[semester._id] ?? {})` /
   `Object.entries(annualState)` — i.e. every row ever loaded into local
   state, not just ones the user actually touched — and calls
   `saveSemesterResult`/`saveAnnualResult` for all of them, every click.

Combined effect: once a row is loaded once, this client's (possibly
stale) cached copy of it gets **resent to the server on every Save Al
click**, silently overwriting any newer value another catechist wrote in
the meantime, without this user ever seeing the newer value or intending
to touch that field. Not a hypothetical — confirmed by reading
`handleSaveAll` and the merge effect together, and by the fact that the
component's own test suite (`evaluations-board.test.tsx`, "saves one
semesterResult per edited (semester, student) pair") only exercises this
with `semesterResults: []` (no pre-loaded rows), so it never hits the
resave-everything path.

**Why:** No `isDirty`/edited-keys tracking exists anywhere in the
component; the buffering model conflates "known locally" with "changed by
the user."

**How to apply:** When reviewing any component with this
load-into-local-state-then-batch-save shape (grep for
`useEffect.*setXState.*prev` merge patterns, common in this codebase's
grading/attendance grid boards), check whether saves are scoped to an
explicit dirty-set and whether the load-merge effect ever lets fresh
server data override a previously-seen key. Recommend: track edited keys
in a separate `Set`/`Record<key, true>` populated only by the `onChange`
handlers, use it to (a) scope `handleSaveAll` to only dirty rows, and (b)
let the merge effect only preserve `prev` for dirty keys, so fresh data
wins for everything else. See also [[global_year_switcher_stale_state]]
for a related-but-distinct local-state-goes-stale risk in the same
component family (that one is about not resetting on scoped-id prop
changes; this one is about the merge direction within a single mount).
