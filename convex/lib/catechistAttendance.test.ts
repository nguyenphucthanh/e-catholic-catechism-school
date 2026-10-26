/// <reference types="vite/client" />
import { describe, expect, test } from 'vitest'
import { authedConvexTest } from '../../test-utils/authedConvexTest'
import schema from '../schema'
import { CATECHIST_ATTENDANCE_ERRORS } from './errors'
import {
  computeCatechistAttendanceRate,
  getExpectedCatechistsForClassSession,
  getExpectedCatechistsForMeeting,
  reconcileCatechistAttendanceRecord,
} from './catechistAttendance'

const modules = import.meta.glob('../**/*.ts')

async function setup() {
  const t = authedConvexTest(schema, modules)
  const ids = await t.run(async (ctx) => {
    const mk = (
      n: number,
      extra: { isActive?: boolean; isDeleted?: boolean } = {},
    ) =>
      ctx.db.insert('catechists', {
        memberId: `GLV${n}`,
        fullName: `C${n}`,
        role: 'user',
        isActive: extra.isActive ?? true,
        isDeleted: extra.isDeleted ?? false,
      })
    const [homeroom, co, deletedAssign, board, head, other, inactive] =
      await Promise.all([
        mk(1),
        mk(2),
        mk(3),
        mk(4),
        mk(5),
        mk(6),
        mk(7, { isActive: false }),
      ])
    const ay = await ctx.db.insert('academicYears', {
      name: '2024',
      startDate: '2024-09-01',
      endDate: '2025-05-31',
      timezone: 'Asia/Ho_Chi_Minh',
      isActive: true,
      isDeleted: false,
    })
    const branch = await ctx.db.insert('branches', {
      name: 'B',
      sortOrder: 1,
      isDeleted: false,
    })
    const otherBranch = await ctx.db.insert('branches', {
      name: 'B2',
      sortOrder: 2,
      isDeleted: false,
    })
    const cls = await ctx.db.insert('classes', {
      branchId: branch,
      name: 'K',
      isDeleted: false,
    })
    const cy = await ctx.db.insert('classYears', {
      classId: cls,
      academicYearId: ay,
      isDeleted: false,
    })
    const semester = await ctx.db.insert('semesters', {
      academicYearId: ay,
      semesterNumber: 1,
      isDeleted: false,
    })
    const cc = (
      catechistId: typeof homeroom,
      role: 'homeroom' | 'co_teacher',
      isDeleted = false,
    ) =>
      ctx.db.insert('classCatechists', {
        catechistId,
        classYearId: cy,
        academicYearId: ay,
        role,
        isDeleted,
      })
    await cc(homeroom, 'homeroom')
    await cc(co, 'co_teacher')
    await cc(deletedAssign, 'co_teacher', true)
    await cc(inactive, 'co_teacher')
    await ctx.db.insert('academicYearAssignments', {
      academicYearId: ay,
      catechistId: board,
      assignmentType: 'board_member',
      isDeleted: false,
    })
    await ctx.db.insert('branchAssignments', {
      academicYearId: ay,
      catechistId: head,
      branchId: branch,
      isDeleted: false,
    })
    await ctx.db.insert('branchAssignments', {
      academicYearId: ay,
      catechistId: other,
      branchId: otherBranch,
      isDeleted: false,
    })
    const session = await ctx.db.insert('classSessions', {
      classYearId: cy,
      semesterId: semester,
      sessionDate: '2024-10-06',
      sessionType: 'catechism',
      isCancelled: false,
      isDeleted: false,
    })
    const meeting = (
      scope: 'all' | 'board' | 'branch',
      branchId?: typeof branch,
    ) =>
      ctx.db.insert('catechistMeetings', {
        academicYearId: ay,
        meetingDate: '2024-10-07',
        title: 'M',
        scope,
        branchId,
        isCancelled: false,
        isDeleted: false,
      })
    return {
      homeroom,
      co,
      deletedAssign,
      board,
      head,
      other,
      inactive,
      ay,
      session,
      allMeeting: await meeting('all'),
      boardMeeting: await meeting('board'),
      branchMeeting: await meeting('branch', branch),
    }
  })
  return { t, ids }
}

