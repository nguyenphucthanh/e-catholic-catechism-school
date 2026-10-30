import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { assertAdminRole, assertValidCatechist } from './lib/authz'
import { ACADEMIC_YEAR_ERRORS } from './lib/errors'
import type { Doc } from './_generated/dataModel'

/**
 * Dates for semesters 2..N must be strictly ascending and fall inside
 * (yearStart, yearEnd]. ISO dates compare correctly as strings.
 */
function assertValidSemesterDates(
  yearStart: string,
  yearEnd: string,
  dates: Array<string>,
) {
  let prev = yearStart
  for (const d of dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d <= prev || d > yearEnd) {
      throw new Error(ACADEMIC_YEAR_ERRORS.INVALID_SEMESTER_DATES)
    }
    prev = d
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Get an academic year by ID.
 */
export const get = query({
  args: { id: v.id('academicYears') },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx)
    const year = await ctx.db.get('academicYears', args.id)
    if (!year || year.isDeleted) return null
    return year
  },
})

/**
 * List all non-deleted academic years, sorted by startDate desc.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await assertValidCatechist(ctx)
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
    await assertValidCatechist(ctx)
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
 * List all non-deleted semesters for an academic year, ordered by
 * semesterNumber ascending.
 */
export const listSemesters = query({
  args: {
    academicYearId: v.id('academicYears'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx)
    const semesters = await ctx.db
      .query('semesters')
      .withIndex('by_academic_year_id_and_semester_number', (q) =>
        q.eq('academicYearId', args.academicYearId),
      )
      .collect()
    return semesters.filter((s) => !s.isDeleted)
  },
})

/**
 * Get the currently active academic year.
 */
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    await assertValidCatechist(ctx)
    const years = await ctx.db
      .query('academicYears')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()
    return years.find((y) => y.isActive) ?? null
  },
})

/**
 * Consolidated aggregate query for active academic year, semesters, and
 * selectable years. Used for top headers, year switchers, and inactive year
 * alerts. `limit` caps `recentYears` (e.g. for the sidebar switcher); omit
 * it to get every non-deleted year back (e.g. to validate a persisted
 * selection still exists).
 */
export const getActiveYearContext = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx)

    const allYears = await ctx.db
      .query('academicYears')
      .withIndex('by_start_date')
      .order('desc')
      .collect()

    const activeYears = allYears.filter((y) => !y.isDeleted)
    const activeYear = activeYears.find((y) => y.isActive) ?? null
    const recentYears =
      args.limit === undefined ? activeYears : activeYears.slice(0, args.limit)

    let semesters: Array<Doc<'semesters'>> = []
    if (activeYear) {
      const semesterDocs = await ctx.db
        .query('semesters')
        .withIndex('by_academic_year_id_and_semester_number', (q) =>
          q.eq('academicYearId', activeYear._id),
        )
        .collect()
      semesters = semesterDocs
        .filter((s) => !s.isDeleted)
        .sort((a, b) => a.semesterNumber - b.semesterNumber)
    }

    return {
      activeYear,
      semesters,
      recentYears,
    }
  },
})

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Create a new academic year.
 */
export const create = mutation({
  args: {
    name: v.string(),
    startDate: v.string(), // ISO date YYYY-MM-DD
    endDate: v.string(), // ISO date YYYY-MM-DD
    timezone: v.string(), // IANA timezone string
    numberOfSemesters: v.number(),
    semesterStartDates: v.optional(v.array(v.string())), // semesters 2..N, in order
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx)

    if (
      !Number.isInteger(args.numberOfSemesters) ||
      args.numberOfSemesters < 1 ||
      args.numberOfSemesters > 4
    ) {
      throw new Error(ACADEMIC_YEAR_ERRORS.INVALID_SEMESTER_COUNT)
    }

    const semesterStartDates = args.semesterStartDates ?? []
    if (
      args.semesterStartDates &&
      semesterStartDates.length !== args.numberOfSemesters - 1
    ) {
      throw new Error(ACADEMIC_YEAR_ERRORS.INVALID_SEMESTER_DATES)
    }
    assertValidSemesterDates(args.startDate, args.endDate, semesterStartDates)

    // Check for duplicate name among non-deleted years. A name may have
    // multiple soft-deleted rows over time, so this can't use .unique().
    const existing = await ctx.db
      .query('academicYears')
      .withIndex('by_name', (q) => q.eq('name', args.name))
      .collect()

    if (existing.some((y) => !y.isDeleted)) {
      throw new Error(ACADEMIC_YEAR_ERRORS.DUPLICATE_NAME)
    }

    const academicYearId = await ctx.db.insert('academicYears', {
      name: args.name,
      startDate: args.startDate,
      endDate: args.endDate,
      timezone: args.timezone,
      isActive: false,
      isDeleted: false,
    })

    for (let i = 1; i <= args.numberOfSemesters; i++) {
      await ctx.db.insert('semesters', {
        academicYearId,
        semesterNumber: i,
        startDate: i > 1 ? semesterStartDates[i - 2] : undefined,
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
    academicYearId: v.id('academicYears'),
    name: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    timezone: v.optional(v.string()),
    semesterStartDates: v.optional(v.array(v.string())), // semesters 2..N, in order
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx)

    const year = await ctx.db.get('academicYears', args.academicYearId)
    if (!year || year.isDeleted) {
      throw new Error(ACADEMIC_YEAR_ERRORS.NOT_FOUND)
    }

    // Revalidate semester dates whenever they or the year range change.
    const semesters = (
      await ctx.db
        .query('semesters')
        .withIndex('by_academic_year_id_and_semester_number', (q) =>
          q.eq('academicYearId', args.academicYearId),
        )
        .collect()
    ).filter((s) => !s.isDeleted)
    const laterSemesters = semesters.filter((s) => s.semesterNumber > 1)
    if (
      args.semesterStartDates &&
      args.semesterStartDates.length !== laterSemesters.length
    ) {
      throw new Error(ACADEMIC_YEAR_ERRORS.INVALID_SEMESTER_DATES)
    }
    const nextDates =
      args.semesterStartDates ??
      laterSemesters.flatMap((s) => (s.startDate ? [s.startDate] : []))
    assertValidSemesterDates(
      args.startDate ?? year.startDate,
      args.endDate ?? year.endDate,
      nextDates,
    )

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

    const { academicYearId, semesterStartDates, ...fields } = args
    await ctx.db.patch('academicYears', academicYearId, fields)
    if (semesterStartDates) {
      for (const [i, s] of laterSemesters.entries()) {
        await ctx.db.patch('semesters', s._id, {
          startDate: semesterStartDates[i],
        })
      }
    }
  },
})

/**
 * Set an academic year as the single active one.
 */
export const setActive = mutation({
  args: {
    academicYearId: v.id('academicYears'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx)

    const targetYear = await ctx.db.get('academicYears', args.academicYearId)
    if (!targetYear || targetYear.isDeleted) {
      throw new Error(ACADEMIC_YEAR_ERRORS.NOT_FOUND)
    }

    const years = await ctx.db
      .query('academicYears')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()
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
    academicYearId: v.id('academicYears'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx)

    const year = await ctx.db.get('academicYears', args.academicYearId)
    if (!year || year.isDeleted) {
      throw new Error(ACADEMIC_YEAR_ERRORS.NOT_FOUND)
    }

    if (year.isActive) {
      throw new Error(ACADEMIC_YEAR_ERRORS.CANNOT_DELETE_ACTIVE)
    }

    await ctx.db.patch('academicYears', args.academicYearId, {
      isDeleted: true,
    })
  },
})
