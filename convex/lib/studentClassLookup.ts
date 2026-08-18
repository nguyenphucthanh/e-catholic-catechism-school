import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

export async function getStudentPrimaryClass(
  ctx: QueryCtx | MutationCtx,
  studentId: Id<'students'>,
  academicYearId: Id<'academicYears'>,
) {
  const primaryClasses = await ctx.db
    .query('studentClasses')
    .withIndex('by_student_id_and_is_primary_class', (q) =>
      q.eq('studentId', studentId).eq('isPrimaryClass', true),
    )
    .collect()

  for (const primaryClass of primaryClasses) {
    if (primaryClass.isDeleted) continue
    const classYear = await ctx.db.get('classYears', primaryClass.classYearId)
    if (!classYear || classYear.isDeleted) continue
    if (classYear.academicYearId !== academicYearId) continue
    const classRecord = await ctx.db.get('classes', classYear.classId)
    if (!classRecord || classRecord.isDeleted) continue
    return classRecord
  }
  return null
}
