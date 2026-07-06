import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { assertAdminRole, assertValidCatechist } from './lib/authz'
import { BRANCH_ERRORS } from './lib/errors'
import {
  getActiveClassYearsForAcademicYear,
  getCatechistIdSetForAcademicYear,
  getStudentIdSetForClassYears,
} from './lib/statsHelpers'
import type { Id } from './_generated/dataModel'

// ─── Queries ──────────────────────────────────────────────────────────────────

export const list = query({
  args: { requesterId: v.id('catechists') },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const branches = await ctx.db
      .query('branches')
      .withIndex('by_sort_order')
      .order('asc')
      .collect()
    return branches.filter((b) => !b.isDeleted)
  },
})

export const get = query({
  args: { requesterId: v.id('catechists'), id: v.id('branches') },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const branch = await ctx.db.get('branches', args.id)
    if (!branch || branch.isDeleted) return null
    return branch
  },
})

export const getBranchDetail = query({
  args: {
    requesterId: v.id('catechists'),
    id: v.id('branches'),
    academicYearId: v.id('academicYears'),
  },
  handler: async (ctx, { requesterId, id, academicYearId }) => {
    await assertValidCatechist(ctx, requesterId)

    const branch = await ctx.db.get('branches', id)
    if (!branch || branch.isDeleted) return null

    const activeClassYears = await getActiveClassYearsForAcademicYear(
      ctx,
      academicYearId,
    )
    const branchClassYears = activeClassYears.filter((cy) => cy.branchId === id)
    const classYearIds = branchClassYears.map((cy) => cy.classYearId)

    const [studentIds, catechistIds] = await Promise.all([
      getStudentIdSetForClassYears(ctx, classYearIds),
      getCatechistIdSetForAcademicYear(
        ctx,
        academicYearId,
        new Set(classYearIds),
      ),
    ])

    const classDetails = (
      await Promise.all(
        branchClassYears.map(async (cy) => {
          const classDoc = await ctx.db.get('classes', cy.classId)
          if (!classDoc || classDoc.isDeleted) return null

          const [classCatechists, studentClasses] = await Promise.all([
            ctx.db
              .query('classCatechists')
              .withIndex('by_class_year_id', (q) =>
                q.eq('classYearId', cy.classYearId),
              )
              .collect(),
            ctx.db
              .query('studentClasses')
              .withIndex('by_class_year_id', (q) =>
                q.eq('classYearId', cy.classYearId),
              )
              .collect(),
          ])

          const activeAssignments = classCatechists.filter(
            (cc) => !cc.isDeleted,
          )
          const catechists = (
            await Promise.all(
              activeAssignments.map(async (cc) => {
                const catechist = await ctx.db.get('catechists', cc.catechistId)
                if (!catechist || catechist.isDeleted) return null
                return {
                  catechistId: cc.catechistId,
                  fullName: catechist.fullName,
                  saintName: catechist.saintName,
                  role: cc.role,
                }
              }),
            )
          ).filter(
            (
              c,
            ): c is {
              catechistId: Id<'catechists'>
              fullName: string
              saintName: string | undefined
              role: 'homeroom' | 'co_teacher'
            } => c !== null,
          )

          const studentCount = studentClasses.filter(
            (sc) => !sc.isDeleted,
          ).length

          return {
            classId: cy.classId,
            className: classDoc.name,
            assignedCatechists: catechists,
            studentCount,
          }
        }),
      )
    ).filter(
      (
        c,
      ): c is {
        classId: Id<'classes'>
        className: string
        assignedCatechists: Array<{
          catechistId: Id<'catechists'>
          fullName: string
          saintName: string | undefined
          role: 'homeroom' | 'co_teacher'
        }>
        studentCount: number
      } => c !== null,
    )

    return {
      branch: {
        _id: branch._id,
        name: branch.name,
        description: branch.description,
      },
      stats: {
        totalStudents: studentIds.size,
        totalCatechists: catechistIds.size,
        totalClasses: classYearIds.length,
      },
      classes: classDetails,
    }
  },
})

