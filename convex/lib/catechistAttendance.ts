import { CATECHIST_ATTENDANCE_ERRORS } from './errors'
import { firstActive } from './dbHelpers'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

export type CatechistAttendanceStatus =
  Doc<'catechistAttendanceRecords'>['status']
export type CatechistRole = NonNullable<
  Doc<'catechistAttendanceRecords'>['roleAtSession']
>
export type ExpectedCatechist = {
  catechistId: Id<'catechists'>
  roleAtSession: CatechistRole
}

async function isEligible(
  ctx: QueryCtx | MutationCtx,
  catechistId: Id<'catechists'>,
) {
  const c = await ctx.db.get('catechists', catechistId)
  return !!c && !c.isDeleted && c.isActive
}

// Roster drift note: catechists.isActive is global, so this is only
// meaningful for the active academic year. Callers use recorded rows only
// for locked/past years.
async function dedupeEligible(
  ctx: QueryCtx | MutationCtx,
  rows: Array<ExpectedCatechist>,
): Promise<Array<ExpectedCatechist>> {
  const seen = new Set<string>()
  const out: Array<ExpectedCatechist> = []
  for (const r of rows) {
    if (seen.has(r.catechistId)) continue
    if (!(await isEligible(ctx, r.catechistId))) continue
    seen.add(r.catechistId)
    out.push(r)
  }
  return out
}

async function classTeachers(
  ctx: QueryCtx | MutationCtx,
  classYearId: Id<'classYears'>,
): Promise<Array<ExpectedCatechist>> {
  const rows = await ctx.db
    .query('classCatechists')
    .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYearId))
    .collect()
  return rows
    .filter((r) => !r.isDeleted)
    .map((r) => ({ catechistId: r.catechistId, roleAtSession: r.role }))
}

export async function getExpectedCatechistsForClassSession(
  ctx: QueryCtx | MutationCtx,
  session: Doc<'classSessions'>,
): Promise<Array<ExpectedCatechist>> {
  if (!session.classYearId) return []
  return dedupeEligible(ctx, await classTeachers(ctx, session.classYearId))
}

export async function getExpectedCatechistsForMeeting(
  ctx: QueryCtx | MutationCtx,
  meeting: Doc<'catechistMeetings'>,
): Promise<Array<ExpectedCatechist>> {
  const attendee = (catechistId: Id<'catechists'>): ExpectedCatechist => ({
    catechistId,
    roleAtSession: 'attendee',
  })

  if (meeting.scope === 'all') {
    const all = await ctx.db
      .query('catechists')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()
    return all.filter((c) => c.isActive).map((c) => attendee(c._id))
  }

  if (meeting.scope === 'board') {
    const rows = await ctx.db
      .query('academicYearAssignments')
      .withIndex('by_academic_year_id', (q) =>
        q.eq('academicYearId', meeting.academicYearId),
      )
      .collect()
    return dedupeEligible(
      ctx,
      rows.filter((r) => !r.isDeleted).map((r) => attendee(r.catechistId)),
    )
  }

  // branch: branch heads + catechists teaching in the branch's classes
  const branchId = meeting.branchId
  if (!branchId) return []
  const heads = await ctx.db
    .query('branchAssignments')
    .withIndex('by_academic_year_id_and_branch_id', (q) =>
      q.eq('academicYearId', meeting.academicYearId).eq('branchId', branchId),
    )
    .collect()
  const rows = heads
    .filter((r) => !r.isDeleted)
    .map((r) => attendee(r.catechistId))

  const classes = await ctx.db
    .query('classes')
    .withIndex('by_branch_id', (q) => q.eq('branchId', branchId))
    .collect()
  for (const cls of classes.filter((c) => !c.isDeleted)) {
    const years = await ctx.db
      .query('classYears')
      .withIndex('by_class_id_and_academic_year_id', (q) =>
        q.eq('classId', cls._id).eq('academicYearId', meeting.academicYearId),
      )
      .collect()
    for (const cy of years.filter((y) => !y.isDeleted)) {
      for (const t of await classTeachers(ctx, cy._id)) {
        rows.push(attendee(t.catechistId))
      }
    }
  }
  return dedupeEligible(ctx, rows)
}

