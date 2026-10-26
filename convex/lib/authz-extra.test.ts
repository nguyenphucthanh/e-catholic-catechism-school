/// <reference types="vite/client" />
import { describe, expect, test } from 'vitest'
import { authedConvexTest } from '../../test-utils/authedConvexTest'
import schema from '../schema'
import { AUTHZ_ERRORS } from './errors'
import {
  assertBoardMemberOrAdmin,
  assertBranchHeadOrAbove,
  assertClassCatechistOrAbove,
  assertEditGuardianPermission,
  assertEditStudentPermission,
  assertValidStudent,
  checkEditStudentPermission,
  checkStudentSensitiveInfoPermission,
  getActiveAcademicYear,
  getEffectivePermissions,
  requireActiveAcademicYear,
} from './authz'

const modules = import.meta.glob('../**/*.ts')

describe('requireActiveAcademicYear', () => {
  test('returns the active year id when one exists', async () => {
    const t = authedConvexTest(schema, modules)
    const yearId = await t.run(async (ctx) =>
      ctx.db.insert('academicYears', {
        name: '2024',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: true,
        isDeleted: false,
      }),
    )

    const result = await t.run(async (ctx) =>
      requireActiveAcademicYear(ctx, 'SOME_ERROR_CODE'),
    )
    expect(result).toBe(yearId)

    const viaGetter = await t.run(async (ctx) => getActiveAcademicYear(ctx))
    expect(viaGetter).toBe(yearId)
  })

  test('throws the caller-supplied error code when no active year exists', async () => {
    const t = authedConvexTest(schema, modules)
    await t.run(async (ctx) =>
      ctx.db.insert('academicYears', {
        name: '2024',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: false,
        isDeleted: false,
      }),
    )

    await expect(
      t.run(async (ctx) =>
        requireActiveAcademicYear(ctx, 'CUSTOM_NO_ACTIVE_YEAR'),
      ),
    ).rejects.toThrow('CUSTOM_NO_ACTIVE_YEAR')

    const viaGetter = await t.run(async (ctx) => getActiveAcademicYear(ctx))
    expect(viaGetter).toBeNull()
  })
})

