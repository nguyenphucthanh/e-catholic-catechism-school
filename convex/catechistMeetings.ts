import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  assertBoardMemberOrAdmin,
  assertValidCatechist,
  getEffectivePermissions,
} from './lib/authz'
import { recordOne } from './catechistAttendance'
import { getExpectedCatechistsForMeeting } from './lib/catechistAttendance'
import {
  CATECHIST_ATTENDANCE_ERRORS,
  CATECHIST_MEETING_ERRORS,
} from './lib/errors'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

const scopeValidator = v.union(
  v.literal('all'),
  v.literal('board'),
  v.literal('branch'),
)

const attendanceValidator = v.array(
  v.object({
    catechistId: v.id('catechists'),
    status: v.union(
      v.literal('present'),
      v.literal('late'),
      v.literal('excused_absence'),
      v.literal('unexcused_absence'),
    ),
    notes: v.optional(v.string()),
    roleAtSession: v.optional(
      v.union(
        v.literal('homeroom'),
        v.literal('co_teacher'),
        v.literal('substitute'),
        v.literal('attendee'),
      ),
    ),
  }),
)

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Auth + AY lock shared by every meeting write. */
async function guardYear(
  ctx: MutationCtx,
  requesterId: Id<'catechists'>,
  academicYearId: Id<'academicYears'>,
) {
  const ay = await ctx.db.get('academicYears', academicYearId)
  if (!ay || ay.isDeleted) {
    throw new Error(CATECHIST_MEETING_ERRORS.ACADEMIC_YEAR_NOT_FOUND)
  }
  await assertBoardMemberOrAdmin(ctx, requesterId, academicYearId)
  if (!ay.isActive) {
    throw new Error(CATECHIST_MEETING_ERRORS.INACTIVE_ACADEMIC_YEAR)
  }
}

async function validateShape(
  ctx: MutationCtx,
  m: {
    meetingDate: string
    scope: 'all' | 'board' | 'branch'
    branchId?: Id<'branches'>
  },
) {
  if (!DATE_RE.test(m.meetingDate)) {
    throw new Error(CATECHIST_MEETING_ERRORS.INVALID_DATE)
  }
  if ((m.scope === 'branch') !== !!m.branchId) {
    throw new Error(CATECHIST_MEETING_ERRORS.INVALID_SCOPE)
  }
  if (m.branchId) {
    const b = await ctx.db.get('branches', m.branchId)
    if (!b || b.isDeleted) {
      throw new Error(CATECHIST_MEETING_ERRORS.BRANCH_NOT_FOUND)
    }
  }
}

async function loadMeeting(
  ctx: MutationCtx,
  meetingId: Id<'catechistMeetings'>,
) {
  const m = await ctx.db.get('catechistMeetings', meetingId)
  if (!m || m.isDeleted) throw new Error(CATECHIST_MEETING_ERRORS.NOT_FOUND)
  return m
}

/**
 * Writes attendance in the caller's transaction (any throw rolls back the
 * meeting write too). Manual-overwrite semantics via recordOne: submitted
 * records are upserted; records not submitted are left untouched.
 */
async function writeAttendance(
  ctx: MutationCtx,
  requesterId: Id<'catechists'>,
  meeting: Doc<'catechistMeetings'>,
  records: typeof attendanceValidator.type,
) {
  if (!records.length) return
  if (new Set(records.map((r) => r.catechistId)).size !== records.length) {
    throw new Error(CATECHIST_ATTENDANCE_ERRORS.DUPLICATE_CATECHIST)
  }
  if (meeting.isCancelled) {
    throw new Error(CATECHIST_ATTENDANCE_ERRORS.MEETING_CANCELLED)
  }
  const target = {
    kind: 'meeting' as const,
    meeting,
    academicYearId: meeting.academicYearId,
  }
  for (const rec of records) {
    // Meetings only have the 'attendee' role.
    if (rec.roleAtSession && rec.roleAtSession !== 'attendee') {
      throw new Error(CATECHIST_ATTENDANCE_ERRORS.INVALID_ROLE)
    }
    await recordOne(ctx, target, [], requesterId, {
      ...rec,
      checkInMethod: 'manual',
    })
  }
}

