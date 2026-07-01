import { internalMutation } from '../_generated/server'

export const backfillAssignments = internalMutation({
  args: {},
  handler: async (ctx) => {
    // 1. Board members -> academicYearAssignments
    const allActiveCatechists = await ctx.db
      .query('catechists')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()

    const boardCatechists = allActiveCatechists.filter(
      (c) => (c.role as string) === 'board',
    )

    const activeYears = await ctx.db
      .query('academicYears')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect()

    if (activeYears.length > 0) {
      const activeYear = activeYears[0]
      for (const catechist of boardCatechists) {
        const existing = await ctx.db
          .query('academicYearAssignments')
          .withIndex('by_academic_year_id_and_catechist_id', (q) =>
            q
              .eq('academicYearId', activeYear._id)
              .eq('catechistId', catechist._id),
          )
          .first()

        if (!existing) {
          await ctx.db.insert('academicYearAssignments', {
            academicYearId: activeYear._id,
            catechistId: catechist._id,
            assignmentType: 'board_member',
            isDeleted: false,
          })
        }
      }
    }

    // 2. Branch leaders -> branchAssignments
    const branchLeaders = allActiveCatechists.filter(
      (c) => (c.role as string) === 'branch_leader',
    )

    for (const leader of branchLeaders) {
      const catechistClasses = await ctx.db
        .query('catechistClasses')
        .withIndex('by_catechist_id', (q) => q.eq('catechistId', leader._id))
        // eslint-disable-next-line @convex-dev/no-filter-in-query
        .filter((q) => q.eq(q.field('isDeleted'), false))
        .collect()

      for (const cc of catechistClasses) {
        const classYear = await ctx.db.get('classYears', cc.classYearId)
        if (!classYear || classYear.isDeleted) continue

        const classDoc = await ctx.db.get('classes', classYear.classId)
        if (!classDoc || classDoc.isDeleted) continue

        const existing = await ctx.db
          .query('branchAssignments')
          .withIndex(
            'by_academic_year_id_and_catechist_id_and_branch_id',
            (q) =>
              q
                .eq('academicYearId', classYear.academicYearId)
                .eq('catechistId', leader._id)
                .eq('branchId', classDoc.branchId),
          )
          .first()

        if (!existing) {
          await ctx.db.insert('branchAssignments', {
            academicYearId: classYear.academicYearId,
            catechistId: leader._id,
            branchId: classDoc.branchId,
            isDeleted: false,
          })
        }
      }
    }

    // 3. CatechistClass -> classCatechists
    const allCatechistClasses = await ctx.db
      .query('catechistClasses')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()

    for (const cc of allCatechistClasses) {
      const classYear = await ctx.db.get('classYears', cc.classYearId)
      if (!classYear) continue

      const existing = await ctx.db
        .query('classCatechists')
        .withIndex('by_catechist_id_and_class_year_id', (q) =>
          q.eq('catechistId', cc.catechistId).eq('classYearId', cc.classYearId),
        )
        .first()

      if (!existing) {
        await ctx.db.insert('classCatechists', {
          catechistId: cc.catechistId,
          classYearId: cc.classYearId,
          academicYearId: classYear.academicYearId,
          role: cc.role,
          isDeleted: false,
        })
      }
    }
  },
})

export const migrateRoleValues = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allCatechists = await ctx.db.query('catechists').collect()
    for (const catechist of allCatechists) {
      const newRole = (catechist.role as string) === 'board' ? 'admin' : 'user'
      if ((catechist.role as string) !== newRole) {
        await ctx.db.patch('catechists', catechist._id, {
          role: newRole as any,
        })
      }
    }
  },
})
