import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

/**
 * Active (non-deleted) classYears for an academic year, joined with their
 * parent class so callers get branchId without a second round trip per row.
 * Excludes classYears whose parent class has been soft-deleted.
 */
export async function getActiveClassYearsForAcademicYear(
  ctx: QueryCtx,
  academicYearId: Id<'academicYears'>,
): Promise<
  Array<{
    classYearId: Id<'classYears'>
    classId: Id<'classes'>
    branchId: Id<'branches'>
  }>
> {
  const classYears = await ctx.db
    .query('classYears')
    .withIndex('by_academic_year_id', (q) =>
      q.eq('academicYearId', academicYearId),
    )
    .collect()

  const activeClassYears = classYears.filter((cy) => !cy.isDeleted)

  const rows = await Promise.all(
    activeClassYears.map(async (cy) => {
      const classDoc = await ctx.db.get('classes', cy.classId)
      if (!classDoc || classDoc.isDeleted) return null
      return {
        classYearId: cy._id,
        classId: cy.classId,
        branchId: classDoc.branchId,
      }
    }),
  )

  return rows.filter((row): row is NonNullable<typeof row> => row !== null)
}

/**
 * Deduplicated set of student ids enrolled (non-deleted) across the given
 * classYearIds.
 */
export async function getStudentIdSetForClassYears(
  ctx: QueryCtx,
  classYearIds: Array<Id<'classYears'>>,
): Promise<Set<Id<'students'>>> {
  const studentIds = new Set<Id<'students'>>()

  const enrollmentsByClassYear = await Promise.all(
    classYearIds.map((classYearId) =>
      ctx.db
        .query('studentClasses')
        .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYearId))
        .collect(),
    ),
  )

  for (const enrollments of enrollmentsByClassYear) {
    for (const enrollment of enrollments) {
      if (!enrollment.isDeleted) studentIds.add(enrollment.studentId)
    }
  }

  return studentIds
}

/**
 * Deduplicated set of catechist ids assigned (non-deleted) to classes for an
 * academic year, optionally restricted to a subset of classYearIds (e.g. the
 * classYears belonging to a single branch).
 */
export async function getCatechistIdSetForAcademicYear(
  ctx: QueryCtx,
  academicYearId: Id<'academicYears'>,
  allowedClassYearIds?: Set<Id<'classYears'>>,
): Promise<Set<Id<'catechists'>>> {
  const assignments = await ctx.db
    .query('classCatechists')
    .withIndex('by_academic_year_id', (q) =>
      q.eq('academicYearId', academicYearId),
    )
    .collect()

  const catechistIds = new Set<Id<'catechists'>>()
  for (const assignment of assignments) {
    if (assignment.isDeleted) continue
    if (allowedClassYearIds && !allowedClassYearIds.has(assignment.classYearId))
      continue
    catechistIds.add(assignment.catechistId)
  }

  return catechistIds
}
