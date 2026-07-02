/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import schema from '../schema'
import {
  assertBoardMemberOrAdmin,
  assertBranchHeadOrAbove,
  assertClassCatechistOrAbove,
  getEffectivePermissions,
} from './authz'

const modules = import.meta.glob('../**/*.ts')

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
    ).rejects.toThrow('board member')
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
    ).rejects.toThrow('branch head')
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
    ).rejects.toThrow('Class not found')
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
})
