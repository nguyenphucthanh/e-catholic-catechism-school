/// <reference types="vite/client" />

/* eslint-disable no-shadow */

import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from '../_generated/api'
import schema from '../schema'
import type { Id } from '../_generated/dataModel'

const modules = import.meta.glob('../**/*.ts')

function seedActiveYear(ctx: any): Promise<Id<'academicYears'>> {
  return ctx.db.insert('academicYears', {
    name: '2024-2025',
    startDate: '2024-09-01',
    endDate: '2025-05-31',
    timezone: 'Asia/Ho_Chi_Minh',
    isActive: true,
    isDeleted: false,
  })
}

function seedCatechist(ctx: any, memberId: string): Promise<Id<'catechists'>> {
  return ctx.db.insert('catechists', {
    memberId,
    fullName: memberId,
    role: 'user',
    isActive: true,
    isDeleted: false,
  })
}

function seedProgram(
  ctx: any,
  academicYearId: Id<'academicYears'>,
  createdBy: Id<'catechists'>,
  branches: Array<Id<'branches'>> = [],
): Promise<Id<'extracurricularPrograms'>> {
  return ctx.db.insert('extracurricularPrograms', {
    academicYearId,
    title: 'Camp',
    details: '{}',
    target: 'all',
    branches,
    dateStart: '2099-01-01',
    dateEnd: '2099-02-01',
    enrollmentExpireDate: '2099-01-15',
    feeRequired: false,
    createdBy,
    createdAt: Date.now(),
    isDeleted: false,
  })
}

function seedAdmin(ctx: any): Promise<Id<'catechists'>> {
  return ctx.db.insert('catechists', {
    memberId: 'ADMIN',
    fullName: 'Admin',
    role: 'admin',
    isActive: true,
    isDeleted: false,
  })
}

