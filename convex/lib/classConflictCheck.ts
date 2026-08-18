import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

export async function hasPrimaryClassConflict(
  ctx: QueryCtx | MutationCtx,
  studentId: Id<'students'>,
  academicYearId: Id<'academicYears'>,
  excludeId?: Id<'studentClasses'>,
): Promise<boolean> {
  const enrollments = await ctx.db
    .query('studentClasses')
    .withIndex('by_student_id_and_is_primary_class', (q) =>
      q.eq('studentId', studentId).eq('isPrimaryClass', true),
    )
    .collect()

  for (const e of enrollments) {
    if (excludeId && e._id === excludeId) continue
    if (e.isDeleted) continue
    if (e.status !== 'active' && e.status !== 'on_leave') continue
    const cy = await ctx.db.get('classYears', e.classYearId)
    if (cy && !cy.isDeleted && cy.academicYearId === academicYearId) {
      return true
    }
  }
  return false
}
