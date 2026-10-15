import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  assertBoardMemberOrAdmin,
  assertBranchHeadOrAbove,
  assertClassCatechistOrAbove,
  getEffectivePermissions,
} from './lib/authz'
import { CATECHIST_ATTENDANCE_ERRORS } from './lib/errors'
import { firstActive } from './lib/dbHelpers'
import {
  computeCatechistAttendanceRate,
  getExpectedCatechistsForClassSession,
  getExpectedCatechistsForMeeting,
  reconcileCatechistAttendanceRecord,
} from './lib/catechistAttendance'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { CatechistRole } from './lib/catechistAttendance'

const statusValidator = v.union(
  v.literal('present'),
  v.literal('late'),
  v.literal('excused_absence'),
  v.literal('unexcused_absence'),
)
const roleValidator = v.union(
  v.literal('homeroom'),
  v.literal('co_teacher'),
  v.literal('substitute'),
  v.literal('attendee'),
)
const checkInMethodValidator = v.union(
  v.literal('qr_scan'),
  v.literal('manual'),
)

type Target =
  | {
      kind: 'session'
      session: Doc<'classSessions'>
      academicYearId: Id<'academicYears'>
    }
  | {
      kind: 'meeting'
      meeting: Doc<'catechistMeetings'>
      academicYearId: Id<'academicYears'>
    }

/** Resolves + authorizes (board/branch/class per plan §2.0). Read-safe. */
async function resolveTarget(
  ctx: QueryCtx | MutationCtx,
  requesterId: Id<'catechists'>,
  ids: { sessionId?: Id<'classSessions'>; meetingId?: Id<'catechistMeetings'> },
): Promise<Target> {
  if (!ids.sessionId === !ids.meetingId) {
    throw new Error(CATECHIST_ATTENDANCE_ERRORS.INVALID_TARGET)
  }

  if (ids.sessionId) {
    const session = await ctx.db.get('classSessions', ids.sessionId)
    if (!session || session.isDeleted) {
      throw new Error(CATECHIST_ATTENDANCE_ERRORS.SESSION_NOT_FOUND)
    }
    if (
      (session.sessionType !== 'catechism' &&
        session.sessionType !== 'supplemental') ||
      !session.classYearId
    ) {
      throw new Error(CATECHIST_ATTENDANCE_ERRORS.INVALID_TARGET)
    }
    const classYear = await ctx.db.get('classYears', session.classYearId)
    if (!classYear || classYear.isDeleted) {
      throw new Error(CATECHIST_ATTENDANCE_ERRORS.SESSION_NOT_FOUND)
    }
    await assertClassCatechistOrAbove(
      ctx,
      requesterId,
      classYear.academicYearId,
      session.classYearId,
    )
    return {
      kind: 'session',
      session,
      academicYearId: classYear.academicYearId,
    }
  }

  const meeting = await ctx.db.get('catechistMeetings', ids.meetingId!)
  if (!meeting || meeting.isDeleted) {
    throw new Error(CATECHIST_ATTENDANCE_ERRORS.MEETING_NOT_FOUND)
  }
  if (meeting.scope === 'branch' && meeting.branchId) {
    await assertBranchHeadOrAbove(
      ctx,
      requesterId,
      meeting.academicYearId,
      meeting.branchId,
    )
  } else {
    await assertBoardMemberOrAdmin(ctx, requesterId, meeting.academicYearId)
  }
  return { kind: 'meeting', meeting, academicYearId: meeting.academicYearId }
}

async function isYearActive(
  ctx: QueryCtx | MutationCtx,
  academicYearId: Id<'academicYears'>,
) {
  const ay = await ctx.db.get('academicYears', academicYearId)
  return !!ay && !ay.isDeleted && ay.isActive
}

/** Write-path guard: resolve, authorize, AY lock, not cancelled. */
async function resolveWritableTarget(
  ctx: MutationCtx,
  requesterId: Id<'catechists'>,
  ids: { sessionId?: Id<'classSessions'>; meetingId?: Id<'catechistMeetings'> },
) {
  const target = await resolveTarget(ctx, requesterId, ids)
  if (!(await isYearActive(ctx, target.academicYearId))) {
    throw new Error(CATECHIST_ATTENDANCE_ERRORS.INACTIVE_ACADEMIC_YEAR)
  }
  if (target.kind === 'session' && target.session.isCancelled) {
    throw new Error(CATECHIST_ATTENDANCE_ERRORS.SESSION_CANCELLED)
  }
  if (target.kind === 'meeting' && target.meeting.isCancelled) {
    throw new Error(CATECHIST_ATTENDANCE_ERRORS.MEETING_CANCELLED)
  }
  return target
}