export const createMeeting = mutation({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
    meetingDate: v.string(),
    title: v.string(),
    scope: scopeValidator,
    branchId: v.optional(v.id('branches')),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    attendance: v.optional(attendanceValidator),
  },
  handler: async (ctx, { requesterId, attendance, ...fields }) => {
    await guardYear(ctx, requesterId, fields.academicYearId)
    await validateShape(ctx, fields)
    const meetingId = await ctx.db.insert('catechistMeetings', {
      ...fields,
      isCancelled: false,
      isDeleted: false,
    })
    if (attendance) {
      const meeting = (await ctx.db.get('catechistMeetings', meetingId))!
      await writeAttendance(ctx, requesterId, meeting, attendance)
    }
    return meetingId
  },
})

export const updateMeeting = mutation({
  args: {
    requesterId: v.id('catechists'),
    meetingId: v.id('catechistMeetings'),
    meetingDate: v.optional(v.string()),
    title: v.optional(v.string()),
    scope: v.optional(scopeValidator),
    branchId: v.optional(v.id('branches')),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    attendance: v.optional(attendanceValidator),
  },
  handler: async (ctx, { requesterId, meetingId, attendance, ...patch }) => {
    const m = await loadMeeting(ctx, meetingId)
    await guardYear(ctx, requesterId, m.academicYearId)
    const scope = patch.scope ?? m.scope
    // Switching away from 'branch' drops the branch; otherwise a patch may
    // supply a new one.
    const branchId =
      scope === 'branch' ? (patch.branchId ?? m.branchId) : undefined
    const meetingDate = patch.meetingDate ?? m.meetingDate
    await validateShape(ctx, { meetingDate, scope, branchId })
    await ctx.db.patch('catechistMeetings', meetingId, {
      ...patch,
      scope,
      branchId,
      meetingDate,
    })
    if (attendance) {
      const updated = (await ctx.db.get('catechistMeetings', meetingId))!
      await writeAttendance(ctx, requesterId, updated, attendance)
    }
    return null
  },
})

/**
 * Live roster preview for a meeting that may not exist yet (create form).
 * Admin/board only, like meeting creation.
 */
export const getExpectedAttendees = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
    scope: scopeValidator,
    branchId: v.optional(v.id('branches')),
  },
  handler: async (ctx, { requesterId, ...meeting }) => {
    await assertBoardMemberOrAdmin(ctx, requesterId, meeting.academicYearId)
    const expected = await getExpectedCatechistsForMeeting(ctx, meeting)
    const out: Array<{
      catechistId: Id<'catechists'>
      memberId: string
      fullName: string
      saintName: string | undefined
    }> = []
    for (const e of expected) {
      const c = await ctx.db.get('catechists', e.catechistId)
      if (!c) continue
      out.push({
        catechistId: c._id,
        memberId: c.memberId,
        fullName: c.fullName,
        saintName: c.saintName,
      })
    }
    return out
  },
})

export const cancelMeeting = mutation({
  args: {
    requesterId: v.id('catechists'),
    meetingId: v.id('catechistMeetings'),
  },
  handler: async (ctx, args) => {
    const m = await loadMeeting(ctx, args.meetingId)
    await guardYear(ctx, args.requesterId, m.academicYearId)
    await ctx.db.patch('catechistMeetings', m._id, { isCancelled: true })
    return null
  },
})

export const softDeleteMeeting = mutation({
  args: {
    requesterId: v.id('catechists'),
    meetingId: v.id('catechistMeetings'),
  },
  handler: async (ctx, args) => {
    const m = await loadMeeting(ctx, args.meetingId)
    await guardYear(ctx, args.requesterId, m.academicYearId)
    await ctx.db.patch('catechistMeetings', m._id, { isDeleted: true })
    return null
  },
})

type Perms = Awaited<ReturnType<typeof getEffectivePermissions>>