// ─── Mutations ────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    requesterId: v.id('catechists'),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const name = args.name.trim()

    const existing = await ctx.db
      .query('branches')
      .withIndex('by_name', (q) => q.eq('name', name))
      .collect()

    if (existing.some((b) => !b.isDeleted)) {
      throw new Error(BRANCH_ERRORS.DUPLICATE_NAME)
    }

    const branches = await ctx.db
      .query('branches')
      .withIndex('by_sort_order')
      .order('desc')
      .collect()

    const activeBranches = branches.filter((b) => !b.isDeleted)
    const nextSortOrder =
      activeBranches.length > 0 ? activeBranches[0].sortOrder + 1 : 1

    const { requesterId, ...fields } = args
    return await ctx.db.insert('branches', {
      ...fields,
      name,
      sortOrder: nextSortOrder,
      isDeleted: false,
    })
  },
})

export const update = mutation({
  args: {
    requesterId: v.id('catechists'),
    branchId: v.id('branches'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const branch = await ctx.db.get('branches', args.branchId)
    if (!branch || branch.isDeleted) {
      throw new Error(BRANCH_ERRORS.NOT_FOUND)
    }

    const name = args.name !== undefined ? args.name.trim() : undefined

    if (name !== undefined && name !== branch.name) {
      const existing = await ctx.db
        .query('branches')
        .withIndex('by_name', (q) => q.eq('name', name))
        .collect()

      if (existing.some((b) => !b.isDeleted)) {
        throw new Error(BRANCH_ERRORS.DUPLICATE_NAME)
      }
    }

    const { requesterId, branchId, ...fields } = args
    await ctx.db.patch('branches', branchId, {
      ...fields,
      ...(name !== undefined ? { name } : {}),
    })
  },
})

export const softDelete = mutation({
  args: {
    requesterId: v.id('catechists'),
    branchId: v.id('branches'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const branch = await ctx.db.get('branches', args.branchId)
    if (!branch || branch.isDeleted) {
      throw new Error(BRANCH_ERRORS.NOT_FOUND)
    }

    // Check if branch is in use by any class (where isDeleted=false)
    const classesInBranch = await ctx.db
      .query('classes')
      .withIndex('by_branch_id', (q) => q.eq('branchId', args.branchId))
      .collect()

    if (classesInBranch.some((c) => !c.isDeleted)) {
      throw new Error(BRANCH_ERRORS.IN_USE_BY_CLASS)
    }

    await ctx.db.patch('branches', args.branchId, {
      isDeleted: true,
    })
  },
})

export const reorder = mutation({
  args: {
    requesterId: v.id('catechists'),
    branchId: v.id('branches'),
    direction: v.union(v.literal('up'), v.literal('down')),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const branch = await ctx.db.get('branches', args.branchId)
    if (!branch || branch.isDeleted) {
      throw new Error(BRANCH_ERRORS.NOT_FOUND)
    }

    const allBranches = await ctx.db
      .query('branches')
      .withIndex('by_sort_order')
      .order('asc')
      .collect()

    const activeBranches = allBranches.filter((b) => !b.isDeleted)
    const currentIndex = activeBranches.findIndex(
      (b) => b._id === args.branchId,
    )

    if (currentIndex === -1) {
      throw new Error(BRANCH_ERRORS.NOT_FOUND)
    }

    if (args.direction === 'up' && currentIndex > 0) {
      const adjacentBranch = activeBranches[currentIndex - 1]
      await ctx.db.patch('branches', branch._id, {
        sortOrder: adjacentBranch.sortOrder,
      })
      await ctx.db.patch('branches', adjacentBranch._id, {
        sortOrder: branch.sortOrder,
      })
    } else if (
      args.direction === 'down' &&
      currentIndex < activeBranches.length - 1
    ) {
      const adjacentBranch = activeBranches[currentIndex + 1]
      await ctx.db.patch('branches', branch._id, {
        sortOrder: adjacentBranch.sortOrder,
      })
      await ctx.db.patch('branches', adjacentBranch._id, {
        sortOrder: branch.sortOrder,
      })
    }
  },
})
