/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { AUTHZ_ERRORS, CATECHIST_ATTENDANCE_ERRORS } from './lib/errors'

const modules = import.meta.glob('./**/*.ts')

async function setup() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async (ctx) => {
    const mk = (n: number, role: 'admin' | 'user' = 'user') =>
      ctx.db.insert('catechists', {
        memberId: `GLV${n}`,
        fullName: `C${n}`,
        role,
        isActive: true,
        isDeleted: false,
      })
    const admin = await mk(0, 'admin')
    const [homeroom, co, board, head, otherHead, outsider, sub] =
      await Promise.all([1, 2, 3, 4, 5, 6, 7].map((n) => mk(n)))
    const mkYear = (name: string, isActive: boolean) =>
      ctx.db.insert('academicYears', {
        name,
        startDate: '2024-09-01',
        endDate: '2025-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive,
        isDeleted: false,
      })
    const ay = await mkYear('2024', true)
    const oldAy = await mkYear('2023', false)
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
    const mkCy = (academicYearId: typeof ay) =>
      ctx.db.insert('classYears', {
        classId: cls,
        academicYearId,
        isDeleted: false,
      })
    const cy = await mkCy(ay)
    const oldCy = await mkCy(oldAy)
    const sem = (academicYearId: typeof ay) =>
      ctx.db.insert('semesters', {
        academicYearId,
        semesterNumber: 1,
        isDeleted: false,
      })
    const semester = await sem(ay)
    const oldSemester = await sem(oldAy)
    const assign = (
      catechistId: typeof ay extends never ? never : typeof homeroom,
      classYearId: typeof cy,
      academicYearId: typeof ay,
      role: 'homeroom' | 'co_teacher',
    ) =>
      ctx.db.insert('classCatechists', {
        catechistId,
        classYearId,
        academicYearId,
        role,
        isDeleted: false,
      })
    await assign(homeroom, cy, ay, 'homeroom')
    await assign(co, cy, ay, 'co_teacher')
    await assign(homeroom, oldCy, oldAy, 'homeroom')
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
      catechistId: otherHead,
      branchId: otherBranch,
      isDeleted: false,
    })
    const mkSession = (
      classYearId: typeof cy,
      semesterId: typeof semester,
      sessionDate: string,
      isCancelled = false,
    ) =>
      ctx.db.insert('classSessions', {
        classYearId,
        semesterId,
        sessionDate,
        sessionType: 'catechism',
        isCancelled,
        isDeleted: false,
      })
    const session = await mkSession(cy, semester, '2024-10-06')
    const session2 = await mkSession(cy, semester, '2024-10-13')
    const cancelledSession = await mkSession(cy, semester, '2024-10-20', true)
    const oldSession = await mkSession(oldCy, oldSemester, '2023-10-01')
    const massSession = await ctx.db.insert('classSessions', {
      academicYearId: ay,
      sessionDate: '2024-10-06',
      sessionType: 'mass',
      isCancelled: false,
      isDeleted: false,
    })
    const mkMeeting = (
      scope: 'all' | 'board' | 'branch',
      branchId?: typeof branch,
      academicYearId = ay,
      isCancelled = false,
    ) =>
      ctx.db.insert('catechistMeetings', {
        academicYearId,
        meetingDate: '2024-10-07',
        title: 'M',
        scope,
        branchId,
        isCancelled,
        isDeleted: false,
      })
    return {
      admin,
      homeroom,
      co,
      board,
      head,
      otherHead,
      outsider,
      sub,
      ay,
      oldAy,
      branch,
      cy,
      session,
      session2,
      cancelledSession,
      oldSession,
      massSession,
      allMeeting: await mkMeeting('all'),
      boardMeeting: await mkMeeting('board'),
      branchMeeting: await mkMeeting('branch', branch),
      cancelledMeeting: await mkMeeting('all', undefined, ay, true),
      oldMeeting: await mkMeeting('all', undefined, oldAy),
    }
  })
  return { t, ids }
}

type Ids = Awaited<ReturnType<typeof setup>>['ids']

