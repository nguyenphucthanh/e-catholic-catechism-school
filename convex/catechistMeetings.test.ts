/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import {
  AUTHZ_ERRORS,
  CATECHIST_ATTENDANCE_ERRORS,
  CATECHIST_MEETING_ERRORS,
} from './lib/errors'

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
    const board = await mk(1)
    const head = await mk(2)
    const ay = await ctx.db.insert('academicYears', {
      name: '2024',
      startDate: '2024-09-01',
      endDate: '2025-05-31',
      timezone: 'Asia/Ho_Chi_Minh',
      isActive: true,
      isDeleted: false,
    })
    const oldAy = await ctx.db.insert('academicYears', {
      name: '2023',
      startDate: '2023-09-01',
      endDate: '2024-05-31',
      timezone: 'Asia/Ho_Chi_Minh',
      isActive: false,
      isDeleted: false,
    })
    const branch = await ctx.db.insert('branches', {
      name: 'B',
      sortOrder: 1,
      isDeleted: false,
    })
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
    return { admin, board, head, ay, oldAy, branch }
  })
  return { t, ids }
}

const base = (ids: { admin: any; ay: any }) => ({
  requesterId: ids.admin,
  academicYearId: ids.ay,
  meetingDate: '2024-10-07',
  title: 'M',
  scope: 'all' as const,
})

