import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  assertCalendarEventEditPermission,
  assertCalendarEventScopePermission,
  assertValidCatechist,
  getEffectivePermissions,
} from './lib/authz'
import { ACADEMIC_YEAR_ERRORS, CALENDAR_EVENT_ERRORS } from './lib/errors'
import type { Doc, Id } from './_generated/dataModel'

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

function assertValidDateTimeRange(fields: {
  date: string
  endDate?: string
  startTime?: string
  endTime?: string
}) {
  const endDate = fields.endDate ?? fields.date
  if (endDate < fields.date) {
    throw new Error(CALENDAR_EVENT_ERRORS.INVALID_DATE_RANGE)
  }
  if (!!fields.startTime !== !!fields.endTime) {
    throw new Error(CALENDAR_EVENT_ERRORS.INCOMPLETE_TIME_RANGE)
  }
  if (
    fields.startTime &&
    fields.endTime &&
    endDate === fields.date &&
    fields.endTime <= fields.startTime
  ) {
    throw new Error(CALENDAR_EVENT_ERRORS.INVALID_TIME_RANGE)
  }
}

async function assertActiveAcademicYear(
  ctx: Parameters<typeof assertValidCatechist>[0],
  academicYearId: Id<'academicYears'>,
) {
  const academicYear = await ctx.db.get('academicYears', academicYearId)
  if (!academicYear || academicYear.isDeleted) {
    throw new Error(ACADEMIC_YEAR_ERRORS.NOT_FOUND)
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

async function enrichEvents(
  ctx: Parameters<typeof assertValidCatechist>[0],
  events: Array<Doc<'calendarEvents'>>,
) {
  const branchIds = new Set<Id<'branches'>>()
  const classYearIds = new Set<Id<'classYears'>>()
  const catechistIds = new Set<Id<'catechists'>>()

  for (const e of events) {
    if (e.scope === 'branch' && e.branchId) branchIds.add(e.branchId)
    if (e.scope === 'class' && e.classYearId) classYearIds.add(e.classYearId)
    catechistIds.add(e.createdBy)
    if (e.updatedBy) catechistIds.add(e.updatedBy)
  }

  const branchMap = new Map<Id<'branches'>, string>()
  const classYearMap = new Map<Id<'classYears'>, string>()
  const catechistNameMap = new Map<Id<'catechists'>, string>()

  const [, classIdsToFetch] = await Promise.all([
    Promise.all(
      Array.from(branchIds).map(async (id) => {
        const branch = await ctx.db.get('branches', id)
        if (branch) branchMap.set(id, branch.name)
      }),
    ),
    Promise.all(
      Array.from(classYearIds).map(async (id) => {
        const classYear = await ctx.db.get('classYears', id)
        return classYear ? ([id, classYear.classId] as const) : undefined
      }),
    ).then((entries) => new Map(entries.filter((e) => e !== undefined))),
    Promise.all(
      Array.from(catechistIds).map(async (id) => {
        const catechistDoc = await ctx.db.get('catechists', id)
        if (catechistDoc) catechistNameMap.set(id, catechistDoc.fullName)
      }),
    ),
  ])

  const distinctClassIds = new Set(classIdsToFetch.values())
  const classNameMap = new Map<Id<'classes'>, string>()
  await Promise.all(
    Array.from(distinctClassIds).map(async (classId) => {
      const classDoc = await ctx.db.get('classes', classId)
      if (classDoc) classNameMap.set(classId, classDoc.name)
    }),
  )
  for (const [classYearId, classId] of classIdsToFetch) {
    const name = classNameMap.get(classId)
    if (name !== undefined) classYearMap.set(classYearId, name)
  }

  return events.map((e) => ({
    ...e,
    branchName:
      e.scope === 'branch' && e.branchId
        ? (branchMap.get(e.branchId) ?? null)
        : null,
    className:
      e.scope === 'class' && e.classYearId
        ? (classYearMap.get(e.classYearId) ?? null)
        : null,
    createdByName: catechistNameMap.get(e.createdBy) ?? '',
    updatedByName: e.updatedBy
      ? (catechistNameMap.get(e.updatedBy) ?? null)
      : null,
  }))
}

export const list = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
    dateFrom: v.string(),
    dateTo: v.string(),
  },
  handler: async (ctx, args) => {
    const catechist = await assertValidCatechist(ctx, args.requesterId)

    // No lower bound on `date` here: a multi-day event can start before
    // `dateFrom` and still overlap the window via `endDate`, and events
    // have no capped duration to derive a safe `gte` bound from. Scoped by
    // `academicYearId` via the index, so this is bounded per-year, not a
    // full-table scan.
    const events = await ctx.db
      .query('calendarEvents')
      .withIndex('by_academic_year_id_and_date', (q) =>
        q.eq('academicYearId', args.academicYearId).lte('date', args.dateTo),
      )
      .collect()

    const nonDeleted = events.filter(
      (e) => !e.isDeleted && (e.endDate ?? e.date) >= args.dateFrom,
    )

    if (catechist.role === 'admin') {
      return enrichEvents(ctx, nonDeleted)
    }

    const perms = await getEffectivePermissions(
      ctx,
      args.requesterId,
      args.academicYearId,
    )

    const visible = nonDeleted.filter(
      (e) =>
        e.scope === 'board' ||
        (e.scope === 'branch' &&
          !!e.branchId &&
          perms.branchHeadOf.includes(e.branchId)) ||
        (e.scope === 'class' &&
          !!e.classYearId &&
          perms.classCatechistOf.includes(e.classYearId)),
    )

    return enrichEvents(ctx, visible)
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

// Reports which scopes/targets the requester may create or edit calendar
// events for (strict same-scope rule — see docs/18-calendar-management.md).
// `branchIds`/`classYearIds` of `null` means "no restriction" (admin).
export const myScopes = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
  },
  handler: async (ctx, args) => {
    const catechist = await assertValidCatechist(ctx, args.requesterId)

    if (catechist.role === 'admin') {
      return {
        isAdmin: true,
        board: true,
        branchIds: null as Array<Id<'branches'>> | null,
        classYearIds: null as Array<Id<'classYears'>> | null,
      }
    }

    const perms = await getEffectivePermissions(
      ctx,
      args.requesterId,
      args.academicYearId,
    )

    return {
      isAdmin: false,
      board: perms.isBoardMember,
      branchIds: perms.branchHeadOf,
      classYearIds: perms.classCatechistOf,
    }
  },
})

