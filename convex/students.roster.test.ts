/// <reference types="vite/client" />

import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

function seedCatechist(ctx: any): Promise<Id<'catechists'>> {
  return ctx.db.insert('catechists', {
    memberId: 'GLV001',
    fullName: 'Admin',
    role: 'admin',
    isActive: true,
    isDeleted: false,
  })
}

function seedAcademicYear(ctx: any): Promise<Id<'academicYears'>> {
  return ctx.db.insert('academicYears', {
    name: '2024-2025',
    startDate: '2024-09-01',
    endDate: '2025-05-31',
    timezone: 'Asia/Ho_Chi_Minh',
    isActive: true,
    isDeleted: false,
  })
}

function seedBranch(ctx: any): Promise<Id<'branches'>> {
  return ctx.db.insert('branches', {
    name: 'Branch A',
    sortOrder: 1,
    isDeleted: false,
  })
}

function seedClass(ctx: any, branchId: Id<'branches'>): Promise<Id<'classes'>> {
  return ctx.db.insert('classes', {
    branchId,
    name: 'Class A',
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
  fullName: string,
  opts: { isDeleted?: boolean } = {},
): Promise<Id<'students'>> {
  return ctx.db.insert('students', {
    studentCode: `STU-${fullName}`,
    fullName,
    isActive: true,
    createdAt: Date.now(),
    isDeleted: opts.isDeleted ?? false,
  })
}

function seedEnrollment(
  ctx: any,
  studentId: Id<'students'>,
  classYearId: Id<'classYears'>,
  opts: {
    status?: 'active' | 'on_leave' | 'withdrawn'
    isPrimaryClass?: boolean
    isDeleted?: boolean
  } = {},
) {
  return ctx.db.insert('studentClasses', {
    studentId,
    classYearId,
    isPrimaryClass: opts.isPrimaryClass ?? true,
    enrolledDate: '2024-09-01',
    status: opts.status ?? 'active',
    isDeleted: opts.isDeleted ?? false,
  })
}

describe('listActiveRosterByClassYear', () => {
  test('returns only active, primary, non-deleted enrollments joined to their student', async () => {
    const t = convexTest(schema, modules)

    const { requesterId, classYearId } = await t.run(async (ctx) => {
      const seededRequesterId = await seedCatechist(ctx)
      const academicYearId = await seedAcademicYear(ctx)
      const branchId = await seedBranch(ctx)
      const classId = await seedClass(ctx, branchId)
      const seededClassYearId = await seedClassYear(
        ctx,
        classId,
        academicYearId,
      )

      const active1 = await seedStudent(ctx, 'Active One')
      await seedEnrollment(ctx, active1, seededClassYearId)

      return { requesterId: seededRequesterId, classYearId: seededClassYearId }
    })

    const roster = await t.query(api.students.listActiveRosterByClassYear, {
      requesterId,
      classYearId,
    })

    expect(roster).toHaveLength(1)
    expect(roster[0]).toMatchObject({
      fullName: 'Active One',
      studentCode: 'STU-Active One',
    })
  })

  test('excludes withdrawn, on_leave, non-primary, and soft-deleted enrollments', async () => {
    const t = convexTest(schema, modules)

    const { requesterId, classYearId } = await t.run(async (ctx) => {
      const seededRequesterId = await seedCatechist(ctx)
      const academicYearId = await seedAcademicYear(ctx)
      const branchId = await seedBranch(ctx)
      const classId = await seedClass(ctx, branchId)
      const seededClassYearId = await seedClassYear(
        ctx,
        classId,
        academicYearId,
      )

      const active = await seedStudent(ctx, 'Active Primary')
      await seedEnrollment(ctx, active, seededClassYearId)

      const withdrawn = await seedStudent(ctx, 'Withdrawn')
      await seedEnrollment(ctx, withdrawn, seededClassYearId, {
        status: 'withdrawn',
      })

      const onLeave = await seedStudent(ctx, 'On Leave')
      await seedEnrollment(ctx, onLeave, seededClassYearId, {
        status: 'on_leave',
      })

      const nonPrimary = await seedStudent(ctx, 'Non Primary')
      await seedEnrollment(ctx, nonPrimary, seededClassYearId, {
        isPrimaryClass: false,
      })

      const deletedEnrollment = await seedStudent(ctx, 'Deleted Enrollment')
      await seedEnrollment(ctx, deletedEnrollment, seededClassYearId, {
        isDeleted: true,
      })

      return { requesterId: seededRequesterId, classYearId: seededClassYearId }
    })

    const roster = await t.query(api.students.listActiveRosterByClassYear, {
      requesterId,
      classYearId,
    })

    expect(roster).toHaveLength(1)
    expect(roster[0].fullName).toBe('Active Primary')
  })

  test('excludes soft-deleted students even if their enrollment is active/primary', async () => {
    const t = convexTest(schema, modules)

    const { requesterId, classYearId } = await t.run(async (ctx) => {
      const seededRequesterId = await seedCatechist(ctx)
      const academicYearId = await seedAcademicYear(ctx)
      const branchId = await seedBranch(ctx)
      const classId = await seedClass(ctx, branchId)
      const seededClassYearId = await seedClassYear(
        ctx,
        classId,
        academicYearId,
      )

      const deletedStudent = await seedStudent(ctx, 'Deleted Student', {
        isDeleted: true,
      })
      await seedEnrollment(ctx, deletedStudent, seededClassYearId)

      return { requesterId: seededRequesterId, classYearId: seededClassYearId }
    })

    const roster = await t.query(api.students.listActiveRosterByClassYear, {
      requesterId,
      classYearId,
    })

    expect(roster).toHaveLength(0)
  })

  test('returns an empty array for a class year with no enrollments', async () => {
    const t = convexTest(schema, modules)

    const { requesterId, classYearId } = await t.run(async (ctx) => {
      const seededRequesterId = await seedCatechist(ctx)
      const academicYearId = await seedAcademicYear(ctx)
      const branchId = await seedBranch(ctx)
      const classId = await seedClass(ctx, branchId)
      const seededClassYearId = await seedClassYear(
        ctx,
        classId,
        academicYearId,
      )
      return { requesterId: seededRequesterId, classYearId: seededClassYearId }
    })

    const roster = await t.query(api.students.listActiveRosterByClassYear, {
      requesterId,
      classYearId,
    })

    expect(roster).toEqual([])
  })
})
