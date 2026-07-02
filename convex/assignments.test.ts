/// <reference types="vite/client" />

/* eslint-disable no-shadow */

import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

// ─── Shared seed helpers ──────────────────────────────────────────────────────

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
  opts: { isActive?: boolean; isDeleted?: boolean } = {},
): Promise<Id<'catechists'>> {
  return ctx.db.insert('catechists', {
    memberId,
    fullName,
    role: 'user',
    isActive: opts.isActive ?? true,
    isDeleted: opts.isDeleted ?? false,
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

function seedInactiveYear(
  ctx: any,
  name = '2023-2024',
): Promise<Id<'academicYears'>> {
  return ctx.db.insert('academicYears', {
    name,
    startDate: '2023-09-01',
    endDate: '2024-05-31',
    timezone: 'Asia/Ho_Chi_Minh',
    isActive: false,
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
): Promise<Id<'classYears'>> {
  return ctx.db.insert('classYears', {
    classId,
    academicYearId,
    isDeleted: false,
  })
}

function makeBoardMember(
  ctx: any,
  catechistId: Id<'catechists'>,
  academicYearId: Id<'academicYears'>,
): Promise<Id<'academicYearAssignments'>> {
  return ctx.db.insert('academicYearAssignments', {
    academicYearId,
    catechistId,
    assignmentType: 'board_member',
    isDeleted: false,
  })
}

// ─── listYearAssignments ──────────────────────────────────────────────────────

describe('listYearAssignments', () => {
  test('returns aggregated data for an active academic year', async () => {
    const t = convexTest(schema, modules)

    const { requesterId, yearId, catechistId, branchId, classYearId } =
      await t.run(async (ctx) => {
        const requesterId = await seedAdmin(ctx)
        const yearId = await seedActiveYear(ctx)
        const catechistId = await seedCatechist(ctx, 'GLV01', 'Giáo Lý Viên A')
        const branchId = await seedBranch(ctx, 'Ấu Nhi', 1)
        const classId = await seedClass(ctx, branchId, 'Lớp Ấu Nhi 1A')
        const classYearId = await seedClassYear(ctx, classId, yearId)

        // Board member
        await makeBoardMember(ctx, catechistId, yearId)

        // Branch head
        await ctx.db.insert('branchAssignments', {
          academicYearId: yearId,
          catechistId,
          branchId,
          isDeleted: false,
        })

        // Class homeroom
        await ctx.db.insert('classCatechists', {
          catechistId,
          classYearId,
          academicYearId: yearId,
          role: 'homeroom',
          isDeleted: false,
        })

        return { requesterId, yearId, catechistId, branchId, classYearId }
      })

    const result = await t.query(api.assignments.listYearAssignments, {
      requesterId,
      academicYearId: yearId,
    })

    expect(result.academicYear.name).toBe('2024-2025')
    expect(result.activeCatechists).toHaveLength(2) // admin + catechist
    expect(result.activeBranches).toHaveLength(1)
    expect(result.classDetails).toHaveLength(1)
    expect(result.classDetails[0].className).toBe('Lớp Ấu Nhi 1A')

    // Board member check
    expect(result.boardMembers.catechistIds).toContain(catechistId)

    // Branch head check
    const branchEntry = result.branchHeads.byBranch[branchId]
    expect(branchEntry).toBeDefined()
    expect(branchEntry.catechistIds).toContain(catechistId)

    // Class teacher check
    const classEntry = result.classTeachers.byClass[classYearId]
    expect(classEntry).toBeDefined()
    expect(classEntry.homeroom?.catechistId).toBe(catechistId)
    expect(classEntry.coTeachers).toHaveLength(0)
  })

  test('returns data for an inactive academic year (read-only scenario)', async () => {
    const t = convexTest(schema, modules)

    const { requesterId, yearId } = await t.run(async (ctx) => {
      const requesterId = await seedAdmin(ctx)
      const yearId = await seedInactiveYear(ctx)
      return { requesterId, yearId }
    })

    const result = await t.query(api.assignments.listYearAssignments, {
      requesterId,
      academicYearId: yearId,
    })

    expect(result.academicYear.isActive).toBe(false)
    expect(result.boardMembers.catechistIds).toHaveLength(0)
    expect(result.classDetails).toHaveLength(0)
  })

  test('excludes soft-deleted branches, class years, and assignment records', async () => {
    const t = convexTest(schema, modules)

    const { requesterId, yearId } = await t.run(async (ctx) => {
      const requesterId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      const catechistId = await seedCatechist(ctx, 'GLV02', 'Giáo Lý Viên B')

      // Soft-deleted branch
      await ctx.db.insert('branches', {
        name: 'Deleted Branch',
        sortOrder: 99,
        isDeleted: true,
      })

      // Soft-deleted class year
      const branchId = await seedBranch(ctx, 'Thiếu Nhi', 2)
      const classId = await seedClass(ctx, branchId, 'Lớp 2A')
      await ctx.db.insert('classYears', {
        classId,
        academicYearId: yearId,
        isDeleted: true,
      })

      // Soft-deleted board assignment
      await ctx.db.insert('academicYearAssignments', {
        academicYearId: yearId,
        catechistId,
        assignmentType: 'board_member',
        isDeleted: true,
      })

      return { requesterId, yearId, catechistId }
    })

    const result = await t.query(api.assignments.listYearAssignments, {
      requesterId,
      academicYearId: yearId,
    })

    // Only the live branch (Thiếu Nhi) should appear
    expect(result.activeBranches).toHaveLength(1)
    expect(result.activeBranches[0].name).toBe('Thiếu Nhi')

    // Soft-deleted class year is excluded
    expect(result.classDetails).toHaveLength(0)

    // Soft-deleted board assignment is excluded
    expect(result.boardMembers.catechistIds).toHaveLength(0)
  })

  test('shows co-teacher alongside homeroom for the same class', async () => {
    const t = convexTest(schema, modules)

    const { requesterId, yearId, homeroomId, coTeacherId, classYearId } =
      await t.run(async (ctx) => {
        const requesterId = await seedAdmin(ctx)
        const yearId = await seedActiveYear(ctx)
        const homeroomId = await seedCatechist(ctx, 'GLV03', 'Homeroom Teacher')
        const coTeacherId = await seedCatechist(ctx, 'GLV04', 'Co Teacher')
        const branchId = await seedBranch(ctx, 'Nghĩa Sĩ', 3)
        const classId = await seedClass(ctx, branchId, 'Lớp 3A')
        const classYearId = await seedClassYear(ctx, classId, yearId)

        await ctx.db.insert('classCatechists', {
          catechistId: homeroomId,
          classYearId,
          academicYearId: yearId,
          role: 'homeroom',
          isDeleted: false,
        })
        await ctx.db.insert('classCatechists', {
          catechistId: coTeacherId,
          classYearId,
          academicYearId: yearId,
          role: 'co_teacher',
          isDeleted: false,
        })

        return { requesterId, yearId, homeroomId, coTeacherId, classYearId }
      })

    const result = await t.query(api.assignments.listYearAssignments, {
      requesterId,
      academicYearId: yearId,
    })

    const classEntry = result.classTeachers.byClass[classYearId]
    expect(classEntry.homeroom?.catechistId).toBe(homeroomId)
    expect(classEntry.coTeachers).toHaveLength(1)
    expect(classEntry.coTeachers[0].catechistId).toBe(coTeacherId)
  })

  test('excludes soft-deleted catechists from class teacher lookups', async () => {
    const t = convexTest(schema, modules)

    const { requesterId, yearId, classYearId } = await t.run(async (ctx) => {
      const requesterId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      // Deleted catechist
      const deletedId = await seedCatechist(ctx, 'GLV05', 'Deleted Teacher', {
        isDeleted: true,
      })
      const branchId = await seedBranch(ctx, 'Hiệp Sĩ', 4)
      const classId = await seedClass(ctx, branchId, 'Lớp 4A')
      const classYearId = await seedClassYear(ctx, classId, yearId)

      // Assignment record still exists but catechist is deleted
      await ctx.db.insert('classCatechists', {
        catechistId: deletedId,
        classYearId,
        academicYearId: yearId,
        role: 'homeroom',
        isDeleted: false,
      })

      return { requesterId, yearId, classYearId }
    })

    const result = await t.query(api.assignments.listYearAssignments, {
      requesterId,
      academicYearId: yearId,
    })

    const classEntry = result.classTeachers.byClass[classYearId]
    expect(classEntry.homeroom).toBeNull()
    expect(classEntry.coTeachers).toHaveLength(0)
  })

  test('classDetails reflects multiple class types', async () => {
    const t = convexTest(schema, modules)

    const { requesterId, yearId } = await t.run(async (ctx) => {
      const requesterId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      const branchId = await seedBranch(ctx, 'Chiên Con', 0)
      const classId = await seedClass(ctx, branchId, 'Lớp Apostle')
      await seedClassYear(ctx, classId, yearId)

      const classId2 = await seedClass(ctx, branchId, 'Lớp Sacrament')
      await seedClassYear(ctx, classId2, yearId)

      return { requesterId, yearId }
    })

    await t.query(api.assignments.listYearAssignments, {
      requesterId,
      academicYearId: yearId,
    })
  })

  test('throws when academic year does not exist', async () => {
    const t = convexTest(schema, modules)

    const requesterId = await t.run(async (ctx) => seedAdmin(ctx))

    // Create and immediately hard-delete to get a valid-format but missing Id
    const missingYearId = await t.run(async (ctx) => {
      const id = await ctx.db.insert('academicYears', {
        name: 'Ghost',
        startDate: '2020-01-01',
        endDate: '2020-12-31',
        timezone: 'UTC',
        isActive: false,
        isDeleted: false,
      })
      await ctx.db.delete('academicYears', id)
      return id
    })

    await expect(
      t.query(api.assignments.listYearAssignments, {
        requesterId,
        academicYearId: missingYearId,
      }),
    ).rejects.toThrow('Academic year not found')
  })
})

// ─── updateBoardAssignments ───────────────────────────────────────────────────

describe('updateBoardAssignments', () => {
  test('admin can set board members on active year', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, catechistId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      const catechistId = await seedCatechist(ctx, 'GLV10', 'Board Member A')
      return { adminId, yearId, catechistId }
    })

    const result = await t.mutation(api.assignments.updateBoardAssignments, {
      requesterId: adminId,
      academicYearId: yearId,
      catechistIds: [catechistId],
    })

    expect(result.success).toBe(true)

    const assignments = await t.run(async (ctx) =>
      ctx.db
        .query('academicYearAssignments')
        .withIndex('by_academic_year_id', (q) => q.eq('academicYearId', yearId))
        .collect(),
    )
    const active = assignments.filter((a) => !a.isDeleted)
    expect(active).toHaveLength(1)
    expect(active[0].catechistId).toBe(catechistId)
    expect(active[0].assignmentType).toBe('board_member')
  })

  test('board member can update board assignments', async () => {
    const t = convexTest(schema, modules)

    const { boardMemberId, yearId, newCatechistId } = await t.run(
      async (ctx) => {
        const boardMemberId = await seedCatechist(ctx, 'GLV11', 'Board Member')
        const yearId = await seedActiveYear(ctx)
        await makeBoardMember(ctx, boardMemberId, yearId)
        const newCatechistId = await seedCatechist(ctx, 'GLV12', 'New Member')
        return { boardMemberId, yearId, newCatechistId }
      },
    )

    await expect(
      t.mutation(api.assignments.updateBoardAssignments, {
        requesterId: boardMemberId,
        academicYearId: yearId,
        catechistIds: [newCatechistId],
      }),
    ).resolves.toMatchObject({ success: true })
  })

  test('replaces existing board assignments (soft-deletes old, inserts new)', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, oldMemberId, newMemberId } = await t.run(
      async (ctx) => {
        const adminId = await seedAdmin(ctx)
        const yearId = await seedActiveYear(ctx)
        const oldMemberId = await seedCatechist(ctx, 'GLV13', 'Old Member')
        const newMemberId = await seedCatechist(ctx, 'GLV14', 'New Member')
        // Pre-existing assignment
        await ctx.db.insert('academicYearAssignments', {
          academicYearId: yearId,
          catechistId: oldMemberId,
          assignmentType: 'board_member',
          isDeleted: false,
        })
        return { adminId, yearId, oldMemberId, newMemberId }
      },
    )

    await t.mutation(api.assignments.updateBoardAssignments, {
      requesterId: adminId,
      academicYearId: yearId,
      catechistIds: [newMemberId],
    })

    const all = await t.run(async (ctx) =>
      ctx.db
        .query('academicYearAssignments')
        .withIndex('by_academic_year_id', (q) => q.eq('academicYearId', yearId))
        .collect(),
    )

    const active = all.filter((a) => !a.isDeleted)
    const deleted = all.filter((a) => a.isDeleted)

    expect(active).toHaveLength(1)
    expect(active[0].catechistId).toBe(newMemberId)

    expect(deleted).toHaveLength(1)
    expect(deleted[0].catechistId).toBe(oldMemberId)
  })

  test('allows setting empty board (clears all assignments)', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      const catechistId = await seedCatechist(ctx, 'GLV15', 'Existing Member')
      await ctx.db.insert('academicYearAssignments', {
        academicYearId: yearId,
        catechistId,
        assignmentType: 'board_member',
        isDeleted: false,
      })
      return { adminId, yearId }
    })

    await t.mutation(api.assignments.updateBoardAssignments, {
      requesterId: adminId,
      academicYearId: yearId,
      catechistIds: [],
    })

    const active = await t.run(async (ctx) => {
      const all = await ctx.db
        .query('academicYearAssignments')
        .withIndex('by_academic_year_id', (q) => q.eq('academicYearId', yearId))
        .collect()
      return all.filter((a) => !a.isDeleted)
    })

    expect(active).toHaveLength(0)
  })

  test('throws when academic year is inactive', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, catechistId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedInactiveYear(ctx)
      const catechistId = await seedCatechist(ctx, 'GLV16', 'Some Catechist')
      return { adminId, yearId, catechistId }
    })

    await expect(
      t.mutation(api.assignments.updateBoardAssignments, {
        requesterId: adminId,
        academicYearId: yearId,
        catechistIds: [catechistId],
      }),
    ).rejects.toThrow('Cannot edit inactive academic year')
  })

  test('throws when academic year does not exist', async () => {
    const t = convexTest(schema, modules)

    const { adminId, missingYearId, catechistId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const catechistId = await seedCatechist(ctx, 'GLV17', 'Some Catechist')
      const id = await ctx.db.insert('academicYears', {
        name: 'Ghost',
        startDate: '2020-01-01',
        endDate: '2020-12-31',
        timezone: 'UTC',
        isActive: true,
        isDeleted: false,
      })
      await ctx.db.delete('academicYears', id)
      return { adminId, missingYearId: id, catechistId }
    })

    await expect(
      t.mutation(api.assignments.updateBoardAssignments, {
        requesterId: adminId,
        academicYearId: missingYearId,
        catechistIds: [catechistId],
      }),
    ).rejects.toThrow('Academic year not found')
  })

  test('throws when a catechist in the list is deleted', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, deletedCatechistId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      const deletedCatechistId = await seedCatechist(
        ctx,
        'GLV18',
        'Deleted Catechist',
        { isDeleted: true },
      )
      return { adminId, yearId, deletedCatechistId }
    })

    await expect(
      t.mutation(api.assignments.updateBoardAssignments, {
        requesterId: adminId,
        academicYearId: yearId,
        catechistIds: [deletedCatechistId],
      }),
    ).rejects.toThrow('Invalid catechist')
  })

  test('throws when a catechist in the list is inactive', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, inactiveCatechistId } = await t.run(
      async (ctx) => {
        const adminId = await seedAdmin(ctx)
        const yearId = await seedActiveYear(ctx)
        const inactiveCatechistId = await seedCatechist(
          ctx,
          'GLV19',
          'Inactive Catechist',
          { isActive: false },
        )
        return { adminId, yearId, inactiveCatechistId }
      },
    )

    await expect(
      t.mutation(api.assignments.updateBoardAssignments, {
        requesterId: adminId,
        academicYearId: yearId,
        catechistIds: [inactiveCatechistId],
      }),
    ).rejects.toThrow('Invalid catechist')
  })

  test('non-admin non-board-member is rejected', async () => {
    const t = convexTest(schema, modules)

    const { userId, yearId, catechistId } = await t.run(async (ctx) => {
      const userId = await seedCatechist(ctx, 'GLV20', 'Regular User')
      const yearId = await seedActiveYear(ctx)
      const catechistId = await seedCatechist(ctx, 'GLV21', 'Target')
      return { userId, yearId, catechistId }
    })

    await expect(
      t.mutation(api.assignments.updateBoardAssignments, {
        requesterId: userId,
        academicYearId: yearId,
        catechistIds: [catechistId],
      }),
    ).rejects.toThrow('Unauthorized')
  })
})