describe('catechistMeetings', () => {
  test('admin and board can create; branch head and others cannot', async () => {
    const { t, ids } = await setup()
    await t.mutation(api.catechistMeetings.createMeeting, base(ids))
    await t.mutation(api.catechistMeetings.createMeeting, {
      ...base(ids),
      requesterId: ids.board,
    })
    await expect(
      t.mutation(api.catechistMeetings.createMeeting, {
        ...base(ids),
        requesterId: ids.head,
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.NOT_BOARD_MEMBER)
  })

  test('branch scope requires branchId; other scopes forbid it; validates date and branch', async () => {
    const { t, ids } = await setup()
    await expect(
      t.mutation(api.catechistMeetings.createMeeting, {
        ...base(ids),
        scope: 'branch',
      }),
    ).rejects.toThrow(CATECHIST_MEETING_ERRORS.INVALID_SCOPE)
    await expect(
      t.mutation(api.catechistMeetings.createMeeting, {
        ...base(ids),
        branchId: ids.branch,
      }),
    ).rejects.toThrow(CATECHIST_MEETING_ERRORS.INVALID_SCOPE)
    await expect(
      t.mutation(api.catechistMeetings.createMeeting, {
        ...base(ids),
        meetingDate: '7/10/2024',
      }),
    ).rejects.toThrow(CATECHIST_MEETING_ERRORS.INVALID_DATE)
    await t.run((ctx) =>
      ctx.db.patch('branches', ids.branch, { isDeleted: true }),
    )
    await expect(
      t.mutation(api.catechistMeetings.createMeeting, {
        ...base(ids),
        scope: 'branch',
        branchId: ids.branch,
      }),
    ).rejects.toThrow(CATECHIST_MEETING_ERRORS.BRANCH_NOT_FOUND)
  })

  test('academic year lock applies to every write', async () => {
    const { t, ids } = await setup()
    await expect(
      t.mutation(api.catechistMeetings.createMeeting, {
        ...base(ids),
        academicYearId: ids.oldAy,
      }),
    ).rejects.toThrow(CATECHIST_MEETING_ERRORS.INACTIVE_ACADEMIC_YEAR)
    const meetingId = await t.run((ctx) =>
      ctx.db.insert('catechistMeetings', {
        academicYearId: ids.oldAy,
        meetingDate: '2023-10-01',
        title: 'old',
        scope: 'all',
        isCancelled: false,
        isDeleted: false,
      }),
    )
    const args = { requesterId: ids.admin, meetingId }
    await expect(
      t.mutation(api.catechistMeetings.updateMeeting, { ...args, title: 'x' }),
    ).rejects.toThrow(CATECHIST_MEETING_ERRORS.INACTIVE_ACADEMIC_YEAR)
    await expect(
      t.mutation(api.catechistMeetings.cancelMeeting, args),
    ).rejects.toThrow(CATECHIST_MEETING_ERRORS.INACTIVE_ACADEMIC_YEAR)
    await expect(
      t.mutation(api.catechistMeetings.softDeleteMeeting, args),
    ).rejects.toThrow(CATECHIST_MEETING_ERRORS.INACTIVE_ACADEMIC_YEAR)
  })

  test('update / cancel / softDelete', async () => {
    const { t, ids } = await setup()
    const id = await t.mutation(api.catechistMeetings.createMeeting, {
      ...base(ids),
      scope: 'branch',
      branchId: ids.branch,
    })
    const args = { requesterId: ids.admin, meetingId: id }
    await t.mutation(api.catechistMeetings.updateMeeting, {
      ...args,
      title: 'New',
      location: 'Hall',
    })
    expect(
      await t.run((ctx) => ctx.db.get('catechistMeetings', id)),
    ).toMatchObject({
      title: 'New',
      location: 'Hall',
      scope: 'branch',
      branchId: ids.branch,
    })
    // leaving branch scope clears branchId
    await t.mutation(api.catechistMeetings.updateMeeting, {
      ...args,
      scope: 'board',
    })
    expect(
      (await t.run((ctx) => ctx.db.get('catechistMeetings', id)))?.branchId,
    ).toBeUndefined()
    // switching back without branchId is invalid
    await expect(
      t.mutation(api.catechistMeetings.updateMeeting, {
        ...args,
        scope: 'branch',
      }),
    ).rejects.toThrow(CATECHIST_MEETING_ERRORS.INVALID_SCOPE)

    await t.mutation(api.catechistMeetings.cancelMeeting, args)
    expect(
      (await t.run((ctx) => ctx.db.get('catechistMeetings', id)))?.isCancelled,
    ).toBe(true)
    await t.mutation(api.catechistMeetings.softDeleteMeeting, args)
    expect(
      (await t.run((ctx) => ctx.db.get('catechistMeetings', id)))?.isDeleted,
    ).toBe(true)
    await expect(
      t.mutation(api.catechistMeetings.cancelMeeting, args),
    ).rejects.toThrow(CATECHIST_MEETING_ERRORS.NOT_FOUND)
  })

  test('unknown academic year', async () => {
    const { t, ids } = await setup()
    await t.run((ctx) =>
      ctx.db.patch('academicYears', ids.ay, { isDeleted: true }),
    )
    await expect(
      t.mutation(api.catechistMeetings.createMeeting, base(ids)),
    ).rejects.toThrow(CATECHIST_MEETING_ERRORS.ACADEMIC_YEAR_NOT_FOUND)
  })
})

async function seedQueries() {
  const { t, ids } = await setup()
  const x = await t.run(async (ctx) => {
    const mk = (n: number) =>
      ctx.db.insert('catechists', {
        memberId: `GLV${n}`,
        fullName: `C${n}`,
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    const teacher = await mk(10)
    const outsider = await mk(11)
    const otherHead = await mk(12)
    const branch2 = await ctx.db.insert('branches', {
      name: 'B2',
      sortOrder: 2,
      isDeleted: false,
    })
    await ctx.db.insert('branchAssignments', {
      academicYearId: ids.ay,
      catechistId: otherHead,
      branchId: branch2,
      isDeleted: false,
    })
    // teacher teaches a class in branch 1 (ids.branch)
    const classId = await ctx.db.insert('classes', {
      branchId: ids.branch,
      name: 'K1',
      isDeleted: false,
    })
    const classYearId = await ctx.db.insert('classYears', {
      classId,
      academicYearId: ids.ay,
      isDeleted: false,
    })
    await ctx.db.insert('classCatechists', {
      catechistId: teacher,
      classYearId,
      academicYearId: ids.ay,
      role: 'homeroom',
      isDeleted: false,
    })
    const meeting = (
      over: Partial<{
        academicYearId: any
        meetingDate: string
        title: string
        scope: 'all' | 'board' | 'branch'
        branchId: any
        isCancelled: boolean
        isDeleted: boolean
      }>,
    ) =>
      ctx.db.insert('catechistMeetings', {
        academicYearId: ids.ay,
        meetingDate: '2024-10-07',
        title: 'M',
        scope: 'all',
        isCancelled: false,
        isDeleted: false,
        ...over,
      })
    const mAll = await meeting({ title: 'all', meetingDate: '2024-10-07' })
    const mBoard = await meeting({
      title: 'board',
      scope: 'board',
      meetingDate: '2024-10-14',
    })
    const mB1 = await meeting({
      title: 'b1',
      scope: 'branch',
      branchId: ids.branch,
      meetingDate: '2024-10-21',
    })
    const mB2 = await meeting({
      title: 'b2',
      scope: 'branch',
      branchId: branch2,
      meetingDate: '2024-11-04',
    })
    const mDeleted = await meeting({
      title: 'gone',
      meetingDate: '2024-10-07',
      isDeleted: true,
    })
    const mCancelled = await meeting({
      title: 'cancelled',
      meetingDate: '2024-10-07',
      isCancelled: true,
    })
    const mOtherYear = await meeting({
      title: 'old',
      academicYearId: ids.oldAy,
      meetingDate: '2024-10-07',
    })
    return {
      teacher,
      outsider,
      otherHead,
      branch2,
      mAll,
      mBoard,
      mB1,
      mB2,
      mDeleted,
      mCancelled,
      mOtherYear,
    }
  })
  return { t, ids, x }
}

const titles = (rows: Array<{ title: string }>) => rows.map((r) => r.title)

describe('catechistMeetings.listMeetings', () => {
  const list = (t: any, requesterId: any, ay: any, extra: object = {}) =>
    t.query(api.catechistMeetings.listMeetings, {
      requesterId,
      academicYearId: ay,
      ...extra,
    })

  test('admin and board member see every live meeting, sorted by date desc', async () => {
    const { t, ids } = await seedQueries()
    const expected = ['b2', 'b1', 'board', 'cancelled', 'all']
    // cancelled and all share a date: only assert the relative date order
    for (const who of [ids.admin, ids.board]) {
      const rows = await list(t, who, ids.ay)
      expect(rows.map((r: any) => r.meetingDate)).toEqual(
        [...rows.map((r: any) => r.meetingDate)].sort().reverse(),
      )
      expect(titles(rows).sort()).toEqual([...expected].sort())
    }
  })

  test('soft-deleted and other-year meetings are excluded', async () => {
    const { t, ids } = await seedQueries()
    const rows = await list(t, ids.admin, ids.ay)
    expect(titles(rows)).not.toContain('gone')
    expect(titles(rows)).not.toContain('old')
  })

  test('non-teaching catechist sees only scope all meetings', async () => {
    const { t, ids, x } = await seedQueries()
    const rows = await list(t, x.outsider, ids.ay)
    expect(titles(rows).sort()).toEqual(['all', 'cancelled'])
  })

  test('branch head sees all-scope and own-branch meetings but not other branch or board', async () => {
    const { t, ids } = await seedQueries()
    const rows = await list(t, ids.head, ids.ay)
    expect(titles(rows).sort()).toEqual(['all', 'b1', 'cancelled'])
  })

  test('other branch head sees only own branch', async () => {
    const { t, ids, x } = await seedQueries()
    const rows = await list(t, x.otherHead, ids.ay)
    expect(titles(rows).sort()).toEqual(['all', 'b2', 'cancelled'])
  })

  test('teacher in a branch sees that branch meeting but not board or other branches', async () => {
    const { t, ids, x } = await seedQueries()
    const rows = await list(t, x.teacher, ids.ay)
    expect(titles(rows).sort()).toEqual(['all', 'b1', 'cancelled'])
  })

  test('date range and scope filters narrow the result', async () => {
    const { t, ids } = await seedQueries()
    expect(
      titles(
        await list(t, ids.admin, ids.ay, {
          dateFrom: '2024-10-14',
          dateTo: '2024-10-21',
        }),
      ).sort(),
    ).toEqual(['b1', 'board'])
    expect(
      titles(
        await list(t, ids.admin, ids.ay, { dateFrom: '2024-10-21' }),
      ).sort(),
    ).toEqual(['b1', 'b2'])
    expect(
      titles(await list(t, ids.admin, ids.ay, { dateTo: '2024-10-07' })).sort(),
    ).toEqual(['all', 'cancelled'])
    expect(
      titles(await list(t, ids.admin, ids.ay, { scope: 'branch' })).sort(),
    ).toEqual(['b1', 'b2'])
  })

  test('canManage only for admin/board; canRecord follows recording rule; branchName resolved', async () => {
    const { t, ids } = await seedQueries()
    const byTitle = (rows: Array<any>) =>
      Object.fromEntries(rows.map((r) => [r.title, r]))
    const admin = byTitle(await list(t, ids.admin, ids.ay))
    expect(admin.b1).toMatchObject({
      canManage: true,
      canRecord: true,
      branchName: 'B',
    })
    expect(admin.all.branchName).toBeNull()

    const head = byTitle(await list(t, ids.head, ids.ay))
    expect(head.b1).toMatchObject({ canManage: false, canRecord: true })
    expect(head.all).toMatchObject({ canManage: false, canRecord: false })
  })
})

describe('catechistMeetings.getMeeting', () => {
  const get = (t: any, requesterId: any, meetingId: any) =>
    t.query(api.catechistMeetings.getMeeting, { requesterId, meetingId })

  test('returns the view with flags for a visible meeting', async () => {
    const { t, ids, x } = await seedQueries()
    expect(await get(t, ids.admin, x.mB1)).toMatchObject({
      title: 'b1',
      branchName: 'B',
      canManage: true,
      canRecord: true,
    })
    expect(await get(t, x.outsider, x.mAll)).toMatchObject({
      canManage: false,
      canRecord: false,
    })
  })

  test('null when soft-deleted', async () => {
    const { t, ids, x } = await seedQueries()
    expect(await get(t, ids.admin, x.mDeleted)).toBeNull()
  })

  test('null when not visible to the requester', async () => {
    const { t, ids, x } = await seedQueries()
    expect(await get(t, x.outsider, x.mBoard)).toBeNull()
    expect(await get(t, x.outsider, x.mB1)).toBeNull()
    expect(await get(t, ids.head, x.mB2)).toBeNull()
    expect(await get(t, x.teacher, x.mB2)).toBeNull()
    expect(await get(t, x.teacher, x.mB1)).not.toBeNull()
  })

  test('null when the meeting no longer exists', async () => {
    const { t, ids, x } = await seedQueries()
    await t.run((ctx) => ctx.db.delete('catechistMeetings', x.mAll))
    expect(await get(t, ids.admin, x.mAll)).toBeNull()
  })
})

describe('catechistMeetings.listRecordableMeetings', () => {
  const rec = (t: any, requesterId: any, ay: any, date: string) =>
    t.query(api.catechistMeetings.listRecordableMeetings, {
      requesterId,
      academicYearId: ay,
      date,
    })

  test('admin and board get every scope on the date; cancelled and deleted excluded', async () => {
    const { t, ids, x } = await seedQueries()
    for (const who of [ids.admin, ids.board]) {
      const rows = await rec(t, who, ids.ay, '2024-10-07')
      expect(rows).toEqual([
        {
          meetingId: x.mAll,
          title: 'all',
          scope: 'all',
          branchName: null,
        },
      ])
    }
    expect(
      (await rec(t, ids.admin, ids.ay, '2024-10-14')).map((r: any) => r.scope),
    ).toEqual(['board'])
  })

  test('branch head only gets own-branch meetings', async () => {
    const { t, ids, x } = await seedQueries()
    expect(await rec(t, ids.head, ids.ay, '2024-10-21')).toEqual([
      { meetingId: x.mB1, title: 'b1', scope: 'branch', branchName: 'B' },
    ])
    expect(await rec(t, ids.head, ids.ay, '2024-11-04')).toEqual([])
    expect(await rec(t, ids.head, ids.ay, '2024-10-07')).toEqual([])
    expect(await rec(t, ids.head, ids.ay, '2024-10-14')).toEqual([])
  })

  test('non-managing catechists get nothing; other dates and years are empty', async () => {
    const { t, ids, x } = await seedQueries()
    expect(await rec(t, x.teacher, ids.ay, '2024-10-21')).toEqual([])
    expect(await rec(t, ids.admin, ids.ay, '2024-12-25')).toEqual([])
    expect(await rec(t, ids.admin, ids.oldAy, '2024-10-07')).toEqual([
      expect.objectContaining({ meetingId: x.mOtherYear }),
    ])
    expect(await rec(t, ids.admin, ids.ay, '2024-10-07')).not.toContainEqual(
      expect.objectContaining({ meetingId: x.mOtherYear }),
    )
  })
})

describe('catechistMeetings attendance on save', () => {
  const countRecords = (t: Awaited<ReturnType<typeof setup>>['t']) =>
    t.run(async (ctx) => ({
      meetings: (await ctx.db.query('catechistMeetings').collect()).length,
      records: await ctx.db.query('catechistAttendanceRecords').collect(),
    }))

  test('no attendance arg behaves as before', async () => {
    const { t, ids } = await setup()
    await t.mutation(api.catechistMeetings.createMeeting, base(ids))
    const r = await countRecords(t)
    expect(r.meetings).toBe(1)
    expect(r.records).toHaveLength(0)
  })

  test('create saves records as manual attendees', async () => {
    const { t, ids } = await setup()
    await t.mutation(api.catechistMeetings.createMeeting, {
      ...base(ids),
      attendance: [
        { catechistId: ids.board, status: 'late' },
        { catechistId: ids.head, status: 'present', roleAtSession: 'attendee' },
      ],
    })
    const { records } = await countRecords(t)
    expect(records).toHaveLength(2)
    expect(records.every((r) => r.roleAtSession === 'attendee')).toBe(true)
    expect(records.every((r) => r.checkInMethod === 'manual')).toBe(true)
    expect(records.find((r) => r.catechistId === ids.board)?.status).toBe(
      'late',
    )
  })

  test('update upserts submitted records and keeps the others', async () => {
    const { t, ids } = await setup()
    const meetingId = await t.mutation(api.catechistMeetings.createMeeting, {
      ...base(ids),
      attendance: [
        { catechistId: ids.board, status: 'present' },
        { catechistId: ids.head, status: 'present' },
      ],
    })
    await t.mutation(api.catechistMeetings.updateMeeting, {
      requesterId: ids.admin,
      meetingId,
      attendance: [
        { catechistId: ids.board, status: 'excused_absence', notes: 'sick' },
        { catechistId: ids.admin, status: 'present' },
      ],
    })
    const { records } = await countRecords(t)
    const live = records.filter((r) => !r.isDeleted)
    expect(live).toHaveLength(3)
    const board = live.find((r) => r.catechistId === ids.board)!
    expect(board.status).toBe('excused_absence')
    expect(board.notes).toBe('sick')
    expect(live.find((r) => r.catechistId === ids.head)?.status).toBe('present')
  })

  test('duplicate ids and non-attendee roles are rejected', async () => {
    const { t, ids } = await setup()
    await expect(
      t.mutation(api.catechistMeetings.createMeeting, {
        ...base(ids),
        attendance: [
          { catechistId: ids.board, status: 'present' },
          { catechistId: ids.board, status: 'late' },
        ],
      }),
    ).rejects.toThrow(CATECHIST_ATTENDANCE_ERRORS.DUPLICATE_CATECHIST)
    await expect(
      t.mutation(api.catechistMeetings.createMeeting, {
        ...base(ids),
        attendance: [
          {
            catechistId: ids.board,
            status: 'present',
            roleAtSession: 'substitute',
          },
        ],
      }),
    ).rejects.toThrow(CATECHIST_ATTENDANCE_ERRORS.INVALID_ROLE)
  })

  test('a failing record rolls back the whole create', async () => {
    const { t, ids } = await setup()
    const ghost = await t.run(async (ctx) => {
      const id = await ctx.db.insert('catechists', {
        memberId: 'GLV99',
        fullName: 'Ghost',
        role: 'user',
        isActive: true,
        isDeleted: true,
      })
      return id
    })
    await expect(
      t.mutation(api.catechistMeetings.createMeeting, {
        ...base(ids),
        attendance: [
          { catechistId: ids.board, status: 'present' },
          { catechistId: ghost, status: 'present' },
        ],
      }),
    ).rejects.toThrow(CATECHIST_ATTENDANCE_ERRORS.CATECHIST_NOT_FOUND)
    const r = await countRecords(t)
    expect(r.meetings).toBe(0)
    expect(r.records).toHaveLength(0)
  })

  test('locked year and non-board requester are refused', async () => {
    const { t, ids } = await setup()
    await expect(
      t.mutation(api.catechistMeetings.createMeeting, {
        ...base(ids),
        academicYearId: ids.oldAy,
        attendance: [{ catechistId: ids.board, status: 'present' }],
      }),
    ).rejects.toThrow(CATECHIST_MEETING_ERRORS.INACTIVE_ACADEMIC_YEAR)
    await expect(
      t.mutation(api.catechistMeetings.createMeeting, {
        ...base(ids),
        requesterId: ids.head,
        attendance: [{ catechistId: ids.board, status: 'present' }],
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.NOT_BOARD_MEMBER)
    expect((await countRecords(t)).records).toHaveLength(0)
  })

  test('attendance on a cancelled meeting is refused on update', async () => {
    const { t, ids } = await setup()
    const meetingId = await t.mutation(
      api.catechistMeetings.createMeeting,
      base(ids),
    )
    await t.mutation(api.catechistMeetings.cancelMeeting, {
      requesterId: ids.admin,
      meetingId,
    })
    await expect(
      t.mutation(api.catechistMeetings.updateMeeting, {
        requesterId: ids.admin,
        meetingId,
        attendance: [{ catechistId: ids.board, status: 'present' }],
      }),
    ).rejects.toThrow(CATECHIST_ATTENDANCE_ERRORS.MEETING_CANCELLED)
  })

  test('a cancelled meeting can be edited without attendance', async () => {
    const { t, ids } = await setup()
    const meetingId = await t.mutation(
      api.catechistMeetings.createMeeting,
      base(ids),
    )
    await t.mutation(api.catechistMeetings.cancelMeeting, {
      requesterId: ids.admin,
      meetingId,
    })
    await t.mutation(api.catechistMeetings.updateMeeting, {
      requesterId: ids.admin,
      meetingId,
      notes: 'edited',
    })
    const m = await t.run((ctx) => ctx.db.get('catechistMeetings', meetingId))
    expect(m?.notes).toBe('edited')
    expect(m?.isCancelled).toBe(true)
  })
})

describe('catechistMeetings.updateMeeting clearCatechistIds', () => {
  const records = (t: Awaited<ReturnType<typeof setup>>['t']) =>
    t.run((ctx) => ctx.db.query('catechistAttendanceRecords').collect())
  const seed = async () => {
    const { t, ids } = await setup()
    const meetingId = await t.mutation(api.catechistMeetings.createMeeting, {
      ...base(ids),
      attendance: [
        { catechistId: ids.board, status: 'present' },
        { catechistId: ids.head, status: 'late' },
      ],
    })
    return { t, ids, meetingId }
  }

  test('soft-deletes a live record and keeps the others', async () => {
    const { t, ids, meetingId } = await seed()
    await t.mutation(api.catechistMeetings.updateMeeting, {
      requesterId: ids.admin,
      meetingId,
      clearCatechistIds: [ids.board],
    })
    const rows = await records(t)
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.catechistId === ids.board)?.isDeleted).toBe(true)
    expect(rows.find((r) => r.catechistId === ids.head)?.isDeleted).toBe(false)
  })

  test('ids without a live record are ignored', async () => {
    const { t, ids, meetingId } = await seed()
    await t.mutation(api.catechistMeetings.updateMeeting, {
      requesterId: ids.admin,
      meetingId,
      clearCatechistIds: [ids.admin],
    })
    expect((await records(t)).every((r) => !r.isDeleted)).toBe(true)
  })

  test('a cleared record can be recorded again later', async () => {
    const { t, ids, meetingId } = await seed()
    const clear = {
      requesterId: ids.admin,
      meetingId,
      clearCatechistIds: [ids.board],
    }
    await t.mutation(api.catechistMeetings.updateMeeting, clear)
    await t.mutation(api.catechistMeetings.updateMeeting, {
      requesterId: ids.admin,
      meetingId,
      attendance: [{ catechistId: ids.board, status: 'late' }],
    })
    // clearing again hits the live row, not the deleted one
    await t.mutation(api.catechistMeetings.updateMeeting, clear)
    const board = (await records(t)).filter((r) => r.catechistId === ids.board)
    expect(board.every((r) => r.isDeleted)).toBe(true)
  })

  test('overlap with attendance is rejected and nothing is written', async () => {
    const { t, ids, meetingId } = await seed()
    await expect(
      t.mutation(api.catechistMeetings.updateMeeting, {
        requesterId: ids.admin,
        meetingId,
        title: 'changed',
        attendance: [{ catechistId: ids.board, status: 'late' }],
        clearCatechistIds: [ids.board],
      }),
    ).rejects.toThrow(CATECHIST_MEETING_ERRORS.CLEAR_OVERLAPS_ATTENDANCE)
    const m = await t.run((ctx) => ctx.db.get('catechistMeetings', meetingId))
    expect(m?.title).toBe('M')
    expect((await records(t)).every((r) => !r.isDeleted)).toBe(true)
  })

  test('refused on a cancelled meeting', async () => {
    const { t, ids, meetingId } = await seed()
    await t.mutation(api.catechistMeetings.cancelMeeting, {
      requesterId: ids.admin,
      meetingId,
    })
    await expect(
      t.mutation(api.catechistMeetings.updateMeeting, {
        requesterId: ids.admin,
        meetingId,
        clearCatechistIds: [ids.board],
      }),
    ).rejects.toThrow(CATECHIST_ATTENDANCE_ERRORS.MEETING_CANCELLED)
    expect((await records(t)).every((r) => !r.isDeleted)).toBe(true)
  })

  test('refused on a locked year', async () => {
    const { t, ids, meetingId } = await seed()
    await t.run((ctx) =>
      ctx.db.patch('academicYears', ids.ay, { isActive: false }),
    )
    await expect(
      t.mutation(api.catechistMeetings.updateMeeting, {
        requesterId: ids.admin,
        meetingId,
        clearCatechistIds: [ids.board],
      }),
    ).rejects.toThrow(CATECHIST_MEETING_ERRORS.INACTIVE_ACADEMIC_YEAR)
    expect((await records(t)).every((r) => !r.isDeleted)).toBe(true)
  })

  test('refused for a non-board requester', async () => {
    const { t, ids, meetingId } = await seed()
    await expect(
      t.mutation(api.catechistMeetings.updateMeeting, {
        requesterId: ids.head,
        meetingId,
        clearCatechistIds: [ids.board],
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.NOT_BOARD_MEMBER)
    expect((await records(t)).every((r) => !r.isDeleted)).toBe(true)
  })

  test('a failing attendance record rolls back the clear', async () => {
    const { t, ids, meetingId } = await seed()
    const ghost = await t.run((ctx) =>
      ctx.db.insert('catechists', {
        memberId: 'GLV98',
        fullName: 'Ghost',
        role: 'user',
        isActive: true,
        isDeleted: true,
      }),
    )
    await expect(
      t.mutation(api.catechistMeetings.updateMeeting, {
        requesterId: ids.admin,
        meetingId,
        attendance: [{ catechistId: ghost, status: 'present' }],
        clearCatechistIds: [ids.board],
      }),
    ).rejects.toThrow(CATECHIST_ATTENDANCE_ERRORS.CATECHIST_NOT_FOUND)
    expect((await records(t)).every((r) => !r.isDeleted)).toBe(true)
  })

  test('omitted or empty arg leaves records unchanged', async () => {
    const { t, ids, meetingId } = await seed()
    await t.mutation(api.catechistMeetings.updateMeeting, {
      requesterId: ids.admin,
      meetingId,
      notes: 'x',
    })
    await t.mutation(api.catechistMeetings.updateMeeting, {
      requesterId: ids.admin,
      meetingId,
      clearCatechistIds: [],
    })
    expect((await records(t)).every((r) => !r.isDeleted)).toBe(true)
  })
})

describe('catechistMeetings attendance on a branch-scoped meeting', () => {
  test('create and update save records for scope=branch', async () => {
    const { t, ids } = await setup()
    const meetingId = await t.mutation(api.catechistMeetings.createMeeting, {
      ...base(ids),
      scope: 'branch',
      branchId: ids.branch,
      attendance: [{ catechistId: ids.head, status: 'late' }],
    })
    await t.mutation(api.catechistMeetings.updateMeeting, {
      requesterId: ids.admin,
      meetingId,
      attendance: [{ catechistId: ids.head, status: 'excused_absence' }],
    })
    const records = await t.run((ctx) =>
      ctx.db.query('catechistAttendanceRecords').collect(),
    )
    const live = records.filter((r) => !r.isDeleted)
    expect(live).toHaveLength(1)
    expect(live[0]).toMatchObject({
      catechistId: ids.head,
      status: 'excused_absence',
      roleAtSession: 'attendee',
    })
  })
})

describe('catechistMeetings.getExpectedAttendees', () => {
  test('resolves roster per scope', async () => {
    const { t, ids } = await setup()
    const q = (extra: Record<string, unknown>) =>
      t.query(api.catechistMeetings.getExpectedAttendees, {
        requesterId: ids.admin,
        academicYearId: ids.ay,
        ...extra,
      } as any)
    const all = await q({ scope: 'all' })
    expect(all.map((a) => a.catechistId).sort()).toEqual(
      [ids.admin, ids.board, ids.head].sort(),
    )
    const board = await q({ scope: 'board' })
    expect(board.map((a) => a.catechistId)).toEqual([ids.board])
    const branch = await q({ scope: 'branch', branchId: ids.branch })
    expect(branch.map((a) => a.catechistId)).toEqual([ids.head])
    expect(branch[0]).toMatchObject({ memberId: 'GLV2', fullName: 'C2' })
    expect(await q({ scope: 'branch' })).toEqual([])
  })

  test('admin/board only', async () => {
    const { t, ids } = await setup()
    await expect(
      t.query(api.catechistMeetings.getExpectedAttendees, {
        requesterId: ids.head,
        academicYearId: ids.ay,
        scope: 'all',
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.NOT_BOARD_MEMBER)
    await t.query(api.catechistMeetings.getExpectedAttendees, {
      requesterId: ids.board,
      academicYearId: ids.ay,
      scope: 'all',
    })
  })
})