/**
 * Upsert one catechist attendance record.
 * - manual write: always overwrites (status/notes/recordedBy/method/time).
 * - qr_scan over qr_scan: first-write-wins, i.e. only an earlier
 *   deviceQueuedAt replaces the stored one.
 * - qr_scan over a manual record: never overwrites (manual is authoritative).
 * Soft-deleted rows are reactivated in place.
 */
export async function reconcileCatechistAttendanceRecord(
  ctx: MutationCtx,
  args: {
    sessionId?: Id<'classSessions'>
    meetingId?: Id<'catechistMeetings'>
    catechistId: Id<'catechists'>
    status: CatechistAttendanceStatus
    roleAtSession?: CatechistRole
    checkInMethod?: 'qr_scan' | 'manual'
    notes?: string
    recordedBy: Id<'catechists'>
    deviceQueuedAt: number
  },
): Promise<{
  id: Id<'catechistAttendanceRecords'>
  action: 'synced' | 'conflict'
}> {
  const { sessionId, meetingId, catechistId } = args
  if (!sessionId === !meetingId) {
    throw new Error(CATECHIST_ATTENDANCE_ERRORS.INVALID_TARGET)
  }
  const method = args.checkInMethod ?? 'manual'

  const existing = await firstActive(
    sessionId
      ? ctx.db
          .query('catechistAttendanceRecords')
          .withIndex('by_session_id_and_catechist_id', (q) =>
            q.eq('sessionId', sessionId).eq('catechistId', catechistId),
          )
      : ctx.db
          .query('catechistAttendanceRecords')
          .withIndex('by_meeting_id_and_catechist_id', (q) =>
            q.eq('meetingId', meetingId).eq('catechistId', catechistId),
          ),
  )

  const fields = {
    status: args.status,
    roleAtSession: args.roleAtSession,
    checkInMethod: method,
    notes: args.notes,
    recordedBy: args.recordedBy,
    deviceQueuedAt: args.deviceQueuedAt,
    syncedAt: Date.now(),
  }

  if (existing) {
    if (method === 'qr_scan') {
      const keepExisting =
        existing.checkInMethod !== 'qr_scan' ||
        args.deviceQueuedAt >= existing.deviceQueuedAt
      if (keepExisting) return { id: existing._id, action: 'conflict' }
    }
    await ctx.db.patch('catechistAttendanceRecords', existing._id, fields)
    return { id: existing._id, action: 'synced' }
  }

  // A soft-deleted row for this key may exist; reactivate instead of
  // inserting a duplicate.
  const all = await (
    sessionId
      ? ctx.db
          .query('catechistAttendanceRecords')
          .withIndex('by_session_id_and_catechist_id', (q) =>
            q.eq('sessionId', sessionId).eq('catechistId', catechistId),
          )
      : ctx.db
          .query('catechistAttendanceRecords')
          .withIndex('by_meeting_id_and_catechist_id', (q) =>
            q.eq('meetingId', meetingId).eq('catechistId', catechistId),
          )
  ).collect()
  const deleted = all.at(0)
  if (deleted) {
    await ctx.db.patch('catechistAttendanceRecords', deleted._id, {
      ...fields,
      isDeleted: false,
    })
    return { id: deleted._id, action: 'synced' }
  }

  const id = await ctx.db.insert('catechistAttendanceRecords', {
    sessionId,
    meetingId,
    catechistId,
    ...fields,
    isDeleted: false,
  })
  return { id, action: 'synced' }
}

export type CatechistAttendanceRate = {
  present: number
  late: number
  excused: number
  unexcused: number
  total: number
  rate: number | null
}

export function computeCatechistAttendanceRate(
  records: Array<{ status: CatechistAttendanceStatus }>,
): CatechistAttendanceRate {
  const c = { present: 0, late: 0, excused: 0, unexcused: 0 }
  for (const r of records) {
    if (r.status === 'present') c.present++
    else if (r.status === 'late') c.late++
    else if (r.status === 'excused_absence') c.excused++
    else c.unexcused++
  }
  const total = c.present + c.late + c.excused + c.unexcused
  return {
    ...c,
    total,
    rate: total === 0 ? null : (c.present + c.late) / total,
  }
}
