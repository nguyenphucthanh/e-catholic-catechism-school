/// <reference types="vite/client" />
import { describe, expect, test } from 'vitest'
import { authedConvexTest } from '../test-utils/authedConvexTest'
import { api, internal } from './_generated/api'
import schema from './schema'
import { syncHasActiveClass } from './lib/enrollment'
import { nameSortKey } from './lib/name'
import type { AuthedConvexTest } from '../test-utils/authedConvexTest'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

async function seed(t: AuthedConvexTest, opts: { activeYear?: boolean } = {}) {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert('catechists', {
      memberId: 'GLV001',
      fullName: 'Admin',
      role: 'admin',
      isActive: true,
      isDeleted: false,
    })
    const insertYear = (name: string, isActive: boolean) =>
      ctx.db.insert('academicYears', {
        name,
        startDate: '2024-09-01',
        endDate: '2025-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive,
        isDeleted: false,
      })
    const yearId = await insertYear('2024-2025', opts.activeYear ?? true)
    const oldYearId = await insertYear('2023-2024', false)
    const branchId = await ctx.db.insert('branches', {
      name: 'Branch',
      sortOrder: 1,
      isDeleted: false,
    })
    const classId = await ctx.db.insert('classes', {
      branchId,
      name: 'Class',
      isDeleted: false,
    })
    const classYearId = await ctx.db.insert('classYears', {
      classId,
      academicYearId: yearId,
      isDeleted: false,
    })
    const oldClassYearId = await ctx.db.insert('classYears', {
      classId,
      academicYearId: oldYearId,
      isDeleted: false,
    })
    return { adminId, yearId, oldYearId, classYearId, oldClassYearId }
  })
}

const addStudent = (t: AuthedConvexTest, code: string, name = `S ${code}`) =>
  t.run((ctx) =>
    ctx.db.insert('students', {
      studentCode: code,
      fullName: name,
      nameSortKey: nameSortKey(name, undefined),
      isActive: true,
      createdAt: Date.now(),
      isDeleted: false,
    }),
  )

const enroll = (
  t: AuthedConvexTest,
  studentId: Id<'students'>,
  classYearId: Id<'classYears'>,
  extra: {
    status?: 'active' | 'on_leave' | 'withdrawn'
    isDeleted?: boolean
  } = {},
) =>
  t.run((ctx) =>
    ctx.db.insert('studentClasses', {
      studentId,
      classYearId,
      enrolledDate: '2024-09-01',
      isPrimaryClass: true,
      status: extra.status ?? 'active',
      isDeleted: extra.isDeleted ?? false,
    }),
  )

const flag = (t: AuthedConvexTest, id: Id<'students'>) =>
  t.run(async (ctx) => (await ctx.db.get('students', id))?.hasActiveClass)

const sync = (t: AuthedConvexTest, id: Id<'students'>, year?: any) =>
  t.run((ctx) => syncHasActiveClass(ctx, id, year))

describe('syncHasActiveClass', () => {
  test.each([
    ['active', true],
    ['on_leave', true],
    ['withdrawn', false],
  ] as const)('status %s in active year -> %s', async (status, expected) => {
    const t = authedConvexTest(schema, modules)
    const ids = await seed(t)
    const s = await addStudent(t, 'A')
    await enroll(t, s, ids.classYearId, { status })
    await sync(t, s)
    expect(await flag(t, s)).toBe(expected)
  })

  test('enrollment only in a non-active year -> false', async () => {
    const t = authedConvexTest(schema, modules)
    const ids = await seed(t)
    const s = await addStudent(t, 'A')
    await enroll(t, s, ids.oldClassYearId)
    await sync(t, s)
    expect(await flag(t, s)).toBe(false)
  })

  test('soft-deleted enrollment -> false', async () => {
    const t = authedConvexTest(schema, modules)
    const ids = await seed(t)
    const s = await addStudent(t, 'A')
    await enroll(t, s, ids.classYearId, { isDeleted: true })
    await sync(t, s)
    expect(await flag(t, s)).toBe(false)
  })

  test('soft-deleted classYear -> false', async () => {
    const t = authedConvexTest(schema, modules)
    const ids = await seed(t)
    const s = await addStudent(t, 'A')
    await enroll(t, s, ids.classYearId)
    await t.run((ctx) =>
      ctx.db.patch('classYears', ids.classYearId, { isDeleted: true }),
    )
    await sync(t, s)
    expect(await flag(t, s)).toBe(false)
  })

  test('no active academic year -> false even with enrollments', async () => {
    const t = authedConvexTest(schema, modules)
    const ids = await seed(t, { activeYear: false })
    const s = await addStudent(t, 'A')
    await enroll(t, s, ids.classYearId)
    await sync(t, s)
    expect(await flag(t, s)).toBe(false)
  })

  test('explicit activeYearId (and null) skips the year lookup', async () => {
    const t = authedConvexTest(schema, modules)
    const ids = await seed(t)
    const s = await addStudent(t, 'A')
    await enroll(t, s, ids.classYearId)
    await sync(t, s, null)
    expect(await flag(t, s)).toBe(false)
    await sync(t, s, ids.yearId)
    expect(await flag(t, s)).toBe(true)
  })

  test('does not throw for a missing student', async () => {
    const t = authedConvexTest(schema, modules)
    await seed(t)
    const s = await addStudent(t, 'A')
    await t.run((ctx) => ctx.db.delete('students', s))
    await sync(t, s)
    expect(await flag(t, s)).toBeNull()
  })
})

