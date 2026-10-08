import { z } from 'zod'
import {
  ATTENDANCE_POINT_LIMIT,
  computeAttendancePoint,
  computeAttendanceSummary,
} from '../../convex/lib/attendance'
import type { Id } from '../../convex/_generated/dataModel'
import type {
  AttendancePointConfig,
  AttendanceStatus,
  AttendanceSummary,
} from '../../convex/lib/attendance'

export { computeAttendancePoint }

// Shared by the global config form and the per-class dialog.
export const attendancePointValueSchema = (message: string) =>
  z
    .number()
    .min(-ATTENDANCE_POINT_LIMIT, message)
    .max(ATTENDANCE_POINT_LIMIT, message)
export type { AttendancePointConfig }

/**
 * One attendance cell as the grid queries return it: a status string, or no
 * entry at all when the cell was never marked.
 */
type GridAttendanceRecord = { status?: string } | undefined

/**
 * Tallies one student's attendance across the sessions a view has already
 * scoped (cancelled sessions filtered out, semester filter applied), reading
 * the composite-keyed `attendanceMap` the attendance grid queries return.
 *
 * The rate itself comes from `computeAttendanceSummary` in
 * convex/lib/attendance.ts, so the frontend can never drift from the
 * backend's definition: (present + late) / scheduled sessions, with unmarked
 * cells counting against the student. `rate` is a 0-1 fraction, or null when
 * no sessions are in scope — callers decide whether that reads as 0%, a dash,
 * or last place.
 */
export function tallyGridAttendance(
  attendanceMap: Record<string, GridAttendanceRecord>,
  studentClassId: string,
  sessions: ReadonlyArray<{ _id: string }>,
): Omit<AttendanceSummary, 'rate'> & { rate: number | null } {
  const sessionIds: Array<Id<'classSessions'>> = []
  const statusBySessionId = new Map<Id<'classSessions'>, AttendanceStatus>()

  for (const session of sessions) {
    // Ids and statuses are the same Convex values, widened to string by the
    // query's return type; these casts keep this the only place that bridges
    // the two, rather than every call site. An unrecognised status simply
    // tallies as not marked.
    const sessionId = session._id as Id<'classSessions'>
    sessionIds.push(sessionId)
    const status = attendanceMap[`${studentClassId}_${session._id}`]?.status
    if (status !== undefined) {
      statusBySessionId.set(sessionId, status as AttendanceStatus)
    }
  }

  const summary = computeAttendanceSummary(sessionIds, statusBySessionId)

  return { ...summary, rate: summary.total > 0 ? summary.rate : null }
}
