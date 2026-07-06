/// <reference types="vite/client" />

/* eslint-disable no-shadow */

import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
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
  isDeleted = false,
): Promise<Id<'branches'>> {
  return ctx.db.insert('branches', {
    name,
    sortOrder,
    isDeleted,
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
): Promise<Id<'classYears'>> {
  return ctx.db.insert('classYears', {
    classId,
    academicYearId,
    isDeleted: false,
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
): Promise<Id<'studentClasses'>> {
  return ctx.db.insert('studentClasses', {
    studentId,
    classYearId,
    isPrimaryClass: true,
    enrolledDate: '2024-09-05',
    status: 'active',
    isDeleted: false,
  })
}

function seedClassCatechist(
  ctx: any,
  catechistId: Id<'catechists'>,
  classYearId: Id<'classYears'>,
  academicYearId: Id<'academicYears'>,
): Promise<Id<'classCatechists'>> {
  return ctx.db.insert('classCatechists', {
    catechistId,
    classYearId,
    academicYearId,
    role: 'homeroom',
    isDeleted: false,
  })
}

// ─── getBranchStats ─────────────────────────────────────────────────────────

describe('getBranchStats', () => {
  test('admin sees per-branch stats across all branches', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, branch1, branch2 } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      const branch1 = await seedBranch(ctx, 'Ấu Nhi', 1)
      const branch2 = await seedBranch(ctx, 'Thiếu Nhi', 2)

      const class1 = await seedClass(ctx, branch1, 'Lớp 1A')
      const class2 = await seedClass(ctx, branch1, 'Lớp 1B')
      const class3 = await seedClass(ctx, branch2, 'Lớp 2A')

      const cy1 = await seedClassYear(ctx, class1, yearId)
      const cy2 = await seedClassYear(ctx, class2, yearId)
      const cy3 = await seedClassYear(ctx, class3, yearId)

      const s1 = await seedStudent(ctx, 'HS001', 'Student One')
      const s2 = await seedStudent(ctx, 'HS002', 'Student Two')
      const s3 = await seedStudent(ctx, 'HS003', 'Student Three')

      // s1 enrolled in two classes of the same branch -> counted once
      await seedStudentClass(ctx, s1, cy1)
      await seedStudentClass(ctx, s1, cy2)
      await seedStudentClass(ctx, s2, cy2)
      await seedStudentClass(ctx, s3, cy3)

      const c1 = await seedCatechist(ctx, 'GLV01', 'Catechist One')
      const c2 = await seedCatechist(ctx, 'GLV02', 'Catechist Two')

      await seedClassCatechist(ctx, c1, cy1, yearId)
      await seedClassCatechist(ctx, c1, cy2, yearId)
      await seedClassCatechist(ctx, c2, cy3, yearId)

      return { adminId, yearId, branch1, branch2 }
    })

    const result = await t.query(api.branchStats.getBranchStats, {
      requesterId: adminId,
      academicYearId: yearId,
    })

    expect(result).toHaveLength(2)

    const b1 = result.find((r) => r.branchId === branch1)
    const b2 = result.find((r) => r.branchId === branch2)

    expect(b1).toMatchObject({
      branchName: 'Ấu Nhi',
      classCount: 2,
      studentCount: 2,
      catechistCount: 1,
    })
    expect(b2).toMatchObject({
      branchName: 'Thiếu Nhi',
      classCount: 1,
      studentCount: 1,
      catechistCount: 1,
    })
  })

  test('branch head only sees stats for their own branch', async () => {
    const t = convexTest(schema, modules)

    const { branchHeadId, yearId, branch1 } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const branch1 = await seedBranch(ctx, 'Ấu Nhi', 1)
      const branch2 = await seedBranch(ctx, 'Thiếu Nhi', 2)

      const class1 = await seedClass(ctx, branch1, 'Lớp 1A')
      const class2 = await seedClass(ctx, branch2, 'Lớp 2A')
      const cy1 = await seedClassYear(ctx, class1, yearId)
      await seedClassYear(ctx, class2, yearId)

      const s1 = await seedStudent(ctx, 'HS001', 'Student One')
      await seedStudentClass(ctx, s1, cy1)

      const branchHeadId = await seedCatechist(ctx, 'GLV01', 'Branch Head')
      await ctx.db.insert('branchAssignments', {
        academicYearId: yearId,
        catechistId: branchHeadId,
        branchId: branch1,
        isDeleted: false,
      })

      return { branchHeadId, yearId, branch1 }
    })

    const result = await t.query(api.branchStats.getBranchStats, {
      requesterId: branchHeadId,
      academicYearId: yearId,
    })

    expect(result).toHaveLength(1)
    expect(result[0].branchId).toBe(branch1)
    expect(result[0].studentCount).toBe(1)
    expect(result[0].classCount).toBe(1)
  })

  test('returns empty array for a requester with no access', async () => {
    const t = convexTest(schema, modules)

    const { catechistId, yearId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx, 'GLV02', 'Plain Catechist')
      const yearId = await seedActiveYear(ctx)
      return { catechistId, yearId }
    })

    const result = await t.query(api.branchStats.getBranchStats, {
      requesterId: catechistId,
      academicYearId: yearId,
    })

    expect(result).toEqual([])
  })

  test('returns zeroed stats for a branch with no classes this year', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, branchId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      const branchId = await seedBranch(ctx, 'Ấu Nhi', 1)
      return { adminId, yearId, branchId }
    })

    const result = await t.query(api.branchStats.getBranchStats, {
      requesterId: adminId,
      academicYearId: yearId,
    })

    expect(result).toEqual([
      {
        branchId,
        branchName: 'Ấu Nhi',
        classCount: 0,
        studentCount: 0,
        catechistCount: 0,
      },
    ])
  })

  test('excludes soft-deleted branches from the admin view', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      await seedBranch(ctx, 'Deleted Branch', 99, true)
      return { adminId, yearId }
    })

    const result = await t.query(api.branchStats.getBranchStats, {
      requesterId: adminId,
      academicYearId: yearId,
    })

    expect(result).toEqual([])
  })
})
