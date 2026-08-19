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
