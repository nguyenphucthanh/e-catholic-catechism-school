import { v } from 'convex/values'
import { query } from './_generated/server'
import { getEffectivePermissions } from './lib/authz'
import {
  getActiveClassYearsForAcademicYear,
  getCatechistIdSetForAcademicYear,
  getStudentIdSetForClassYears,
} from './lib/statsHelpers'
import type { Id } from './_generated/dataModel'

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

    const accessibleBranchIds = new Set(branchIds)

    const activeClassYears = await getActiveClassYearsForAcademicYear(
      ctx,
      academicYearId,
    )

    const classYearIdsByBranch = new Map<
      Id<'branches'>,
      Array<Id<'classYears'>>
    >()
    for (const cy of activeClassYears) {
      if (!accessibleBranchIds.has(cy.branchId)) continue
      const existing = classYearIdsByBranch.get(cy.branchId)
      if (existing) {
        existing.push(cy.classYearId)
      } else {
        classYearIdsByBranch.set(cy.branchId, [cy.classYearId])
      }
    }

    const stats = await Promise.all(
      branchIds.map(async (branchId) => {
        const branch = await ctx.db.get('branches', branchId)
        const classYearIds = classYearIdsByBranch.get(branchId) ?? []

        const [studentIds, catechistIds] = await Promise.all([
          getStudentIdSetForClassYears(ctx, classYearIds),
          getCatechistIdSetForAcademicYear(
            ctx,
            academicYearId,
            new Set(classYearIds),
          ),
        ])

        return {
          branchId,
          branchName: branch?.name ?? 'Unknown branch',
          classCount: classYearIds.length,
          studentCount: studentIds.size,
          catechistCount: catechistIds.size,
        }
      }),
    )

    return stats
  },
})
