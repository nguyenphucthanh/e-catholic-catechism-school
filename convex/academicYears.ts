import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { assertBoardRole } from './lib/authz'
import { ACADEMIC_YEAR_ERRORS } from './lib/errors'

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * List all non-deleted academic years, sorted by startDate desc.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const years = await ctx.db
      .query('academicYears')
      .withIndex('by_start_date')
      .order('desc')
      .collect()
    return years.filter((y) => !y.isDeleted)
  },
})

/**
 * List the most recent N non-deleted academic years, sorted by startDate desc.
 * Used for the sidebar switcher.
 */
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5
    const years = await ctx.db
      .query('academicYears')
      .withIndex('by_start_date')
      .order('desc')
      .collect()
    return years.filter((y) => !y.isDeleted).slice(0, limit)
  },
})

/**
 * Get the currently active academic year.
 */
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const years = await ctx.db
      .query('academicYears')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()
    return years.find((y) => y.isActive) ?? null
  },
})

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Create a new academic year.
 */
export const create = mutation({
  args: {
    requesterId: v.id('catechists'),
    name: v.string(),
    startDate: v.string(), // ISO date YYYY-MM-DD
    endDate: v.string(), // ISO date YYYY-MM-DD
    timezone: v.string(), // IANA timezone string
    numberOfSemesters: v.number(),
  },
  handler: async (ctx, args) => {
    await assertBoardRole(ctx, args.requesterId)

    if (
      !Number.isInteger(args.numberOfSemesters) ||
      args.numberOfSemesters < 1 ||
      args.numberOfSemesters > 4
    ) {
      throw new Error(ACADEMIC_YEAR_ERRORS.INVALID_SEMESTER_COUNT)
    }

    // Check for duplicate name among non-deleted years. A name may have
    // multiple soft-deleted rows over time, so this can't use .unique().
    const existing = await ctx.db
      .query('academicYears')
      .withIndex('by_name', (q) => q.eq('name', args.name))
      .collect()

    if (existing.some((y) => !y.isDeleted)) {
      throw new Error(ACADEMIC_YEAR_ERRORS.DUPLICATE_NAME)
    }

    const { requesterId, numberOfSemesters, ...fields } = args
    const academicYearId = await ctx.db.insert('academicYears', {
      ...fields,
      isActive: false,
      isDeleted: false,
    })

    for (let i = 1; i <= numberOfSemesters; i++) {
      await ctx.db.insert('semesters', {
        academicYearId,
        semesterNumber: i,
        isDeleted: false,
      })
    }

    return academicYearId
  },
})

/**
 * Update an existing academic year's details.
 */
export const update = mutation({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
    name: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertBoardRole(ctx, args.requesterId)

    const year = await ctx.db.get('academicYears', args.academicYearId)
    if (!year || year.isDeleted) {
      throw new Error('Academic year not found')
    }

    // Check for duplicate name if name is being changed. A name may have
    // multiple soft-deleted rows over time, so this can't use .unique().
    if (args.name !== undefined && args.name !== year.name) {
      const nameToCheck = args.name
      const existing = await ctx.db
        .query('academicYears')
        .withIndex('by_name', (q) => q.eq('name', nameToCheck))
        .collect()

      if (existing.some((y) => !y.isDeleted)) {
        throw new Error(ACADEMIC_YEAR_ERRORS.DUPLICATE_NAME)
      }
    }

    const { requesterId, academicYearId, ...fields } = args
    await ctx.db.patch('academicYears', academicYearId, fields)
  },
})

/**
 * Set an academic year as the single active one.
 */
export const setActive = mutation({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
  },
  handler: async (ctx, args) => {
    await assertBoardRole(ctx, args.requesterId)

    const targetYear = await ctx.db.get('academicYears', args.academicYearId)
    if (!targetYear || targetYear.isDeleted) {
      throw new Error('Academic year not found')
    }

    const years = await ctx.db.query('academicYears').collect()
    for (const year of years) {
      if (year._id === args.academicYearId) {
        if (!year.isActive) {
          await ctx.db.patch('academicYears', year._id, { isActive: true })
        }
      } else {
        if (year.isActive) {
          await ctx.db.patch('academicYears', year._id, { isActive: false })
        }
      }
    }
  },
})

/**
 * Soft delete an academic year.
 * Prevents deleting the active academic year.
 */
export const softDelete = mutation({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
  },
  handler: async (ctx, args) => {
    await assertBoardRole(ctx, args.requesterId)

    const year = await ctx.db.get('academicYears', args.academicYearId)
    if (!year || year.isDeleted) {
      throw new Error('Academic year not found')
    }

    if (year.isActive) {
      throw new Error(ACADEMIC_YEAR_ERRORS.CANNOT_DELETE_ACTIVE)
    }

    await ctx.db.patch('academicYears', args.academicYearId, {
      isDeleted: true,
    })
  },
})
