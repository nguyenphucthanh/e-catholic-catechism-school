import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { assertBoardRole } from './lib/authz'
import { BRANCH_ERRORS } from './lib/errors'

// ─── Queries ──────────────────────────────────────────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    const branches = await ctx.db
      .query('branches')
      .withIndex('by_sort_order')
      .order('asc')
      .collect()
    return branches.filter((b) => !b.isDeleted)
  },
})

export const get = query({
  args: { id: v.id('branches') },
  handler: async (ctx, args) => {
    const branch = await ctx.db.get("branches", args.id)
    if (!branch || branch.isDeleted) return null
    return branch
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
    await assertBoardRole(ctx, args.requesterId)

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
    await assertBoardRole(ctx, args.requesterId)

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
    await assertBoardRole(ctx, args.requesterId)

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
    await assertBoardRole(ctx, args.requesterId)

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
