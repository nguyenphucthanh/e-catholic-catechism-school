import { describe, expect, it } from 'vitest'
import {
  computeAttendancePoint,
  computeAttendanceSummary,
  isClassScopedSession,
  reconcileAttendanceRecord,
} from './attendance'

describe('computeAttendancePoint', () => {
  it('returns null when total sessions is 0', () => {
    const summary = {
      present: 0,
      late: 0,
      excusedAbsence: 0,
      unexcusedAbsence: 0,
      notMarked: 0,
      total: 0,
      rate: null,
    }
    expect(computeAttendancePoint(summary, { mode: 'rate' })).toBeNull()
  })

  it('converts attendance rate to scale-of-10 point (70% -> 7.0)', () => {
    const summary = {
      present: 7,
      late: 0,
      excusedAbsence: 3,
      unexcusedAbsence: 0,
      notMarked: 0,
      total: 10,
      rate: 0.7,
    }
    expect(computeAttendancePoint(summary, { mode: 'rate' })).toBe(7)
  })

  it('defaults to rate mode when config is undefined', () => {
    const summary = {
      present: 9,
      late: 1,
      excusedAbsence: 0,
      unexcusedAbsence: 0,
      notMarked: 0,
      total: 10,
      rate: 1.0,
    }
    expect(computeAttendancePoint(summary, undefined)).toBe(10)
  })

  it('computes point per type with custom weights: (10 + 9 + 0 + -0.5) / 4 = 4.6', () => {
    const summary = {
      present: 1,
      late: 1,
      excusedAbsence: 1,
      unexcusedAbsence: 1,
      notMarked: 0,
      total: 4,
      rate: 0.5,
    }
    const config = {
      mode: 'type' as const,
      present: 10,
      late: 9,
      excused: 0,
      absentUnset: -0.5,
    }
    // (10*1 + 9*1 + 0*1 + -0.5*1) / 4 = 18.5 / 4 = 4.625 -> 4.6
    expect(computeAttendancePoint(summary, config)).toBe(4.6)
  })

  it('clamps point to minimum 0 if negative penalties dominate', () => {
    const summary = {
      present: 0,
      late: 0,
      excusedAbsence: 0,
      unexcusedAbsence: 5,
      notMarked: 0,
      total: 5,
      rate: 0,
    }
    const config = {
      mode: 'type' as const,
      present: 10,
      late: 9,
      excused: 0,
      absentUnset: -5,
    }
    expect(computeAttendancePoint(summary, config)).toBe(0)
  })

  it('clamps point to maximum 10 if weights exceed 10', () => {
    const summary = {
      present: 2,
      late: 0,
      excusedAbsence: 0,
      unexcusedAbsence: 0,
      notMarked: 0,
      total: 2,
      rate: 1,
    }
    const config = {
      mode: 'type' as const,
      present: 10,
      late: 10,
      excused: 0,
      absentUnset: 0,
    }
    expect(computeAttendancePoint(summary, config)).toBe(10)
  })
})

describe('attendance helpers', () => {
  it('isClassScopedSession checks validity of sessions', () => {
    expect(
      isClassScopedSession({
        isDeleted: false,
        isCancelled: false,
        sessionType: 'catechism',
      } as any),
    ).toBe(true)
    expect(
      isClassScopedSession({
        isDeleted: false,
        isCancelled: false,
        sessionType: 'supplemental',
      } as any),
    ).toBe(true)
    expect(
      isClassScopedSession({
        isDeleted: true,
        isCancelled: false,
        sessionType: 'catechism',
      } as any),
    ).toBe(false)
    expect(
      isClassScopedSession({
        isDeleted: false,
        isCancelled: true,
        sessionType: 'catechism',
      } as any),
    ).toBe(false)
    expect(
      isClassScopedSession({
        isDeleted: false,
        isCancelled: false,
        sessionType: 'mass',
      } as any),
    ).toBe(false)
  })

  it('computeAttendanceSummary tallies status correctly', () => {
    const s1 = 's1' as any
    const s2 = 's2' as any
    const s3 = 's3' as any
    const s4 = 's4' as any
    const s5 = 's5' as any
    const statusMap = new Map<any, any>([
      [s1, 'present'],
      [s2, 'late'],
      [s3, 'excused_absence'],
      [s4, 'unexcused_absence'],
    ])
    const res = computeAttendanceSummary([s1, s2, s3, s4, s5], statusMap)
    expect(res.present).toBe(1)
    expect(res.late).toBe(1)
    expect(res.excusedAbsence).toBe(1)
    expect(res.unexcusedAbsence).toBe(1)
    expect(res.notMarked).toBe(1)
    expect(res.total).toBe(5)
    expect(res.rate).toBe(0.4)
  })

  it('reconcileAttendanceRecord inserts, updates, deletes, and handles conflicts', async () => {
    const insertedRows: Array<any> = []
    const patchedRows: Array<any> = []

    const mockDb = {
      insert: (_table: string, doc: any) => {
        const id = 'new_id'
        insertedRows.push({ id, ...doc })
        return Promise.resolve(id)
      },
      patch: (_table: string, id: any, patch: any) => {
        patchedRows.push({ id, ...patch })
        return Promise.resolve()
      },
    }

    // Insert new
    const r1 = await reconcileAttendanceRecord(
      { db: mockDb },
      {
        sessionId: 's1' as any,
        studentClassId: 'sc1' as any,
        status: 'present',
        recordedBy: 'c1' as any,
        deviceQueuedAt: 100,
        mode: 'overwrite',
        existing: null,
      },
    )
    expect(r1.action).toBe('synced')

    // Delete existing
    const r2 = await reconcileAttendanceRecord(
      { db: mockDb },
      {
        sessionId: 's1' as any,
        studentClassId: 'sc1' as any,
        status: null,
        recordedBy: 'c1' as any,
        deviceQueuedAt: 100,
        mode: 'overwrite',
        existing: { _id: 'rec1' as any, isDeleted: false } as any,
      },
    )
    expect(r2.action).toBe('deleted')

    // Error on conflict
    await expect(
      reconcileAttendanceRecord(
        { db: mockDb },
        {
          sessionId: 's1' as any,
          studentClassId: 'sc1' as any,
          status: 'present',
          recordedBy: 'c1' as any,
          deviceQueuedAt: 100,
          mode: 'error_on_conflict',
          existing: { _id: 'rec1' as any, isDeleted: false } as any,
        },
      ),
    ).rejects.toThrow('ATTENDANCE_ALREADY_RECORDED')

    // First write wins conflict
    const rConflict = await reconcileAttendanceRecord(
      { db: mockDb },
      {
        sessionId: 's1' as any,
        studentClassId: 'sc1' as any,
        status: 'present',
        recordedBy: 'c1' as any,
        deviceQueuedAt: 200,
        mode: 'first_write_wins',
        existing: {
          _id: 'rec1' as any,
          isDeleted: false,
          deviceQueuedAt: 100,
        } as any,
      },
    )
    expect(rConflict.action).toBe('conflict')

    // Reactivate soft-deleted
    const rReactivate = await reconcileAttendanceRecord(
      { db: mockDb },
      {
        sessionId: 's1' as any,
        studentClassId: 'sc1' as any,
        status: 'late',
        recordedBy: 'c1' as any,
        deviceQueuedAt: 200,
        mode: 'overwrite',
        existing: { _id: 'rec1' as any, isDeleted: true } as any,
      },
    )
    expect(rReactivate.action).toBe('synced')
  })
})
