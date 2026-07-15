/// <reference types="vite/client" />

/* eslint-disable no-shadow */

import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { ACADEMIC_YEAR_ERRORS, AUTHZ_ERRORS } from './lib/errors'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

// ─── Shared seed helpers ──────────────────────────────────────────────────

function seedAdmin(ctx: any): Promise<Id<'catechists'>> {
  return ctx.db.insert('catechists', {
    memberId: 'ADMIN',
    fullName: 'Admin User',
    role: 'admin',
    isActive: true,
    isDeleted: false,
  })
}

function seedCatechist(
  ctx: any,
  memberId: string,
  fullName: string,
): Promise<Id<'catechists'>> {
  return ctx.db.insert('catechists', {
    memberId,
    fullName,
    role: 'user',
    isActive: true,
    isDeleted: false,
  })
}

function seedActiveYear(
  ctx: any,
  name = '2024-2025',
): Promise<Id<'academicYears'>> {
  return ctx.db.insert('academicYears', {
    name,
    startDate: '2024-09-01',
    endDate: '2025-05-31',
    timezone: 'Asia/Ho_Chi_Minh',
    isActive: true,
    isDeleted: false,
  })
}

function seedBranch(
  ctx: any,
  name: string,
  sortOrder: number,
): Promise<Id<'branches'>> {
  return ctx.db.insert('branches', {
    name,
    sortOrder,
    isDeleted: false,
  })
}

function seedClass(
  ctx: any,
  branchId: Id<'branches'>,
  name: string,
): Promise<Id<'classes'>> {
  return ctx.db.insert('classes', {
    branchId,
    name,
    isDeleted: false,
  })
}

function seedClassYear(
  ctx: any,
  classId: Id<'classes'>,
  academicYearId: Id<'academicYears'>,
  isDeleted = false,
): Promise<Id<'classYears'>> {
  return ctx.db.insert('classYears', {
    classId,
    academicYearId,
    isDeleted,
  })
}

function seedStudent(
  ctx: any,
  studentCode: string,
  fullName: string,
): Promise<Id<'students'>> {
  return ctx.db.insert('students', {
    studentCode,
    fullName,
    isActive: true,
    createdAt: Date.now(),
    isDeleted: false,
  })
}

function seedStudentClass(
  ctx: any,
  studentId: Id<'students'>,
  classYearId: Id<'classYears'>,
  isDeleted = false,
): Promise<Id<'studentClasses'>> {
  return ctx.db.insert('studentClasses', {
    studentId,
    classYearId,
    isPrimaryClass: true,
    enrolledDate: '2024-09-05',
    status: 'active',
    isDeleted,
  })
}

function seedClassCatechist(
  ctx: any,
  catechistId: Id<'catechists'>,
  classYearId: Id<'classYears'>,
  academicYearId: Id<'academicYears'>,
  isDeleted = false,
): Promise<Id<'classCatechists'>> {
  return ctx.db.insert('classCatechists', {
    catechistId,
    classYearId,
    academicYearId,
    role: 'homeroom',
    isDeleted,
  })
}

// ─── getOrgStats ────────────────────────────────────────────────────────────