// ─── updateBranchAssignments ──────────────────────────────────────────────────

describe('updateBranchAssignments', () => {
  test('admin can assign a branch head', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, branchId, catechistId } = await t.run(
      async (ctx) => {
        const adminId = await seedAdmin(ctx)
        const yearId = await seedActiveYear(ctx)
        const branchId = await seedBranch(ctx, 'Ấu Nhi', 1)
        const catechistId = await seedCatechist(ctx, 'GLV30', 'Branch Head')
        return { adminId, yearId, branchId, catechistId }
      },
    )

    const result = await t.mutation(api.assignments.updateBranchAssignments, {
      requesterId: adminId,
      academicYearId: yearId,
      branchId,
      catechistIds: [catechistId],
    })

    expect(result.success).toBe(true)

    const active = await t.run(async (ctx) => {
      const all = await ctx.db
        .query('branchAssignments')
        .withIndex('by_academic_year_id_and_branch_id', (q) =>
          q.eq('academicYearId', yearId).eq('branchId', branchId),
        )
        .collect()
      return all.filter((a) => !a.isDeleted)
    })

    expect(active).toHaveLength(1)
    expect(active[0].catechistId).toBe(catechistId)
  })

  test('board member can update branch assignments', async () => {
    const t = convexTest(schema, modules)

    const { boardMemberId, yearId, branchId, catechistId } = await t.run(
      async (ctx) => {
        const boardMemberId = await seedCatechist(ctx, 'GLV31', 'Board Member')
        const yearId = await seedActiveYear(ctx)
        await makeBoardMember(ctx, boardMemberId, yearId)
        const branchId = await seedBranch(ctx, 'Thiếu Nhi', 2)
        const catechistId = await seedCatechist(ctx, 'GLV32', 'Branch Head')
        return { boardMemberId, yearId, branchId, catechistId }
      },
    )

    await expect(
      t.mutation(api.assignments.updateBranchAssignments, {
        requesterId: boardMemberId,
        academicYearId: yearId,
        branchId,
        catechistIds: [catechistId],
      }),
    ).resolves.toMatchObject({ success: true })
  })

  test('replaces per-branch assignments only — other branches unaffected', async () => {
    const t = convexTest(schema, modules)

    const {
      adminId,
      yearId,
      branchAId,
      branchBId,
      catechistForA,
      catechistForB,
      newForA,
    } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      const branchAId = await seedBranch(ctx, 'Branch A', 1)
      const branchBId = await seedBranch(ctx, 'Branch B', 2)
      const catechistForA = await seedCatechist(ctx, 'GLV33', 'Head A')
      const catechistForB = await seedCatechist(ctx, 'GLV34', 'Head B')
      const newForA = await seedCatechist(ctx, 'GLV35', 'New Head A')

      // Pre-seed both branch assignments
      await ctx.db.insert('branchAssignments', {
        academicYearId: yearId,
        catechistId: catechistForA,
        branchId: branchAId,
        isDeleted: false,
      })
      await ctx.db.insert('branchAssignments', {
        academicYearId: yearId,
        catechistId: catechistForB,
        branchId: branchBId,
        isDeleted: false,
      })

      return {
        adminId,
        yearId,
        branchAId,
        branchBId,
        catechistForA,
        catechistForB,
        newForA,
      }
    })

    // Update only Branch A
    await t.mutation(api.assignments.updateBranchAssignments, {
      requesterId: adminId,
      academicYearId: yearId,
      branchId: branchAId,
      catechistIds: [newForA],
    })

    const allAssignments = await t.run(async (ctx) =>
      ctx.db
        .query('branchAssignments')
        .withIndex('by_academic_year_id', (q) => q.eq('academicYearId', yearId))
        .collect(),
    )

    // Branch A old assignment soft-deleted
    const oldA = allAssignments.find(
      (a) => a.catechistId === catechistForA && a.branchId === branchAId,
    )
    expect(oldA?.isDeleted).toBe(true)

    // Branch A new assignment active
    const newA = allAssignments.find(
      (a) => a.catechistId === newForA && a.branchId === branchAId,
    )
    expect(newA?.isDeleted).toBe(false)

    // Branch B untouched
    const branchBAssignment = allAssignments.find(
      (a) => a.catechistId === catechistForB && a.branchId === branchBId,
    )
    expect(branchBAssignment?.isDeleted).toBe(false)
  })

  test('throws when academic year is inactive', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, branchId, catechistId } = await t.run(
      async (ctx) => {
        const adminId = await seedAdmin(ctx)
        const yearId = await seedInactiveYear(ctx)
        const branchId = await seedBranch(ctx, 'Test Branch', 5)
        const catechistId = await seedCatechist(ctx, 'GLV36', 'Head')
        return { adminId, yearId, branchId, catechistId }
      },
    )

    await expect(
      t.mutation(api.assignments.updateBranchAssignments, {
        requesterId: adminId,
        academicYearId: yearId,
        branchId,
        catechistIds: [catechistId],
      }),
    ).rejects.toThrow('Cannot edit inactive academic year')
  })

  test('throws when branch does not exist', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, missingBranchId, catechistId } = await t.run(
      async (ctx) => {
        const adminId = await seedAdmin(ctx)
        const yearId = await seedActiveYear(ctx)
        const catechistId = await seedCatechist(ctx, 'GLV37', 'Head')
        const id = await ctx.db.insert('branches', {
          name: 'Ghost',
          sortOrder: 99,
          isDeleted: false,
        })
        await ctx.db.delete('branches', id)
        return { adminId, yearId, missingBranchId: id, catechistId }
      },
    )

    await expect(
      t.mutation(api.assignments.updateBranchAssignments, {
        requesterId: adminId,
        academicYearId: yearId,
        branchId: missingBranchId,
        catechistIds: [catechistId],
      }),
    ).rejects.toThrow('Branch not found')
  })

  test('throws when a catechist is deleted or inactive', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, branchId, inactiveId } = await t.run(
      async (ctx) => {
        const adminId = await seedAdmin(ctx)
        const yearId = await seedActiveYear(ctx)
        const branchId = await seedBranch(ctx, 'Nghĩa Sĩ', 3)
        const inactiveId = await seedCatechist(ctx, 'GLV38', 'Inactive', {
          isActive: false,
        })
        return { adminId, yearId, branchId, inactiveId }
      },
    )

    await expect(
      t.mutation(api.assignments.updateBranchAssignments, {
        requesterId: adminId,
        academicYearId: yearId,
        branchId,
        catechistIds: [inactiveId],
      }),
    ).rejects.toThrow('Invalid catechist')
  })

  test('non-admin non-board-member is rejected', async () => {
    const t = convexTest(schema, modules)

    const { userId, yearId, branchId, catechistId } = await t.run(
      async (ctx) => {
        const userId = await seedCatechist(ctx, 'GLV39', 'Regular User')
        const yearId = await seedActiveYear(ctx)
        const branchId = await seedBranch(ctx, 'Some Branch', 6)
        const catechistId = await seedCatechist(ctx, 'GLV40', 'Target')
        return { userId, yearId, branchId, catechistId }
      },
    )

    await expect(
      t.mutation(api.assignments.updateBranchAssignments, {
        requesterId: userId,
        academicYearId: yearId,
        branchId,
        catechistIds: [catechistId],
      }),
    ).rejects.toThrow('Unauthorized')
  })

  test('allows clearing all branch heads (empty catechistIds)', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, branchId } = await t.run(async (ctx) => {
      const adminId = await seedAdmin(ctx)
      const yearId = await seedActiveYear(ctx)
      const branchId = await seedBranch(ctx, 'Hiệp Sĩ', 4)
      const catechistId = await seedCatechist(ctx, 'GLV41', 'Existing Head')
      await ctx.db.insert('branchAssignments', {
        academicYearId: yearId,
        catechistId,
        branchId,
        isDeleted: false,
      })
      return { adminId, yearId, branchId }
    })

    await t.mutation(api.assignments.updateBranchAssignments, {
      requesterId: adminId,
      academicYearId: yearId,
      branchId,
      catechistIds: [],
    })

    const active = await t.run(async (ctx) => {
      const all = await ctx.db
        .query('branchAssignments')
        .withIndex('by_academic_year_id_and_branch_id', (q) =>
          q.eq('academicYearId', yearId).eq('branchId', branchId),
        )
        .collect()
      return all.filter((a) => !a.isDeleted)
    })

    expect(active).toHaveLength(0)
  })
})

