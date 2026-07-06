import { v } from 'convex/values'
import { query } from './_generated/server'
import { assertBoardMemberOrAdmin } from './lib/authz'

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

    // TODO: Implement org-wide stats aggregation
    // - Count total classes in academic year
    // - Count total students enrolled across all classes
    // - Count total catechists assigned (deduplicated)

    return {
      totalClasses: 0,
      totalStudents: 0,
      totalCatechists: 0,
    }
  },
})
