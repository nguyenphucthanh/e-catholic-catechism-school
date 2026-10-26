import { v } from 'convex/values'
import { query } from './_generated/server'
import { assertBoardMemberOrAdmin, requireCatechistId } from './lib/authz'
import { ACADEMIC_YEAR_ERRORS } from './lib/errors'
import {
  getActiveClassYearsForAcademicYear,
  getCatechistIdSetForAcademicYear,
  getStudentIdSetForClassYears,
} from './lib/statsHelpers'

export const getOrgStats = query({
  args: {
    academicYearId: v.id('academicYears'),
  },
  async handler(ctx, { academicYearId }) {
    const requesterId = await requireCatechistId(ctx)
    await assertBoardMemberOrAdmin(ctx, requesterId, academicYearId)

    const academicYear = await ctx.db.get('academicYears', academicYearId)
    if (!academicYear || academicYear.isDeleted) {
      throw new Error(ACADEMIC_YEAR_ERRORS.NOT_FOUND)
    }

    const activeClassYears = await getActiveClassYearsForAcademicYear(
      ctx,
      academicYearId,
    )
    const classYearIds = activeClassYears.map((cy) => cy.classYearId)

    const [studentIds, catechistIds] = await Promise.all([
      getStudentIdSetForClassYears(ctx, classYearIds),
      getCatechistIdSetForAcademicYear(
        ctx,
        academicYearId,
        new Set(classYearIds),
      ),
    ])

    return {
      totalClasses: activeClassYears.length,
      totalStudents: studentIds.size,
      totalCatechists: catechistIds.size,
    }
  },
})