// ─── updateClassAssignments ───────────────────────────────────────────────────

describe('updateClassAssignments', () => {
  test('admin can set homeroom and co-teachers', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, classYearId, homeroomId, coTeacherId } =
      await t.run(async (ctx) => {
        const adminId = await seedAdmin(ctx)
        const yearId = await seedActiveYear(ctx)
        const branchId = await seedBranch(ctx, 'Ấu Nhi', 1)
        const classId = await seedClass(ctx, branchId, 'Lớp 1A')
        const classYearId = await seedClassYear(ctx, classId, yearId)
        const homeroomId = await seedCatechist(ctx, 'GLV50', 'Homeroom')
        const coTeacherId = await seedCatechist(ctx, 'GLV51', 'Co Teacher')
        return { adminId, yearId, classYearId, homeroomId, coTeacherId }
      })

    const result = await t.mutation(api.assignments.updateClassAssignments, {
      requesterId: adminId,
      academicYearId: yearId,
      classYearId,
      homeroomCatechistId: homeroomId,
      coTeacherCatechistIds: [coTeacherId],
    })

    expect(result.success).toBe(true)

    const assignments = await t.run(async (ctx) => {
      const all = await ctx.db
        .query('classCatechists')
        .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYearId))
        .collect()
      return all.filter((a) => !a.isDeleted)
    })

    expect(assignments).toHaveLength(2)
    const homeroom = assignments.find((a) => a.role === 'homeroom')
    const co = assignments.find((a) => a.role === 'co_teacher')
    expect(homeroom?.catechistId).toBe(homeroomId)
    expect(co?.catechistId).toBe(coTeacherId)
  })

  test('board member can update class assignments', async () => {
    const t = convexTest(schema, modules)

    const { boardMemberId, yearId, classYearId, homeroomId } = await t.run(
      async (ctx) => {
        const boardMemberId = await seedCatechist(ctx, 'GLV52', 'Board Member')
        const yearId = await seedActiveYear(ctx)
        await makeBoardMember(ctx, boardMemberId, yearId)
        const branchId = await seedBranch(ctx, 'Thiếu Nhi', 2)
        const classId = await seedClass(ctx, branchId, 'Lớp 2A')
        const classYearId = await seedClassYear(ctx, classId, yearId)
        const homeroomId = await seedCatechist(ctx, 'GLV53', 'Homeroom')
        return { boardMemberId, yearId, classYearId, homeroomId }
      },
    )

    await expect(
      t.mutation(api.assignments.updateClassAssignments, {
        requesterId: boardMemberId,
        academicYearId: yearId,
        classYearId,
        homeroomCatechistId: homeroomId,
        coTeacherCatechistIds: [],
      }),
    ).resolves.toMatchObject({ success: true })
  })

  test('homeroomCatechistId in coTeacherCatechistIds is silently skipped (exclusion logic)', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, classYearId, homeroomId } = await t.run(
      async (ctx) => {
        const adminId = await seedAdmin(ctx)
        const yearId = await seedActiveYear(ctx)
        const branchId = await seedBranch(ctx, 'Nghĩa Sĩ', 3)
        const classId = await seedClass(ctx, branchId, 'Lớp 3A')
        const classYearId = await seedClassYear(ctx, classId, yearId)
        const homeroomId = await seedCatechist(ctx, 'GLV54', 'Dual Role')
        return { adminId, yearId, classYearId, homeroomId }
      },
    )

    // Pass homeroomId in BOTH positions — it should not create a duplicate co_teacher row
    await t.mutation(api.assignments.updateClassAssignments, {
      requesterId: adminId,
      academicYearId: yearId,
      classYearId,
      homeroomCatechistId: homeroomId,
      coTeacherCatechistIds: [homeroomId],
    })

    const active = await t.run(async (ctx) => {
      const all = await ctx.db
        .query('classCatechists')
        .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYearId))
        .collect()
      return all.filter((a) => !a.isDeleted)
    })

    // Only one record — the homeroom; the co_teacher duplicate was excluded
    expect(active).toHaveLength(1)
    expect(active[0].role).toBe('homeroom')
  })

  test('replaces existing assignments (soft-deletes old rows)', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, classYearId, oldHomeroomId, newHomeroomId } =
      await t.run(async (ctx) => {
        const adminId = await seedAdmin(ctx)
        const yearId = await seedActiveYear(ctx)
        const branchId = await seedBranch(ctx, 'Hiệp Sĩ', 4)
        const classId = await seedClass(ctx, branchId, 'Lớp 4A')
        const classYearId = await seedClassYear(ctx, classId, yearId)
        const oldHomeroomId = await seedCatechist(ctx, 'GLV55', 'Old Homeroom')
        const newHomeroomId = await seedCatechist(ctx, 'GLV56', 'New Homeroom')

        await ctx.db.insert('classCatechists', {
          catechistId: oldHomeroomId,
          classYearId,
          academicYearId: yearId,
          role: 'homeroom',
          isDeleted: false,
        })

        return { adminId, yearId, classYearId, oldHomeroomId, newHomeroomId }
      })

    await t.mutation(api.assignments.updateClassAssignments, {
      requesterId: adminId,
      academicYearId: yearId,
      classYearId,
      homeroomCatechistId: newHomeroomId,
      coTeacherCatechistIds: [],
    })

    const all = await t.run(async (ctx) =>
      ctx.db
        .query('classCatechists')
        .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYearId))
        .collect(),
    )

    const deletedOld = all.find((a) => a.catechistId === oldHomeroomId)
    const activeNew = all.find((a) => a.catechistId === newHomeroomId)

    expect(deletedOld?.isDeleted).toBe(true)
    expect(activeNew?.isDeleted).toBe(false)
    expect(activeNew?.role).toBe('homeroom')
  })

  test('null homeroomCatechistId sets no homeroom (only co-teachers)', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, classYearId, coTeacherId } = await t.run(
      async (ctx) => {
        const adminId = await seedAdmin(ctx)
        const yearId = await seedActiveYear(ctx)
        const branchId = await seedBranch(ctx, 'Dự Trưởng', 5)
        const classId = await seedClass(ctx, branchId, 'Lớp 5A')
        const classYearId = await seedClassYear(ctx, classId, yearId)
        const coTeacherId = await seedCatechist(ctx, 'GLV57', 'Co Only')
        return { adminId, yearId, classYearId, coTeacherId }
      },
    )

    await t.mutation(api.assignments.updateClassAssignments, {
      requesterId: adminId,
      academicYearId: yearId,
      classYearId,
      homeroomCatechistId: null,
      coTeacherCatechistIds: [coTeacherId],
    })

    const active = await t.run(async (ctx) => {
      const all = await ctx.db
        .query('classCatechists')
        .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYearId))
        .collect()
      return all.filter((a) => !a.isDeleted)
    })

    expect(active).toHaveLength(1)
    expect(active[0].role).toBe('co_teacher')
    expect(active[0].catechistId).toBe(coTeacherId)
  })

  test('throws when academic year is inactive', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, classYearId, homeroomId } = await t.run(
      async (ctx) => {
        const adminId = await seedAdmin(ctx)
        const yearId = await seedInactiveYear(ctx)
        const branchId = await seedBranch(ctx, 'Test', 1)
        const classId = await seedClass(ctx, branchId, 'Lớp Test')
        const classYearId = await seedClassYear(ctx, classId, yearId)
        const homeroomId = await seedCatechist(ctx, 'GLV58', 'Homeroom')
        return { adminId, yearId, classYearId, homeroomId }
      },
    )

    await expect(
      t.mutation(api.assignments.updateClassAssignments, {
        requesterId: adminId,
        academicYearId: yearId,
        classYearId,
        homeroomCatechistId: homeroomId,
        coTeacherCatechistIds: [],
      }),
    ).rejects.toThrow('Cannot edit inactive academic year')
  })

  test('throws when classYear does not exist', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, missingClassYearId, homeroomId } = await t.run(
      async (ctx) => {
        const adminId = await seedAdmin(ctx)
        const yearId = await seedActiveYear(ctx)
        const homeroomId = await seedCatechist(ctx, 'GLV59', 'Homeroom')
        const branchId = await seedBranch(ctx, 'Test', 1)
        const classId = await seedClass(ctx, branchId, 'Lớp Ghost')
        const id = await ctx.db.insert('classYears', {
          classId,
          academicYearId: yearId,
          isDeleted: false,
        })
        await ctx.db.delete('classYears', id)
        return { adminId, yearId, missingClassYearId: id, homeroomId }
      },
    )

    await expect(
      t.mutation(api.assignments.updateClassAssignments, {
        requesterId: adminId,
        academicYearId: yearId,
        classYearId: missingClassYearId,
        homeroomCatechistId: homeroomId,
        coTeacherCatechistIds: [],
      }),
    ).rejects.toThrow('Class year not found')
  })

  test('throws when classYear belongs to a different academic year', async () => {
    const t = convexTest(schema, modules)

    const { adminId, activeYearId, classYearId, homeroomId } = await t.run(
      async (ctx) => {
        const adminId = await seedAdmin(ctx)
        const activeYearId = await seedActiveYear(ctx, '2024-2025')
        // Class year is under the INACTIVE year
        const otherYearId = await seedInactiveYear(ctx, '2023-2024')
        const branchId = await seedBranch(ctx, 'Test', 1)
        const classId = await seedClass(ctx, branchId, 'Lớp Mismatched')
        const classYearId = await seedClassYear(ctx, classId, otherYearId)
        const homeroomId = await seedCatechist(ctx, 'GLV60', 'Homeroom')
        return { adminId, activeYearId, classYearId, homeroomId }
      },
    )

    await expect(
      t.mutation(api.assignments.updateClassAssignments, {
        requesterId: adminId,
        academicYearId: activeYearId,
        classYearId,
        homeroomCatechistId: homeroomId,
        coTeacherCatechistIds: [],
      }),
    ).rejects.toThrow('Class year does not belong to the academic year')
  })

  test('throws when homeroom catechist is deleted', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, classYearId, deletedId } = await t.run(
      async (ctx) => {
        const adminId = await seedAdmin(ctx)
        const yearId = await seedActiveYear(ctx)
        const branchId = await seedBranch(ctx, 'Test', 1)
        const classId = await seedClass(ctx, branchId, 'Lớp A')
        const classYearId = await seedClassYear(ctx, classId, yearId)
        const deletedId = await seedCatechist(ctx, 'GLV61', 'Deleted', {
          isDeleted: true,
        })
        return { adminId, yearId, classYearId, deletedId }
      },
    )

    await expect(
      t.mutation(api.assignments.updateClassAssignments, {
        requesterId: adminId,
        academicYearId: yearId,
        classYearId,
        homeroomCatechistId: deletedId,
        coTeacherCatechistIds: [],
      }),
    ).rejects.toThrow('Invalid homeroom catechist')
  })

  test('throws when a co-teacher is inactive', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, classYearId, inactiveId } = await t.run(
      async (ctx) => {
        const adminId = await seedAdmin(ctx)
        const yearId = await seedActiveYear(ctx)
        const branchId = await seedBranch(ctx, 'Test', 1)
        const classId = await seedClass(ctx, branchId, 'Lớp B')
        const classYearId = await seedClassYear(ctx, classId, yearId)
        const inactiveId = await seedCatechist(ctx, 'GLV62', 'Inactive', {
          isActive: false,
        })
        return { adminId, yearId, classYearId, inactiveId }
      },
    )

    await expect(
      t.mutation(api.assignments.updateClassAssignments, {
        requesterId: adminId,
        academicYearId: yearId,
        classYearId,
        homeroomCatechistId: null,
        coTeacherCatechistIds: [inactiveId],
      }),
    ).rejects.toThrow('Invalid co-teacher catechist')
  })

  test('non-admin non-board-member is rejected', async () => {
    const t = convexTest(schema, modules)

    const { userId, yearId, classYearId } = await t.run(async (ctx) => {
      const userId = await seedCatechist(ctx, 'GLV63', 'Regular User')
      const yearId = await seedActiveYear(ctx)
      const branchId = await seedBranch(ctx, 'Test', 1)
      const classId = await seedClass(ctx, branchId, 'Lớp C')
      const classYearId = await seedClassYear(ctx, classId, yearId)
      return { userId, yearId, classYearId }
    })

    await expect(
      t.mutation(api.assignments.updateClassAssignments, {
        requesterId: userId,
        academicYearId: yearId,
        classYearId,
        homeroomCatechistId: null,
        coTeacherCatechistIds: [],
      }),
    ).rejects.toThrow('Unauthorized')
  })

  test('stores correct academicYearId on inserted classCatechist rows', async () => {
    const t = convexTest(schema, modules)

    const { adminId, yearId, classYearId, homeroomId, coTeacherId } =
      await t.run(async (ctx) => {
        const adminId = await seedAdmin(ctx)
        const yearId = await seedActiveYear(ctx)
        const branchId = await seedBranch(ctx, 'Test', 1)
        const classId = await seedClass(ctx, branchId, 'Lớp D')
        const classYearId = await seedClassYear(ctx, classId, yearId)
        const homeroomId = await seedCatechist(ctx, 'GLV64', 'Homeroom')
        const coTeacherId = await seedCatechist(ctx, 'GLV65', 'Co Teacher')
        return { adminId, yearId, classYearId, homeroomId, coTeacherId }
      })

    await t.mutation(api.assignments.updateClassAssignments, {
      requesterId: adminId,
      academicYearId: yearId,
      classYearId,
      homeroomCatechistId: homeroomId,
      coTeacherCatechistIds: [coTeacherId],
    })

    const rows = await t.run(async (ctx) => {
      const all = await ctx.db
        .query('classCatechists')
        .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYearId))
        .collect()
      return all.filter((a) => !a.isDeleted)
    })

    for (const row of rows) {
      expect(row.academicYearId).toBe(yearId)
    }
  })
})
