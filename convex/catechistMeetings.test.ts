/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { AUTHZ_ERRORS, CATECHIST_MEETING_ERRORS } from './lib/errors'

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
