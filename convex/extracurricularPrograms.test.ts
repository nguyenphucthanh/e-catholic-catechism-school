/// <reference types="vite/client" />

/* eslint-disable no-shadow */

import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

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

function makeBoardMember(
  ctx: any,
  catechistId: Id<'catechists'>,
  academicYearId: Id<'academicYears'>,
) {
  return ctx.db.insert('academicYearAssignments', {
    academicYearId,
    catechistId,
    assignmentType: 'board_member',
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

function makeBranchHead(
  ctx: any,
  catechistId: Id<'catechists'>,
  academicYearId: Id<'academicYears'>,
  branchId: Id<'branches'>,
) {
  return ctx.db.insert('branchAssignments', {
    academicYearId,
    catechistId,
    branchId,
    isDeleted: false,
  })
}

describe('extracurricularPrograms — board member & branch head access', () => {
  test('board member can create a program', async () => {
    const t = convexTest(schema, modules)
    const { boardId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const boardId = await seedCatechist(ctx, 'GLV-BOARD')
      await makeBoardMember(ctx, boardId, yearId)
      return { boardId }
    })

    const id = await t.mutation(api.extracurricularPrograms.createProgram, {
      requesterId: boardId,
      title: 'Retreat',
      details: '{}',
      target: 'all',
      branches: [],
      dateStart: '2099-01-01',
      dateEnd: '2099-02-01',
      enrollmentExpireDate: '2099-01-15',
      feeRequired: false,
    })
    expect(id).toBeTruthy()
  })

  test('board member can update and delete a program', async () => {
    const t = convexTest(schema, modules)
    const { boardId, programId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const boardId = await seedCatechist(ctx, 'GLV-BOARD')
      await makeBoardMember(ctx, boardId, yearId)
      const programId = await seedProgram(ctx, yearId, boardId)
      return { boardId, programId }
    })

    await t.mutation(api.extracurricularPrograms.updateProgram, {
      programId,
      requesterId: boardId,
      title: 'Updated',
    })
    await t.mutation(api.extracurricularPrograms.deleteProgram, {
      programId,
      requesterId: boardId,
    })

    const deleted = await t.run((ctx) =>
      ctx.db.get('extracurricularPrograms', programId),
    )
    expect(deleted?.isDeleted).toBe(true)
    expect(deleted?.title).toBe('Updated')
  })

  test('branch head can create, update, delete program for their branch', async () => {
    const t = convexTest(schema, modules)
    const { branchHeadId, branchA, programId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const branchHeadId = await seedCatechist(ctx, 'GLV-BRANCH-HEAD')
      const branchA = await ctx.db.insert('branches', {
        name: 'Branch A',
        sortOrder: 1,
        isDeleted: false,
      })
      await makeBranchHead(ctx, branchHeadId, yearId, branchA)
      const programId = await seedProgram(ctx, yearId, branchHeadId, [branchA])
      return { branchHeadId, branchA, programId }
    })

    const createdId = await t.mutation(
      api.extracurricularPrograms.createProgram,
      {
        requesterId: branchHeadId,
        title: 'Branch Event',
        details: '{}',
        target: 'all',
        branches: [branchA],
        dateStart: '2099-01-01',
        dateEnd: '2099-02-01',
        enrollmentExpireDate: '2099-01-15',
        feeRequired: false,
      },
    )
    expect(createdId).toBeTruthy()

    await t.mutation(api.extracurricularPrograms.updateProgram, {
      programId,
      requesterId: branchHeadId,
      title: 'Updated Branch Program',
    })
    await t.mutation(api.extracurricularPrograms.deleteProgram, {
      programId,
      requesterId: branchHeadId,
    })

    const deleted = await t.run((ctx) =>
      ctx.db.get('extracurricularPrograms', programId),
    )
    expect(deleted?.isDeleted).toBe(true)
  })

  test('plain catechist (no board or branch head assignment) cannot create or delete', async () => {
    const t = convexTest(schema, modules)
    const { plainId, programId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const plainId = await seedCatechist(ctx, 'GLV-PLAIN')
      const admin = await seedCatechist(ctx, 'GLV-A')
      const programId = await seedProgram(ctx, yearId, admin)
      return { plainId, programId }
    })

    await expect(
      t.mutation(api.extracurricularPrograms.createProgram, {
        requesterId: plainId,
        title: 'Nope',
        details: '{}',
        target: 'all',
        branches: [],
        dateStart: '2099-01-01',
        dateEnd: '2099-02-01',
        enrollmentExpireDate: '2099-01-15',
        feeRequired: false,
      }),
    ).rejects.toThrow()

    await expect(
      t.mutation(api.extracurricularPrograms.deleteProgram, {
        programId,
        requesterId: plainId,
      }),
    ).rejects.toThrow()
  })

  test('board member sees all programs regardless of branch scope', async () => {
    const t = convexTest(schema, modules)
    const { boardId, yearId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const boardId = await seedCatechist(ctx, 'GLV-BOARD')
      await makeBoardMember(ctx, boardId, yearId)
      const admin = await seedCatechist(ctx, 'GLV-A')
      const branchA = await ctx.db.insert('branches', {
        name: 'A',
        sortOrder: 1,
        isDeleted: false,
      })
      // Program scoped to a branch the board member does not head
      await seedProgram(ctx, yearId, admin, [branchA])
      return { boardId, yearId }
    })

    const programs = await t.query(api.extracurricularPrograms.listPrograms, {
      academicYearId: yearId,
      requesterId: boardId,
    })
    expect(programs.length).toBe(1)
  })
})

