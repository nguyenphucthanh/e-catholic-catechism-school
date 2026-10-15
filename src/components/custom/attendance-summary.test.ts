import { describe, expect, it } from 'vitest'
import { summarizeAttendance } from './attendance-summary'

describe('summarizeAttendance', () => {
  it('returns zeros for an empty list', () => {
    expect(summarizeAttendance([])).toEqual({
      total: 0,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
    })
  })

  it('counts each status bucket', () => {
    expect(
      summarizeAttendance([
        'present',
        'present',
        'late',
        'unexcused_absence',
        'excused_absence',
        'excused_absence',
      ]),
    ).toEqual({ total: 6, present: 2, late: 1, absent: 1, excused: 2 })
  })
})
