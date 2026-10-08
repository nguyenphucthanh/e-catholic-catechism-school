import { v } from 'convex/values'
import { ATTENDANCE_ERRORS } from './errors'
import type { Doc, Id } from '../_generated/dataModel'

export type AttendanceStatus = Doc<'attendanceRecords'>['status']

// Sessions that count toward a student's attendance rate: catechism/
// supplemental sessions tied to a classYear, excluding cancelled ones.
// Parish-scoped sessions (mass, extracurricular) are out of scope here.
export function isClassScopedSession(session: Doc<'classSessions'>): boolean {
  return (
    !session.isDeleted &&
    !session.isCancelled &&
    (session.sessionType === 'catechism' ||
      session.sessionType === 'supplemental')
  )
}

export type AttendanceSummary = {
  present: number
  late: number
  excusedAbsence: number
  unexcusedAbsence: number
  notMarked: number
  total: number
  rate: number // (present + late) / total, 0–1 fraction; 0 if total is 0
}

// Pure: caller fetches the scheduled session ids (already filtered via
// isClassScopedSession) and the recorded status per session for one student.
export function computeAttendanceSummary(
  scheduledSessionIds: Array<Id<'classSessions'>>,
  statusBySessionId: Map<Id<'classSessions'>, AttendanceStatus>,
): AttendanceSummary {
  const tally = {
    present: 0,
    late: 0,
    excusedAbsence: 0,
    unexcusedAbsence: 0,
    notMarked: 0,
  }

  for (const sessionId of scheduledSessionIds) {
    const status = statusBySessionId.get(sessionId)
    if (status === 'present') tally.present += 1
    else if (status === 'late') tally.late += 1
    else if (status === 'excused_absence') tally.excusedAbsence += 1
    else if (status === 'unexcused_absence') tally.unexcusedAbsence += 1
    else tally.notMarked += 1
  }

  const total = scheduledSessionIds.length

  return {
    ...tally,
    total,
    rate: total > 0 ? (tally.present + tally.late) / total : 0,
  }
}

export type AttendancePointConfig =
  | { mode: 'rate' }
  | {
      mode: 'type'
      present: number
      late: number
      excused: number
      absentUnset: number
    }

export const attendancePointConfigValidator = v.union(
  v.object({
    mode: v.literal('rate'),
  }),
  v.object({
    mode: v.literal('type'),
    present: v.number(),
    late: v.number(),
    excused: v.number(),
    absentUnset: v.number(),
  }),
)

export const ATTENDANCE_POINT_LIMIT = 10

// Mutation-layer guard: the UI zod schema is not trusted. Rejects NaN/Infinity
// and values outside ±ATTENDANCE_POINT_LIMIT.
export function assertValidAttendancePointConfig(
  config: AttendancePointConfig | undefined,
) {
  if (!config || config.mode === 'rate') return
  const { present, late, excused, absentUnset } = config
  for (const n of [present, late, excused, absentUnset]) {
    if (!Number.isFinite(n) || Math.abs(n) > ATTENDANCE_POINT_LIMIT) {
      throw new Error(ATTENDANCE_ERRORS.INVALID_POINT_CONFIG)
    }
  }
}

export function computeAttendancePoint(
  summary: {
    present: number
    late: number
    excusedAbsence: number
    unexcusedAbsence: number
    notMarked: number
    total: number
    rate: number | null
  },
  config?: AttendancePointConfig,
): number | null {
  if (summary.total === 0 || summary.rate === null) {
    return null
  }

  if (!config || config.mode === 'rate') {
    const point = summary.rate * 10
    return Math.max(0, Math.min(10, Math.round(point * 10) / 10))
  }

  const totalPoints =
    summary.present * config.present +
    summary.late * config.late +
    summary.excusedAbsence * config.excused +
    (summary.unexcusedAbsence + summary.notMarked) * config.absentUnset

  const rawAverage = totalPoints / summary.total
  return Math.max(0, Math.min(10, Math.round(rawAverage * 10) / 10))
}

export type ReconcileMode =
  'overwrite' | 'first_write_wins' | 'error_on_conflict'

/**
 * Reconciles an attendance record insertion or update for a (sessionId, studentClassId) pair.
 * Handles:
 * - Soft-deletion reactivation
 * - LWW (First-Write-Wins based on deviceQueuedAt if conflict occurs)
 * - Single vs batch conflict behavior
 */
export async function reconcileAttendanceRecord(
  ctx: { db: any },
  args: {
    sessionId: Id<'classSessions'>
    studentClassId: Id<'studentClasses'>
    status: AttendanceStatus | null
    notes?: string
    recordedBy: Id<'catechists'>
    deviceQueuedAt: number
    mode: ReconcileMode
    // Pass when the caller already fetched the row (e.g. a batch mutation
    // resolving all existing records in one indexed query) to avoid a
    // redundant per-record lookup here.
    existing?: Doc<'attendanceRecords'> | null
  },
): Promise<{
  id: Id<'attendanceRecords'> | undefined
  action: 'synced' | 'deleted' | 'conflict'
}> {
  const mode = args.mode

  const existing =
    args.existing !== undefined
      ? args.existing
      : await ctx.db
          .query('attendanceRecords')
          .withIndex('by_session_id_and_student_class_id', (q: any) =>
            q
              .eq('sessionId', args.sessionId)
              .eq('studentClassId', args.studentClassId),
          )
          .unique()

  if (args.status === null) {
    if (existing && !existing.isDeleted) {
      await ctx.db.patch('attendanceRecords', existing._id, {
        isDeleted: true,
      })
    }
    return { id: existing?._id, action: 'deleted' }
  }

  if (existing) {
    if (!existing.isDeleted) {
      if (mode === 'error_on_conflict') {
        throw new Error('ATTENDANCE_ALREADY_RECORDED')
      }

      if (mode === 'first_write_wins') {
        if (args.deviceQueuedAt >= existing.deviceQueuedAt) {
          return { id: existing._id, action: 'conflict' }
        }
      }

      await ctx.db.patch('attendanceRecords', existing._id, {
        status: args.status,
        notes: args.notes,
        recordedBy: args.recordedBy,
        deviceQueuedAt: args.deviceQueuedAt,
        syncedAt: Date.now(),
      })
      return { id: existing._id, action: 'synced' }
    }

    // Reactivate soft-deleted record
    await ctx.db.patch('attendanceRecords', existing._id, {
      status: args.status,
      notes: args.notes,
      recordedBy: args.recordedBy,
      deviceQueuedAt: args.deviceQueuedAt,
      syncedAt: Date.now(),
      isDeleted: false,
    })
    return { id: existing._id, action: 'synced' }
  }

  const id = await ctx.db.insert('attendanceRecords', {
    sessionId: args.sessionId,
    studentClassId: args.studentClassId,
    status: args.status,
    notes: args.notes,
    recordedBy: args.recordedBy,
    deviceQueuedAt: args.deviceQueuedAt,
    syncedAt: Date.now(),
    isDeleted: false,
  })

  return { id, action: 'synced' }
}
