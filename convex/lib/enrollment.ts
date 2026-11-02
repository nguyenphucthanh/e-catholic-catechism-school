import { getActiveAcademicYear } from './authz'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

// Enrolled = not soft-deleted and not withdrawn (active or on_leave).
// Deny-list on purpose: a future status counts as active unless it is excluded here.
export function isActiveEnrollment(
  sc: Pick<Doc<'studentClasses'>, 'isDeleted' | 'status'>,
) {
  return !sc.isDeleted && sc.status !== 'withdrawn'
}

// Keeps students.hasActiveClass equal to "has an enrolled class in the active
// academic year". Call after any enrollment write for the student. Pass
// `activeYearId` (null = no active year) when syncing many students to skip
// the per-call year lookup.
export async function syncHasActiveClass(
  ctx: MutationCtx,
  studentId: Id<'students'>,
  activeYearId?: Id<'academicYears'> | null,
) {
  const yearId =
    activeYearId === undefined ? await getActiveAcademicYear(ctx) : activeYearId

  let has = false
  if (yearId) {
    const enrollments = await ctx.db
      .query('studentClasses')
      .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
      .collect()
    for (const sc of enrollments.filter(isActiveEnrollment)) {
      const classYear = await ctx.db.get('classYears', sc.classYearId)
      if (
        classYear &&
        !classYear.isDeleted &&
        classYear.academicYearId === yearId
      ) {
        has = true
        break
      }
    }
  }

  const student = await ctx.db.get('students', studentId)
  if (student && student.hasActiveClass !== has) {
    await ctx.db.patch('students', studentId, { hasActiveClass: has })
  }
}
