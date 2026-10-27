/// <reference types="vite/client" />

import { describe, expect, test } from 'vitest'
import { authedConvexTest } from '../test-utils/authedConvexTest'
import { api } from './_generated/api'
import schema from './schema'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

function seedCatechist(
  ctx: any,
  opts: { isActive?: boolean } = {},
): Promise<Id<'catechists'>> {
  return ctx.db.insert('catechists', {
    memberId: 'GLV001',
    fullName: 'Admin',
    role: 'admin',
    isActive: opts.isActive ?? true,
    isDeleted: false,
  })
}

function seedYear(
  ctx: any,
  isActive: boolean,
  name = '2024-2025',
): Promise<Id<'academicYears'>> {
  return ctx.db.insert('academicYears', {
    name,
    startDate: '2024-09-01',
    endDate: '2025-05-31',
    timezone: 'Asia/Ho_Chi_Minh',
    isActive,
    isDeleted: false,
  })
}

async function seedClassYear(
  ctx: any,
  academicYearId: Id<'academicYears'>,
  name: string,
  isDeleted = false,
): Promise<Id<'classYears'>> {
  const branchId = await ctx.db.insert('branches', {
    name: `Branch ${name}`,
    sortOrder: 1,
    isDeleted: false,
  })
  const classId = await ctx.db.insert('classes', {
    branchId,
    name,
    isDeleted: false,
  })
  return ctx.db.insert('classYears', { classId, academicYearId, isDeleted })
}

function seedStudent(
  ctx: any,
  fullName: string,
  opts: { isDeleted?: boolean; photo?: Id<'_storage'> } = {},
): Promise<Id<'students'>> {
  return ctx.db.insert('students', {
    studentCode: `C-${fullName}`,
    fullName,
    isActive: true,
    createdAt: Date.now(),
    isDeleted: opts.isDeleted ?? false,
    ...(opts.photo ? { profilePhotoStorageId: opts.photo } : {}),
  })
}

function enroll(
  ctx: any,
  studentId: Id<'students'>,
  classYearId: Id<'classYears'>,
  opts: {
    status?: 'active' | 'on_leave' | 'withdrawn'
    isDeleted?: boolean
  } = {},
) {
  return ctx.db.insert('studentClasses', {
    studentId,
    classYearId,
    isPrimaryClass: true,
    enrolledDate: '2024-09-01',
    status: opts.status ?? 'active',
    isDeleted: opts.isDeleted ?? false,
  })
}

describe('listForQrCards', () => {
  test('returns [] when there is no active academic year', async () => {
    const t = authedConvexTest(schema, modules)
    const requesterId = await t.run(async (ctx) => {
      const id = await seedCatechist(ctx)
      const year = await seedYear(ctx, false)
      const cy = await seedClassYear(ctx, year, 'A')
      await enroll(ctx, await seedStudent(ctx, 'Student'), cy)
      return id
    })

    expect(await t.query(api.students.listForQrCards, { requesterId })).toEqual(
      [],
    )
  })

  test('includes only active enrollments of live students in the active year, deduped', async () => {
    const t = authedConvexTest(schema, modules)
    const requesterId = await t.run(async (ctx) => {
      const id = await seedCatechist(ctx)
      const year = await seedYear(ctx, true)
      const otherYear = await seedYear(ctx, false, '2023-2024')
      const cy1 = await seedClassYear(ctx, year, 'A')
      const cy2 = await seedClassYear(ctx, year, 'B')
      const deletedCy = await seedClassYear(ctx, year, 'C', true)
      const otherCy = await seedClassYear(ctx, otherYear, 'D')

      const both = await seedStudent(ctx, 'Both Classes')
      await enroll(ctx, both, cy1)
      await enroll(ctx, both, cy2)

      await enroll(ctx, await seedStudent(ctx, 'Withdrawn'), cy1, {
        status: 'withdrawn',
      })
      await enroll(ctx, await seedStudent(ctx, 'On Leave'), cy1, {
        status: 'on_leave',
      })
      await enroll(ctx, await seedStudent(ctx, 'Deleted Enrollment'), cy1, {
        isDeleted: true,
      })
      await enroll(
        ctx,
        await seedStudent(ctx, 'Deleted Student', { isDeleted: true }),
        cy1,
      )
      await enroll(ctx, await seedStudent(ctx, 'Other Year'), otherCy)
      await enroll(ctx, await seedStudent(ctx, 'Deleted ClassYear'), deletedCy)
      return id
    })

    const result = await t.query(api.students.listForQrCards, { requesterId })

    expect(result.map((r) => r.fullName)).toEqual(['Both Classes'])
  })

  test('photoUrl is a string when a photo is stored, otherwise null', async () => {
    const t = authedConvexTest(schema, modules)
    const requesterId = await t.run(async (ctx) => {
      const id = await seedCatechist(ctx)
      const year = await seedYear(ctx, true)
      const cy = await seedClassYear(ctx, year, 'A')
      const photo = await ctx.storage.store(new Blob(['img']))
      await enroll(ctx, await seedStudent(ctx, 'With Photo', { photo }), cy)
      await enroll(ctx, await seedStudent(ctx, 'No Photo'), cy)
      return id
    })

    const result = await t.query(api.students.listForQrCards, { requesterId })
    const byName = Object.fromEntries(result.map((r) => [r.fullName, r]))

    expect(typeof byName['With Photo'].photoUrl).toBe('string')
    expect(byName['No Photo'].photoUrl).toBeNull()
  })

  test.each([
    [
      'lastName_firstName',
      ['Nguyễn Văn An', 'Trần Thị Bình', 'Lê Hoàng Cường'],
    ],
    [
      'firstName_lastName',
      ['Lê Hoàng Cường', 'Nguyễn Văn An', 'Trần Thị Bình'],
    ],
  ] as const)(
    'sorts by appConfig.nameFormat %s',
    async (nameFormat, expected) => {
      const t = authedConvexTest(schema, modules)
      const requesterId = await t.run(async (ctx) => {
        const id = await seedCatechist(ctx)
        await ctx.db.insert('appConfig', {
          parishName: 'P',
          dioceseName: 'D',
          nameFormat,
        })
        const year = await seedYear(ctx, true)
        const cy = await seedClassYear(ctx, year, 'A')
        for (const name of [
          'Trần Thị Bình',
          'Lê Hoàng Cường',
          'Nguyễn Văn An',
        ]) {
          await enroll(ctx, await seedStudent(ctx, name), cy)
        }
        return id
      })

      const result = await t.query(api.students.listForQrCards, { requesterId })

      expect(result.map((r) => r.fullName)).toEqual(expected)
    },
  )

  test('rejects when the requester is not a valid catechist', async () => {
    const t = authedConvexTest(schema, modules)
    const requesterId = await t.run((ctx) =>
      seedCatechist(ctx, { isActive: false }),
    )

    await expect(
      t.query(api.students.listForQrCards, { requesterId }),
    ).rejects.toThrow('ACCOUNT_INACTIVE')
  })
})