describe('getOrgStats', () => {
  test('aggregates classes, deduped students, and deduped catechists', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      const branch1 = await seedBranch(ctx, 'Ấu Nhi', 1)
      const branch2 = await seedBranch(ctx, 'Thiếu Nhi', 2)

      const class1 = await seedClass(ctx, branch1, 'Lớp 1A')
      const class2 = await seedClass(ctx, branch2, 'Lớp 2A')
      const cy1 = await seedClassYear(ctx, class1, yearId)
      const cy2 = await seedClassYear(ctx, class2, yearId)

      const s1 = await seedStudent(ctx, 'HS001', 'Student One')
      const s2 = await seedStudent(ctx, 'HS002', 'Student Two')
      const s3 = await seedStudent(ctx, 'HS003', 'Student Three')

      // s1 enrolled in two classes -> should only count once
      await seedStudentClass(ctx, s1, cy1)
      await seedStudentClass(ctx, s1, cy2)
      await seedStudentClass(ctx, s2, cy1)
      await seedStudentClass(ctx, s3, cy2)

      const c1 = await seedCatechist(ctx, 'GLV01', 'Catechist One')
      const c2 = await seedCatechist(ctx, 'GLV02', 'Catechist Two')

      // c1 assigned to two classes -> should only count once
      await seedClassCatechist(ctx, c1, cy1, yearId)
      await seedClassCatechist(ctx, c1, cy2, yearId)
      await seedClassCatechist(ctx, c2, cy1, yearId)

      return { adminId, yearId }
    })

    const result = await t.query(api.orgStats.getOrgStats, {
      requesterId: adminId,
      academicYearId: yearId,
    })

    expect(result.totalClasses).toBe(2)
    expect(result.totalStudents).toBe(3)
    expect(result.totalCatechists).toBe(2)
  })

  test('returns zeros when the academic year has no classes', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      return { adminId, yearId }
    })

    const result = await t.query(api.orgStats.getOrgStats, {
      requesterId: adminId,
      academicYearId: yearId,
    })

    expect(result).toEqual({
      totalClasses: 0,
      totalStudents: 0,
      totalCatechists: 0,
    })
  })

  test('excludes soft-deleted classYears, studentClasses, and classCatechists', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      const branch = await seedBranch(ctx, 'Ấu Nhi', 1)

      const liveClass = await seedClass(ctx, branch, 'Live Class')
      const liveCy = await seedClassYear(ctx, liveClass, yearId)

      const deletedClass = await seedClass(ctx, branch, 'Deleted Class Year')
      await seedClassYear(ctx, deletedClass, yearId, true)

      const s1 = await seedStudent(ctx, 'HS010', 'Live Student')
      await seedStudentClass(ctx, s1, liveCy)

      const s2 = await seedStudent(ctx, 'HS011', 'Deleted Enrollment Student')
      await seedStudentClass(ctx, s2, liveCy, true)

      const c1 = await seedCatechist(ctx, 'GLV10', 'Live Catechist')
      await seedClassCatechist(ctx, c1, liveCy, yearId)

      const c2 = await seedCatechist(ctx, 'GLV11', 'Deleted Assignment')
      await seedClassCatechist(ctx, c2, liveCy, yearId, true)

      return { adminId, yearId }
    })

    const result = await t.query(api.orgStats.getOrgStats, {
      requesterId: adminId,
      academicYearId: yearId,
    })

    expect(result.totalClasses).toBe(1)
    expect(result.totalStudents).toBe(1)
    expect(result.totalCatechists).toBe(1)
  })

  test('rejects a requester who is not admin or board member', async () => {
    const t = convexTest(schema, modules)

    const { catechistId, yearId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx, 'GLV20', 'Plain Catechist')
      const yearId = await seedActiveYear(ctx)
      return { catechistId, yearId }
    })

    await expect(
      t.query(api.orgStats.getOrgStats, {
        requesterId: catechistId,
        academicYearId: yearId,
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.NOT_BOARD_MEMBER)
  })

  test('allows a board member for the academic year', async () => {
    const t = convexTest(schema, modules)

    const { boardMemberId, yearId } = await t.run(async (ctx) => {
      const boardMemberId = await seedCatechist(ctx, 'GLV21', 'Board Member')
      const yearId = await seedActiveYear(ctx)
      await ctx.db.insert('academicYearAssignments', {
        academicYearId: yearId,
        catechistId: boardMemberId,
        assignmentType: 'board_member',
        isDeleted: false,
      })
      return { boardMemberId, yearId }
    })

    const result = await t.query(api.orgStats.getOrgStats, {
      requesterId: boardMemberId,
      academicYearId: yearId,
    })

    expect(result).toEqual({
      totalClasses: 0,
      totalStudents: 0,
      totalCatechists: 0,
    })
  })

  test('throws when the academic year does not exist or is soft-deleted', async () => {
    const t = convexTest(schema, modules)

    const { adminId, deletedYearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const deletedYearId = await ctx.db.insert('academicYears', {
        name: 'Deleted Year',
        startDate: '2022-09-01',
        endDate: '2023-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: false,
        isDeleted: true,
      })
      return { adminId, deletedYearId }
    })

    await expect(
      t.query(api.orgStats.getOrgStats, {
        requesterId: adminId,
        academicYearId: deletedYearId,
      }),
    ).rejects.toThrow(ACADEMIC_YEAR_ERRORS.NOT_FOUND)
  })
})
