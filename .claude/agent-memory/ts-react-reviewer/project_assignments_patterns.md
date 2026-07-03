---
name: project-assignments-patterns
description: Patterns and anti-patterns found in the assignments view/edit pages reviewed on 2026-07-02
metadata:
  type: project
---

Assignments pages reviewed: `src/routes/_authenticated/assignments.tsx` (view) and `src/routes/_authenticated/assignments_.edit.tsx` (edit).

**Key findings:**

- `AuthUser.userDocId` is typed as `string`, not `Id<'catechists'>` — cast with `as Id<'catechists'>` is used in both pages without a runtime guard, making it unsafe.
- `isBoardMember` in `src/lib/permissions.ts` is a stub that simply delegates to `isAdmin` — the `selectedYearId` arg is ignored. Client-side edit guard therefore only allows admins, not board members.
- `Select` wrapper (`src/components/ui/select.tsx`) does NOT accept or consume an `items` prop — passing `items={[...]}` to `<Select>` in the edit page silently does nothing; `SelectContent` / `SelectItem` children are what drive the dropdown.
- `Combobox` (`src/components/ui/combobox.tsx`) also does NOT consume an `items` prop; it is `ComboboxPrimitive.Root` directly. Passing `items={catechistOptions}` has no effect at runtime.
- Discard-confirmation dialog in edit page is wired up with state (`discardDialog`, `pendingRoute`) but is never triggered — there is no router blocker / `useBlocker` call. The dialog is dead UI.
- `coTeacherOptions` is recomputed inline in JSX twice per class row (once for `items={}`, once in `ComboboxContent` children) — the first call has no effect (dead `items` prop).
- `err: any` typed catch clauses appear in all three save handlers.
- Save button label for board and branch tabs incorrectly uses `t('assignments.class.save')` instead of a board/branch-specific key.
- `useMutation` import is present but unused in both pages (only `useQuery` is used in assignments.tsx; mutations in edit page come from individual `useMutation` calls).

**Why:** use these findings to flag similar patterns in future reviews of this codebase quickly.
**How to apply:** When reviewing any page that uses Select/Combobox from this ui/ layer, verify children-driven items, not `items` prop. Always check `isBoardMember` stub before assuming client-side role guards work.

**Correction (2026-07-03):** the blanket claim above that `<Select>`'s `items`
prop "does nothing" is wrong as a general statement — see
[[baseui_select_items_prop]]. It's a real, consumed `Select.Root` prop that
drives `<Select.Value>`'s label lookup when `SelectValue` has no children.
Whatever was observed in `assignments_.edit.tsx` was likely specific to that
file (e.g. children on `SelectValue` overriding it) — verify per-instance,
don't cite this note as proof `items` is inert.