describe('backfillHasActiveClass', () => {
  test('recomputes the flag for every student', async () => {
    const t = authedConvexTest(schema, modules)
    const ids = await seed(t)
    const a = await addStudent(t, 'A')
    const b = await addStudent(t, 'B')
    const c = await addStudent(t, 'C')
    await enroll(t, a, ids.classYearId)
    await enroll(t, b, ids.oldClassYearId)
    // stale flag on c must be corrected
    await t.run((ctx) => ctx.db.patch('students', c, { hasActiveClass: true }))

    const res = await t.mutation(
      internal.studyingFlags.backfillHasActiveClass,
      {},
    )
    expect(res).toEqual({ processed: 3, isDone: true })
    expect(await flag(t, a)).toBe(true)
    expect(await flag(t, b)).toBe(false)
    expect(await flag(t, c)).toBe(false)
  })

  test('reschedules itself with the cursor when not done (batch of 100)', async () => {
    const t = authedConvexTest(schema, modules)
    await seed(t)
    await t.run(async (ctx) => {
      for (let i = 0; i < 101; i++) {
        await ctx.db.insert('students', {
          studentCode: `X${i}`,
          fullName: `X${i}`,
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
      }
    })
    const first = await t.mutation(
      internal.studyingFlags.backfillHasActiveClass,
      {},
    )
    expect(first).toEqual({ processed: 100, isDone: false })
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query('_scheduled_functions').collect(),
    )
    expect(scheduled).toHaveLength(1)
    expect(scheduled[0].args[0].cursor).toEqual(expect.any(String))
  })
})

describe('academicYears.setActive recompute', () => {
  test('switching the active year recomputes hasActiveClass', async () => {
    const t = authedConvexTest(schema, modules)
    const ids = await seed(t)
    const s = await addStudent(t, 'A')
    await enroll(t, s, ids.classYearId)
    await sync(t, s)
    expect(await flag(t, s)).toBe(true)

    await t.mutation(api.academicYears.setActive, {
      requesterId: ids.adminId,
      academicYearId: ids.oldYearId,
    })
    // run the scheduled backfill directly (deterministic, no timers)
    await t.mutation(internal.studyingFlags.backfillHasActiveClass, {})
    expect(await flag(t, s)).toBe(false)

    const scheduled = await t.run((ctx) =>
      ctx.db.system.query('_scheduled_functions').collect(),
    )
    expect(scheduled.length).toBeGreaterThanOrEqual(1)
  })
})

describe('enrollment mutations keep hasActiveClass in sync', () => {
  test('enrollStudents sets true; updateEnrollmentsStatus withdrawn -> false, active -> true', async () => {
    const t = authedConvexTest(schema, modules)
    const ids = await seed(t)
    const studentId = await t.mutation(internal.students.create, {
      passwordHash: 'h',
      requesterId: ids.adminId,
      fullName: 'Student A',
    })
    expect(await flag(t, studentId)).toBe(false)

    const [scId] = await t.mutation(api.students.enrollStudents, {
      requesterId: ids.adminId,
      studentIds: [studentId],
      classYearId: ids.classYearId,
      isPrimaryClass: true,
      enrolledDate: '2024-09-01',
    })
    expect(await flag(t, studentId)).toBe(true)

    await t.mutation(api.students.updateEnrollmentsStatus, {
      requesterId: ids.adminId,
      studentClassIds: [scId],
      status: 'withdrawn',
      statusChangedDate: '2024-10-01',
    } as any)
    expect(await flag(t, studentId)).toBe(false)

    await t.mutation(api.students.updateEnrollmentsStatus, {
      requesterId: ids.adminId,
      studentClassIds: [scId],
      status: 'on_leave',
      statusChangedDate: '2024-10-02',
    } as any)
    expect(await flag(t, studentId)).toBe(true)
  })
})

describe('students.list studyingStatus', () => {
  async function fixture() {
    const t = authedConvexTest(schema, modules)
    const ids = await seed(t)
    // Names/codes chosen so code order and name order differ.
    const a = await addStudent(t, '3', 'Alpha')
    const b = await addStudent(t, '1', 'Charlie')
    const c = await addStudent(t, '2', 'Bravo')
    const d = await addStudent(t, '4', 'Delta')
    await enroll(t, a, ids.classYearId)
    await enroll(t, c, ids.classYearId)
    await enroll(t, b, ids.oldClassYearId)
    for (const id of [a, b, c, d]) await sync(t, id)
    const list = async (args: Record<string, unknown>) =>
      (
        await t.query(api.students.list, {
          requesterId: ids.adminId,
          paginationOpts: { numItems: 10, cursor: null },
          ...args,
        } as any)
      ).page.map((s: any) => s.fullName)
    return { t, ids, list }
  }

  test.each([
    [undefined, ['Bravo', 'Alpha'], ['Delta', 'Charlie']],
    ['studentCode', ['Bravo', 'Alpha'], ['Charlie', 'Delta']],
    ['fullName', ['Alpha', 'Bravo'], ['Charlie', 'Delta']],
  ] as const)(
    'native index path, sortBy=%s',
    async (sortBy, studyingNames, notEnrolledNames) => {
      const { list } = await fixture()
      expect(await list({ studyingStatus: 'studying', sortBy })).toEqual(
        studyingNames,
      )
      expect(await list({ studyingStatus: 'notEnrolled', sortBy })).toEqual(
        notEnrolledNames,
      )
    },
  )

  test('no studyingStatus returns everyone', async () => {
    const { list } = await fixture()
    expect(await list({})).toHaveLength(4)
  })

  test('unset hasActiveClass counts as notEnrolled on the in-memory path', async () => {
    const { t, list } = await fixture()
    await addStudent(t, '9', 'Legacy')
    expect(
      await list({ name: 'legacy', studyingStatus: 'notEnrolled' }),
    ).toEqual(['Legacy'])
    expect(await list({ name: 'legacy', studyingStatus: 'studying' })).toEqual(
      [],
    )
  })

  test('name search falls back to in-memory filter and still honors studyingStatus', async () => {
    const { list } = await fixture()
    expect(await list({ name: 'alp', studyingStatus: 'studying' })).toEqual([
      'Alpha',
    ])
    expect(await list({ name: 'charlie', studyingStatus: 'studying' })).toEqual(
      [],
    )
    expect(
      await list({ name: 'charlie', studyingStatus: 'notEnrolled' }),
    ).toEqual(['Charlie'])
  })

  test('class filter path (in-memory) honors studyingStatus', async () => {
    const { ids, list } = await fixture()
    expect(
      await list({
        classYearId: ids.classYearId,
        academicYearId: ids.yearId,
        studyingStatus: 'notEnrolled',
      }),
    ).toEqual([])
    expect(
      await list({
        classYearId: ids.classYearId,
        academicYearId: ids.yearId,
        studyingStatus: 'studying',
      }),
    ).toHaveLength(2)
  })

  test('paginates within the filtered set', async () => {
    const { t, ids } = await fixture()
    const p1 = await t.query(api.students.list, {
      requesterId: ids.adminId,
      paginationOpts: { numItems: 1, cursor: null },
      studyingStatus: 'notEnrolled',
      sortBy: 'studentCode',
    } as any)
    expect(p1.page.map((s: any) => s.fullName)).toEqual(['Charlie'])
    expect(p1.isDone).toBe(false)
    const p2 = await t.query(api.students.list, {
      requesterId: ids.adminId,
      paginationOpts: { numItems: 1, cursor: p1.continueCursor },
      studyingStatus: 'notEnrolled',
      sortBy: 'studentCode',
    } as any)
    expect(p2.page.map((s: any) => s.fullName)).toEqual(['Delta'])
  })

  test('exportList honors studyingStatus', async () => {
    const { t, ids } = await fixture()
    const rows: Array<any> = await t.query(api.students.exportList, {
      requesterId: ids.adminId,
      studyingStatus: 'studying',
    } as any)
    expect(rows.map((r) => r.fullName).sort()).toEqual(['Alpha', 'Bravo'])
  })
})
