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