describe('extracurricularPrograms — listEligiblePrograms', () => {
  test('returns [] when there is no active academic year', async () => {
    const t = convexTest(schema, modules)
    const studentId = await t.run(async (ctx) => {
      return ctx.db.insert('students', {
        studentCode: 'STD-500',
        fullName: 'STD-500',
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
    })

    const result = await t.query(
      api.extracurricularPrograms.listEligiblePrograms,
      { studentRequesterId: studentId },
    )
    expect(result).toEqual([])
  })

  test('returns branch-eligible student/all programs and marks enrollment status', async () => {
    const t = convexTest(schema, modules)
    const { studentId, eligibleId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      const branchA = await ctx.db.insert('branches', {
        name: 'A',
        sortOrder: 1,
        isDeleted: false,
      })
      const branchB = await ctx.db.insert('branches', {
        name: 'B',
        sortOrder: 2,
        isDeleted: false,
      })
      const classId = await ctx.db.insert('classes', {
        branchId: branchA,
        name: 'Class A',
        isDeleted: false,
      })
      const classYearId = await ctx.db.insert('classYears', {
        classId,
        academicYearId: yearId,
        isDeleted: false,
      })
      const studentId = await ctx.db.insert('students', {
        studentCode: 'STD-600',
        fullName: 'STD-600',
        tokenIdentifier: 'token-std-600',
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
      await ctx.db.insert('studentClasses', {
        studentId,
        classYearId,
        isPrimaryClass: true,
        enrolledDate: '2024-09-01',
        status: 'active',
        isDeleted: false,
      })

      // Eligible: target student, scoped to branchA
      const eligibleId = await ctx.db.insert('extracurricularPrograms', {
        academicYearId: yearId,
        title: 'Eligible',
        details: '{}',
        target: 'student',
        branches: [branchA],
        dateStart: '2099-01-01',
        dateEnd: '2099-02-01',
        enrollmentExpireDate: '2099-01-15',
        feeRequired: false,
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
      })
      // Not eligible: catechist-only target
      await ctx.db.insert('extracurricularPrograms', {
        academicYearId: yearId,
        title: 'Catechist Only',
        details: '{}',
        target: 'catechist',
        branches: [],
        dateStart: '2099-01-01',
        dateEnd: '2099-02-01',
        enrollmentExpireDate: '2099-01-15',
        feeRequired: false,
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
      })
      // Not eligible: scoped to a different branch only
      await ctx.db.insert('extracurricularPrograms', {
        academicYearId: yearId,
        title: 'Other Branch',
        details: '{}',
        target: 'all',
        branches: [branchB],
        dateStart: '2099-01-01',
        dateEnd: '2099-02-01',
        enrollmentExpireDate: '2099-01-15',
        feeRequired: false,
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
      })

      return { studentId, eligibleId }
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'token-std-600' })
      .query(api.extracurricularPrograms.listEligiblePrograms, {
        studentRequesterId: studentId,
      })

    expect(result.length).toBe(1)
    expect(result[0]._id).toBe(eligibleId)
    expect(result[0].userEnrolled).toBe(false)
  })

  test('returns all target programs when student has no primary class', async () => {
    const t = convexTest(schema, modules)
    const studentId = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      const branchA = await ctx.db.insert('branches', {
        name: 'A',
        sortOrder: 1,
        isDeleted: false,
      })
      const studentId = await ctx.db.insert('students', {
        studentCode: 'STD-700',
        fullName: 'STD-700',
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
      await ctx.db.insert('extracurricularPrograms', {
        academicYearId: yearId,
        title: 'Branch Scoped',
        details: '{}',
        target: 'student',
        branches: [branchA],
        dateStart: '2099-01-01',
        dateEnd: '2099-02-01',
        enrollmentExpireDate: '2099-01-15',
        feeRequired: false,
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
      })
      return studentId
    })

    const result = await t.query(
      api.extracurricularPrograms.listEligiblePrograms,
      { studentRequesterId: studentId },
    )
    // No primary class means branch filtering is skipped entirely.
    expect(result.length).toBe(1)
  })
})

describe('extracurricularPrograms — enrollProgram error branches', () => {
  test('throws NOT_FOUND for missing or deleted program', async () => {
    const t = convexTest(schema, modules)
    const { catechistId, programId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const catechistId = await seedCatechist(ctx, 'GLV-EF1')
      const programId = await seedProgram(ctx, yearId, catechistId)
      await ctx.db.patch('extracurricularPrograms', programId, {
        isDeleted: true,
      })
      return { catechistId, programId }
    })

    await expect(
      t.mutation(api.extracurricularPrograms.enrollProgram, {
        programId,
        requesterId: catechistId,
      }),
    ).rejects.toThrow()
  })

  test('throws INACTIVE_ACADEMIC_YEAR when program year is not active', async () => {
    const t = convexTest(schema, modules)
    const { catechistId, programId } = await t.run(async (ctx) => {
      const yearId = await ctx.db.insert('academicYears', {
        name: 'Inactive Year',
        startDate: '2024-09-01',
        endDate: '2025-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: false,
        isDeleted: false,
      })
      const catechistId = await seedCatechist(ctx, 'GLV-EF2')
      const programId = await seedProgram(ctx, yearId, catechistId)
      return { catechistId, programId }
    })

    await expect(
      t.mutation(api.extracurricularPrograms.enrollProgram, {
        programId,
        requesterId: catechistId,
      }),
    ).rejects.toThrow()
  })

  test('throws INVALID_ENROLLMENT_DATE after the enrollment window closes', async () => {
    const t = convexTest(schema, modules)
    const { catechistId, programId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const catechistId = await seedCatechist(ctx, 'GLV-EF3')
      const programId = await ctx.db.insert('extracurricularPrograms', {
        academicYearId: yearId,
        title: 'Expired',
        details: '{}',
        target: 'all',
        branches: [],
        dateStart: '2000-01-01',
        dateEnd: '2000-02-01',
        enrollmentExpireDate: '2000-01-15',
        feeRequired: false,
        createdBy: catechistId,
        createdAt: Date.now(),
        isDeleted: false,
      })
      return { catechistId, programId }
    })

    await expect(
      t.mutation(api.extracurricularPrograms.enrollProgram, {
        programId,
        requesterId: catechistId,
      }),
    ).rejects.toThrow()
  })

  test('throws IDENTITY_NOT_FOUND when no requester or identity resolves to a known user', async () => {
    const t = convexTest(schema, modules)
    const { programId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      const programId = await seedProgram(ctx, yearId, adminId)
      return { programId }
    })

    await expect(
      t
        .withIdentity({ tokenIdentifier: 'unknown-token' })
        .mutation(api.extracurricularPrograms.enrollProgram, { programId }),
    ).rejects.toThrow()
  })

  test('throws TARGET_NOT_ELIGIBLE when catechist tries to enroll in student-only program', async () => {
    const t = convexTest(schema, modules)
    const { catechistId, programId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      const catechistId = await seedCatechist(ctx, 'GLV-EF4')
      const programId = await ctx.db.insert('extracurricularPrograms', {
        academicYearId: yearId,
        title: 'Student Only',
        details: '{}',
        target: 'student',
        branches: [],
        dateStart: '2099-01-01',
        dateEnd: '2099-02-01',
        enrollmentExpireDate: '2099-01-15',
        feeRequired: false,
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
      })
      return { catechistId, programId }
    })

    await expect(
      t.mutation(api.extracurricularPrograms.enrollProgram, {
        programId,
        requesterId: catechistId,
      }),
    ).rejects.toThrow()
  })

  test('throws BRANCH_NOT_ELIGIBLE when student has no eligible primary class', async () => {
    const t = convexTest(schema, modules)
    const { studentId, programId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      const branchA = await ctx.db.insert('branches', {
        name: 'A',
        sortOrder: 1,
        isDeleted: false,
      })
      const studentId = await ctx.db.insert('students', {
        studentCode: 'STD-EF5',
        fullName: 'STD-EF5',
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
      const programId = await seedProgram(ctx, yearId, adminId, [branchA])
      return { studentId, programId }
    })

    await expect(
      t.mutation(api.extracurricularPrograms.enrollProgram, {
        programId,
        studentRequesterId: studentId,
      }),
    ).rejects.toThrow()
  })

  test('throws CAPACITY_EXCEEDED when program is full', async () => {
    const t = convexTest(schema, modules)
    const { catechistId, programId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      const catechistId = await seedCatechist(ctx, 'GLV-EF6')
      const programId = await ctx.db.insert('extracurricularPrograms', {
        academicYearId: yearId,
        title: 'Full',
        details: '{}',
        target: 'all',
        branches: [],
        dateStart: '2099-01-01',
        dateEnd: '2099-02-01',
        enrollmentExpireDate: '2099-01-15',
        feeRequired: false,
        maxCapacity: 1,
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
      })
      await ctx.db.insert('extracurricularEnrollments', {
        programId,
        tokenIdentifier: 'someone-else',
        createdAt: Date.now(),
        isDeleted: false,
      })
      return { catechistId, programId }
    })

    await expect(
      t.mutation(api.extracurricularPrograms.enrollProgram, {
        programId,
        requesterId: catechistId,
      }),
    ).rejects.toThrow()
  })

  test('resolves requester via identity token when neither id arg is provided', async () => {
    const t = convexTest(schema, modules)
    const { programId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      await ctx.db.insert('catechists', {
        memberId: 'GLV-EF7',
        fullName: 'Identity Enroller',
        role: 'user',
        isActive: true,
        isDeleted: false,
        tokenIdentifier: 'identity-token-7',
      })
      const adminId = await seedAdmin(ctx)
      const programId = await seedProgram(ctx, yearId, adminId)
      return { programId }
    })

    await t
      .withIdentity({ tokenIdentifier: 'identity-token-7' })
      .mutation(api.extracurricularPrograms.enrollProgram, { programId })

    const enrollments = await t.run((ctx) =>
      ctx.db.query('extracurricularEnrollments').collect(),
    )
    expect(
      enrollments.some((e) => e.tokenIdentifier === 'identity-token-7'),
    ).toBe(true)
  })
})

