import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  assertCalendarEventEditPermission,
  assertCalendarEventScopePermission,
  assertValidCatechist,
  getEffectivePermissions,
} from './lib/authz'
import { CALENDAR_EVENT_ERRORS } from './lib/errors'
import type { Id } from './_generated/dataModel'

const severityValidator = v.union(
  v.literal('high'),
  v.literal('medium'),
  v.literal('low'),
)

const scopeValidator = v.union(
  v.literal('board'),
  v.literal('branch'),
  v.literal('class'),
)

async function assertActiveAcademicYear(
  ctx: Parameters<typeof assertValidCatechist>[0],
  academicYearId: Id<'academicYears'>,
) {
  const academicYear = await ctx.db.get('academicYears', academicYearId)
  if (!academicYear || academicYear.isDeleted) {
    throw new Error('Academic year not found')
  }
  if (!academicYear.isActive) {
    throw new Error(CALENDAR_EVENT_ERRORS.INACTIVE_ACADEMIC_YEAR)
  }
  return academicYear
}

async function resolveScopeTarget(
  ctx: Parameters<typeof assertValidCatechist>[0],
  scope: 'board' | 'branch' | 'class',
  branchId: Id<'branches'> | undefined,
  classYearId: Id<'classYears'> | undefined,
  academicYearId: Id<'academicYears'>,
) {
  if (scope === 'branch') {
    if (!branchId || classYearId) {
      throw new Error(CALENDAR_EVENT_ERRORS.INVALID_SCOPE)
    }
    const branch = await ctx.db.get('branches', branchId)
    if (!branch || branch.isDeleted) {
      throw new Error(CALENDAR_EVENT_ERRORS.BRANCH_NOT_FOUND)
    }
  } else if (scope === 'class') {
    if (!classYearId || branchId) {
      throw new Error(CALENDAR_EVENT_ERRORS.INVALID_SCOPE)
    }
    const classYear = await ctx.db.get('classYears', classYearId)
    if (
      !classYear ||
      classYear.isDeleted ||
      classYear.academicYearId !== academicYearId
    ) {
      throw new Error(CALENDAR_EVENT_ERRORS.CLASS_YEAR_NOT_FOUND)
    }
  } else {
    if (branchId || classYearId) {
      throw new Error(CALENDAR_EVENT_ERRORS.INVALID_SCOPE)
    }
  }
}

// ─── Queries ────────────────────────────────────────────────────────────

export const list = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
    dateFrom: v.string(),
    dateTo: v.string(),
  },
  handler: async (ctx, args) => {
    const catechist = await assertValidCatechist(ctx, args.requesterId)

    const events = await ctx.db
      .query('calendarEvents')
      .withIndex('by_academic_year_id_and_date', (q) =>
        q
          .eq('academicYearId', args.academicYearId)
          .gte('date', args.dateFrom)
          .lte('date', args.dateTo),
      )
      .collect()

    const nonDeleted = events.filter((e) => !e.isDeleted)

    if (catechist.role === 'admin') {
      return nonDeleted
    }

    const perms = await getEffectivePermissions(
      ctx,
      args.requesterId,
      args.academicYearId,
    )

    return nonDeleted.filter(
      (e) =>
        e.scope === 'board' ||
        (e.scope === 'branch' &&
          !!e.branchId &&
          perms.branchHeadOf.includes(e.branchId)) ||
        (e.scope === 'class' &&
          !!e.classYearId &&
          perms.classCatechistOf.includes(e.classYearId)),
    )
  },
})

export const get = query({
  args: {
    requesterId: v.id('catechists'),
    id: v.id('calendarEvents'),
  },
  handler: async (ctx, args) => {
    const catechist = await assertValidCatechist(ctx, args.requesterId)
    const event = await ctx.db.get('calendarEvents', args.id)
    if (!event || event.isDeleted) return null

    if (catechist.role === 'admin' || event.scope === 'board') return event

    const perms = await getEffectivePermissions(
      ctx,
      args.requesterId,
      event.academicYearId,
    )

    const visible =
      (event.scope === 'branch' &&
        !!event.branchId &&
        perms.branchHeadOf.includes(event.branchId)) ||
      (event.scope === 'class' &&
        !!event.classYearId &&
        perms.classCatechistOf.includes(event.classYearId))

    return visible ? event : null
  },
})

// ─── Mutations ──────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
    date: v.string(),
    liturgicalDate: v.optional(v.string()),
    description: v.string(),
    severity: severityValidator,
    scope: scopeValidator,
    branchId: v.optional(v.id('branches')),
    classYearId: v.optional(v.id('classYears')),
  },
  handler: async (ctx, args) => {
    const {
      requesterId,
      academicYearId,
      scope,
      branchId,
      classYearId,
      ...fields
    } = args

    await assertActiveAcademicYear(ctx, academicYearId)
    await resolveScopeTarget(ctx, scope, branchId, classYearId, academicYearId)
    await assertCalendarEventScopePermission(
      ctx,
      requesterId,
      academicYearId,
      scope,
      { branchId, classYearId },
    )

    return await ctx.db.insert('calendarEvents', {
      academicYearId,
      scope,
      branchId,
      classYearId,
      createdBy: requesterId,
      createdAt: Date.now(),
      isDeleted: false,
      ...fields,
    })
  },
})

export const update = mutation({
  args: {
    requesterId: v.id('catechists'),
    id: v.id('calendarEvents'),
    date: v.optional(v.string()),
    liturgicalDate: v.optional(v.string()),
    description: v.optional(v.string()),
    severity: v.optional(severityValidator),
  },
  handler: async (ctx, args) => {
    const { requesterId, id, ...fields } = args

    const event = await ctx.db.get('calendarEvents', id)
    if (!event || event.isDeleted) {
      throw new Error(CALENDAR_EVENT_ERRORS.NOT_FOUND)
    }

    await assertCalendarEventEditPermission(ctx, requesterId, event)
    await assertActiveAcademicYear(ctx, event.academicYearId)

    await ctx.db.patch('calendarEvents', id, {
      ...fields,
      updatedBy: requesterId,
      updatedAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: {
    requesterId: v.id('catechists'),
    id: v.id('calendarEvents'),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get('calendarEvents', args.id)
    if (!event || event.isDeleted) {
      throw new Error(CALENDAR_EVENT_ERRORS.NOT_FOUND)
    }

    await assertCalendarEventEditPermission(ctx, args.requesterId, event)
    await assertActiveAcademicYear(ctx, event.academicYearId)

    await ctx.db.patch('calendarEvents', args.id, {
      isDeleted: true,
      updatedBy: args.requesterId,
      updatedAt: Date.now(),
    })
  },
})
