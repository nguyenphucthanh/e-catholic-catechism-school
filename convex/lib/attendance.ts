import type { Doc, Id } from '../_generated/dataModel'

type AttendanceStatus = Doc<'attendanceRecords'>['status']

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