describe('recordAttendance permission matrix', () => {
  const sessionCases = (ids: Ids): Array<[string, any, boolean]> => [
    ['admin', ids.admin, true],
    ['board', ids.board, true],
    ['branch head of the class branch', ids.head, true],
    ['homeroom', ids.homeroom, true],
    ['co-teacher', ids.co, true],
    ['head of another branch', ids.otherHead, false],
    ['non-assigned catechist', ids.outsider, false],
  ]

  test.each([0, 1, 2, 3, 4, 5, 6])('class session case %i', async (i) => {
    const { t, ids } = await setup()
    const [, requesterId, allowed] = sessionCases(ids)[i]
    const call = t.mutation(api.catechistAttendance.recordAttendance, {
      requesterId,
      sessionId: ids.session,
      catechistId: ids.homeroom,
      status: 'present',
    })
    if (allowed) await expect(call).resolves.toBeDefined()
    else await expect(call).rejects.toThrow()
  })

  test('meeting scope all/board: admin+board ok; branch head and member denied', async () => {
    const { t, ids } = await setup()
    for (const meetingId of [ids.allMeeting, ids.boardMeeting]) {
      for (const requesterId of [ids.admin, ids.board]) {
        await t.mutation(api.catechistAttendance.recordAttendance, {
          requesterId,
          meetingId,
          catechistId: ids.co,
          status: 'present',
        })
      }
      for (const requesterId of [ids.head, ids.homeroom]) {
        await expect(
          t.mutation(api.catechistAttendance.recordAttendance, {
            requesterId,
            meetingId,
            catechistId: ids.co,
            status: 'present',
          }),
        ).rejects.toThrow(AUTHZ_ERRORS.NOT_BOARD_MEMBER)
      }
    }
  })

  test('meeting scope branch: admin, board, that branch head ok; other head denied', async () => {
    const { t, ids } = await setup()
    for (const requesterId of [ids.admin, ids.board, ids.head]) {
      await t.mutation(api.catechistAttendance.recordAttendance, {
        requesterId,
        meetingId: ids.branchMeeting,
        catechistId: ids.co,
        status: 'late',
      })
    }
    for (const requesterId of [ids.otherHead, ids.homeroom]) {
      await expect(
        t.mutation(api.catechistAttendance.recordAttendance, {
          requesterId,
          meetingId: ids.branchMeeting,
          catechistId: ids.co,
          status: 'late',
        }),
      ).rejects.toThrow(AUTHZ_ERRORS.NOT_BRANCH_HEAD_OR_ABOVE)
    }
  })
})