describe('expected rosters', () => {
  test('class session: homeroom + co-teacher, ignores soft-deleted and inactive', async () => {
    const { t, ids } = await setup()
    const res = await t.run(async (ctx) => {
      const s = (await ctx.db.get('classSessions', ids.session))!
      return getExpectedCatechistsForClassSession(ctx, s)
    })
    expect(res).toEqual([
      { catechistId: ids.homeroom, roleAtSession: 'homeroom' },
      { catechistId: ids.co, roleAtSession: 'co_teacher' },
    ])
  })

  test('class session without classYearId has no expected roster', async () => {
    const { t, ids } = await setup()
    const res = await t.run(async (ctx) => {
      const s = (await ctx.db.get('classSessions', ids.session))!
      return getExpectedCatechistsForClassSession(ctx, {
        ...s,
        classYearId: undefined,
      })
    })
    expect(res).toEqual([])
  })

  test('meeting all: active, non-deleted catechists', async () => {
    const { t, ids } = await setup()
    const res = await t.run(async (ctx) =>
      getExpectedCatechistsForMeeting(
        ctx,
        (await ctx.db.get('catechistMeetings', ids.allMeeting))!,
      ),
    )
    const got = res.map((r) => r.catechistId)
    expect(got).toContain(ids.homeroom)
    expect(got).not.toContain(ids.inactive)
    expect(res.every((r) => r.roleAtSession === 'attendee')).toBe(true)
  })

  test('meeting board: only board members', async () => {
    const { t, ids } = await setup()
    const res = await t.run(async (ctx) =>
      getExpectedCatechistsForMeeting(
        ctx,
        (await ctx.db.get('catechistMeetings', ids.boardMeeting))!,
      ),
    )
    expect(res.map((r) => r.catechistId)).toEqual([ids.board])
  })

  test('meeting branch: branch head + teachers in the branch, not other branches', async () => {
    const { t, ids } = await setup()
    const res = await t.run(async (ctx) =>
      getExpectedCatechistsForMeeting(
        ctx,
        (await ctx.db.get('catechistMeetings', ids.branchMeeting))!,
      ),
    )
    const got = res.map((r) => r.catechistId).sort()
    expect(got).toEqual([ids.homeroom, ids.co, ids.head].sort())
  })

  test('meeting branch without branchId is empty', async () => {
    const { t, ids } = await setup()
    const res = await t.run(async (ctx) => {
      const m = (await ctx.db.get('catechistMeetings', ids.branchMeeting))!
      return getExpectedCatechistsForMeeting(ctx, { ...m, branchId: undefined })
    })
    expect(res).toEqual([])
  })
})