describe('authz functions', () => {
  test('assertBoardMemberOrAdmin allows admin without assignment', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await t.run(async (ctx) =>
      ctx.db.insert('catechists', {
        memberId: 'A1',
        fullName: 'A',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      }),
    )
    const yearId = await t.run(async (ctx) =>
      ctx.db.insert('academicYears', {
        name: '2024',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: false,
        isDeleted: false,
      }),
    )

    const result = await (
      await t.as(adminId)
    ).run(async (ctx) => assertBoardMemberOrAdmin(ctx, yearId))
    expect(result.role).toBe('admin')
  })

  test('assertBoardMemberOrAdmin throws for non-board user', async () => {
    const t = authedConvexTest(schema, modules)
    const userId = await t.run(async (ctx) =>
      ctx.db.insert('catechists', {
        memberId: 'U1',
        fullName: 'U',
        role: 'user',
        isActive: true,
        isDeleted: false,
      }),
    )
    const yearId = await t.run(async (ctx) =>
      ctx.db.insert('academicYears', {
        name: '2024',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: false,
        isDeleted: false,
      }),
    )

    await expect(
      (await t.as(userId)).run(async (ctx) =>
        assertBoardMemberOrAdmin(ctx, yearId),
      ),
    ).rejects.toThrow(AUTHZ_ERRORS.NOT_BOARD_MEMBER)
  })

  test('assertBoardMemberOrAdmin allows user with board assignment', async () => {
    const t = authedConvexTest(schema, modules)
    const userId = await t.run(async (ctx) =>
      ctx.db.insert('catechists', {
        memberId: 'U2',
        fullName: 'U2',
        role: 'user',
        isActive: true,
        isDeleted: false,
      }),
    )
    const yearId = await t.run(async (ctx) =>
      ctx.db.insert('academicYears', {
        name: '2024',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: false,
        isDeleted: false,
      }),
    )
    await t.run(async (ctx) =>
      ctx.db.insert('academicYearAssignments', {
        academicYearId: yearId,
        catechistId: userId,
        assignmentType: 'board_member',
        isDeleted: false,
      }),
    )

    const result = await (
      await t.as(userId)
    ).run(async (ctx) => assertBoardMemberOrAdmin(ctx, yearId))
    expect(result._id).toBe(userId)
  })

  test('assertBranchHeadOrAbove allows admin', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await t.run(async (ctx) =>
      ctx.db.insert('catechists', {
        memberId: 'A1',
        fullName: 'A',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      }),
    )
    const yearId = await t.run(async (ctx) =>
      ctx.db.insert('academicYears', {
        name: '2024',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: false,
        isDeleted: false,
      }),
    )
    const branchId = await t.run(async (ctx) =>
      ctx.db.insert('branches', { name: 'B1', isDeleted: false, sortOrder: 1 }),
    )

    const result = await (
      await t.as(adminId)
    ).run(async (ctx) => assertBranchHeadOrAbove(ctx, yearId, branchId))
    expect(result.role).toBe('admin')
  })

  test('assertBranchHeadOrAbove allows board member', async () => {
    const t = authedConvexTest(schema, modules)
    const userId = await t.run(async (ctx) =>
      ctx.db.insert('catechists', {
        memberId: 'U2',
        fullName: 'U2',
        role: 'user',
        isActive: true,
        isDeleted: false,
      }),
    )
    const yearId = await t.run(async (ctx) =>
      ctx.db.insert('academicYears', {
        name: '2024',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: false,
        isDeleted: false,
      }),
    )
    const branchId = await t.run(async (ctx) =>
      ctx.db.insert('branches', { name: 'B1', isDeleted: false, sortOrder: 1 }),
    )
    await t.run(async (ctx) =>
      ctx.db.insert('academicYearAssignments', {
        academicYearId: yearId,
        catechistId: userId,
        assignmentType: 'board_member',
        isDeleted: false,
      }),
    )

    const result = await (
      await t.as(userId)
    ).run(async (ctx) => assertBranchHeadOrAbove(ctx, yearId, branchId))
    expect(result._id).toBe(userId)
  })

  test('assertBranchHeadOrAbove allows branch head', async () => {
    const t = authedConvexTest(schema, modules)
    const userId = await t.run(async (ctx) =>
      ctx.db.insert('catechists', {
        memberId: 'U3',
        fullName: 'U3',
        role: 'user',
        isActive: true,
        isDeleted: false,
      }),
    )
    const yearId = await t.run(async (ctx) =>
      ctx.db.insert('academicYears', {
        name: '2024',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: false,
        isDeleted: false,
      }),
    )
    const branchId = await t.run(async (ctx) =>
      ctx.db.insert('branches', { name: 'B1', isDeleted: false, sortOrder: 1 }),
    )
    await t.run(async (ctx) =>
      ctx.db.insert('branchAssignments', {
        academicYearId: yearId,
        branchId,
        catechistId: userId,
        isDeleted: false,
      }),
    )

    const result = await (
      await t.as(userId)
    ).run(async (ctx) => assertBranchHeadOrAbove(ctx, yearId, branchId))
    expect(result._id).toBe(userId)
  })

  test('assertBranchHeadOrAbove throws for regular user', async () => {
    const t = authedConvexTest(schema, modules)
    const userId = await t.run(async (ctx) =>
      ctx.db.insert('catechists', {
        memberId: 'U3',
        fullName: 'U3',
        role: 'user',
        isActive: true,
        isDeleted: false,
      }),
    )
    const yearId = await t.run(async (ctx) =>
      ctx.db.insert('academicYears', {
        name: '2024',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: false,
        isDeleted: false,
      }),
    )
    const branchId = await t.run(async (ctx) =>
      ctx.db.insert('branches', { name: 'B1', isDeleted: false, sortOrder: 1 }),
    )

    await expect(
      (await t.as(userId)).run(async (ctx) =>
        assertBranchHeadOrAbove(ctx, yearId, branchId),
      ),
    ).rejects.toThrow(AUTHZ_ERRORS.NOT_BRANCH_HEAD_OR_ABOVE)
  })

  test('assertClassCatechistOrAbove allows class catechist', async () => {
    const t = authedConvexTest(schema, modules)
    const userId = await t.run(async (ctx) =>
      ctx.db.insert('catechists', {
        memberId: 'A1',
        fullName: 'A',
        role: 'user',
        isActive: true,
        isDeleted: false,
      }),
    )
    const yearId = await t.run(async (ctx) =>
      ctx.db.insert('academicYears', {
        name: '2024',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: false,
        isDeleted: false,
      }),
    )
    const branchId = await t.run(async (ctx) =>
      ctx.db.insert('branches', { name: 'B1', isDeleted: false, sortOrder: 1 }),
    )
    const classId = await t.run(async (ctx) =>
      ctx.db.insert('classes', { branchId, name: 'C1', isDeleted: false }),
    )
    const classYearId = await t.run(async (ctx) =>
      ctx.db.insert('classYears', {
        academicYearId: yearId,
        classId,
        isDeleted: false,
      }),
    )
    await t.run(async (ctx) =>
      ctx.db.insert('classCatechists', {
        academicYearId: yearId,
        classYearId,
        catechistId: userId,
        role: 'homeroom',
        isDeleted: false,
      }),
    )

    const result = await (
      await t.as(userId)
    ).run(async (ctx) => assertClassCatechistOrAbove(ctx, yearId, classYearId))
    expect(result._id).toBe(userId)
  })

  test('assertClassCatechistOrAbove throws if class deleted', async () => {
    const t = authedConvexTest(schema, modules)
    const userId = await t.run(async (ctx) =>
      ctx.db.insert('catechists', {
        memberId: 'A1',
        fullName: 'A',
        role: 'user',
        isActive: true,
        isDeleted: false,
      }),
    )
    const yearId = await t.run(async (ctx) =>
      ctx.db.insert('academicYears', {
        name: '2024',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: false,
        isDeleted: false,
      }),
    )
    const branchId = await t.run(async (ctx) =>
      ctx.db.insert('branches', { name: 'B1', isDeleted: false, sortOrder: 1 }),
    )
    const classId = await t.run(async (ctx) =>
      ctx.db.insert('classes', { branchId, name: 'C1', isDeleted: true }),
    )
    const classYearId = await t.run(async (ctx) =>
      ctx.db.insert('classYears', {
        academicYearId: yearId,
        classId,
        isDeleted: false,
      }),
    )

    await expect(
      (await t.as(userId)).run(async (ctx) =>
        assertClassCatechistOrAbove(ctx, yearId, classYearId),
      ),
    ).rejects.toThrow(AUTHZ_ERRORS.CLASS_NOT_FOUND)
  })

  test('getEffectivePermissions returns correctly', async () => {
    const t = authedConvexTest(schema, modules)
    const userId = await t.run(async (ctx) =>
      ctx.db.insert('catechists', {
        memberId: 'A1',
        fullName: 'A',
        role: 'user',
        isActive: true,
        isDeleted: false,
      }),
    )
    const yearId = await t.run(async (ctx) =>
      ctx.db.insert('academicYears', {
        name: '2024',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: false,
        isDeleted: false,
      }),
    )
    const branchId = await t.run(async (ctx) =>
      ctx.db.insert('branches', { name: 'B1', isDeleted: false, sortOrder: 1 }),
    )
    const classId = await t.run(async (ctx) =>
      ctx.db.insert('classes', { branchId, name: 'C1', isDeleted: false }),
    )
    const classYearId = await t.run(async (ctx) =>
      ctx.db.insert('classYears', {
        academicYearId: yearId,
        classId,
        isDeleted: false,
      }),
    )

    await t.run(async (ctx) =>
      ctx.db.insert('academicYearAssignments', {
        academicYearId: yearId,
        catechistId: userId,
        assignmentType: 'board_member',
        isDeleted: false,
      }),
    )
    await t.run(async (ctx) =>
      ctx.db.insert('branchAssignments', {
        academicYearId: yearId,
        branchId,
        catechistId: userId,
        isDeleted: false,
      }),
    )
    await t.run(async (ctx) =>
      ctx.db.insert('classCatechists', {
        academicYearId: yearId,
        classYearId,
        catechistId: userId,
        role: 'homeroom',
        isDeleted: false,
      }),
    )

    const perms = await (
      await t.as(userId)
    ).run(async (ctx) => getEffectivePermissions(ctx, yearId))
    expect(perms.isAdmin).toBe(false)
    expect(perms.isBoardMember).toBe(true)
    expect(perms.branchHeadOf).toContain(branchId)
    expect(perms.classCatechistOf).toContain(classYearId)

    const permsNoYear = await (
      await t.as(userId)
    ).run(async (ctx) => getEffectivePermissions(ctx))
    expect(permsNoYear.isAdmin).toBe(false)
    expect(permsNoYear.isBoardMember).toBe(false)
  })

  describe('assertValidStudent', () => {
    test('accepts a valid active student', async () => {
      const t = authedConvexTest(schema, modules)
      const studentId = await t.run(async (ctx) =>
        ctx.db.insert('students', {
          studentCode: 'HS001',
          fullName: 'Student One',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        }),
      )

      const result = await (
        await t.as(studentId)
      ).run(async (ctx) => assertValidStudent(ctx))
      expect(result._id).toBe(studentId)
    })

    test('rejects a missing student', async () => {
      const t = authedConvexTest(schema, modules)
      const studentId = await t.run(async (ctx) => {
        const id = await ctx.db.insert('students', {
          studentCode: 'HS002',
          fullName: 'Student Two',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        })
        await ctx.db.delete('students', id)
        return id
      })

      await expect(
        (await t.as(studentId)).run(async (ctx) => assertValidStudent(ctx)),
      ).rejects.toThrow(AUTHZ_ERRORS.STUDENT_NOT_FOUND)
    })

    test('rejects a soft-deleted student', async () => {
      const t = authedConvexTest(schema, modules)
      const studentId = await t.run(async (ctx) =>
        ctx.db.insert('students', {
          studentCode: 'HS003',
          fullName: 'Student Three',
          isActive: true,
          isDeleted: true,
          createdAt: Date.now(),
        }),
      )

      await expect(
        (await t.as(studentId)).run(async (ctx) => assertValidStudent(ctx)),
      ).rejects.toThrow(AUTHZ_ERRORS.ACCOUNT_DELETED)
    })

    test('rejects an inactive student', async () => {
      const t = authedConvexTest(schema, modules)
      const studentId = await t.run(async (ctx) =>
        ctx.db.insert('students', {
          studentCode: 'HS004',
          fullName: 'Student Four',
          isActive: false,
          isDeleted: false,
          createdAt: Date.now(),
        }),
      )

      await expect(
        (await t.as(studentId)).run(async (ctx) => assertValidStudent(ctx)),
      ).rejects.toThrow(AUTHZ_ERRORS.ACCOUNT_INACTIVE)
    })
  })

  describe('checkEditStudentPermission', () => {
    test('allows admin to edit any student', async () => {
      const t = authedConvexTest(schema, modules)
      const adminId = await t.run(async (ctx) =>
        ctx.db.insert('catechists', {
          memberId: 'C1',
          fullName: 'Admin',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        }),
      )
      const studentId = await t.run(async (ctx) =>
        ctx.db.insert('students', {
          studentCode: 'HS001',
          fullName: 'Student One',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        }),
      )

      const allowed = await (
        await t.as(adminId)
      ).run(async (ctx) => checkEditStudentPermission(ctx, studentId))
      expect(allowed).toBe(true)
    })

    test('allows any catechist to edit floating student with no active enrollments', async () => {
      const t = authedConvexTest(schema, modules)
      const userId = await t.run(async (ctx) =>
        ctx.db.insert('catechists', {
          memberId: 'C2',
          fullName: 'Catechist',
          role: 'user',
          isActive: true,
          isDeleted: false,
        }),
      )
      const studentId = await t.run(async (ctx) =>
        ctx.db.insert('students', {
          studentCode: 'HS002',
          fullName: 'Student Two',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        }),
      )

      const allowed = await (
        await t.as(userId)
      ).run(async (ctx) => checkEditStudentPermission(ctx, studentId))
      expect(allowed).toBe(true)
    })

    test('allows class catechist to edit student in their class', async () => {
      const t = authedConvexTest(schema, modules)
      const userId = await t.run(async (ctx) =>
        ctx.db.insert('catechists', {
          memberId: 'C3',
          fullName: 'Teacher',
          role: 'user',
          isActive: true,
          isDeleted: false,
        }),
      )
      const yearId = await t.run(async (ctx) =>
        ctx.db.insert('academicYears', {
          name: '2024',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
          isDeleted: false,
        }),
      )
      const branchId = await t.run(async (ctx) =>
        ctx.db.insert('branches', {
          name: 'B1',
          isDeleted: false,
          sortOrder: 1,
        }),
      )
      const classId = await t.run(async (ctx) =>
        ctx.db.insert('classes', {
          name: 'Class 1',
          branchId,
          isDeleted: false,
        }),
      )
      const classYearId = await t.run(async (ctx) =>
        ctx.db.insert('classYears', {
          classId,
          academicYearId: yearId,
          isDeleted: false,
        }),
      )
      const studentId = await t.run(async (ctx) =>
        ctx.db.insert('students', {
          studentCode: 'HS003',
          fullName: 'Student Three',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        }),
      )

      await t.run(async (ctx) => {
        await ctx.db.insert('studentClasses', {
          studentId,
          classYearId,
          isPrimaryClass: true,
          enrolledDate: '2024-01-01',
          status: 'active',
          isDeleted: false,
        })
        await ctx.db.insert('classCatechists', {
          catechistId: userId,
          classYearId,
          academicYearId: yearId,
          role: 'co_teacher',
          isDeleted: false,
        })
      })

      const allowed = await (
        await t.as(userId)
      ).run(async (ctx) => checkEditStudentPermission(ctx, studentId))
      expect(allowed).toBe(true)
    })

    test('allows branch head to edit student in their branch', async () => {
      const t = authedConvexTest(schema, modules)
      const userId = await t.run(async (ctx) =>
        ctx.db.insert('catechists', {
          memberId: 'C-BH',
          fullName: 'Branch Head',
          role: 'user',
          isActive: true,
          isDeleted: false,
        }),
      )
      const yearId = await t.run(async (ctx) =>
        ctx.db.insert('academicYears', {
          name: '2024',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
          isDeleted: false,
        }),
      )
      const branchId = await t.run(async (ctx) =>
        ctx.db.insert('branches', {
          name: 'B1',
          isDeleted: false,
          sortOrder: 1,
        }),
      )
      const classId = await t.run(async (ctx) =>
        ctx.db.insert('classes', {
          name: 'Class 1',
          branchId,
          isDeleted: false,
        }),
      )
      const classYearId = await t.run(async (ctx) =>
        ctx.db.insert('classYears', {
          classId,
          academicYearId: yearId,
          isDeleted: false,
        }),
      )
      const studentId = await t.run(async (ctx) =>
        ctx.db.insert('students', {
          studentCode: 'HS-BH',
          fullName: 'Student Branch',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        }),
      )

      await t.run(async (ctx) => {
        await ctx.db.insert('studentClasses', {
          studentId,
          classYearId,
          isPrimaryClass: true,
          enrolledDate: '2024-01-01',
          status: 'active',
          isDeleted: false,
        })
        await ctx.db.insert('branchAssignments', {
          catechistId: userId,
          academicYearId: yearId,
          branchId,
          isDeleted: false,
        })
      })

      const allowed = await (
        await t.as(userId)
      ).run(async (ctx) => checkEditStudentPermission(ctx, studentId))
      expect(allowed).toBe(true)
    })

    test('denies non-floating student edit when no active academic year exists', async () => {
      const t = authedConvexTest(schema, modules)
      const userId = await t.run(async (ctx) =>
        ctx.db.insert('catechists', {
          memberId: 'C-NoActive',
          fullName: 'Teacher',
          role: 'user',
          isActive: true,
          isDeleted: false,
        }),
      )
      const yearId = await t.run(async (ctx) =>
        ctx.db.insert('academicYears', {
          name: '2024',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: false,
          isDeleted: false,
        }),
      )
      const branchId = await t.run(async (ctx) =>
        ctx.db.insert('branches', {
          name: 'B1',
          isDeleted: false,
          sortOrder: 1,
        }),
      )
      const classId = await t.run(async (ctx) =>
        ctx.db.insert('classes', {
          name: 'Class 1',
          branchId,
          isDeleted: false,
        }),
      )
      const classYearId = await t.run(async (ctx) =>
        ctx.db.insert('classYears', {
          classId,
          academicYearId: yearId,
          isDeleted: false,
        }),
      )
      const studentId = await t.run(async (ctx) =>
        ctx.db.insert('students', {
          studentCode: 'HS-NoActive',
          fullName: 'Student No Active',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        }),
      )

      await t.run(async (ctx) => {
        await ctx.db.insert('studentClasses', {
          studentId,
          classYearId,
          isPrimaryClass: true,
          enrolledDate: '2024-01-01',
          status: 'active',
          isDeleted: false,
        })
      })

      const allowed = await (
        await t.as(userId)
      ).run(async (ctx) => checkEditStudentPermission(ctx, studentId))
      expect(allowed).toBe(false)
    })

    test('denies catechist not assigned to class or branch when student has active enrollment', async () => {
      const t = authedConvexTest(schema, modules)
      const userId = await t.run(async (ctx) =>
        ctx.db.insert('catechists', {
          memberId: 'C4',
          fullName: 'Other Teacher',
          role: 'user',
          isActive: true,
          isDeleted: false,
        }),
      )
      const yearId = await t.run(async (ctx) =>
        ctx.db.insert('academicYears', {
          name: '2024',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
          isDeleted: false,
        }),
      )
      const branchId = await t.run(async (ctx) =>
        ctx.db.insert('branches', {
          name: 'B1',
          isDeleted: false,
          sortOrder: 1,
        }),
      )
      const classId = await t.run(async (ctx) =>
        ctx.db.insert('classes', {
          name: 'Class 1',
          branchId,
          isDeleted: false,
        }),
      )
      const classYearId = await t.run(async (ctx) =>
        ctx.db.insert('classYears', {
          classId,
          academicYearId: yearId,
          isDeleted: false,
        }),
      )
      const studentId = await t.run(async (ctx) =>
        ctx.db.insert('students', {
          studentCode: 'HS004',
          fullName: 'Student Four',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        }),
      )

      await t.run(async (ctx) => {
        await ctx.db.insert('studentClasses', {
          studentId,
          classYearId,
          isPrimaryClass: true,
          enrolledDate: '2024-01-01',
          status: 'active',
          isDeleted: false,
        })
      })

      const allowed = await (
        await t.as(userId)
      ).run(async (ctx) => checkEditStudentPermission(ctx, studentId))
      expect(allowed).toBe(false)

      await expect(
        (await t.as(userId)).run(async (ctx) =>
          assertEditStudentPermission(ctx, studentId),
        ),
      ).rejects.toThrow(AUTHZ_ERRORS.CANNOT_EDIT_STUDENT)
    })

    test('denies catechist from editing student when enrollment belongs to an inactive academic year', async () => {
      const t = authedConvexTest(schema, modules)
      const userId = await t.run(async (ctx) =>
        ctx.db.insert('catechists', {
          memberId: 'C5-inactive',
          fullName: 'Past Teacher',
          role: 'user',
          isActive: true,
          isDeleted: false,
        }),
      )
      const inactiveYearId = await t.run(async (ctx) =>
        ctx.db.insert('academicYears', {
          name: '2023',
          startDate: '2023-01-01',
          endDate: '2023-12-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: false,
          isDeleted: false,
        }),
      )
      // active year exists in the system
      await t.run(async (ctx) =>
        ctx.db.insert('academicYears', {
          name: '2024',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
          isDeleted: false,
        }),
      )
      const branchId = await t.run(async (ctx) =>
        ctx.db.insert('branches', {
          name: 'B1',
          isDeleted: false,
          sortOrder: 1,
        }),
      )
      const classId = await t.run(async (ctx) =>
        ctx.db.insert('classes', {
          name: 'Class 1',
          branchId,
          isDeleted: false,
        }),
      )
      const classYearId = await t.run(async (ctx) =>
        ctx.db.insert('classYears', {
          classId,
          academicYearId: inactiveYearId,
          isDeleted: false,
        }),
      )
      const studentId = await t.run(async (ctx) =>
        ctx.db.insert('students', {
          studentCode: 'HS005',
          fullName: 'Student Five',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        }),
      )

      await t.run(async (ctx) => {
        await ctx.db.insert('studentClasses', {
          studentId,
          classYearId,
          isPrimaryClass: true,
          enrolledDate: '2023-01-01',
          status: 'active',
          isDeleted: false,
        })
        await ctx.db.insert('classCatechists', {
          catechistId: userId,
          classYearId,
          academicYearId: inactiveYearId,
          role: 'homeroom',
          isDeleted: false,
        })
      })

      const allowed = await (
        await t.as(userId)
      ).run(async (ctx) => checkEditStudentPermission(ctx, studentId))
      expect(allowed).toBe(false)
    })

    test('allows class catechist when a soft-deleted classCatechists row precedes a valid one for the same key', async () => {
      const t = authedConvexTest(schema, modules)
      const userId = await t.run(async (ctx) =>
        ctx.db.insert('catechists', {
          memberId: 'C-Dup1',
          fullName: 'Rehired Teacher',
          role: 'user',
          isActive: true,
          isDeleted: false,
        }),
      )
      const yearId = await t.run(async (ctx) =>
        ctx.db.insert('academicYears', {
          name: '2024',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
          isDeleted: false,
        }),
      )
      const branchId = await t.run(async (ctx) =>
        ctx.db.insert('branches', {
          name: 'B1',
          isDeleted: false,
          sortOrder: 1,
        }),
      )
      const classId = await t.run(async (ctx) =>
        ctx.db.insert('classes', {
          name: 'Class 1',
          branchId,
          isDeleted: false,
        }),
      )
      const classYearId = await t.run(async (ctx) =>
        ctx.db.insert('classYears', {
          classId,
          academicYearId: yearId,
          isDeleted: false,
        }),
      )
      const studentId = await t.run(async (ctx) =>
        ctx.db.insert('students', {
          studentCode: 'HS-Dup1',
          fullName: 'Student Dup1',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        }),
      )

      await t.run(async (ctx) => {
        await ctx.db.insert('studentClasses', {
          studentId,
          classYearId,
          isPrimaryClass: true,
          enrolledDate: '2024-01-01',
          status: 'active',
          isDeleted: false,
        })
        // Old removed assignment (inserted first, so index/insertion order
        // would return this row first if `.first()` were used).
        await ctx.db.insert('classCatechists', {
          catechistId: userId,
          classYearId,
          academicYearId: yearId,
          role: 'co_teacher',
          isDeleted: true,
        })
        // Re-added valid assignment for the same (catechistId, classYearId) key.
        await ctx.db.insert('classCatechists', {
          catechistId: userId,
          classYearId,
          academicYearId: yearId,
          role: 'co_teacher',
          isDeleted: false,
        })
      })

      const allowed = await (
        await t.as(userId)
      ).run(async (ctx) => checkEditStudentPermission(ctx, studentId))
      expect(allowed).toBe(true)
    })

    test('allows branch head when a soft-deleted branchAssignments row precedes a valid one for the same key', async () => {
      const t = authedConvexTest(schema, modules)
      const userId = await t.run(async (ctx) =>
        ctx.db.insert('catechists', {
          memberId: 'C-Dup2',
          fullName: 'Rehired Branch Head',
          role: 'user',
          isActive: true,
          isDeleted: false,
        }),
      )
      const yearId = await t.run(async (ctx) =>
        ctx.db.insert('academicYears', {
          name: '2024',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
          isDeleted: false,
        }),
      )
      const branchId = await t.run(async (ctx) =>
        ctx.db.insert('branches', {
          name: 'B1',
          isDeleted: false,
          sortOrder: 1,
        }),
      )
      const classId = await t.run(async (ctx) =>
        ctx.db.insert('classes', {
          name: 'Class 1',
          branchId,
          isDeleted: false,
        }),
      )
      const classYearId = await t.run(async (ctx) =>
        ctx.db.insert('classYears', {
          classId,
          academicYearId: yearId,
          isDeleted: false,
        }),
      )
      const studentId = await t.run(async (ctx) =>
        ctx.db.insert('students', {
          studentCode: 'HS-Dup2',
          fullName: 'Student Dup2',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        }),
      )

      await t.run(async (ctx) => {
        await ctx.db.insert('studentClasses', {
          studentId,
          classYearId,
          isPrimaryClass: true,
          enrolledDate: '2024-01-01',
          status: 'active',
          isDeleted: false,
        })
        await ctx.db.insert('branchAssignments', {
          catechistId: userId,
          academicYearId: yearId,
          branchId,
          isDeleted: true,
        })
        await ctx.db.insert('branchAssignments', {
          catechistId: userId,
          academicYearId: yearId,
          branchId,
          isDeleted: false,
        })
      })

      const allowed = await (
        await t.as(userId)
      ).run(async (ctx) => checkEditStudentPermission(ctx, studentId))
      expect(allowed).toBe(true)
    })

    test('allows board member when a soft-deleted academicYearAssignments row precedes a valid one for the same key', async () => {
      const t = authedConvexTest(schema, modules)
      const userId = await t.run(async (ctx) =>
        ctx.db.insert('catechists', {
          memberId: 'C-Dup3',
          fullName: 'Rehired Board Member',
          role: 'user',
          isActive: true,
          isDeleted: false,
        }),
      )
      const yearId = await t.run(async (ctx) =>
        ctx.db.insert('academicYears', {
          name: '2024',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
          isDeleted: false,
        }),
      )
      const studentId = await t.run(async (ctx) =>
        ctx.db.insert('students', {
          studentCode: 'HS-Dup3',
          fullName: 'Student Dup3',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        }),
      )

      await t.run(async (ctx) => {
        await ctx.db.insert('academicYearAssignments', {
          academicYearId: yearId,
          catechistId: userId,
          assignmentType: 'board_member',
          isDeleted: true,
        })
        await ctx.db.insert('academicYearAssignments', {
          academicYearId: yearId,
          catechistId: userId,
          assignmentType: 'board_member',
          isDeleted: false,
        })
      })

      const allowed = await (
        await t.as(userId)
      ).run(async (ctx) => checkEditStudentPermission(ctx, studentId))
      expect(allowed).toBe(true)
    })
  })

  describe('checkStudentSensitiveInfoPermission', () => {
    test('allows class catechist when a soft-deleted classCatechists row precedes a valid one for the same key', async () => {
      const t = authedConvexTest(schema, modules)
      const userId = await t.run(async (ctx) =>
        ctx.db.insert('catechists', {
          memberId: 'C-Dup4',
          fullName: 'Rehired Teacher',
          role: 'user',
          isActive: true,
          isDeleted: false,
        }),
      )
      const yearId = await t.run(async (ctx) =>
        ctx.db.insert('academicYears', {
          name: '2024',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
          isDeleted: false,
        }),
      )
      const branchId = await t.run(async (ctx) =>
        ctx.db.insert('branches', {
          name: 'B1',
          isDeleted: false,
          sortOrder: 1,
        }),
      )
      const classId = await t.run(async (ctx) =>
        ctx.db.insert('classes', {
          name: 'Class 1',
          branchId,
          isDeleted: false,
        }),
      )
      const classYearId = await t.run(async (ctx) =>
        ctx.db.insert('classYears', {
          classId,
          academicYearId: yearId,
          isDeleted: false,
        }),
      )
      const studentId = await t.run(async (ctx) =>
        ctx.db.insert('students', {
          studentCode: 'HS-Dup4',
          fullName: 'Student Dup4',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        }),
      )

      await t.run(async (ctx) => {
        await ctx.db.insert('studentClasses', {
          studentId,
          classYearId,
          isPrimaryClass: true,
          enrolledDate: '2024-01-01',
          status: 'active',
          isDeleted: false,
        })
        await ctx.db.insert('classCatechists', {
          catechistId: userId,
          classYearId,
          academicYearId: yearId,
          role: 'co_teacher',
          isDeleted: true,
        })
        await ctx.db.insert('classCatechists', {
          catechistId: userId,
          classYearId,
          academicYearId: yearId,
          role: 'co_teacher',
          isDeleted: false,
        })
      })

      const allowed = await (
        await t.as(userId)
      ).run(async (ctx) => checkStudentSensitiveInfoPermission(ctx, studentId))
      expect(allowed).toBe(true)
    })

    test('denies when only a soft-deleted classCatechists row exists', async () => {
      const t = authedConvexTest(schema, modules)
      const userId = await t.run(async (ctx) =>
        ctx.db.insert('catechists', {
          memberId: 'C-Dup5',
          fullName: 'Removed Teacher',
          role: 'user',
          isActive: true,
          isDeleted: false,
        }),
      )
      const yearId = await t.run(async (ctx) =>
        ctx.db.insert('academicYears', {
          name: '2024',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
          isDeleted: false,
        }),
      )
      const branchId = await t.run(async (ctx) =>
        ctx.db.insert('branches', {
          name: 'B1',
          isDeleted: false,
          sortOrder: 1,
        }),
      )
      const classId = await t.run(async (ctx) =>
        ctx.db.insert('classes', {
          name: 'Class 1',
          branchId,
          isDeleted: false,
        }),
      )
      const classYearId = await t.run(async (ctx) =>
        ctx.db.insert('classYears', {
          classId,
          academicYearId: yearId,
          isDeleted: false,
        }),
      )
      const studentId = await t.run(async (ctx) =>
        ctx.db.insert('students', {
          studentCode: 'HS-Dup5',
          fullName: 'Student Dup5',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        }),
      )

      await t.run(async (ctx) => {
        await ctx.db.insert('studentClasses', {
          studentId,
          classYearId,
          isPrimaryClass: true,
          enrolledDate: '2024-01-01',
          status: 'active',
          isDeleted: false,
        })
        await ctx.db.insert('classCatechists', {
          catechistId: userId,
          classYearId,
          academicYearId: yearId,
          role: 'co_teacher',
          isDeleted: true,
        })
      })

      const allowed = await (
        await t.as(userId)
      ).run(async (ctx) => checkStudentSensitiveInfoPermission(ctx, studentId))
      expect(allowed).toBe(false)
    })
  })

  describe('assertEditGuardianPermission', () => {
    test('allows managing guardian with no student links', async () => {
      const t = authedConvexTest(schema, modules)
      const userId = await t.run(async (ctx) =>
        ctx.db.insert('catechists', {
          memberId: 'C5',
          fullName: 'Teacher',
          role: 'user',
          isActive: true,
          isDeleted: false,
        }),
      )
      const guardianId = await t.run(async (ctx) =>
        ctx.db.insert('guardians', {
          fullName: 'Guardian One',
          isDeleted: false,
        }),
      )

      await expect(
        (await t.as(userId)).run(async (ctx) =>
          assertEditGuardianPermission(ctx, guardianId),
        ),
      ).resolves.toBeNull()
    })

    test('denies managing guardian if catechist cannot edit linked student', async () => {
      const t = authedConvexTest(schema, modules)
      const userId = await t.run(async (ctx) =>
        ctx.db.insert('catechists', {
          memberId: 'C6',
          fullName: 'Teacher',
          role: 'user',
          isActive: true,
          isDeleted: false,
        }),
      )
      const yearId = await t.run(async (ctx) =>
        ctx.db.insert('academicYears', {
          name: '2024',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
          isDeleted: false,
        }),
      )
      const branchId = await t.run(async (ctx) =>
        ctx.db.insert('branches', {
          name: 'B1',
          isDeleted: false,
          sortOrder: 1,
        }),
      )
      const classId = await t.run(async (ctx) =>
        ctx.db.insert('classes', {
          name: 'Class 1',
          branchId,
          isDeleted: false,
        }),
      )
      const classYearId = await t.run(async (ctx) =>
        ctx.db.insert('classYears', {
          classId,
          academicYearId: yearId,
          isDeleted: false,
        }),
      )
      const studentId = await t.run(async (ctx) =>
        ctx.db.insert('students', {
          studentCode: 'HS005',
          fullName: 'Student Five',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        }),
      )
      const guardianId = await t.run(async (ctx) =>
        ctx.db.insert('guardians', {
          fullName: 'Guardian Two',
          isDeleted: false,
        }),
      )

      await t.run(async (ctx) => {
        await ctx.db.insert('studentClasses', {
          studentId,
          classYearId,
          isPrimaryClass: true,
          enrolledDate: '2024-01-01',
          status: 'active',
          isDeleted: false,
        })
        await ctx.db.insert('studentGuardians', {
          studentId,
          guardianId,
          relationship: 'Father',
          contactPriority: 1,
          isDeleted: false,
        })
      })

      await expect(
        (await t.as(userId)).run(async (ctx) =>
          assertEditGuardianPermission(ctx, guardianId),
        ),
      ).rejects.toThrow(AUTHZ_ERRORS.CANNOT_MANAGE_GUARDIAN)
    })
  })
})