async function expectedFor(ctx: QueryCtx | MutationCtx, target: Target) {
  return target.kind === 'session'
    ? getExpectedCatechistsForClassSession(ctx, target.session)
    : getExpectedCatechistsForMeeting(ctx, target.meeting)
}

export async function recordOne(
  ctx: MutationCtx,
  target: Target,
  expected: Awaited<ReturnType<typeof expectedFor>>,
  requesterId: Id<'catechists'>,
  rec: {
    catechistId: Id<'catechists'>
    status: Doc<'catechistAttendanceRecords'>['status']
    roleAtSession?: CatechistRole
    checkInMethod?: 'qr_scan' | 'manual'
    notes?: string
    deviceQueuedAt?: number
  },
) {
  const catechist = await ctx.db.get('catechists', rec.catechistId)
  if (!catechist || catechist.isDeleted) {
    throw new Error(CATECHIST_ATTENDANCE_ERRORS.CATECHIST_NOT_FOUND)
  }
  const role: CatechistRole =
    rec.roleAtSession ??
    (target.kind === 'meeting'
      ? 'attendee'
      : (expected.find((e) => e.catechistId === rec.catechistId)
          ?.roleAtSession ?? 'substitute'))

  return await reconcileCatechistAttendanceRecord(ctx, {
    sessionId: target.kind === 'session' ? target.session._id : undefined,
    meetingId: target.kind === 'meeting' ? target.meeting._id : undefined,
    catechistId: rec.catechistId,
    status: rec.status,
    roleAtSession: role,
    checkInMethod: rec.checkInMethod,
    notes: rec.notes,
    recordedBy: requesterId,
    deviceQueuedAt: rec.deviceQueuedAt ?? Date.now(),
  })
}

/** Soft-deletes a catechist's live record for a meeting; no-op when none. */
export async function clearMeetingRecord(
  ctx: MutationCtx,
  meetingId: Id<'catechistMeetings'>,
  catechistId: Id<'catechists'>,
) {
  const record = await firstActive(
    ctx.db
      .query('catechistAttendanceRecords')
      .withIndex('by_meeting_id_and_catechist_id', (q) =>
        q.eq('meetingId', meetingId).eq('catechistId', catechistId),
      ),
  )
  if (record) {
    await ctx.db.patch('catechistAttendanceRecords', record._id, {
      isDeleted: true,
    })
  }
}

export const recordAttendance = mutation({
  args: {
    requesterId: v.id('catechists'),
    sessionId: v.optional(v.id('classSessions')),
    meetingId: v.optional(v.id('catechistMeetings')),
    catechistId: v.id('catechists'),
    status: statusValidator,
    roleAtSession: v.optional(roleValidator),
    checkInMethod: v.optional(checkInMethodValidator),
    notes: v.optional(v.string()),
    deviceQueuedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { requesterId, sessionId, meetingId, ...rec } = args
    const target = await resolveWritableTarget(ctx, requesterId, {
      sessionId,
      meetingId,
    })
    const expected = await expectedFor(ctx, target)
    return await recordOne(ctx, target, expected, requesterId, rec)
  },
})

