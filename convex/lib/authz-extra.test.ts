/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
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
  getActiveAcademicYear,
  getEffectivePermissions,
  requireActiveAcademicYear,
} from './authz'

const modules = import.meta.glob('../**/*.ts')

describe('requireActiveAcademicYear', () => {
  test('returns the active year id when one exists', async () => {
    const t = convexTest(schema, modules)
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
    const t = convexTest(schema, modules)
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
    const t = convexTest(schema, modules)
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

    const result = await t.run(async (ctx) =>
      assertBoardMemberOrAdmin(ctx, adminId, yearId),
    )
    expect(result.role).toBe('admin')
  })

  test('assertBoardMemberOrAdmin throws for non-board user', async () => {
    const t = convexTest(schema, modules)
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
      t.run(async (ctx) => assertBoardMemberOrAdmin(ctx, userId, yearId)),
    ).rejects.toThrow(AUTHZ_ERRORS.NOT_BOARD_MEMBER)
  })

  test('assertBoardMemberOrAdmin allows user with board assignment', async () => {
    const t = convexTest(schema, modules)
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

    const result = await t.run(async (ctx) =>
      assertBoardMemberOrAdmin(ctx, userId, yearId),
    )
    expect(result._id).toBe(userId)
  })

  test('assertBranchHeadOrAbove allows admin', async () => {
    const t = convexTest(schema, modules)
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

    const result = await t.run(async (ctx) =>
      assertBranchHeadOrAbove(ctx, adminId, yearId, branchId),
    )
    expect(result.role).toBe('admin')
  })

  test('assertBranchHeadOrAbove allows board member', async () => {
    const t = convexTest(schema, modules)
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

    const result = await t.run(async (ctx) =>
      assertBranchHeadOrAbove(ctx, userId, yearId, branchId),
    )
    expect(result._id).toBe(userId)
  })

  test('assertBranchHeadOrAbove allows branch head', async () => {
    const t = convexTest(schema, modules)
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

    const result = await t.run(async (ctx) =>
      assertBranchHeadOrAbove(ctx, userId, yearId, branchId),
    )
    expect(result._id).toBe(userId)
  })

  test('assertBranchHeadOrAbove throws for regular user', async () => {
    const t = convexTest(schema, modules)
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
      t.run(async (ctx) =>
        assertBranchHeadOrAbove(ctx, userId, yearId, branchId),
      ),
    ).rejects.toThrow(AUTHZ_ERRORS.NOT_BRANCH_HEAD_OR_ABOVE)
  })

  test('assertClassCatechistOrAbove allows class catechist', async () => {
    const t = convexTest(schema, modules)
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

    const result = await t.run(async (ctx) =>
      assertClassCatechistOrAbove(ctx, userId, yearId, classYearId),
    )
    expect(result._id).toBe(userId)
  })

  test('assertClassCatechistOrAbove throws if class deleted', async () => {
    const t = convexTest(schema, modules)
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
      t.run(async (ctx) =>
        assertClassCatechistOrAbove(ctx, userId, yearId, classYearId),
      ),
    ).rejects.toThrow(AUTHZ_ERRORS.CLASS_NOT_FOUND)
  })

  test('getEffectivePermissions returns correctly', async () => {
    const t = convexTest(schema, modules)
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

    const perms = await t.run(async (ctx) =>
      getEffectivePermissions(ctx, userId, yearId),
    )
    expect(perms.isAdmin).toBe(false)
    expect(perms.isBoardMember).toBe(true)
    expect(perms.branchHeadOf).toContain(branchId)
    expect(perms.classCatechistOf).toContain(classYearId)

    const permsNoYear = await t.run(async (ctx) =>
      getEffectivePermissions(ctx, userId),
    )
    expect(permsNoYear.isAdmin).toBe(false)
    expect(permsNoYear.isBoardMember).toBe(false)
  })

  describe('assertValidStudent', () => {
    test('accepts a valid active student', async () => {
      const t = convexTest(schema, modules)
      const studentId = await t.run(async (ctx) =>
        ctx.db.insert('students', {
          studentCode: 'HS001',
          fullName: 'Student One',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        }),
      )

      const result = await t.run(async (ctx) =>
        assertValidStudent(ctx, studentId),
      )
      expect(result._id).toBe(studentId)
    })

    test('rejects a missing student', async () => {
      const t = convexTest(schema, modules)
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
        t.run(async (ctx) => assertValidStudent(ctx, studentId)),
      ).rejects.toThrow(AUTHZ_ERRORS.STUDENT_NOT_FOUND)
    })

    test('rejects a soft-deleted student', async () => {
      const t = convexTest(schema, modules)
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
        t.run(async (ctx) => assertValidStudent(ctx, studentId)),
      ).rejects.toThrow(AUTHZ_ERRORS.ACCOUNT_DELETED)
    })

    test('rejects an inactive student', async () => {
      const t = convexTest(schema, modules)
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
        t.run(async (ctx) => assertValidStudent(ctx, studentId)),
      ).rejects.toThrow(AUTHZ_ERRORS.ACCOUNT_INACTIVE)
    })
  })

  describe('checkEditStudentPermission', () => {
    test('allows admin to edit any student', async () => {
      const t = convexTest(schema, modules)
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

      const allowed = await t.run(async (ctx) =>
        checkEditStudentPermission(ctx, adminId, studentId),
      )
      expect(allowed).toBe(true)
    })

    test('allows any catechist to edit floating student with no active enrollments', async () => {
      const t = convexTest(schema, modules)
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

      const allowed = await t.run(async (ctx) =>
        checkEditStudentPermission(ctx, userId, studentId),
      )
      expect(allowed).toBe(true)
    })

    test('allows class catechist to edit student in their class', async () => {
      const t = convexTest(schema, modules)
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

      const allowed = await t.run(async (ctx) =>
        checkEditStudentPermission(ctx, userId, studentId),
      )
      expect(allowed).toBe(true)
    })

    test('denies catechist not assigned to class or branch when student has active enrollment', async () => {
      const t = convexTest(schema, modules)
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

      const allowed = await t.run(async (ctx) =>
        checkEditStudentPermission(ctx, userId, studentId),
      )
      expect(allowed).toBe(false)

      await expect(
        t.run(async (ctx) =>
          assertEditStudentPermission(ctx, userId, studentId),
        ),
      ).rejects.toThrow(AUTHZ_ERRORS.CANNOT_EDIT_STUDENT)
    })
  })

  describe('assertEditGuardianPermission', () => {
    test('allows managing guardian with no student links', async () => {
      const t = convexTest(schema, modules)
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
        t.run(async (ctx) =>
          assertEditGuardianPermission(ctx, userId, guardianId),
        ),
      ).resolves.toBeNull()
    })

    test('denies managing guardian if catechist cannot edit linked student', async () => {
      const t = convexTest(schema, modules)
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
        t.run(async (ctx) =>
          assertEditGuardianPermission(ctx, userId, guardianId),
        ),
      ).rejects.toThrow(AUTHZ_ERRORS.CANNOT_MANAGE_GUARDIAN)
    })
  })
})
