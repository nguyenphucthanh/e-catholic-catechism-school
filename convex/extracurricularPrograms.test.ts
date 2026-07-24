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

  test('createProgram persists links and updateProgram can patch or clear them', async () => {
    const t = convexTest(schema, modules)
    const adminId = await t.run(async (ctx) => {
      await seedActiveYear(ctx)
      return seedAdmin(ctx)
    })

    const programId = await t.mutation(
      api.extracurricularPrograms.createProgram,
      {
        requesterId: adminId,
        title: 'Camp',
        details: '{}',
        target: 'all',
        branches: [],
        dateStart: '2099-01-01',
        dateEnd: '2099-02-01',
        enrollmentExpireDate: '2099-01-15',
        feeRequired: false,
        links: [
          {
            type: 'social',
            label: 'Facebook',
            url: 'https://facebook.com/x',
            forEnrolledOnly: false,
          },
          {
            type: 'im',
            label: 'Zalo Group',
            url: 'https://zalo.me/g/abc',
            forEnrolledOnly: true,
          },
        ],
      },
    )

    const created = await t.run((ctx) =>
      ctx.db.get('extracurricularPrograms', programId),
    )
    expect(created?.links).toHaveLength(2)
    expect(created?.links?.[0]).toEqual({
      type: 'social',
      label: 'Facebook',
      url: 'https://facebook.com/x',
      forEnrolledOnly: false,
    })
    expect(created?.links?.[1].forEnrolledOnly).toBe(true)

    await t.mutation(api.extracurricularPrograms.updateProgram, {
      programId,
      requesterId: adminId,
      links: [],
    })

    const cleared = await t.run((ctx) =>
      ctx.db.get('extracurricularPrograms', programId),
    )
    expect(cleared?.links).toEqual([])
  })

  test('createProgram omits links when not provided', async () => {
    const t = convexTest(schema, modules)
    const adminId = await t.run(async (ctx) => {
      await seedActiveYear(ctx)
      return seedAdmin(ctx)
    })

    const programId = await t.mutation(
      api.extracurricularPrograms.createProgram,
      {
        requesterId: adminId,
        title: 'No Links Camp',
        details: '{}',
        target: 'all',
        branches: [],
        dateStart: '2099-01-01',
        dateEnd: '2099-02-01',
        enrollmentExpireDate: '2099-01-15',
        feeRequired: false,
      },
    )

    const created = await t.run((ctx) =>
      ctx.db.get('extracurricularPrograms', programId),
    )
    expect(created?.links).toBeUndefined()
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

  test('updateEnrollmentPaymentStatus mutation toggles isPaid correctly for authorized managers', async () => {
    const t = convexTest(schema, modules)
    const {
      adminId,
      plainId,
      programId: _programId,
      enrollmentId,
    } = await t.run(async (ctx) => {
      const yearId = await seedActiveYear(ctx)
      const adminId = await seedAdmin(ctx)
      const plainId = await seedCatechist(ctx, 'GLV-PLAIN')
      const programId = await seedProgram(ctx, yearId, adminId)

      const enrollmentId = await ctx.db.insert('extracurricularEnrollments', {
        programId,
        tokenIdentifier: 'token-std-200',
        createdAt: Date.now(),
        isPaid: false,
        isDeleted: false,
      })

      return { adminId, plainId, programId, enrollmentId }
    })

    // Plain catechist cannot update payment status
    await expect(
      t.mutation(api.extracurricularPrograms.updateEnrollmentPaymentStatus, {
        enrollmentId,
        requesterId: plainId,
        isPaid: true,
      }),
    ).rejects.toThrow()

    // Admin can update payment status
    await t.mutation(
      api.extracurricularPrograms.updateEnrollmentPaymentStatus,
      {
        enrollmentId,
        requesterId: adminId,
        isPaid: true,
      },
    )

    const enrollment = await t.run((ctx) =>
      ctx.db.get('extracurricularEnrollments', enrollmentId),
    )
    expect(enrollment?.isPaid).toBe(true)
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

  describe('extracurricularPrograms — calendar integration', () => {
    test('creating, updating, and deleting a program manages its linked calendar event', async () => {
      const t = convexTest(schema, modules)
      const { adminId, yearId: _yearId } = await t.run(async (ctx) => {
        const yearId = await seedActiveYear(ctx)
        const adminId = await seedAdmin(ctx)
        return { adminId, yearId }
      })

      // 1. Create a program
      const programId = await t.mutation(
        api.extracurricularPrograms.createProgram,
        {
          requesterId: adminId,
          title: 'Camp XYZ',
          details:
            '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Details here"}]}]}',
          target: 'all',
          branches: [],
          dateStart: '2099-01-01',
          dateEnd: '2099-02-01',
          enrollmentExpireDate: '2099-01-15',
          feeRequired: false,
        },
      )
      expect(programId).toBeTruthy()

      // Verify program has calendarEventId linked
      const program = await t.run((ctx) =>
        ctx.db.get('extracurricularPrograms', programId),
      )
      expect(program?.calendarEventId).toBeTruthy()

      // Verify calendar event was created with correct fields
      const calendarEvent = await t.run((ctx) =>
        ctx.db.get('calendarEvents', program!.calendarEventId!),
      )
      expect(calendarEvent).toBeTruthy()
      expect(calendarEvent?.date).toBe('2099-01-01')
      expect(calendarEvent?.endDate).toBe('2099-02-01')
      expect(calendarEvent?.scope).toBe('board')
      expect(calendarEvent?.isDeleted).toBe(false)
      // Check that heading is prepended
      const description = JSON.parse(calendarEvent!.description)
      expect(description.content[0].type).toBe('heading')
      expect(description.content[0].content[0].text).toBe('Camp XYZ')

      // 2. Update program dates and title
      await t.mutation(api.extracurricularPrograms.updateProgram, {
        programId,
        requesterId: adminId,
        title: 'New Camp XYZ',
        dateStart: '2099-01-10',
      })

      const updatedEvent = await t.run((ctx) =>
        ctx.db.get('calendarEvents', program!.calendarEventId!),
      )
      expect(updatedEvent?.date).toBe('2099-01-10')
      const updatedDescription = JSON.parse(updatedEvent!.description)
      expect(updatedDescription.content[0].content[0].text).toBe('New Camp XYZ')

      // 3. Delete program
      await t.mutation(api.extracurricularPrograms.deleteProgram, {
        programId,
        requesterId: adminId,
      })

      const deletedProgram = await t.run((ctx) =>
        ctx.db.get('extracurricularPrograms', programId),
      )
      expect(deletedProgram?.isDeleted).toBe(true)

      const deletedEvent = await t.run((ctx) =>
        ctx.db.get('calendarEvents', program!.calendarEventId!),
      )
      expect(deletedEvent?.isDeleted).toBe(true)
    })

    test('program with one branch creates branch-scoped event, and legacy program handles missing event on update', async () => {
      const t = convexTest(schema, modules)
      const {
        adminId,
        branchId,
        yearId: _yearId,
      } = await t.run(async (ctx) => {
        const yearId = await seedActiveYear(ctx)
        const adminId = await seedAdmin(ctx)
        const branchId = await ctx.db.insert('branches', {
          name: 'Ấu Nhi',
          sortOrder: 1,
          isDeleted: false,
        })
        return { adminId, branchId, yearId }
      })

      // Create program with one branch
      const programId = await t.mutation(
        api.extracurricularPrograms.createProgram,
        {
          requesterId: adminId,
          title: 'Branch Camp',
          details: 'plain-text-details', // non-json details
          target: 'all',
          branches: [branchId],
          dateStart: '2099-01-01',
          dateEnd: '2099-02-01',
          enrollmentExpireDate: '2099-01-15',
          feeRequired: false,
        },
      )

      const program = await t.run((ctx) =>
        ctx.db.get('extracurricularPrograms', programId),
      )
      expect(program?.calendarEventId).toBeTruthy()

      const calendarEvent = await t.run((ctx) =>
        ctx.db.get('calendarEvents', program!.calendarEventId!),
      )
      expect(calendarEvent?.scope).toBe('branch')
      expect(calendarEvent?.branchId).toBe(branchId)

      // Simulate a legacy program by removing its calendarEventId link
      await t.run(async (ctx) => {
        await ctx.db.patch('extracurricularPrograms', programId, {
          calendarEventId: undefined,
        })
      })

      // Update the program, which should create and link a new calendar event
      await t.mutation(api.extracurricularPrograms.updateProgram, {
        programId,
        requesterId: adminId,
        title: 'Updated Branch Camp',
      })

      const updatedProgram = await t.run((ctx) =>
        ctx.db.get('extracurricularPrograms', programId),
      )
      expect(updatedProgram?.calendarEventId).toBeTruthy()
      expect(updatedProgram?.calendarEventId).not.toBe(program?.calendarEventId)

      const newCalendarEvent = await t.run((ctx) =>
        ctx.db.get('calendarEvents', updatedProgram!.calendarEventId!),
      )
      expect(newCalendarEvent?.scope).toBe('branch')
      expect(newCalendarEvent?.branchId).toBe(branchId)
    })
  })

  describe('extracurricularPrograms — peer managers (in-charge catechists)', () => {
    test('assigned peer manager can update, delete program and view enrollments', async () => {
      const t = convexTest(schema, modules)
      const { peerId, unauthorizedId, programId } = await t.run(async (ctx) => {
        const yearId = await seedActiveYear(ctx)
        const ownerId = await seedCatechist(ctx, 'GLV-OWNER')
        const peerId = await seedCatechist(ctx, 'GLV-PEER')
        const unauthorizedId = await seedCatechist(ctx, 'GLV-UNAUTH')

        const programId = await ctx.db.insert('extracurricularPrograms', {
          academicYearId: yearId,
          title: 'Camp',
          details: '{}',
          target: 'all',
          branches: [],
          inChargeCatechists: [peerId],
          dateStart: '2099-01-01',
          dateEnd: '2099-02-01',
          enrollmentExpireDate: '2099-01-15',
          feeRequired: false,
          createdBy: ownerId,
          createdAt: Date.now(),
          isDeleted: false,
        })

        return { yearId, ownerId, peerId, unauthorizedId, programId }
      })

      // 1. Peer manager can update the program
      await t.mutation(api.extracurricularPrograms.updateProgram, {
        programId,
        requesterId: peerId,
        title: 'Camp Updated',
      })

      const program = await t.run((ctx) =>
        ctx.db.get('extracurricularPrograms', programId),
      )
      expect(program?.title).toBe('Camp Updated')

      // 2. Unauthorized catechist cannot update
      await expect(
        t.mutation(api.extracurricularPrograms.updateProgram, {
          programId,
          requesterId: unauthorizedId,
          title: 'Unauth attempt',
        }),
      ).rejects.toThrow()

      // 3. Peer manager can view enrollments
      const enrollments = await t.query(
        api.extracurricularPrograms.getEnrollments,
        {
          programId,
          requesterId: peerId,
        },
      )
      expect(enrollments).toBeDefined()

      // 4. Unauthorized catechist cannot view enrollments
      await expect(
        t.query(api.extracurricularPrograms.getEnrollments, {
          programId,
          requesterId: unauthorizedId,
        }),
      ).rejects.toThrow()

      // 5. Peer manager can delete the program
      await t.mutation(api.extracurricularPrograms.deleteProgram, {
        programId,
        requesterId: peerId,
      })

      const deletedProgram = await t.run((ctx) =>
        ctx.db.get('extracurricularPrograms', programId),
      )
      expect(deletedProgram?.isDeleted).toBe(true)
    })
  })

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

  describe('extracurricularPrograms — getProgramDetail error/unauthorized branches', () => {
    test('throws NOT_FOUND for missing or deleted program', async () => {
      const t = convexTest(schema, modules)
      const { adminId, programId } = await t.run(async (ctx) => {
        const yearId = await seedActiveYear(ctx)
        const adminId = await seedAdmin(ctx)
        const programId = await seedProgram(ctx, yearId, adminId)
        await ctx.db.patch('extracurricularPrograms', programId, {
          isDeleted: true,
        })
        return { adminId, programId }
      })

      await expect(
        t.query(api.extracurricularPrograms.getProgramDetail, {
          programId,
          requesterId: adminId,
        }),
      ).rejects.toThrow()
    })

    test('student is blocked from catechist-only program detail', async () => {
      const t = convexTest(schema, modules)
      const { studentId, programId } = await t.run(async (ctx) => {
        const yearId = await seedActiveYear(ctx)
        const adminId = await seedAdmin(ctx)
        const studentId = await ctx.db.insert('students', {
          studentCode: 'STD-800',
          fullName: 'STD-800',
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
        const programId = await ctx.db.insert('extracurricularPrograms', {
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
        return { studentId, programId }
      })

      await expect(
        t.query(api.extracurricularPrograms.getProgramDetail, {
          programId,
          studentRequesterId: studentId,
        }),
      ).rejects.toThrow()
    })

    test('student with no primary class is unauthorized for a branch-scoped program', async () => {
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
          studentCode: 'STD-900',
          fullName: 'STD-900',
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
        const programId = await seedProgram(ctx, yearId, adminId, [branchA])
        return { studentId, programId }
      })

      await expect(
        t.query(api.extracurricularPrograms.getProgramDetail, {
          programId,
          studentRequesterId: studentId,
        }),
      ).rejects.toThrow()
    })

    test('student is unauthorized for a program scoped to a branch they are not in', async () => {
      const t = convexTest(schema, modules)
      const { studentId, programId } = await t.run(async (ctx) => {
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
          studentCode: 'STD-901',
          fullName: 'STD-901',
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
        const programId = await seedProgram(ctx, yearId, adminId, [branchB])
        return { studentId, programId }
      })

      await expect(
        t.query(api.extracurricularPrograms.getProgramDetail, {
          programId,
          studentRequesterId: studentId,
        }),
      ).rejects.toThrow()
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

  describe('extracurricularPrograms — updateProgram / deleteProgram lock & auth branches', () => {
    test('updateProgram and deleteProgram throw NOT_FOUND on missing/deleted program', async () => {
      const t = convexTest(schema, modules)
      const { adminId, programId } = await t.run(async (ctx) => {
        const yearId = await seedActiveYear(ctx)
        const adminId = await seedAdmin(ctx)
        const programId = await seedProgram(ctx, yearId, adminId)
        await ctx.db.patch('extracurricularPrograms', programId, {
          isDeleted: true,
        })
        return { adminId, programId }
      })

      await expect(
        t.mutation(api.extracurricularPrograms.updateProgram, {
          programId,
          requesterId: adminId,
          title: 'X',
        }),
      ).rejects.toThrow()

      await expect(
        t.mutation(api.extracurricularPrograms.deleteProgram, {
          programId,
          requesterId: adminId,
        }),
      ).rejects.toThrow()
    })

    test('updateProgram and deleteProgram throw INACTIVE_ACADEMIC_YEAR when year is locked', async () => {
      const t = convexTest(schema, modules)
      const { adminId, programId } = await t.run(async (ctx) => {
        const yearId = await seedActiveYear(ctx)
        const adminId = await seedAdmin(ctx)
        const programId = await seedProgram(ctx, yearId, adminId)
        await ctx.db.patch('academicYears', yearId, { isActive: false })
        return { adminId, programId }
      })

      await expect(
        t.mutation(api.extracurricularPrograms.updateProgram, {
          programId,
          requesterId: adminId,
          title: 'X',
        }),
      ).rejects.toThrow()

      await expect(
        t.mutation(api.extracurricularPrograms.deleteProgram, {
          programId,
          requesterId: adminId,
        }),
      ).rejects.toThrow()
    })

    test('branch head without matching branch cannot update or delete a board-scoped program', async () => {
      const t = convexTest(schema, modules)
      const { branchHeadId, programId } = await t.run(async (ctx) => {
        const yearId = await seedActiveYear(ctx)
        const owner = await seedCatechist(ctx, 'GLV-OWN2')
        const branchHeadId = await seedCatechist(ctx, 'GLV-BH2')
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
        await makeBranchHead(ctx, branchHeadId, yearId, branchA)
        const programId = await seedProgram(ctx, yearId, owner, [branchB])
        return { branchHeadId, programId }
      })

      await expect(
        t.mutation(api.extracurricularPrograms.updateProgram, {
          programId,
          requesterId: branchHeadId,
          title: 'Nope',
        }),
      ).rejects.toThrow()

      await expect(
        t.mutation(api.extracurricularPrograms.deleteProgram, {
          programId,
          requesterId: branchHeadId,
        }),
      ).rejects.toThrow()
    })

    test('deleteProgram on a legacy program without calendarEventId does not touch calendarEvents', async () => {
      const t = convexTest(schema, modules)
      const { adminId, programId } = await t.run(async (ctx) => {
        const yearId = await seedActiveYear(ctx)
        const adminId = await seedAdmin(ctx)
        const programId = await ctx.db.insert('extracurricularPrograms', {
          academicYearId: yearId,
          title: 'Legacy',
          details: '{}',
          target: 'all',
          branches: [],
          dateStart: '2099-01-01',
          dateEnd: '2099-02-01',
          enrollmentExpireDate: '2099-01-15',
          feeRequired: false,
          createdBy: adminId,
          createdAt: Date.now(),
          isDeleted: false,
        })
        return { adminId, programId }
      })

      await t.mutation(api.extracurricularPrograms.deleteProgram, {
        programId,
        requesterId: adminId,
      })

      const deleted = await t.run((ctx) =>
        ctx.db.get('extracurricularPrograms', programId),
      )
      expect(deleted?.isDeleted).toBe(true)
      expect(deleted?.calendarEventId).toBeUndefined()
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

    test('branch head of the program branch can update payment status', async () => {
      const t = convexTest(schema, modules)
      const { branchHeadId, enrollmentId } = await t.run(async (ctx) => {
        const yearId = await seedActiveYear(ctx)
        const owner = await seedCatechist(ctx, 'GLV-OWN3')
        const branchHeadId = await seedCatechist(ctx, 'GLV-BH3')
        const branchA = await ctx.db.insert('branches', {
          name: 'A',
          sortOrder: 1,
          isDeleted: false,
        })
        await makeBranchHead(ctx, branchHeadId, yearId, branchA)
        const programId = await seedProgram(ctx, yearId, owner, [branchA])
        const enrollmentId = await ctx.db.insert('extracurricularEnrollments', {
          programId,
          tokenIdentifier: 'u1',
          createdAt: Date.now(),
          isPaid: false,
          isDeleted: false,
        })
        return { branchHeadId, enrollmentId }
      })

      await t.mutation(
        api.extracurricularPrograms.updateEnrollmentPaymentStatus,
        {
          enrollmentId,
          requesterId: branchHeadId,
          isPaid: true,
        },
      )

      const enrollment = await t.run((ctx) =>
        ctx.db.get('extracurricularEnrollments', enrollmentId),
      )
      expect(enrollment?.isPaid).toBe(true)
    })
  })

  describe('extracurricularPrograms — listPrograms additional filters/sorts', () => {
    test('filters by branch, sorts by title ascending and descending', async () => {
      const t = convexTest(schema, modules)
      const { adminId, yearId, branchA } = await t.run(async (ctx) => {
        const yearId = await seedActiveYear(ctx)
        const adminId = await seedAdmin(ctx)
        const branchA = await ctx.db.insert('branches', {
          name: 'A',
          sortOrder: 1,
          isDeleted: false,
        })
        await ctx.db.insert('extracurricularPrograms', {
          academicYearId: yearId,
          title: 'Zebra',
          details: '{}',
          target: 'all',
          branches: [branchA],
          dateStart: '2099-01-01',
          dateEnd: '2099-02-01',
          enrollmentExpireDate: '2099-01-15',
          feeRequired: false,
          createdBy: adminId,
          createdAt: Date.now(),
          isDeleted: false,
        })
        await ctx.db.insert('extracurricularPrograms', {
          academicYearId: yearId,
          title: 'Alpha',
          details: '{}',
          target: 'all',
          branches: [branchA],
          dateStart: '2099-01-01',
          dateEnd: '2099-02-01',
          enrollmentExpireDate: '2099-01-15',
          feeRequired: false,
          createdBy: adminId,
          createdAt: Date.now(),
          isDeleted: false,
        })
        // Different branch — should be excluded by branch filter
        const branchB = await ctx.db.insert('branches', {
          name: 'B',
          sortOrder: 2,
          isDeleted: false,
        })
        await ctx.db.insert('extracurricularPrograms', {
          academicYearId: yearId,
          title: 'Other',
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
        return { adminId, yearId, branchA }
      })

      const asc = await t.query(api.extracurricularPrograms.listPrograms, {
        academicYearId: yearId,
        requesterId: adminId,
        branch: branchA,
        sortBy: 'title',
        sortOrder: 'asc',
      })
      expect(asc.map((p) => p.title)).toEqual(['Alpha', 'Zebra'])

      const desc = await t.query(api.extracurricularPrograms.listPrograms, {
        academicYearId: yearId,
        requesterId: adminId,
        branch: branchA,
        sortBy: 'title',
        sortOrder: 'desc',
      })
      expect(desc.map((p) => p.title)).toEqual(['Zebra', 'Alpha'])
    })

    test('filters by active and past status', async () => {
      const t = convexTest(schema, modules)
      const { adminId, yearId } = await t.run(async (ctx) => {
        const yearId = await seedActiveYear(ctx)
        const adminId = await seedAdmin(ctx)
        await ctx.db.insert('extracurricularPrograms', {
          academicYearId: yearId,
          title: 'Past Event',
          details: '{}',
          target: 'all',
          branches: [],
          dateStart: '2000-01-01',
          dateEnd: '2000-02-01',
          enrollmentExpireDate: '2000-01-15',
          feeRequired: false,
          createdBy: adminId,
          createdAt: Date.now(),
          isDeleted: false,
        })
        await ctx.db.insert('extracurricularPrograms', {
          academicYearId: yearId,
          title: 'Ongoing Event',
          details: '{}',
          target: 'all',
          branches: [],
          dateStart: '2000-01-01',
          dateEnd: '2999-01-01',
          enrollmentExpireDate: '2999-01-01',
          feeRequired: false,
          createdBy: adminId,
          createdAt: Date.now(),
          isDeleted: false,
        })
        return { adminId, yearId }
      })

      const past = await t.query(api.extracurricularPrograms.listPrograms, {
        academicYearId: yearId,
        requesterId: adminId,
        status: 'past',
      })
      expect(past.map((p) => p.title)).toEqual(['Past Event'])

      const active = await t.query(api.extracurricularPrograms.listPrograms, {
        academicYearId: yearId,
        requesterId: adminId,
        status: 'active',
      })
      expect(active.map((p) => p.title)).toEqual(['Ongoing Event'])
    })
  })
})