describe('write guards', () => {
  test('target must be exactly one of sessionId/meetingId', async () => {
    const { t, ids } = await setup()
    const base = {
      requesterId: ids.admin,
      catechistId: ids.co,
      status: 'present' as const,
    }
    await expect(
      t.mutation(api.catechistAttendance.recordAttendance, base),
    ).rejects.toThrow(CATECHIST_ATTENDANCE_ERRORS.INVALID_TARGET)
    await expect(
      t.mutation(api.catechistAttendance.recordAttendance, {
        ...base,
        sessionId: ids.session,
        meetingId: ids.allMeeting,
      }),
    ).rejects.toThrow(CATECHIST_ATTENDANCE_ERRORS.INVALID_TARGET)
  })

  test('mass session is not a valid target', async () => {
    const { t, ids } = await setup()
    await expect(
      t.mutation(api.catechistAttendance.recordAttendance, {
        requesterId: ids.admin,
        sessionId: ids.massSession,
        catechistId: ids.co,
        status: 'present',
      }),
    ).rejects.toThrow(CATECHIST_ATTENDANCE_ERRORS.INVALID_TARGET)
  })

  test('inactive academic year blocks every write path', async () => {
    const { t, ids } = await setup()
    const locked = CATECHIST_ATTENDANCE_ERRORS.INACTIVE_ACADEMIC_YEAR
    // seed a record in the locked year to delete
    const recordId = await t.run((ctx) =>
      ctx.db.insert('catechistAttendanceRecords', {
        sessionId: ids.oldSession,
        catechistId: ids.homeroom,
        status: 'present',
        recordedBy: ids.admin,
        deviceQueuedAt: 1,
        isDeleted: false,
      }),
    )
    for (const target of [
      { sessionId: ids.oldSession },
      { meetingId: ids.oldMeeting },
    ]) {
      await expect(
        t.mutation(api.catechistAttendance.recordAttendance, {
          requesterId: ids.admin,
          ...target,
          catechistId: ids.homeroom,
          status: 'present',
        }),
      ).rejects.toThrow(locked)
      await expect(
        t.mutation(api.catechistAttendance.batchRecordAttendance, {
          requesterId: ids.admin,
          ...target,
          records: [{ catechistId: ids.homeroom, status: 'present' }],
        }),
      ).rejects.toThrow(locked)
    }
    await expect(
      t.mutation(api.catechistAttendance.deleteAttendanceRecord, {
        requesterId: ids.admin,
        recordId,
      }),
    ).rejects.toThrow(locked)
  })

  test('cancelled session / meeting rejects writes', async () => {
    const { t, ids } = await setup()
    await expect(
      t.mutation(api.catechistAttendance.recordAttendance, {
        requesterId: ids.admin,
        sessionId: ids.cancelledSession,
        catechistId: ids.co,
        status: 'present',
      }),
    ).rejects.toThrow(CATECHIST_ATTENDANCE_ERRORS.SESSION_CANCELLED)
    await expect(
      t.mutation(api.catechistAttendance.recordAttendance, {
        requesterId: ids.admin,
        meetingId: ids.cancelledMeeting,
        catechistId: ids.co,
        status: 'present',
      }),
    ).rejects.toThrow(CATECHIST_ATTENDANCE_ERRORS.MEETING_CANCELLED)
  })

  test('not-found target / catechist; deleted catechist rejected', async () => {
    const { t, ids } = await setup()
    await t.run(async (ctx) => {
      await ctx.db.patch('classSessions', ids.session2, { isDeleted: true })
      await ctx.db.patch('catechistMeetings', ids.boardMeeting, {
        isDeleted: true,
      })
      await ctx.db.patch('catechists', ids.sub, { isDeleted: true })
    })
    await expect(
      t.mutation(api.catechistAttendance.recordAttendance, {
        requesterId: ids.admin,
        sessionId: ids.session2,
        catechistId: ids.co,
        status: 'present',
      }),
    ).rejects.toThrow(CATECHIST_ATTENDANCE_ERRORS.SESSION_NOT_FOUND)
    await expect(
      t.mutation(api.catechistAttendance.recordAttendance, {
        requesterId: ids.admin,
        meetingId: ids.boardMeeting,
        catechistId: ids.co,
        status: 'present',
      }),
    ).rejects.toThrow(CATECHIST_ATTENDANCE_ERRORS.MEETING_NOT_FOUND)
    await expect(
      t.mutation(api.catechistAttendance.recordAttendance, {
        requesterId: ids.admin,
        sessionId: ids.session,
        catechistId: ids.sub,
        status: 'present',
      }),
    ).rejects.toThrow(CATECHIST_ATTENDANCE_ERRORS.CATECHIST_NOT_FOUND)
  })

  test('batch: rejects duplicate catechists; writes all in one go', async () => {
    const { t, ids } = await setup()
    await expect(
      t.mutation(api.catechistAttendance.batchRecordAttendance, {
        requesterId: ids.admin,
        sessionId: ids.session,
        records: [
          { catechistId: ids.co, status: 'present' },
          { catechistId: ids.co, status: 'late' },
        ],
      }),
    ).rejects.toThrow(CATECHIST_ATTENDANCE_ERRORS.DUPLICATE_CATECHIST)
    const res = await t.mutation(
      api.catechistAttendance.batchRecordAttendance,
      {
        requesterId: ids.admin,
        sessionId: ids.session,
        records: [
          { catechistId: ids.co, status: 'present' },
          {
            catechistId: ids.homeroom,
            status: 'unexcused_absence',
            notes: 'no show',
          },
        ],
      },
    )
    expect(res).toHaveLength(2)
  })

  test('delete is a soft delete and is idempotent-safe (second call not found)', async () => {
    const { t, ids } = await setup()
    const id = await t.mutation(api.catechistAttendance.recordAttendance, {
      requesterId: ids.admin,
      sessionId: ids.session,
      catechistId: ids.co,
      status: 'present',
    })
    await t.mutation(api.catechistAttendance.deleteAttendanceRecord, {
      requesterId: ids.admin,
      recordId: id.id,
    })
    const row = await t.run((ctx) =>
      ctx.db.get('catechistAttendanceRecords', id.id),
    )
    expect(row?.isDeleted).toBe(true)
    await expect(
      t.mutation(api.catechistAttendance.deleteAttendanceRecord, {
        requesterId: ids.admin,
        recordId: id.id,
      }),
    ).rejects.toThrow(CATECHIST_ATTENDANCE_ERRORS.RECORD_NOT_FOUND)
  })

  test('role is derived: expected role, substitute, attendee', async () => {
    const { t, ids } = await setup()
    const rec = async (args: any) => {
      const r = await t.mutation(api.catechistAttendance.recordAttendance, {
        requesterId: ids.admin,
        status: 'present',
        ...args,
      })
      return (await t.run((ctx) =>
        ctx.db.get('catechistAttendanceRecords', r.id),
      ))!.roleAtSession
    }
    expect(
      await rec({ sessionId: ids.session, catechistId: ids.homeroom }),
    ).toBe('homeroom')
    expect(
      await rec({ sessionId: ids.session, catechistId: ids.outsider }),
    ).toBe('substitute')
    expect(
      await rec({ meetingId: ids.allMeeting, catechistId: ids.outsider }),
    ).toBe('attendee')
  })
})

