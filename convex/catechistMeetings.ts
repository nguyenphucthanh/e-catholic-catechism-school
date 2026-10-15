import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { assertBoardMemberOrAdmin } from './lib/authz'
import { CATECHIST_MEETING_ERRORS } from './lib/errors'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'

const scopeValidator = v.union(
  v.literal('all'),
  v.literal('board'),
  v.literal('branch'),
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
  },
  handler: async (ctx, { requesterId, ...fields }) => {
    await guardYear(ctx, requesterId, fields.academicYearId)
    await validateShape(ctx, fields)
    return await ctx.db.insert('catechistMeetings', {
      ...fields,
      isCancelled: false,
      isDeleted: false,
    })
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
  },
  handler: async (ctx, { requesterId, meetingId, ...patch }) => {
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
    return null
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
