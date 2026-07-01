import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { assertBoardRole } from './lib/authz'
import { CLASS_ERRORS } from './lib/errors'

// ─── Queries ──────────────────────────────────────────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    const classes = await ctx.db
      .query('classes')
      .withIndex('by_is_deleted')
      .collect()
    return classes.filter((c) => !c.isDeleted)
  },
})

// ─── Mutations ────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    requesterId: v.id('catechists'),
    branchId: v.id('branches'),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertBoardRole(ctx, args.requesterId)

    const name = args.name.trim()
    if (!name) {
      throw new Error(CLASS_ERRORS.DUPLICATE_NAME)
    }

    const existing = await ctx.db
      .query('classes')
      .withIndex('by_branch_id', (q) => q.eq('branchId', args.branchId))
      .collect()

    if (existing.some((c) => !c.isDeleted && c.name === name)) {
      throw new Error(CLASS_ERRORS.DUPLICATE_NAME)
    }

    const { requesterId, ...fields } = args
    return await ctx.db.insert('classes', {
      ...fields,
      name,
      isDeleted: false,
    })
  },
})

export const update = mutation({
  args: {
    requesterId: v.id('catechists'),
    classId: v.id('classes'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertBoardRole(ctx, args.requesterId)

    const cls = await ctx.db.get('classes', args.classId)
    if (!cls || cls.isDeleted) {
      throw new Error(CLASS_ERRORS.NOT_FOUND)
    }

    const name = args.name !== undefined ? args.name.trim() : undefined

    if (name !== undefined && name !== cls.name) {
      if (!name) {
        throw new Error(CLASS_ERRORS.DUPLICATE_NAME)
      }
      const existing = await ctx.db
        .query('classes')
        .withIndex('by_branch_id', (q) => q.eq('branchId', cls.branchId))
        .collect()

      if (existing.some((c) => !c.isDeleted && c.name === name)) {
        throw new Error(CLASS_ERRORS.DUPLICATE_NAME)
      }
    }

    const { requesterId, classId, ...fields } = args
    await ctx.db.patch('classes', classId, {
      ...fields,
      ...(name !== undefined ? { name } : {}),
    })
  },
})

export const softDelete = mutation({
  args: {
    requesterId: v.id('catechists'),
    classId: v.id('classes'),
  },
  handler: async (ctx, args) => {
    await assertBoardRole(ctx, args.requesterId)

    const cls = await ctx.db.get('classes', args.classId)
    if (!cls || cls.isDeleted) {
      throw new Error(CLASS_ERRORS.NOT_FOUND)
    }

    // Check referential integrity: query classYears by by_class_id
    const classYears = await ctx.db
      .query('classYears')
      .withIndex('by_class_id', (q) => q.eq('classId', args.classId))
      .collect()

    if (classYears.some((cy) => !cy.isDeleted)) {
      throw new Error(CLASS_ERRORS.IN_USE_BY_CLASS_YEAR)
    }

    await ctx.db.patch('classes', args.classId, {
      isDeleted: true,
    })
  },
})

export const bulkCreate = mutation({
  args: {
    requesterId: v.id('catechists'),
    classes: v.array(
      v.object({
        branchId: v.id('branches'),
        name: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await assertBoardRole(ctx, args.requesterId)

    const resultIds = []

    // Group by branchId to check duplicates efficiently
    const byBranch = new Map<string, Array<string>>()
    for (const c of args.classes) {
      const name = c.name.trim()
      if (!name) {
        throw new Error(CLASS_ERRORS.DUPLICATE_NAME)
      }

      const branchIdStr = c.branchId as string
      const names = byBranch.get(branchIdStr) || []

      // Check duplicate within batch
      if (names.includes(name)) {
        throw new Error(CLASS_ERRORS.DUPLICATE_NAME)
      }

      names.push(name)
      byBranch.set(branchIdStr, names)
    }

    // Check duplicates against DB
    for (const [branchIdStr, names] of byBranch.entries()) {
      const existing = await ctx.db
        .query('classes')
        .withIndex('by_branch_id', (q) => q.eq('branchId', branchIdStr as any))
        .collect()

      for (const name of names) {
        if (existing.some((c) => !c.isDeleted && c.name === name)) {
          throw new Error(CLASS_ERRORS.DUPLICATE_NAME)
        }
      }
    }

    // Insert all
    for (const c of args.classes) {
      const id = await ctx.db.insert('classes', {
        branchId: c.branchId,
        name: c.name.trim(),
        isDeleted: false,
      })
      resultIds.push(id)
    }

    return resultIds
  },
})