export const batchRecordAttendance = mutation({
  args: {
    requesterId: v.id('catechists'),
    sessionId: v.optional(v.id('classSessions')),
    meetingId: v.optional(v.id('catechistMeetings')),
    records: v.array(
      v.object({
        catechistId: v.id('catechists'),
        status: statusValidator,
        notes: v.optional(v.string()),
        roleAtSession: v.optional(roleValidator),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { requesterId, sessionId, meetingId, records } = args
    const target = await resolveWritableTarget(ctx, requesterId, {
      sessionId,
      meetingId,
    })
    if (new Set(records.map((r) => r.catechistId)).size !== records.length) {
      throw new Error(CATECHIST_ATTENDANCE_ERRORS.DUPLICATE_CATECHIST)
    }
    const expected = await expectedFor(ctx, target)
    const ids: Array<Id<'catechistAttendanceRecords'>> = []
    for (const rec of records) {
      const { id } = await recordOne(ctx, target, expected, requesterId, rec)
      ids.push(id)
    }
    return ids
  },
})

export const deleteAttendanceRecord = mutation({
  args: {
    requesterId: v.id('catechists'),
    recordId: v.id('catechistAttendanceRecords'),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get('catechistAttendanceRecords', args.recordId)
    if (!record || record.isDeleted) {
      throw new Error(CATECHIST_ATTENDANCE_ERRORS.RECORD_NOT_FOUND)
    }
    await resolveWritableTarget(ctx, args.requesterId, {
      sessionId: record.sessionId,
      meetingId: record.meetingId,
    })
    await ctx.db.patch('catechistAttendanceRecords', record._id, {
      isDeleted: true,
    })
    return null
  },
})

// ─── Queries ─────────────────────────────────────────────────────────────

/**
 * Class sessions on `date` the requester may record catechist attendance for
 * (mirrors assertClassCatechistOrAbove: admin/board = all, branch head =
 * their branches, catechist = own classes). Unlike classSessions
 * `listMySessionsInRange`, admin/board are not filtered out.
 */
export const listRecordableSessions = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const perms = await getEffectivePermissions(
      ctx,
      args.requesterId,
      args.academicYearId,
    )
    const sessions = await ctx.db
      .query('classSessions')
      .withIndex('by_session_date', (q) => q.eq('sessionDate', args.date))
      .collect()
    const out: Array<{
      sessionId: Id<'classSessions'>
      className: string
      sessionType: 'catechism' | 'supplemental'
    }> = []
    for (const s of sessions) {
      if (
        s.isDeleted ||
        s.isCancelled ||
        !s.classYearId ||
        (s.sessionType !== 'catechism' && s.sessionType !== 'supplemental')
      ) {
        continue
      }
      const cy = await ctx.db.get('classYears', s.classYearId)
      if (!cy || cy.isDeleted || cy.academicYearId !== args.academicYearId) {
        continue
      }
      const cls = await ctx.db.get('classes', cy.classId)
      if (!cls || cls.isDeleted) continue
      const allowed =
        perms.isAdmin ||
        perms.isBoardMember ||
        perms.classCatechistOf.includes(cy._id) ||
        perms.branchHeadOf.includes(cls.branchId)
      if (!allowed) continue
      out.push({
        sessionId: s._id,
        className: cls.name,
        sessionType: s.sessionType,
      })
    }
    return out.sort((a, b) => a.className.localeCompare(b.className))
  },
})

async function buildRoster(
  ctx: QueryCtx,
  target: Target,
  recordsQuery: Array<Doc<'catechistAttendanceRecords'>>,
) {
  const records = recordsQuery.filter((r) => !r.isDeleted)
  const active = await isYearActive(ctx, target.academicYearId)

  const describe = async (
    catechistId: Id<'catechists'>,
    roleAtSession: CatechistRole | undefined,
    record: Doc<'catechistAttendanceRecords'> | undefined,
  ) => {
    const c = await ctx.db.get('catechists', catechistId)
    return {
      catechistId,
      memberId: c?.memberId ?? null,
      fullName: c?.fullName ?? null,
      saintName: c?.saintName ?? null,
      roleAtSession: record?.roleAtSession ?? roleAtSession ?? null,
      status: record?.status ?? null,
      recordId: record?._id ?? null,
      checkInMethod: record?.checkInMethod ?? null,
      notes: record?.notes ?? null,
    }
  }

  const counts = computeCatechistAttendanceRate(records)
  const base = {
    present: counts.present,
    late: counts.late,
    excused: counts.excused,
    unexcused: counts.unexcused,
  }

  // Past/locked year: today's catechist flags would distort the roster, so
  // report recorded rows only and no unrecorded count.
  if (!active) {
    return {
      roster: await Promise.all(
        records.map((r) => describe(r.catechistId, r.roleAtSession, r)),
      ),
      substitutes: [],
      summary: { totalExpected: null, ...base, unrecorded: null },
    }
  }

  const expected = await expectedFor(ctx, target)
  const byCatechist = new Map(records.map((r) => [r.catechistId, r]))
  const roster = await Promise.all(
    expected.map((e) =>
      describe(e.catechistId, e.roleAtSession, byCatechist.get(e.catechistId)),
    ),
  )
  const expectedIds = new Set(expected.map((e) => e.catechistId))
  const substitutes = await Promise.all(
    records
      .filter((r) => !expectedIds.has(r.catechistId))
      .map((r) => describe(r.catechistId, r.roleAtSession, r)),
  )
  return {
    roster,
    substitutes,
    summary: {
      totalExpected: expected.length,
      ...base,
      unrecorded: roster.filter((r) => r.status === null).length,
    },
  }
}

