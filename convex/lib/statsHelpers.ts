import { isActiveEnrollment } from './enrollment'
import type { Doc, Id } from '../_generated/dataModel'
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
 * Deduplicated set of student ids with an active/on_leave enrollment across
 * the given classYearIds. Students are not re-read: students.softDelete
 * refuses any student with a non-withdrawn enrollment, so these never point
 * at a deleted student.
 */
export async function getStudentIdSetForClassYears(
  ctx: QueryCtx,
  classYearIds: Array<Id<'classYears'>>,
): Promise<Set<Id<'students'>>> {
  const enrollmentsByClassYear = await Promise.all(
    classYearIds.map((classYearId) =>
      ctx.db
        .query('studentClasses')
        .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYearId))
        .collect(),
    ),
  )

  const studentIds = new Set<Id<'students'>>()
  for (const enrollments of enrollmentsByClassYear) {
    for (const enrollment of enrollments) {
      if (isActiveEnrollment(enrollment)) {
        studentIds.add(enrollment.studentId)
      }
    }
  }

  return studentIds
}

/**
 * Non-deleted class catechist assignments for an academic year. Callers that
 * need per-subset counts (e.g. per branch) read this once and filter in memory.
 */
export async function getClassCatechistAssignmentsForAcademicYear(
  ctx: QueryCtx,
  academicYearId: Id<'academicYears'>,
): Promise<Array<Doc<'classCatechists'>>> {
  const assignments = await ctx.db
    .query('classCatechists')
    .withIndex('by_academic_year_id', (q) =>
      q.eq('academicYearId', academicYearId),
    )
    .collect()
  return assignments.filter((a) => !a.isDeleted)
}

/**
 * Deduplicated catechist ids from the given assignments, optionally restricted
 * to a subset of classYearIds (e.g. the classYears of a single branch).
 */
export function collectCatechistIds(
  assignments: Array<Doc<'classCatechists'>>,
  allowedClassYearIds?: Set<Id<'classYears'>>,
): Set<Id<'catechists'>> {
  const catechistIds = new Set<Id<'catechists'>>()
  for (const assignment of assignments) {
    if (allowedClassYearIds && !allowedClassYearIds.has(assignment.classYearId))
      continue
    catechistIds.add(assignment.catechistId)
  }
  return catechistIds
}

/**
 * Deduplicated set of catechist ids assigned (non-deleted) to classes for an
 * academic year, optionally restricted to a subset of classYearIds.
 */
export async function getCatechistIdSetForAcademicYear(
  ctx: QueryCtx,
  academicYearId: Id<'academicYears'>,
  allowedClassYearIds?: Set<Id<'classYears'>>,
): Promise<Set<Id<'catechists'>>> {
  return collectCatechistIds(
    await getClassCatechistAssignmentsForAcademicYear(ctx, academicYearId),
    allowedClassYearIds,
  )
}

/**
 * Percentage (0-100) rounded to `decimals` places; returns null for empty
 * (zero-denominator or non-finite) inputs so charts can render "no data" instead of a
 * misleading 0% or NaN.
 */
export function percentage(
  numerator: number,
  denominator: number,
  decimals: number,
): number | null {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return null
  }
  const factor = 10 ** decimals
  return Math.round((numerator / denominator) * 100 * factor) / factor
}