describe('extracurricularPrograms — unenrollProgram error branches', () => {
  test('throws UNAUTHORIZED when no requester/identity resolves to a known user', async () => {
    const t = convexTest(schema, modules)
    const programId = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      return seedProgram(ctx, yearId, adminId)
    })

    await expect(
      t
        .withIdentity({ tokenIdentifier: 'unknown-token' })
        .mutation(api.extracurricularPrograms.unenrollProgram, {
          programId,
        }),
    ).rejects.toThrow()
  })

  test('throws NOT_ENROLLED when catechist has no active enrollment', async () => {
    const t = convexTest(schema, modules)
    const { catechistId, programId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      const catechistId = await seedCatechist(ctx, 'GLV-UN1')
      const programId = await seedProgram(ctx, yearId, adminId)
      return { catechistId, programId }
    })

    await expect(
      t.mutation(api.extracurricularPrograms.unenrollProgram, {
        programId,
        requesterId: catechistId,
      }),
    ).rejects.toThrow()
  })

  test('resolves via identity token when neither id arg is provided', async () => {
    const t = convexTest(schema, modules)
    const programId = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      await ctx.db.insert('catechists', {
        memberId: 'GLV-UN2',
        fullName: 'Identity Unenroller',
        role: 'user',
        isActive: true,
        isDeleted: false,
        tokenIdentifier: 'identity-token-un',
      })
      const programId = await seedProgram(ctx, yearId, adminId)
      await ctx.db.insert('extracurricularEnrollments', {
        programId,
        tokenIdentifier: 'identity-token-un',
        createdAt: Date.now(),
        isDeleted: false,
      })
      return programId
    })

    await t
      .withIdentity({ tokenIdentifier: 'identity-token-un' })
      .mutation(api.extracurricularPrograms.unenrollProgram, { programId })

    const remaining = await t.run((ctx) =>
      ctx.db.query('extracurricularEnrollments').collect(),
    )
    expect(remaining.every((e) => e.isDeleted)).toBe(true)
  })
})