/** Same rule as meeting recording (see catechistAttendance resolveTarget). */
function canRecordMeeting(perms: Perms, m: Doc<'catechistMeetings'>) {
  if (perms.isAdmin || perms.isBoardMember) return true
  return (
    m.scope === 'branch' &&
    !!m.branchId &&
    perms.branchHeadOf.includes(m.branchId)
  )
}

/**
 * Visibility: admin/board see everything; `all` is visible to everyone;
 * a branch head sees own-branch meetings; any other catechist sees a meeting
 * only when they are in its expected roster (e.g. teaches in that branch).
 * Board-scope meetings are therefore board/admin only.
 */
async function canViewMeeting(
  ctx: QueryCtx,
  requesterId: Id<'catechists'>,
  perms: Perms,
  m: Doc<'catechistMeetings'>,
) {
  if (perms.isAdmin || perms.isBoardMember || m.scope === 'all') return true
  if (m.scope === 'board') return false
  if (canRecordMeeting(perms, m)) return true
  const expected = await getExpectedCatechistsForMeeting(ctx, m)
  return expected.some((e) => e.catechistId === requesterId)
}

async function toView(
  ctx: QueryCtx,
  perms: Perms,
  m: Doc<'catechistMeetings'>,
) {
  const branch = m.branchId ? await ctx.db.get('branches', m.branchId) : null
  return {
    ...m,
    branchName: branch?.name ?? null,
    canManage: perms.isAdmin || perms.isBoardMember,
    canRecord: canRecordMeeting(perms, m),
  }
}

export const listMeetings = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
    scope: v.optional(scopeValidator),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const perms = await getEffectivePermissions(
      ctx,
      args.requesterId,
      args.academicYearId,
    )
    // ponytail: one year's meetings are few; cap instead of paginating
    const rows = await ctx.db
      .query('catechistMeetings')
      .withIndex('by_academic_year_id_and_meeting_date', (q) => {
        const base = q.eq('academicYearId', args.academicYearId)
        if (args.dateFrom && args.dateTo) {
          return base
            .gte('meetingDate', args.dateFrom)
            .lte('meetingDate', args.dateTo)
        }
        if (args.dateFrom) return base.gte('meetingDate', args.dateFrom)
        if (args.dateTo) return base.lte('meetingDate', args.dateTo)
        return base
      })
      .order('desc')
      .take(500)
    const out: Array<Awaited<ReturnType<typeof toView>>> = []
    for (const m of rows) {
      if (m.isDeleted || (args.scope && m.scope !== args.scope)) continue
      if (!(await canViewMeeting(ctx, args.requesterId, perms, m))) continue
      out.push(await toView(ctx, perms, m))
    }
    return out
  },
})

export const getMeeting = query({
  args: {
    requesterId: v.id('catechists'),
    meetingId: v.id('catechistMeetings'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const m = await ctx.db.get('catechistMeetings', args.meetingId)
    if (!m || m.isDeleted) return null
    const perms = await getEffectivePermissions(
      ctx,
      args.requesterId,
      m.academicYearId,
    )
    if (!(await canViewMeeting(ctx, args.requesterId, perms, m))) return null
    return await toView(ctx, perms, m)
  },
})

/** Meetings on a date the requester may record attendance for. */
export const listRecordableMeetings = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const perms = await getEffectivePermissions(
      ctx,
      args.requesterId,
      args.academicYearId,
    )
    const rows = await ctx.db
      .query('catechistMeetings')
      .withIndex('by_academic_year_id_and_meeting_date', (q) =>
        q
          .eq('academicYearId', args.academicYearId)
          .eq('meetingDate', args.date),
      )
      .take(50)
    const out: Array<{
      meetingId: Id<'catechistMeetings'>
      title: string
      scope: Doc<'catechistMeetings'>['scope']
      branchName: string | null
    }> = []
    for (const m of rows) {
      if (m.isDeleted || m.isCancelled || !canRecordMeeting(perms, m)) continue
      const branch = m.branchId
        ? await ctx.db.get('branches', m.branchId)
        : null
      out.push({
        meetingId: m._id,
        title: m.title,
        scope: m.scope,
        branchName: branch?.name ?? null,
      })
    }
    return out
  },
})