function seedAdmin(ctx: any): Promise<Id<'catechists'>> {
  return ctx.db.insert('catechists', {
    memberId: 'ADMIN',
    fullName: 'Admin',
    role: 'admin',
    isActive: true,
    isDeleted: false,
  })
}

describe('extracurricularPrograms — admin CRUD, list, detail', () => {
  test('createProgram rejects invalid date range and enrollment date', async () => {
    const t = convexTest(schema, modules)
    const adminId = await t.run(async (ctx) => {
      await seedActiveYear(ctx)
      return seedAdmin(ctx)
    })

    await expect(
      t.mutation(api.extracurricularPrograms.createProgram, {
        requesterId: adminId,
        title: 'X',
        details: '{}',
        target: 'all',
        branches: [],
        dateStart: '2099-02-01',
        dateEnd: '2099-01-01',
        enrollmentExpireDate: '2099-01-15',
        feeRequired: false,
      }),
    ).rejects.toThrow()

    await expect(
      t.mutation(api.extracurricularPrograms.createProgram, {
        requesterId: adminId,
        title: 'X',
        details: '{}',
        target: 'all',
        branches: [],
        dateStart: '2099-01-01',
        dateEnd: '2099-03-01',
        enrollmentExpireDate: '2099-04-01',
        feeRequired: false,
      }),
    ).rejects.toThrow()

    // Allows start date and end date to be the same date
    const sameDayId = await t.mutation(
      api.extracurricularPrograms.createProgram,
      {
        requesterId: adminId,
        title: 'Single Day Event',
        details: '{}',
        target: 'all',
        branches: [],
        dateStart: '2099-05-01',
        dateEnd: '2099-05-01',
        enrollmentExpireDate: '2099-04-30',
        feeRequired: false,
      },
    )
    expect(sameDayId).toBeTruthy()
  })

  test('updateProgram rejects past start date and capacity below enrolled', async () => {
    const t = convexTest(schema, modules)
    const { adminId, programId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      const programId = await seedProgram(ctx, yearId, adminId)
      await ctx.db.insert('extracurricularEnrollments', {
        programId,
        tokenIdentifier: 'u1',
        createdAt: Date.now(),
        isDeleted: false,
      })
      return { adminId, programId }
    })

    await expect(
      t.mutation(api.extracurricularPrograms.updateProgram, {
        programId,
        requesterId: adminId,
        dateStart: '2000-01-01',
      }),
    ).rejects.toThrow()

    await expect(
      t.mutation(api.extracurricularPrograms.updateProgram, {
        programId,
        requesterId: adminId,
        maxCapacity: 0,
      }),
    ).rejects.toThrow()

    await t.mutation(api.extracurricularPrograms.updateProgram, {
      programId,
      requesterId: adminId,
      title: 'New',
      details: '{"a":1}',
      target: 'catechist',
      feeRequired: true,
      feeAmount: 50,
      maxCapacity: 10,
    })
    const updated = await t.run((ctx) =>
      ctx.db.get('extracurricularPrograms', programId),
    )
    expect(updated?.title).toBe('New')
    expect(updated?.feeAmount).toBe(50)
  })

  test('listPrograms applies search, target, status, and hasFee filters', async () => {
    const t = convexTest(schema, modules)
    const { adminId, yearId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      await ctx.db.insert('extracurricularPrograms', {
        academicYearId: yearId,
        title: 'Soccer Camp',
        details: '{}',
        target: 'student',
        branches: [],
        dateStart: '2099-01-01',
        dateEnd: '2099-02-01',
        enrollmentExpireDate: '2099-01-15',
        feeRequired: true,
        feeAmount: 20,
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
      })
      return { adminId, yearId }
    })

    const bySearch = await t.query(api.extracurricularPrograms.listPrograms, {
      academicYearId: yearId,
      requesterId: adminId,
      search: 'soccer',
      target: 'student',
      status: 'upcoming',
      hasFee: true,
      sortBy: 'count',
      sortOrder: 'desc',
    })
    expect(bySearch.length).toBe(1)

    const noMatch = await t.query(api.extracurricularPrograms.listPrograms, {
      academicYearId: yearId,
      requesterId: adminId,
      search: 'zzz',
    })
    expect(noMatch.length).toBe(0)
  })

  test('getProgramDetail returns program for admin catechist; getEnrollments blocks plain catechist', async () => {
    const t = convexTest(schema, modules)
    const { adminId, plainId, programId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      const plainId = await seedCatechist(ctx, 'GLV-PLAIN')
      const programId = await seedProgram(ctx, yearId, adminId)
      return { adminId, plainId, programId }
    })

    const detail = await t
      .withIdentity({ tokenIdentifier: 'admin-token' })
      .query(api.extracurricularPrograms.getProgramDetail, {
        programId,
        requesterId: adminId,
      })
    expect(detail.enrollmentCount).toBe(0)

    await expect(
      t.query(api.extracurricularPrograms.getEnrollments, {
        programId,
        requesterId: plainId,
      }),
    ).rejects.toThrow()
  })

  test('enroll and unenroll flow for a catechist', async () => {
    const t = convexTest(schema, modules)
    const { programId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      const branchA = await ctx.db.insert('branches', {
        name: 'A',
        sortOrder: 1,
        isDeleted: false,
      })
      const catechistId = await ctx.db.insert('catechists', {
        memberId: 'GLV-ENROLL',
        fullName: 'Enroller',
        role: 'user',
        isActive: true,
        isDeleted: false,
        tokenIdentifier: 'enroll-token',
      })
      await ctx.db.insert('branchAssignments', {
        academicYearId: yearId,
        catechistId,
        branchId: branchA,
        isDeleted: false,
      })
      const programId = await ctx.db.insert('extracurricularPrograms', {
        academicYearId: yearId,
        title: 'Trip',
        details: '{}',
        target: 'catechist',
        branches: [branchA],
        dateStart: '2099-01-01',
        dateEnd: '2099-02-01',
        enrollmentExpireDate: '2099-01-15',
        feeRequired: false,
        maxCapacity: 5,
        createdBy: adminId,
        createdAt: Date.now(),
        isDeleted: false,
      })
      return { programId }
    })

    const asUser = t.withIdentity({ tokenIdentifier: 'enroll-token' })
    await asUser.mutation(api.extracurricularPrograms.enrollProgram, {
      programId,
    })

    await expect(
      asUser.mutation(api.extracurricularPrograms.enrollProgram, { programId }),
    ).rejects.toThrow()

    await asUser.mutation(api.extracurricularPrograms.unenrollProgram, {
      programId,
    })

    await expect(
      asUser.mutation(api.extracurricularPrograms.unenrollProgram, {
        programId,
      }),
    ).rejects.toThrow()
  })

  test('base catechist can list programs and view program detail', async () => {
    const t = convexTest(schema, modules)
    const { yearId, baseCatechistId, programId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      const baseCatechistId = await seedCatechist(ctx, 'GLV-BASE')
      const programId = await seedProgram(ctx, yearId, adminId)
      return { yearId, baseCatechistId, programId }
    })

    const programs = await t.query(api.extracurricularPrograms.listPrograms, {
      academicYearId: yearId,
      requesterId: baseCatechistId,
    })
    expect(programs.length).toBe(1)

    const detail = await t
      .withIdentity({ tokenIdentifier: 'base-token' })
      .query(api.extracurricularPrograms.getProgramDetail, {
        programId,
        requesterId: baseCatechistId,
      })
    expect(detail.title).toBe('Camp')
  })

  test('catechist creator can enroll via requesterId without identity', async () => {
    const t = convexTest(schema, modules)
    const { catechistId, programId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const catechistId = await seedCatechist(ctx, 'GLV-CREATOR')
      const programId = await seedProgram(ctx, yearId, catechistId)
      return { catechistId, programId }
    })

    await t.mutation(api.extracurricularPrograms.enrollProgram, {
      programId,
      requesterId: catechistId,
    })

    const detail = await t.query(api.extracurricularPrograms.getProgramDetail, {
      programId,
      requesterId: catechistId,
    })
    expect(detail.userEnrolled).toBe(true)

    await t.mutation(api.extracurricularPrograms.unenrollProgram, {
      programId,
      requesterId: catechistId,
    })

    const detailAfter = await t.query(
      api.extracurricularPrograms.getProgramDetail,
      {
        programId,
        requesterId: catechistId,
      },
    )
    expect(detailAfter.userEnrolled).toBe(false)
  })

  test('base catechist can enroll in a program regardless of branch restrictions', async () => {
    const t = convexTest(schema, modules)
    const { baseCatechistId, programId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      const branchA = await ctx.db.insert('branches', {
        name: 'Branch A',
        sortOrder: 1,
        isDeleted: false,
      })
      const baseCatechistId = await seedCatechist(ctx, 'GLV-BASE-BRANCH')
      const programId = await seedProgram(ctx, yearId, adminId, [branchA])
      return { baseCatechistId, programId }
    })

    await t.mutation(api.extracurricularPrograms.enrollProgram, {
      programId,
      requesterId: baseCatechistId,
    })

    const detail = await t.query(api.extracurricularPrograms.getProgramDetail, {
      programId,
      requesterId: baseCatechistId,
    })
    expect(detail.userEnrolled).toBe(true)
  })

  test('getEnrollments returns rich user details for enrolled catechist and student', async () => {
    const t = convexTest(schema, modules)
    const { adminId, programId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      const programId = await seedProgram(ctx, yearId, adminId)

      // 1. Create a catechist
      const catechistId = await ctx.db.insert('catechists', {
        memberId: 'CAT-100',
        tokenIdentifier: 'token-cat-100',
        saintName: 'Giuse',
        fullName: 'Nguyễn Văn A',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })

      // 2. Create a student with primary class
      const branchId = await ctx.db.insert('branches', {
        name: 'Ấu Nhi',
        sortOrder: 1,
        isDeleted: false,
      })
      const classId = await ctx.db.insert('classes', {
        branchId,
        name: 'Ấu Nhi 1',
        isDeleted: false,
      })
      const classYearId = await ctx.db.insert('classYears', {
        classId,
        academicYearId: yearId,
        isDeleted: false,
      })
      const studentId = await ctx.db.insert('students', {
        studentCode: 'STD-200',
        tokenIdentifier: 'token-std-200',
        saintName: 'Maria',
        fullName: 'Trần Thị B',
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

      // 3. Insert enrollments
      await ctx.db.insert('extracurricularEnrollments', {
        programId,
        tokenIdentifier: 'token-cat-100',
        createdAt: 1000,
        isDeleted: false,
      })
      await ctx.db.insert('extracurricularEnrollments', {
        programId,
        tokenIdentifier: 'token-std-200',
        createdAt: 2000,
        isDeleted: false,
      })
      await ctx.db.insert('extracurricularEnrollments', {
        programId,
        tokenIdentifier: 'unknown-token-999',
        createdAt: 3000,
        isDeleted: false,
      })

      return { adminId, programId, catechistId, studentId }
    })

    const enrollments = await t.query(
      api.extracurricularPrograms.getEnrollments,
      {
        programId,
        requesterId: adminId,
      },
    )

    expect(enrollments.length).toBe(3)

    const catEnrollment = enrollments.find((e) => e.userType === 'catechist')
    expect(catEnrollment).toBeDefined()
    if (catEnrollment) {
      expect(catEnrollment.userInfo.saintName).toBe('Giuse')
      expect(catEnrollment.userInfo.fullName).toBe('Nguyễn Văn A')
      expect(catEnrollment.userInfo.code).toBe('CAT-100')
    }

    const stdEnrollment = enrollments.find((e) => e.userType === 'student')
    expect(stdEnrollment).toBeDefined()
    if (stdEnrollment) {
      expect(stdEnrollment.userInfo.saintName).toBe('Maria')
      expect(stdEnrollment.userInfo.fullName).toBe('Trần Thị B')
      expect(stdEnrollment.userInfo.code).toBe('STD-200')
      expect(stdEnrollment.userInfo.className).toBe('Ấu Nhi 1')
    }

    const unknownEnrollment = enrollments.find((e) => e.userType === 'unknown')
    expect(unknownEnrollment).toBeDefined()
    if (unknownEnrollment) {
      expect(unknownEnrollment.userInfo.fullName).toBe('unknown-token-999')
    }
  })

  test('student can view program detail and enroll/unenroll', async () => {
    const t = convexTest(schema, modules)
    const { programId, studentId } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      const branchId = await ctx.db.insert('branches', {
        name: 'Ấu Nhi',
        sortOrder: 1,
        isDeleted: false,
      })
      const classId = await ctx.db.insert('classes', {
        branchId,
        name: 'Ấu Nhi 1',
        isDeleted: false,
      })
      const classYearId = await ctx.db.insert('classYears', {
        classId,
        academicYearId: yearId,
        isDeleted: false,
      })
      const studentId = await ctx.db.insert('students', {
        studentCode: 'STD-300',
        tokenIdentifier: 'token-std-300',
        saintName: 'Phaolô',
        fullName: 'Lê Văn C',
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
      const programId = await seedProgram(ctx, yearId, adminId, [branchId])
      return { programId, studentId }
    })

    const detail = await t.query(api.extracurricularPrograms.getProgramDetail, {
      programId,
      studentRequesterId: studentId,
    })
    expect(detail.title).toBe('Camp')
    expect(detail.userEnrolled).toBe(false)

    await t.mutation(api.extracurricularPrograms.enrollProgram, {
      programId,
      studentRequesterId: studentId,
    })

    const detailEnrolled = await t.query(
      api.extracurricularPrograms.getProgramDetail,
      {
        programId,
        studentRequesterId: studentId,
      },
    )
    expect(detailEnrolled.userEnrolled).toBe(true)

    await t.mutation(api.extracurricularPrograms.unenrollProgram, {
      programId,
      studentRequesterId: studentId,
    })

    const detailUnenrolled = await t.query(
      api.extracurricularPrograms.getProgramDetail,
      {
        programId,
        studentRequesterId: studentId,
      },
    )
    expect(detailUnenrolled.userEnrolled).toBe(false)
  })

  test('student with primary classes across multiple academic years does not crash unique() lookup', async () => {
    const t = convexTest(schema, modules)
    const { programId, studentId } = await t.run(async (ctx) => {
      const pastYearId = await ctx.db.insert('academicYears', {
        name: '2023-2024',
        startDate: '2023-09-01',
        endDate: '2024-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: false,
        isDeleted: false,
      })
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      const branchId = await ctx.db.insert('branches', {
        name: 'Ấu Nhi',
        sortOrder: 1,
        isDeleted: false,
      })
      const classId = await ctx.db.insert('classes', {
        branchId,
        name: 'Ấu Nhi 1',
        isDeleted: false,
      })
      const pastClassYearId = await ctx.db.insert('classYears', {
        classId,
        academicYearId: pastYearId,
        isDeleted: false,
      })
      const classYearId = await ctx.db.insert('classYears', {
        classId,
        academicYearId: yearId,
        isDeleted: false,
      })
      const studentId = await ctx.db.insert('students', {
        studentCode: 'STD-400',
        tokenIdentifier: 'token-std-400',
        saintName: 'Anna',
        fullName: 'Phạm Thị D',
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
      // Withdrawn-but-not-deleted primary class from a prior, inactive year —
      // reproduces the bug: two non-deleted isPrimaryClass rows for one student.
      await ctx.db.insert('studentClasses', {
        studentId,
        classYearId: pastClassYearId,
        isPrimaryClass: true,
        enrolledDate: '2023-09-01',
        status: 'withdrawn',
        statusChangedDate: '2024-05-31',
        leftDate: '2024-05-31',
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
      const programId = await seedProgram(ctx, yearId, adminId, [branchId])
      return { programId, studentId }
    })

    const detail = await t.query(api.extracurricularPrograms.getProgramDetail, {
      programId,
      studentRequesterId: studentId,
    })
    expect(detail.title).toBe('Camp')

    await expect(
      t.mutation(api.extracurricularPrograms.enrollProgram, {
        programId,
        studentRequesterId: studentId,
      }),
    ).resolves.toBeDefined()
  })
})
