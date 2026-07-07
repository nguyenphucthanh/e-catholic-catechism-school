---
name: promote-transfer-feature
description: KAN-222 promote/transfer students feature review findings — eligibility-flag/mutation-conflict mismatch, stale ts-ignore, unscoped read query
metadata:
  type: project
---

Reviewed uncommitted "promote/transfer students" feature (branch KAN-222): `convex/students.ts` `getEligibleForTransfer`, `src/routes/_authenticated/_catechist/students_.promote.tsx`, plus tests and i18n keys.

Findings (see [[convex_db_api]] for related Convex conventions):

- `getEligibleForTransfer`'s `alreadyEnrolledInTargetYear` flag checks ANY active/on_leave enrollment in the target academic year, but the real conflict enforced by `enrollStudentsInternal`/`hasPrimaryClassConflict` (students.ts) is primary-only. Since the promote page always submits `isPrimaryClass: true`, this over-broad flag disables valid transfers for students who only hold a non-primary enrollment in the target year. Whenever a new "eligibility preview" query is added to predict a mutation's conflict error, verify the query's predicate exactly mirrors the mutation's actual conflict-check predicate (not just "same academic year").
- Codebase has an established pattern of leaving `// @ts-ignore - Route not yet generated` comments on `navigate({ to: ... })` / `<Link to=...>` calls for routes that don't exist in `src/routeTree.gen.ts` yet. When reviewing new nav code, check whether the corresponding route actually landed in `routeTree.gen.ts` in the same diff — if so, the ts-ignore is stale and should be removed (verified via `tsc --noEmit` after deleting the line in a scratch copy).
- `getEligibleForEnrollment` (students.ts:1176) and now `getEligibleForTransfer` both authorize with plain `assertValidCatechist` (any valid catechist, no branch/class scoping) even though they return roster PII (fullName, studentCode, gender) for an arbitrary class/year. The sibling *mutation* `enrollStudents` scopes non-admins via `assertEnrollmentPermission` (checks `academicYearAssignments`). This is a recurring gap: read-side "eligibility" queries in this codebase are unscoped while the write-side mutations they feed are scoped. Worth flagging each time a new eligibility/roster-preview query is added, since it's an established but unresolved pattern (accepted convention or unaddressed gap — unclear which).
