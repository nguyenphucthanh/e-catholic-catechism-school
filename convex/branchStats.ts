import { v } from 'convex/values'
import { query } from './_generated/server'
import { getEffectivePermissions } from './lib/authz'

export const getBranchStats = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
  },
  async handler(ctx, { requesterId, academicYearId }) {
    const perms = await getEffectivePermissions(
      ctx,
      requesterId,
      academicYearId,
    )

    if (
      !perms.isAdmin &&
      !perms.isBoardMember &&
      perms.branchHeadOf.length === 0
    ) {
      return []
    }

    const branchIds =
      perms.isAdmin || perms.isBoardMember
        ? await ctx.db
            .query('branches')
            .collect()
            .then((branches) =>
              branches.filter((b) => !b.isDeleted).map((b) => b._id),
            )
        : perms.branchHeadOf

    // TODO: Implement per-branch stats
    // For each branch, count:
    // - Classes in that branch for this academic year
    // - Students enrolled in those classes
    // - Catechists assigned to those classes

    return branchIds.map((branchId) => ({
      branchId,
      branchName: 'Branch Name (TODO)',
      classCount: 0,
      studentCount: 0,
      catechistCount: 0,
    }))
  },
})
