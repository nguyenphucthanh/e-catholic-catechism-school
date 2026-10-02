import { describe, expect, test } from 'vitest'
import { tallyGridAttendance } from './attendance'

const sessions = [
  { _id: 'session1' },
  { _id: 'session2' },
  { _id: 'session3' },
  { _id: 'session4' },
]

describe('tallyGridAttendance', () => {
  test('tallies each status for the given student and counts missing cells as not marked', () => {
    const result = tallyGridAttendance(
      {
        sc1_session1: { status: 'present' },
        sc1_session2: { status: 'late' },
        sc1_session3: { status: 'excused_absence' },
        // session4 has no record for sc1
        sc2_session1: { status: 'unexcused_absence' },
      },
      'sc1',
      sessions,
    )

    expect(result).toEqual({
      present: 1,
      late: 1,
      excusedAbsence: 1,
      unexcusedAbsence: 0,
      notMarked: 1,
      total: 4,
      rate: 0.5,
    })
  })

  test('counts late as attended in the rate', () => {
    const result = tallyGridAttendance(
      { sc1_session1: { status: 'late' }, sc1_session2: { status: 'late' } },
      'sc1',
      [{ _id: 'session1' }, { _id: 'session2' }],
    )

    expect(result.rate).toBe(1)
  })

  test('counts absences and unmarked cells against the rate', () => {
    const result = tallyGridAttendance(
      {
        sc1_session1: { status: 'excused_absence' },
        sc1_session2: { status: 'unexcused_absence' },
      },
      'sc1',
      [{ _id: 'session1' }, { _id: 'session2' }],
    )

    expect(result).toMatchObject({
      excusedAbsence: 1,
      unexcusedAbsence: 1,
      notMarked: 0,
      rate: 0,
    })
  })

  test('returns a null rate when no sessions are in scope, so callers choose how to render it', () => {
    const result = tallyGridAttendance(
      { sc1_session1: { status: 'present' } },
      'sc1',
      [],
    )

    expect(result.total).toBe(0)
    expect(result.rate).toBeNull()
  })

  test('ignores records belonging to other students', () => {
    const result = tallyGridAttendance(
      {
        sc1_session1: { status: 'present' },
        sc2_session1: { status: 'present' },
        sc2_session2: { status: 'present' },
      },
      'sc2',
      [{ _id: 'session1' }, { _id: 'session2' }],
    )

    expect(result).toMatchObject({ present: 2, notMarked: 0, rate: 1 })
  })

  test('treats an unrecognised status as not marked rather than throwing', () => {
    const result = tallyGridAttendance(
      { sc1_session1: { status: 'something_else' } },
      'sc1',
      [{ _id: 'session1' }],
    )

    expect(result).toMatchObject({ notMarked: 1, rate: 0 })
  })
})