describe('reconcileCatechistAttendanceRecord', () => {
  const base = (ids: Awaited<ReturnType<typeof setup>>['ids']) => ({
    catechistId: ids.homeroom,
    recordedBy: ids.board,
  })

  test('rejects neither or both targets', async () => {
    const { t, ids } = await setup()
    await t.run(async (ctx) => {
      await expect(
        reconcileCatechistAttendanceRecord(ctx, {
          ...base(ids),
          status: 'present',
          deviceQueuedAt: 1,
        }),
      ).rejects.toThrow(CATECHIST_ATTENDANCE_ERRORS.INVALID_TARGET)
      await expect(
        reconcileCatechistAttendanceRecord(ctx, {
          ...base(ids),
          sessionId: ids.session,
          meetingId: ids.allMeeting,
          status: 'present',
          deviceQueuedAt: 1,
        }),
      ).rejects.toThrow(CATECHIST_ATTENDANCE_ERRORS.INVALID_TARGET)
    })
  })

  test('two scans: earlier deviceQueuedAt wins, later is a conflict', async () => {
    const { t, ids } = await setup()
    await t.run(async (ctx) => {
      const scan = (status: 'present' | 'late', at: number) =>
        reconcileCatechistAttendanceRecord(ctx, {
          ...base(ids),
          sessionId: ids.session,
          status,
          checkInMethod: 'qr_scan',
          deviceQueuedAt: at,
        })
      const first = await scan('present', 100)
      expect((await scan('late', 200)).action).toBe('conflict')
      expect(
        (await ctx.db.get('catechistAttendanceRecords', first.id))!.status,
      ).toBe('present')
      // an earlier offline scan synced late replaces the stored one
      expect((await scan('late', 50)).action).toBe('synced')
      const row = (await ctx.db.get('catechistAttendanceRecords', first.id))!
      expect(row.status).toBe('late')
      expect(row.deviceQueuedAt).toBe(50)
    })
  })

  test('manual overwrites a scan; scan never overwrites manual', async () => {
    const { t, ids } = await setup()
    await t.run(async (ctx) => {
      const scanned = await reconcileCatechistAttendanceRecord(ctx, {
        ...base(ids),
        meetingId: ids.allMeeting,
        status: 'present',
        checkInMethod: 'qr_scan',
        deviceQueuedAt: 100,
      })
      const manual = await reconcileCatechistAttendanceRecord(ctx, {
        ...base(ids),
        meetingId: ids.allMeeting,
        status: 'excused_absence',
        notes: 'sick',
        deviceQueuedAt: 500,
      })
      expect(manual.id).toBe(scanned.id)
      let row = (await ctx.db.get('catechistAttendanceRecords', scanned.id))!
      expect(row).toMatchObject({
        status: 'excused_absence',
        checkInMethod: 'manual',
        notes: 'sick',
        recordedBy: ids.board,
      })

      const later = await reconcileCatechistAttendanceRecord(ctx, {
        ...base(ids),
        meetingId: ids.allMeeting,
        status: 'present',
        checkInMethod: 'qr_scan',
        deviceQueuedAt: 1,
      })
      expect(later.action).toBe('conflict')
      row = (await ctx.db.get('catechistAttendanceRecords', scanned.id))!
      expect(row.status).toBe('excused_absence')
    })
  })

  test('reactivates a soft-deleted row instead of inserting', async () => {
    const { t, ids } = await setup()
    await t.run(async (ctx) => {
      const a = await reconcileCatechistAttendanceRecord(ctx, {
        ...base(ids),
        sessionId: ids.session,
        status: 'present',
        deviceQueuedAt: 1,
      })
      await ctx.db.patch('catechistAttendanceRecords', a.id, {
        isDeleted: true,
      })
      const b = await reconcileCatechistAttendanceRecord(ctx, {
        ...base(ids),
        sessionId: ids.session,
        status: 'late',
        deviceQueuedAt: 2,
      })
      expect(b.id).toBe(a.id)
      expect(
        await ctx.db.query('catechistAttendanceRecords').collect(),
      ).toHaveLength(1)
      expect(
        await ctx.db.get('catechistAttendanceRecords', a.id),
      ).toMatchObject({ isDeleted: false, status: 'late' })
    })
  })
})

describe('computeCatechistAttendanceRate', () => {
  test('late counts as attended; excused and unexcused are in the denominator', () => {
    const r = computeCatechistAttendanceRate([
      { status: 'present' },
      { status: 'late' },
      { status: 'excused_absence' },
      { status: 'unexcused_absence' },
    ])
    expect(r).toEqual({
      present: 1,
      late: 1,
      excused: 1,
      unexcused: 1,
      total: 4,
      rate: 0.5,
    })
  })

  test('empty -> null rate', () => {
    expect(computeCatechistAttendanceRate([])).toMatchObject({
      total: 0,
      rate: null,
    })
  })
})
