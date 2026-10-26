import type { Doc } from '../_generated/dataModel'

// Enrolled = not soft-deleted and not withdrawn (active or on_leave).
// Deny-list on purpose: a future status counts as active unless it is excluded here.
export function isActiveEnrollment(
  sc: Pick<Doc<'studentClasses'>, 'isDeleted' | 'status'>,
) {
  return !sc.isDeleted && sc.status !== 'withdrawn'
}