export const getSessionAttendanceRoster = query({
  args: { requesterId: v.id('catechists'), sessionId: v.id('classSessions') },
  handler: async (ctx, args) => {
    const target = await resolveTarget(ctx, args.requesterId, {
      sessionId: args.sessionId,
    })
    const records = await ctx.db
      .query('catechistAttendanceRecords')
      .withIndex('by_session_id_and_catechist_id', (q) =>
        q.eq('sessionId', args.sessionId),
      )
      .collect()
    return await buildRoster(ctx, target, records)
  },
})

export const getMeetingAttendanceRoster = query({
  args: {
    requesterId: v.id('catechists'),
    meetingId: v.id('catechistMeetings'),
  },
  handler: async (ctx, args) => {
    const target = await resolveTarget(ctx, args.requesterId, {
      meetingId: args.meetingId,
    })
    const records = await ctx.db
      .query('catechistAttendanceRecords')
      .withIndex('by_meeting_id_and_catechist_id', (q) =>
        q.eq('meetingId', args.meetingId),
      )
      .collect()
    return await buildRoster(ctx, target, records)
  },
})

type HistoryEntry = {
  recordId: Id<'catechistAttendanceRecords'>
  kind: 'class' | 'meeting'
  targetId: Id<'classSessions'> | Id<'catechistMeetings'>
  date: string
  title: string | null
  isCancelled: boolean
  status: Doc<'catechistAttendanceRecords'>['status']
  roleAtSession: CatechistRole | null
}

