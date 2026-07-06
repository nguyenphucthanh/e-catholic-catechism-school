import { v } from 'convex/values'
import { query } from './_generated/server'
import { assertBoardMemberOrAdmin } from './lib/authz'
import {
  getActiveClassYearsForAcademicYear,
  getCatechistIdSetForAcademicYear,
  getStudentIdSetForClassYears,
} from './lib/statsHelpers'

export const getOrgStats = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
  },
  async handler(ctx, { requesterId, academicYearId }) {
    await assertBoardMemberOrAdmin(ctx, requesterId, academicYearId)

    const academicYear = await ctx.db.get('academicYears', academicYearId)
    if (!academicYear || academicYear.isDeleted) {
      throw new Error('Academic year not found')
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