describe('extracurricularPrograms — updateEnrollmentPaymentStatus error/auth branches', () => {
  test('throws not-found for missing enrollment', async () => {
    const t = convexTest(schema, modules)
    const { adminId, enrollmentId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      const programId = await seedProgram(ctx, yearId, adminId)
      const enrollmentId = await ctx.db.insert('extracurricularEnrollments', {
        programId,
        tokenIdentifier: 'u1',
        createdAt: Date.now(),
        isDeleted: false,
      })
      await ctx.db.delete('extracurricularEnrollments', enrollmentId)
      return { adminId, enrollmentId }
    })

    await expect(
      t.mutation(api.extracurricularPrograms.updateEnrollmentPaymentStatus, {
        enrollmentId,
        requesterId: adminId,
        isPaid: true,
      }),
    ).rejects.toThrow()
  })

  test('throws NOT_FOUND when the parent program is deleted', async () => {
    const t = convexTest(schema, modules)
    const { adminId, enrollmentId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      const programId = await seedProgram(ctx, yearId, adminId)
      await ctx.db.patch('extracurricularPrograms', programId, {
        isDeleted: true,
      })
      const enrollmentId = await ctx.db.insert('extracurricularEnrollments', {
        programId,
        tokenIdentifier: 'u1',
        createdAt: Date.now(),
        isDeleted: false,
      })
      return { adminId, enrollmentId }
    })

    await expect(
      t.mutation(api.extracurricularPrograms.updateEnrollmentPaymentStatus, {
        enrollmentId,
        requesterId: adminId,
        isPaid: true,
      }),
    ).rejects.toThrow()
  })
})