/** Live records of a catechist inside one year, joined to their target. */
async function loadCatechistEntries(
  ctx: QueryCtx,
  catechistId: Id<'catechists'>,
  academicYearId: Id<'academicYears'>,
): Promise<Array<HistoryEntry>> {
  // ponytail: unbounded per-catechist collect; one catechist's lifetime rows stay small
  const records = await ctx.db
    .query('catechistAttendanceRecords')
    .withIndex('by_catechist_id', (q) => q.eq('catechistId', catechistId))
    .collect()
  const out: Array<HistoryEntry> = []
  for (const r of records) {
    if (r.isDeleted) continue
    if (r.sessionId) {
      const s = await ctx.db.get('classSessions', r.sessionId)
      if (!s || s.isDeleted || !s.classYearId) continue
      const cy = await ctx.db.get('classYears', s.classYearId)
      if (!cy || cy.academicYearId !== academicYearId) continue
      out.push({
        recordId: r._id,
        kind: 'class',
        targetId: s._id,
        date: s.sessionDate,
        title: null,
        isCancelled: s.isCancelled,
        status: r.status,
        roleAtSession: r.roleAtSession ?? null,
      })
    } else if (r.meetingId) {
      const m = await ctx.db.get('catechistMeetings', r.meetingId)
      if (!m || m.isDeleted || m.academicYearId !== academicYearId) continue
      out.push({
        recordId: r._id,
        kind: 'meeting',
        targetId: m._id,
        date: m.meetingDate,
        title: m.title,
        isCancelled: m.isCancelled,
        status: r.status,
        roleAtSession: r.roleAtSession ?? null,
      })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

// Self, or board/admin of that year.
async function assertCanViewCatechist(
  ctx: QueryCtx,
  requesterId: Id<'catechists'>,
  catechistId: Id<'catechists'>,
  academicYearId: Id<'academicYears'>,
) {
  if (requesterId === catechistId) return
  await assertBoardMemberOrAdmin(ctx, requesterId, academicYearId)
}

export const getCatechistAttendanceSummary = query({
  args: {
    requesterId: v.id('catechists'),
    catechistId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
    // Query can't read the clock; the client passes today (YYYY-MM-DD) so
    // `unrecorded` only counts targets that already happened.
    asOfDate: v.string(),
  },
  handler: async (ctx, args) => {
    await assertCanViewCatechist(
      ctx,
      args.requesterId,
      args.catechistId,
      args.academicYearId,
    )
    const entries = (
      await loadCatechistEntries(ctx, args.catechistId, args.academicYearId)
    ).filter((e) => !e.isCancelled)
    const classTeaching = computeCatechistAttendanceRate(
      entries.filter((e) => e.kind === 'class'),
    )
    const meeting = computeCatechistAttendanceRate(
      entries.filter((e) => e.kind === 'meeting'),
    )
    const overall = computeCatechistAttendanceRate(entries)

    let unrecorded: number | null = null
    if (await isYearActive(ctx, args.academicYearId)) {
      unrecorded = 0
      const recorded = new Set<string>(entries.map((e) => e.targetId))

      const assignments = await ctx.db
        .query('classCatechists')
        .withIndex('by_catechist_id', (q) =>
          q.eq('catechistId', args.catechistId),
        )
        .collect()
      for (const a of assignments) {
        if (a.isDeleted || a.academicYearId !== args.academicYearId) continue
        const sessions = await ctx.db
          .query('classSessions')
          .withIndex('by_class_year_id_and_semester_id', (q) =>
            q.eq('classYearId', a.classYearId),
          )
          .collect()
        for (const s of sessions) {
          if (
            s.isDeleted ||
            s.isCancelled ||
            s.sessionDate > args.asOfDate ||
            (s.sessionType !== 'catechism' && s.sessionType !== 'supplemental')
          ) {
            continue
          }
          if (!recorded.has(s._id)) unrecorded++
        }
      }

      const meetings = await ctx.db
        .query('catechistMeetings')
        .withIndex('by_academic_year_id_and_meeting_date', (q) =>
          q
            .eq('academicYearId', args.academicYearId)
            .lte('meetingDate', args.asOfDate),
        )
        .collect()
      for (const m of meetings) {
        if (m.isDeleted || m.isCancelled || recorded.has(m._id)) continue
        const exp = await getExpectedCatechistsForMeeting(ctx, m)
        if (exp.some((e) => e.catechistId === args.catechistId)) unrecorded++
      }
    }

    return { classTeaching, meeting, overall, unrecorded }
  },
})

export const listCatechistAttendanceHistory = query({
  args: {
    requesterId: v.id('catechists'),
    catechistId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
    kind: v.optional(v.union(v.literal('class'), v.literal('meeting'))),
  },
  handler: async (ctx, args) => {
    await assertCanViewCatechist(
      ctx,
      args.requesterId,
      args.catechistId,
      args.academicYearId,
    )
    const entries = await loadCatechistEntries(
      ctx,
      args.catechistId,
      args.academicYearId,
    )
    return args.kind ? entries.filter((e) => e.kind === args.kind) : entries
  },
})

// Bounds for the yearly matrix. A year can hold thousands of class sessions,
// so we cap targets and catechist rows and flag `truncated` instead of
// paginating: the matrix is rendered as one table, and callers can narrow with
// `branchId`. Each class (and the meeting list) contributes at most
// MATRIX_MAX_TARGETS + 1 rows in index order, then the merged list is sorted by
// date and cut to MATRIX_MAX_TARGETS. So when `truncated` is true the kept
// targets are the earliest of what was read, not guaranteed the earliest of the
// whole year. Totals cover the included targets only.
const MATRIX_MAX_TARGETS = 120
const MATRIX_MAX_CATECHISTS = 100

type MatrixCell = Doc<'catechistAttendanceRecords'>['status'] | 'unrecorded'

/**
 * Catechists x (class sessions + meetings) for one year. Admin/board for the
 * whole year; with `branchId`, branch heads of that branch also qualify.
 * Cell: a status, 'unrecorded' (assigned to the class, no record yet), or
 * null (not applicable / no record). Cancelled targets are left out, so they
 * never affect rates; rates use recorded rows only.
 */
export const getYearlyMatrixReport = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
    branchId: v.optional(v.id('branches')),
  },
  handler: async (ctx, args) => {
    const { requesterId, academicYearId, branchId } = args
    if (branchId) {
      await assertBranchHeadOrAbove(ctx, requesterId, academicYearId, branchId)
    } else {
      await assertBoardMemberOrAdmin(ctx, requesterId, academicYearId)
    }

    type MatrixTarget = {
      id: Id<'classSessions'> | Id<'catechistMeetings'>
      kind: 'class' | 'meeting'
      date: string
      label: string
      classYearId?: Id<'classYears'>
    }
    const targets: Array<MatrixTarget> = []
    const assigned = new Map<Id<'classYears'>, Array<Id<'catechists'>>>()

    const classYears = await ctx.db
      .query('classYears')
      .withIndex('by_academic_year_id', (q) =>
        q.eq('academicYearId', academicYearId),
      )
      .collect()
    for (const cy of classYears) {
      if (cy.isDeleted) continue
      const cls = await ctx.db.get('classes', cy.classId)
      if (!cls || cls.isDeleted || (branchId && cls.branchId !== branchId)) {
        continue
      }
      const teachers = await ctx.db
        .query('classCatechists')
        .withIndex('by_class_year_id', (q) => q.eq('classYearId', cy._id))
        .collect()
      assigned.set(
        cy._id,
        teachers.filter((r) => !r.isDeleted).map((r) => r.catechistId),
      )
      const sessions = await ctx.db
        .query('classSessions')
        .withIndex('by_class_year_id_and_semester_id', (q) =>
          q.eq('classYearId', cy._id),
        )
        .take(MATRIX_MAX_TARGETS + 1)
      for (const s of sessions) {
        if (
          s.isDeleted ||
          s.isCancelled ||
          (s.sessionType !== 'catechism' && s.sessionType !== 'supplemental')
        ) {
          continue
        }
        targets.push({
          id: s._id,
          kind: 'class',
          date: s.sessionDate,
          label: cls.name,
          classYearId: cy._id,
        })
      }
    }

    const meetings = await ctx.db
      .query('catechistMeetings')
      .withIndex('by_academic_year_id_and_meeting_date', (q) =>
        q.eq('academicYearId', academicYearId),
      )
      .take(MATRIX_MAX_TARGETS + 1)
    for (const m of meetings) {
      if (m.isDeleted || m.isCancelled) continue
      // Branch filter keeps year-wide and that branch's meetings.
      if (branchId && m.scope === 'board') continue
      if (branchId && m.scope === 'branch' && m.branchId !== branchId) continue
      targets.push({
        id: m._id,
        kind: 'meeting',
        date: m.meetingDate,
        label: m.title,
      })
    }

    targets.sort((a, b) => a.date.localeCompare(b.date))
    let truncated = targets.length > MATRIX_MAX_TARGETS
    targets.length = Math.min(targets.length, MATRIX_MAX_TARGETS)

    const cells = new Map<Id<'catechists'>, Array<MatrixCell | null>>()
    const row = (id: Id<'catechists'>) => {
      let r = cells.get(id)
      if (!r) {
        r = targets.map(() => null)
        cells.set(id, r)
      }
      return r
    }

    for (const [ti, target] of targets.entries()) {
      if (target.kind === 'class') {
        for (const cid of assigned.get(target.classYearId!) ?? []) {
          row(cid)[ti] = 'unrecorded'
        }
      }
      const sessionId = target.kind === 'class' ? target.id : undefined
      const records = await (sessionId
        ? ctx.db
            .query('catechistAttendanceRecords')
            .withIndex('by_session_id_and_catechist_id', (q) =>
              q.eq('sessionId', sessionId as Id<'classSessions'>),
            )
            .collect()
        : ctx.db
            .query('catechistAttendanceRecords')
            .withIndex('by_meeting_id_and_catechist_id', (q) =>
              q.eq('meetingId', target.id as Id<'catechistMeetings'>),
            )
            .collect())
      for (const r of records) {
        if (!r.isDeleted) row(r.catechistId)[ti] = r.status
      }
    }

    const people: Array<{
      catechistId: Id<'catechists'>
      memberId: string
      saintName: string | null
      fullName: string
      cells: Array<MatrixCell | null>
      totals: ReturnType<typeof computeCatechistAttendanceRate>
    }> = []
    for (const [catechistId, rowCells] of cells) {
      const c = await ctx.db.get('catechists', catechistId)
      if (!c || c.isDeleted) continue
      const recorded = rowCells.filter(
        (x): x is Doc<'catechistAttendanceRecords'>['status'] =>
          x !== null && x !== 'unrecorded',
      )
      people.push({
        catechistId,
        memberId: c.memberId,
        saintName: c.saintName ?? null,
        fullName: c.fullName,
        cells: rowCells,
        totals: computeCatechistAttendanceRate(
          recorded.map((status) => ({ status })),
        ),
      })
    }
    people.sort((a, b) => a.fullName.localeCompare(b.fullName))
    if (people.length > MATRIX_MAX_CATECHISTS) {
      people.length = MATRIX_MAX_CATECHISTS
      truncated = true
    }

    return {
      targets: targets.map(({ id, kind, date, label }) => ({
        id,
        kind,
        date,
        label,
      })),
      rows: people,
      truncated,
    }
  },
})
