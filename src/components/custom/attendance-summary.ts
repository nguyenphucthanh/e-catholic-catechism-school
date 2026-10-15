import type { AttendanceStatus } from '~/components/custom/attendance-tile'

/** Counts for the "N present / late / absent / excused" pill. */
export function summarizeAttendance(statuses: ReadonlyArray<AttendanceStatus>) {
  const counts = { present: 0, late: 0, absent: 0, excused: 0 }
  for (const st of statuses) {
    if (st === 'present') counts.present++
    else if (st === 'late') counts.late++
    else if (st === 'unexcused_absence') counts.absent++
    else counts.excused++
  }
  return { total: statuses.length, ...counts }
}