// ─── Mutations ──────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
    date: v.string(),
    endDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
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

    assertValidDateTimeRange(fields)
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
    endDate: v.optional(v.string()),
    // `null` explicitly clears the field (e.g. converting a timed event
    // back to all-day); omitted (`undefined`) leaves it untouched — an
    // `undefined` arg can't carry that distinction, it's stripped before
    // reaching the handler.
    startTime: v.optional(v.union(v.string(), v.null())),
    endTime: v.optional(v.union(v.string(), v.null())),
    liturgicalDate: v.optional(v.string()),
    description: v.optional(v.string()),
    severity: v.optional(severityValidator),
  },
  handler: async (ctx, args) => {
    const { requesterId, id, startTime, endTime, ...fields } = args

    const event = await ctx.db.get('calendarEvents', id)
    if (!event || event.isDeleted) {
      throw new Error(CALENDAR_EVENT_ERRORS.NOT_FOUND)
    }

    const mergedStartTime =
      startTime === undefined ? event.startTime : (startTime ?? undefined)
    const mergedEndTime =
      endTime === undefined ? event.endTime : (endTime ?? undefined)

    assertValidDateTimeRange({
      date: fields.date ?? event.date,
      endDate: fields.endDate ?? event.endDate,
      startTime: mergedStartTime,
      endTime: mergedEndTime,
    })

    await assertCalendarEventEditPermission(ctx, requesterId, event)
    await assertActiveAcademicYear(ctx, event.academicYearId)

    await ctx.db.patch('calendarEvents', id, {
      ...fields,
      ...(startTime !== undefined ? { startTime: mergedStartTime } : {}),
      ...(endTime !== undefined ? { endTime: mergedEndTime } : {}),
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