describe('rosters', () => {
  test('session roster: unrecorded, substitutes, summary', async () => {
    const { t, ids } = await setup()
    await t.mutation(api.catechistAttendance.recordAttendance, {
      requesterId: ids.admin,
      sessionId: ids.session,
      catechistId: ids.homeroom,
      status: 'unexcused_absence',
    })
    await t.mutation(api.catechistAttendance.recordAttendance, {
      requesterId: ids.admin,
      sessionId: ids.session,
      catechistId: ids.sub,
      status: 'present',
    })
    const r = await t.query(
      api.catechistAttendance.getSessionAttendanceRoster,
      {
        requesterId: ids.admin,
        sessionId: ids.session,
      },
    )
    expect(r.roster.map((x) => [x.catechistId, x.status])).toEqual([
      [ids.homeroom, 'unexcused_absence'],
      [ids.co, null],
    ])
    expect(r.substitutes.map((x) => x.catechistId)).toEqual([ids.sub])
    expect(r.summary).toEqual({
      totalExpected: 2,
      present: 1,
      late: 0,
      excused: 0,
      unexcused: 1,
      unrecorded: 1,
    })
  })

  test('meeting roster uses scope; locked year reports recorded rows only', async () => {
    const { t, ids } = await setup()
    const boardRoster = await t.query(
      api.catechistAttendance.getMeetingAttendanceRoster,
      {
        requesterId: ids.admin,
        meetingId: ids.boardMeeting,
      },
    )
    expect(boardRoster.roster.map((x) => x.catechistId)).toEqual([ids.board])

    await t.run((ctx) =>
      ctx.db.insert('catechistAttendanceRecords', {
        meetingId: ids.oldMeeting,
        catechistId: ids.homeroom,
        status: 'present',
        roleAtSession: 'attendee',
        recordedBy: ids.admin,
        deviceQueuedAt: 1,
        isDeleted: false,
      }),
    )
    const old = await t.query(
      api.catechistAttendance.getMeetingAttendanceRoster,
      {
        requesterId: ids.admin,
        meetingId: ids.oldMeeting,
      },
    )
    expect(old.roster).toHaveLength(1)
    expect(old.substitutes).toEqual([])
    expect(old.summary).toMatchObject({
      totalExpected: null,
      unrecorded: null,
      present: 1,
    })
  })

  test('roster queries enforce the same authz', async () => {
    const { t, ids } = await setup()
    await expect(
      t.query(api.catechistAttendance.getSessionAttendanceRoster, {
        requesterId: ids.outsider,
        sessionId: ids.session,
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.NO_CLASS_ACCESS)
  })
})

describe('summary and history', () => {
  async function seeded() {
    const { t, ids } = await setup()
    const rec = (args: any) =>
      t.mutation(api.catechistAttendance.recordAttendance, {
        requesterId: ids.admin,
        ...args,
      })
    await rec({
      sessionId: ids.session,
      catechistId: ids.homeroom,
      status: 'present',
    })
    await rec({
      sessionId: ids.session2,
      catechistId: ids.homeroom,
      status: 'excused_absence',
    })
    await rec({
      meetingId: ids.allMeeting,
      catechistId: ids.homeroom,
      status: 'late',
    })
    // substitute: counts in their own rate only
    await rec({
      sessionId: ids.session,
      catechistId: ids.sub,
      status: 'present',
    })
    // cancelled afterwards: must be excluded from the rate
    await t.run(async (ctx) => {
      await ctx.db.insert('catechistAttendanceRecords', {
        sessionId: ids.cancelledSession,
        catechistId: ids.homeroom,
        status: 'unexcused_absence',
        recordedBy: ids.admin,
        deviceQueuedAt: 1,
        isDeleted: false,
      })
    })
    return { t, ids }
  }

  test('rates: split by kind, cancelled excluded, substitute counted for self', async () => {
    const { t, ids } = await seeded()
    const s = await t.query(
      api.catechistAttendance.getCatechistAttendanceSummary,
      {
        requesterId: ids.homeroom,
        catechistId: ids.homeroom,
        academicYearId: ids.ay,
        asOfDate: '2024-12-31',
      },
    )
    expect(s.classTeaching).toMatchObject({
      present: 1,
      excused: 1,
      total: 2,
      rate: 0.5,
    })
    expect(s.meeting).toMatchObject({ late: 1, total: 1, rate: 1 })
    expect(s.overall).toMatchObject({ total: 3 })
    expect(s.overall.rate).toBeCloseTo(2 / 3)
    // sessions: 2 recorded, cancelled excluded; meetings: boardMeeting not expected,
    // branchMeeting expected (teaches in branch) and unrecorded
    expect(s.unrecorded).toBe(1)

    const sub = await t.query(
      api.catechistAttendance.getCatechistAttendanceSummary,
      {
        requesterId: ids.admin,
        catechistId: ids.sub,
        academicYearId: ids.ay,
        asOfDate: '2024-12-31',
      },
    )
    expect(sub.classTeaching).toMatchObject({ present: 1, total: 1, rate: 1 })
  })

  test('summary: locked year has null unrecorded; asOfDate bounds unrecorded', async () => {
    const { t, ids } = await seeded()
    const old = await t.query(
      api.catechistAttendance.getCatechistAttendanceSummary,
      {
        requesterId: ids.admin,
        catechistId: ids.homeroom,
        academicYearId: ids.oldAy,
        asOfDate: '2024-12-31',
      },
    )
    expect(old.unrecorded).toBeNull()
    const early = await t.query(
      api.catechistAttendance.getCatechistAttendanceSummary,
      {
        requesterId: ids.admin,
        catechistId: ids.co,
        academicYearId: ids.ay,
        asOfDate: '2024-10-06',
      },
    )
    // co taught: session on 10-06 unrecorded; session2/cancelled/meetings later or excluded
    expect(early.unrecorded).toBe(1)
  })

  test('summary/history are visible to self and board/admin only', async () => {
    const { t, ids } = await seeded()
    await expect(
      t.query(api.catechistAttendance.getCatechistAttendanceSummary, {
        requesterId: ids.outsider,
        catechistId: ids.homeroom,
        academicYearId: ids.ay,
        asOfDate: '2024-12-31',
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.NOT_BOARD_MEMBER)
    await expect(
      t.query(api.catechistAttendance.listCatechistAttendanceHistory, {
        requesterId: ids.outsider,
        catechistId: ids.homeroom,
        academicYearId: ids.ay,
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.NOT_BOARD_MEMBER)
  })

  test('history: chronological, kind filter, year scoped, deleted skipped', async () => {
    const { t, ids } = await seeded()
    await t.run(async (ctx) => {
      await ctx.db.insert('catechistAttendanceRecords', {
        sessionId: ids.oldSession,
        catechistId: ids.homeroom,
        status: 'present',
        recordedBy: ids.admin,
        deviceQueuedAt: 1,
        isDeleted: false,
      })
      await ctx.db.insert('catechistAttendanceRecords', {
        meetingId: ids.boardMeeting,
        catechistId: ids.homeroom,
        status: 'present',
        recordedBy: ids.admin,
        deviceQueuedAt: 1,
        isDeleted: true,
      })
    })
    const all = await t.query(
      api.catechistAttendance.listCatechistAttendanceHistory,
      {
        requesterId: ids.homeroom,
        catechistId: ids.homeroom,
        academicYearId: ids.ay,
      },
    )
    expect(all.map((e) => e.date)).toEqual([
      '2024-10-06',
      '2024-10-07',
      '2024-10-13',
      '2024-10-20',
    ])
    expect(all.find((e) => e.date === '2024-10-20')?.isCancelled).toBe(true)
    const meetings = await t.query(
      api.catechistAttendance.listCatechistAttendanceHistory,
      {
        requesterId: ids.homeroom,
        catechistId: ids.homeroom,
        academicYearId: ids.ay,
        kind: 'meeting',
      },
    )
    expect(meetings).toHaveLength(1)
    expect(meetings[0].title).toBe('M')
  })
})

describe('regression: student side untouched', () => {
  test('catechist records and meetings do not touch classSessions or attendanceRecords', async () => {
    const { t, ids } = await setup()
    const snapshot = () =>
      t.run(async (ctx) => ({
        sessions: await ctx.db.query('classSessions').collect(),
        students: await ctx.db.query('attendanceRecords').collect(),
      }))
    const before = await snapshot()
    await t.mutation(api.catechistAttendance.recordAttendance, {
      requesterId: ids.admin,
      sessionId: ids.session,
      catechistId: ids.co,
      status: 'present',
    })
    await t.mutation(api.catechistAttendance.batchRecordAttendance, {
      requesterId: ids.admin,
      meetingId: ids.allMeeting,
      records: [{ catechistId: ids.co, status: 'late' }],
    })
    await t.mutation(api.catechistMeetings.createMeeting, {
      requesterId: ids.admin,
      academicYearId: ids.ay,
      meetingDate: '2024-11-01',
      title: 'X',
      scope: 'all',
    })
    expect(await snapshot()).toEqual(before)
  })
})

describe('listRecordableSessions', () => {
  const DATE = '2024-10-06'

  async function withExtraSessions() {
    const { t, ids } = await setup()
    const extra = await t.run(async (ctx) => {
      const otherBranch = (await ctx.db.query('branches').collect()).find(
        (b) => b.name === 'B2',
      )!
      const cls2 = await ctx.db.insert('classes', {
        branchId: otherBranch._id,
        name: 'A-Other',
        isDeleted: false,
      })
      const cy2 = await ctx.db.insert('classYears', {
        classId: cls2,
        academicYearId: ids.ay,
        isDeleted: false,
      })
      const semester = (await ctx.db.query('semesters').collect()).find(
        (s) => s.academicYearId === ids.ay,
      )!
      const mk = (over: Record<string, unknown>) =>
        ctx.db.insert('classSessions', {
          classYearId: cy2,
          semesterId: semester._id,
          sessionDate: DATE,
          sessionType: 'catechism',
          isCancelled: false,
          isDeleted: false,
          ...over,
        })
      const otherSession = await mk({})
      const deleted = await mk({ isDeleted: true })
      const extracurricular = await mk({ sessionType: 'extracurricular' })
      const supplemental = await ctx.db.insert('classSessions', {
        classYearId: ids.cy,
        semesterId: semester._id,
        sessionDate: DATE,
        sessionType: 'supplemental',
        isCancelled: false,
        isDeleted: false,
      })
      return { otherSession, deleted, extracurricular, supplemental }
    })
    const list = async (requesterId: Ids['admin']) =>
      (
        await t.query(api.catechistAttendance.listRecordableSessions, {
          requesterId,
          academicYearId: ids.ay,
          date: DATE,
        })
      ).map((s) => s.sessionId)
    return { t, ids, extra, list }
  }

  test('admin and board member see all class sessions on the date, sorted by class name', async () => {
    const { t, ids, extra, list } = await withExtraSessions()
    const expected = [extra.otherSession, ids.session, extra.supplemental]
    // "A-Other" sorts before "K"
    expect((await list(ids.admin))[0]).toBe(extra.otherSession)
    expect(new Set(await list(ids.admin))).toEqual(new Set(expected))
    expect(new Set(await list(ids.board))).toEqual(new Set(expected))
    const adminRows = await t.query(
      api.catechistAttendance.listRecordableSessions,
      { requesterId: ids.admin, academicYearId: ids.ay, date: DATE },
    )
    expect(adminRows.map((r) => r.className)).toEqual(['A-Other', 'K', 'K'])
    expect(
      adminRows.find((r) => r.sessionId === extra.supplemental)?.sessionType,
    ).toBe('supplemental')
  })

  test('assigned catechist sees only own classes', async () => {
    const { ids, extra, list } = await withExtraSessions()
    expect(new Set(await list(ids.homeroom))).toEqual(
      new Set([ids.session, extra.supplemental]),
    )
    expect(new Set(await list(ids.co))).toEqual(
      new Set([ids.session, extra.supplemental]),
    )
  })

  test('branch head sees only classes in their branch', async () => {
    const { ids, extra, list } = await withExtraSessions()
    expect(new Set(await list(ids.head))).toEqual(
      new Set([ids.session, extra.supplemental]),
    )
    expect(await list(ids.otherHead)).toEqual([extra.otherSession])
  })

  test('non-assigned catechist sees none', async () => {
    const { ids, list } = await withExtraSessions()
    expect(await list(ids.outsider)).toEqual([])
  })

  test('excludes cancelled, deleted, mass and extracurricular sessions', async () => {
    const { t, ids, extra } = await withExtraSessions()
    await t.run((ctx) =>
      ctx.db.patch('classSessions', ids.session, { isCancelled: true }),
    )
    const rows = await t.query(api.catechistAttendance.listRecordableSessions, {
      requesterId: ids.admin,
      academicYearId: ids.ay,
      date: DATE,
    })
    const got = rows.map((r) => r.sessionId)
    expect(got).not.toContain(ids.session) // cancelled
    expect(got).not.toContain(ids.massSession)
    expect(got).not.toContain(extra.deleted)
    expect(got).not.toContain(extra.extracurricular)
    expect(new Set(got)).toEqual(
      new Set([extra.otherSession, extra.supplemental]),
    )
  })

  test('excludes sessions of another academic year and other dates', async () => {
    const { t, ids } = await setup()
    const old = await t.query(api.catechistAttendance.listRecordableSessions, {
      requesterId: ids.admin,
      academicYearId: ids.oldAy,
      date: '2024-10-06',
    })
    expect(old).toEqual([])
    const other = await t.query(
      api.catechistAttendance.listRecordableSessions,
      { requesterId: ids.admin, academicYearId: ids.ay, date: '2024-10-13' },
    )
    expect(other.map((r) => r.sessionId)).toEqual([ids.session2])
  })
})

describe('getYearlyMatrixReport', () => {
  async function seeded() {
    const { t, ids } = await setup()
    const rec = (args: any) =>
      t.mutation(api.catechistAttendance.recordAttendance, {
        requesterId: ids.admin,
        ...args,
      })
    await rec({
      sessionId: ids.session,
      catechistId: ids.homeroom,
      status: 'present',
    })
    await rec({
      sessionId: ids.session2,
      catechistId: ids.homeroom,
      status: 'excused_absence',
    })
    await rec({
      meetingId: ids.allMeeting,
      catechistId: ids.homeroom,
      status: 'late',
    })
    await rec({ sessionId: ids.session, catechistId: ids.sub, status: 'late' })
    await t.run((ctx) =>
      ctx.db.insert('catechistAttendanceRecords', {
        sessionId: ids.cancelledSession,
        catechistId: ids.homeroom,
        status: 'unexcused_absence',
        recordedBy: ids.admin,
        deviceQueuedAt: 1,
        isDeleted: false,
      }),
    )
    const run = (requesterId: any, extra: any = {}) =>
      t.query(api.catechistAttendance.getYearlyMatrixReport, {
        requesterId,
        academicYearId: ids.ay,
        ...extra,
      })
    return { t, ids, run }
  }

  test('permissions: admin/board ok; teacher denied; branch head only with own branch', async () => {
    const { ids, run } = await seeded()
    await run(ids.admin)
    await run(ids.board)
    await expect(run(ids.homeroom)).rejects.toThrow(
      AUTHZ_ERRORS.NOT_BOARD_MEMBER,
    )
    await expect(run(ids.head)).rejects.toThrow(AUTHZ_ERRORS.NOT_BOARD_MEMBER)
    await run(ids.head, { branchId: ids.branch })
    await expect(run(ids.otherHead, { branchId: ids.branch })).rejects.toThrow(
      AUTHZ_ERRORS.NOT_BRANCH_HEAD_OR_ABOVE,
    )
  })

  test('cells, cancelled excluded, recorded-only rate math', async () => {
    const { ids, run } = await seeded()
    const r = await run(ids.admin)
    const ti = (id: string) => r.targets.findIndex((x) => x.id === id)
    expect(r.truncated).toBe(false)
    expect(ti(ids.cancelledSession)).toBe(-1)
    expect(ti(ids.cancelledMeeting)).toBe(-1)
    expect(ti(ids.massSession)).toBe(-1)

    const home = r.rows.find((x) => x.catechistId === ids.homeroom)!
    expect(home.cells[ti(ids.session)]).toBe('present')
    expect(home.cells[ti(ids.session2)]).toBe('excused_absence')
    expect(home.cells[ti(ids.allMeeting)]).toBe('late')
    expect(home.cells[ti(ids.boardMeeting)]).toBeNull()
    // (present + late) / 3 recorded; cancelled absence ignored
    expect(home.totals).toMatchObject({ total: 3, present: 1, late: 1 })
    expect(home.totals.rate).toBeCloseTo(2 / 3)

    // co-teacher has no records: assigned sessions are 'unrecorded', rate null
    const co = r.rows.find((x) => x.catechistId === ids.co)!
    expect(co.cells[ti(ids.session)]).toBe('unrecorded')
    expect(co.totals).toMatchObject({ total: 0, rate: null })

    // substitute appears with own record only
    const sub = r.rows.find((x) => x.catechistId === ids.sub)!
    expect(sub.cells[ti(ids.session)]).toBe('late')
    expect(sub.cells[ti(ids.session2)]).toBeNull()
    expect(sub.totals.rate).toBe(1)
  })

  test('branch filter keeps branch classes, drops board meetings and other branches', async () => {
    const { t, ids, run } = await seeded()
    const other = await t.run(async (ctx) => {
      const b = await ctx.db.insert('branches', {
        name: 'B3',
        sortOrder: 3,
        isDeleted: false,
      })
      const c = await ctx.db.insert('classes', {
        branchId: b,
        name: 'Z',
        isDeleted: false,
      })
      const cy = await ctx.db.insert('classYears', {
        classId: c,
        academicYearId: ids.ay,
        isDeleted: false,
      })
      const sem = (await ctx.db.query('semesters').collect())[0]
      return await ctx.db.insert('classSessions', {
        classYearId: cy,
        semesterId: sem._id,
        sessionDate: '2024-10-06',
        sessionType: 'catechism',
        isCancelled: false,
        isDeleted: false,
      })
    })
    const all = await run(ids.admin)
    expect(all.targets.map((x) => x.id)).toContain(other)
    expect(all.targets.map((x) => x.id)).toContain(ids.boardMeeting)

    const r = await run(ids.admin, { branchId: ids.branch })
    const tids = r.targets.map((x) => x.id)
    expect(tids).not.toContain(other)
    expect(tids).not.toContain(ids.boardMeeting)
    expect(tids).toContain(ids.session)
    expect(tids).toContain(ids.allMeeting)
    expect(tids).toContain(ids.branchMeeting)
  })

  test('soft-deleted records and sessions are ignored', async () => {
    const { t, ids, run } = await seeded()
    await t.run(async (ctx) => {
      await ctx.db.patch('classSessions', ids.session2, { isDeleted: true })
    })
    const r = await run(ids.admin)
    expect(r.targets.map((x) => x.id)).not.toContain(ids.session2)
    const home = r.rows.find((x) => x.catechistId === ids.homeroom)!
    expect(home.totals.total).toBe(2)
  })

  test('truncates targets and flags it', async () => {
    const { t, ids, run } = await seeded()
    await t.run(async (ctx) => {
      const sem = (await ctx.db.query('semesters').collect())[0]
      for (let i = 0; i < 125; i++) {
        await ctx.db.insert('classSessions', {
          classYearId: ids.cy,
          semesterId: sem._id,
          sessionDate: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
          sessionType: 'catechism',
          isCancelled: false,
          isDeleted: false,
        })
      }
    })
    const r = await run(ids.admin)
    expect(r.truncated).toBe(true)
    expect(r.targets).toHaveLength(120)
    expect(r.rows[0].cells).toHaveLength(120)
  })

  test('branch filter drops other branches branch-scope meetings; other years never appear', async () => {
    const { t, ids, run } = await seeded()
    const otherBranchMeeting = await t.run(async (ctx) => {
      const otherBranch = (await ctx.db.query('branches').collect()).find(
        (b) => b.name === 'B2',
      )!
      return await ctx.db.insert('catechistMeetings', {
        academicYearId: ids.ay,
        meetingDate: '2024-10-08',
        title: 'Other branch',
        scope: 'branch',
        branchId: otherBranch._id,
        isCancelled: false,
        isDeleted: false,
      })
    })
    const all = (await run(ids.admin)).targets.map((x) => x.id)
    expect(all).toContain(otherBranchMeeting)
    expect(all).not.toContain(ids.oldSession)
    expect(all).not.toContain(ids.oldMeeting)

    const scoped = (await run(ids.head, { branchId: ids.branch })).targets.map(
      (x) => x.id,
    )
    expect(scoped).not.toContain(otherBranchMeeting)
    expect(scoped).toContain(ids.session)
  })

  test('soft-deleted attendance records and catechists are left out', async () => {
    const { t, ids, run } = await seeded()
    await t.run(async (ctx) => {
      const rec = await ctx.db
        .query('catechistAttendanceRecords')
        .withIndex('by_session_id_and_catechist_id', (q) =>
          q.eq('sessionId', ids.session).eq('catechistId', ids.homeroom),
        )
        .first()
      await ctx.db.patch('catechistAttendanceRecords', rec!._id, {
        isDeleted: true,
      })
      await ctx.db.patch('catechists', ids.sub, { isDeleted: true })
    })
    const r = await run(ids.admin)
    const ti = r.targets.findIndex((x) => x.id === ids.session)
    const home = r.rows.find((x) => x.catechistId === ids.homeroom)!
    expect(home.cells[ti]).toBe('unrecorded')
    expect(home.totals.total).toBe(2)
    expect(r.rows.some((x) => x.catechistId === ids.sub)).toBe(false)
  })

  test('exactly 120 targets is not truncated; meetings count toward the cap', async () => {
    const { t, ids, run } = await seeded()
    await t.run(async (ctx) => {
      const sem = (await ctx.db.query('semesters').collect())[0]
      for (let i = 0; i < 115; i++) {
        await ctx.db.insert('classSessions', {
          classYearId: ids.cy,
          semesterId: sem._id,
          sessionDate: '2025-02-01',
          sessionType: 'catechism',
          isCancelled: false,
          isDeleted: false,
        })
      }
    })
    const exact = await run(ids.admin)
    expect(exact.targets).toHaveLength(120)
    expect(exact.truncated).toBe(false)

    await t.run((ctx) =>
      ctx.db.insert('catechistMeetings', {
        academicYearId: ids.ay,
        meetingDate: '2025-03-01',
        title: 'Late',
        scope: 'all',
        isCancelled: false,
        isDeleted: false,
      }),
    )
    const over = await run(ids.admin)
    expect(over.targets).toHaveLength(120)
    expect(over.truncated).toBe(true)
    // earliest first: the latest-dated target is the one dropped
    expect(over.targets.map((x) => x.label)).not.toContain('Late')
  })

  test('kind filters targets to class sessions or meetings', async () => {
    const { ids, run } = await seeded()
    const cls = await run(ids.admin, { kind: 'class' })
    expect(cls.targets.length).toBeGreaterThan(0)
    expect(cls.targets.every((x) => x.kind === 'class')).toBe(true)
    const mtg = await run(ids.admin, { kind: 'meeting' })
    expect(mtg.targets.length).toBeGreaterThan(0)
    expect(mtg.targets.every((x) => x.kind === 'meeting')).toBe(true)
  })

  test('date range bounds class sessions and meetings inclusively; totals follow', async () => {
    const { ids, run } = await seeded()
    const all = await run(ids.admin)
    const dates = [...new Set(all.targets.map((x) => x.date))].sort()
    expect(dates.length).toBeGreaterThan(1)
    const first = dates[0]
    const r = await run(ids.admin, { fromDate: first, toDate: first })
    expect(r.targets.length).toBeGreaterThan(0)
    expect(r.targets.every((x) => x.date === first)).toBe(true)
    const home = r.rows.find((x) => x.catechistId === ids.homeroom)
    const homeAll = all.rows.find((x) => x.catechistId === ids.homeroom)!
    expect(home?.totals.total ?? 0).toBeLessThan(homeAll.totals.total)
    const none = await run(ids.admin, {
      fromDate: '1999-01-01',
      toDate: '1999-12-31',
    })
    expect(none.targets).toEqual([])
    expect(none.rows).toEqual([])
  })

  test('meeting roster pre-fills unrecorded for expected catechists', async () => {
    const { ids, run } = await seeded()
    const r = await run(ids.admin, { kind: 'meeting' })
    const ti = r.targets.findIndex((x) => x.id === ids.allMeeting)
    // co has no record for the all-scope meeting but is an expected attendee
    const co = r.rows.find((x) => x.catechistId === ids.co)!
    expect(co.cells[ti]).toBe('unrecorded')
    expect(co.totals.total).toBe(0)
  })

  test('catechist rows cap at 100: boundary not truncated, 101 truncated', async () => {
    const { t, ids, run } = await seeded()
    const addTeachers = (n: number, from: number) =>
      t.run(async (ctx) => {
        for (let i = 0; i < n; i++) {
          const c = await ctx.db.insert('catechists', {
            memberId: `X${from + i}`,
            fullName: `Z${String(from + i).padStart(3, '0')}`,
            role: 'user',
            isActive: true,
            isDeleted: false,
          })
          await ctx.db.insert('classCatechists', {
            catechistId: c,
            classYearId: ids.cy,
            academicYearId: ids.ay,
            role: 'co_teacher',
            isDeleted: false,
          })
        }
      })
    // seeded: homeroom, co, sub = 3 rows; +97 = exactly 100
    await addTeachers(97, 0)
    // class-only: meeting rosters would add rows beyond the seeded teachers
    const exact = await run(ids.admin, { kind: 'class' })
    expect(exact.rows).toHaveLength(100)
    expect(exact.truncated).toBe(false)

    await addTeachers(1, 97)
    const over = await run(ids.admin, { kind: 'class' })
    expect(over.rows).toHaveLength(100)
    expect(over.truncated).toBe(true)
    // sorted by name, so the last-named catechist is the one cut
    expect(over.rows.map((x) => x.fullName)).not.toContain('Z097')
  })
})
