/// <reference types="vite/client" />
/* eslint-disable no-shadow */
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { AUTHZ_ERRORS, BRANCH_ERRORS } from './lib/errors'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

describe('branches backend functions', () => {
  test('board CRUD operations', async () => {
    const t = convexTest(schema, modules)

    const { boardId, catechistId } = await t.run(async (ctx) => {
      const bId = await ctx.db.insert('catechists', {
        memberId: 'GLV0001',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })

      const cId = await ctx.db.insert('catechists', {
        memberId: 'GLV0002',
        fullName: 'Catechist User',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })

      return { boardId: bId, catechistId: cId }
    })

    // 1. Initial list empty
    const initialList = await t.query(api.branches.list, {
      requesterId: boardId,
    })
    expect(initialList).toEqual([])

    // 2. Reject non-board create
    await expect(
      t.mutation(api.branches.create, {
        requesterId: catechistId,
        name: 'Ấu Nhi',
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.ADMIN_REQUIRED)

    // 3. Accept board create
    const branch1Id = await t.mutation(api.branches.create, {
      requesterId: boardId,
      name: 'Ấu Nhi',
    })
    expect(branch1Id).toBeDefined()

    // 4. Create another branch
    const branch2Id = await t.mutation(api.branches.create, {
      requesterId: boardId,
      name: 'Thiếu Nhi',
    })

    // 5. Test list query
    const list = await t.query(api.branches.list, { requesterId: boardId })
    expect(list).toHaveLength(2)
    expect(list[0]._id).toBe(branch1Id) // sortOrder 1
    expect(list[1]._id).toBe(branch2Id) // sortOrder 2
    expect(list[0].sortOrder).toBe(1)
    expect(list[1].sortOrder).toBe(2)

    // 6. Test update
    await t.mutation(api.branches.update, {
      requesterId: boardId,
      branchId: branch1Id,
      name: 'Ấu Nhi Updated',
    })

    const updatedList = await t.query(api.branches.list, {
      requesterId: boardId,
    })
    expect(updatedList[0].name).toBe('Ấu Nhi Updated')

    // 7. Test move up / down
    // branch2 moves up (direction = up) -> swaps with branch1
    await t.mutation(api.branches.reorder, {
      requesterId: boardId,
      branchId: branch2Id,
      direction: 'up',
    })

    const reorderedList1 = await t.query(api.branches.list, {
      requesterId: boardId,
    })
    expect(reorderedList1[0]._id).toBe(branch2Id) // sortOrder 1
    expect(reorderedList1[1]._id).toBe(branch1Id) // sortOrder 2

    // branch2 moves down -> swaps back
    await t.mutation(api.branches.reorder, {
      requesterId: boardId,
      branchId: branch2Id,
      direction: 'down',
    })

    const reorderedList2 = await t.query(api.branches.list, {
      requesterId: boardId,
    })
    expect(reorderedList2[0]._id).toBe(branch1Id) // sortOrder 1
    expect(reorderedList2[1]._id).toBe(branch2Id) // sortOrder 2

    // 8. Move up boundary no-op
    await t.mutation(api.branches.reorder, {
      requesterId: boardId,
      branchId: branch1Id,
      direction: 'up',
    })

    const listAfterNoop = await t.query(api.branches.list, {
      requesterId: boardId,
    })
    expect(listAfterNoop[0]._id).toBe(branch1Id)

    // 9. Soft delete
    await t.mutation(api.branches.softDelete, {
      requesterId: boardId,
      branchId: branch2Id,
    })

    const listAfterDelete = await t.query(api.branches.list, {
      requesterId: boardId,
    })
    expect(listAfterDelete).toHaveLength(1)
    expect(listAfterDelete[0]._id).toBe(branch1Id)
  })

  test('duplicate name check ignores soft-deleted branches', async () => {
    const t = convexTest(schema, modules)
    const boardId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV0003',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const branch1Id = await t.mutation(api.branches.create, {
      requesterId: boardId,
      name: 'Chiên Con',
    })

    await expect(
      t.mutation(api.branches.create, {
        requesterId: boardId,
        name: 'Chiên Con',
      }),
    ).rejects.toThrow(BRANCH_ERRORS.DUPLICATE_NAME)

    await t.mutation(api.branches.softDelete, {
      requesterId: boardId,
      branchId: branch1Id,
    })

    const branch3Id = await t.mutation(api.branches.create, {
      requesterId: boardId,
      name: 'Chiên Con',
    })
    expect(branch3Id).toBeDefined()
  })

  test('softDelete throws if branch in use by a class', async () => {
    const t = convexTest(schema, modules)
    const boardId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV0003',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const branch1Id = await t.mutation(api.branches.create, {
      requesterId: boardId,
      name: 'Dự Trưởng',
    })

    await t.run(async (ctx) => {
      await ctx.db.insert('classes', {
        branchId: branch1Id,
        name: 'Class 1',
        isDeleted: false,
      })
    })

    await expect(
      t.mutation(api.branches.softDelete, {
        requesterId: boardId,
        branchId: branch1Id,
      }),
    ).rejects.toThrow(BRANCH_ERRORS.IN_USE_BY_CLASS)
  })

  test('update throws NOT_FOUND for non-existent branch', async () => {
    const t = convexTest(schema, modules)
    const boardId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV0004',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const branch1Id = await t.mutation(api.branches.create, {
      requesterId: boardId,
      name: 'Temp Branch',
    })
    await t.mutation(api.branches.softDelete, {
      requesterId: boardId,
      branchId: branch1Id,
    })

    await expect(
      t.mutation(api.branches.update, {
        requesterId: boardId,
        branchId: branch1Id,
        name: 'New Name',
      }),
    ).rejects.toThrow(BRANCH_ERRORS.NOT_FOUND)
  })

  test('update rename throws DUPLICATE_NAME for existing branch', async () => {
    const t = convexTest(schema, modules)
    const boardId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV0005',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const branch1Id = await t.mutation(api.branches.create, {
      requesterId: boardId,
      name: 'Branch 1',
    })
    await t.mutation(api.branches.create, {
      requesterId: boardId,
      name: 'Branch 2',
    })

    await expect(
      t.mutation(api.branches.update, {
        requesterId: boardId,
        branchId: branch1Id,
        name: 'Branch 2',
      }),
    ).rejects.toThrow(BRANCH_ERRORS.DUPLICATE_NAME)
  })

  test('softDelete throws NOT_FOUND for non-existent branch', async () => {
    const t = convexTest(schema, modules)
    const boardId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV0006',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const branch1Id = await t.mutation(api.branches.create, {
      requesterId: boardId,
      name: 'Temp Branch 2',
    })
    await t.mutation(api.branches.softDelete, {
      requesterId: boardId,
      branchId: branch1Id,
    })

    await expect(
      t.mutation(api.branches.softDelete, {
        requesterId: boardId,
        branchId: branch1Id,
      }),
    ).rejects.toThrow(BRANCH_ERRORS.NOT_FOUND)
  })

  test('reorder throws NOT_FOUND for non-existent branch', async () => {
    const t = convexTest(schema, modules)
    const boardId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV0007',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const branch1Id = await t.mutation(api.branches.create, {
      requesterId: boardId,
      name: 'Temp Branch 3',
    })
    await t.mutation(api.branches.softDelete, {
      requesterId: boardId,
      branchId: branch1Id,
    })

    await expect(
      t.mutation(api.branches.reorder, {
        requesterId: boardId,
        branchId: branch1Id,
        direction: 'up',
      }),
    ).rejects.toThrow(BRANCH_ERRORS.NOT_FOUND)
  })

  test('reorder "down" swaps sortOrder with the next branch', async () => {
    const t = convexTest(schema, modules)
    const boardId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV0008',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const branch1Id = await t.mutation(api.branches.create, {
      requesterId: boardId,
      name: 'Down Branch 1',
    })
    const branch2Id = await t.mutation(api.branches.create, {
      requesterId: boardId,
      name: 'Down Branch 2',
    })

    await t.mutation(api.branches.reorder, {
      requesterId: boardId,
      branchId: branch1Id,
      direction: 'down',
    })

    const list = await t.query(api.branches.list, { requesterId: boardId })
    expect(list[0]._id).toBe(branch2Id) // sortOrder 1
    expect(list[1]._id).toBe(branch1Id) // sortOrder 2
  })

  test('reorder "down" is a no-op when already at the last position', async () => {
    const t = convexTest(schema, modules)
    const boardId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV0009',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const branch1Id = await t.mutation(api.branches.create, {
      requesterId: boardId,
      name: 'Last Branch 1',
    })
    const branch2Id = await t.mutation(api.branches.create, {
      requesterId: boardId,
      name: 'Last Branch 2',
    })

    await t.mutation(api.branches.reorder, {
      requesterId: boardId,
      branchId: branch2Id,
      direction: 'down',
    })

    const list = await t.query(api.branches.list, { requesterId: boardId })
    expect(list[0]._id).toBe(branch1Id)
    expect(list[1]._id).toBe(branch2Id)
  })
})

describe('getBranchDetail', () => {
  function seedYear(ctx: any): Promise<Id<'academicYears'>> {
    return ctx.db.insert('academicYears', {
      name: '2024-2025',
      startDate: '2024-09-01',
      endDate: '2025-05-31',
      timezone: 'Asia/Ho_Chi_Minh',
      isActive: true,
      isDeleted: false,
    })
  }

  test('returns null when branch not found or deleted', async () => {
    const t = convexTest(schema, modules)
    const { catechistId, academicYearId, deletedBranchId } = await t.run(
      async (ctx) => {
        const catechistId = await ctx.db.insert('catechists', {
          memberId: 'GLV0010',
          fullName: 'Board User',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
        const academicYearId = await seedYear(ctx)
        const deletedBranchId = await ctx.db.insert('branches', {
          name: 'Deleted Branch',
          sortOrder: 1,
          isDeleted: true,
        })
        return { catechistId, academicYearId, deletedBranchId }
      },
    )

    const resultDeleted = await t.query(api.branches.getBranchDetail, {
      requesterId: catechistId,
      id: deletedBranchId,
      academicYearId,
    })
    expect(resultDeleted).toBeNull()
  })

  test('aggregates classes, catechists, and students; filters soft-deleted rows and other branches/years', async () => {
    const t = convexTest(schema, modules)

    const { catechistId, academicYearId, otherYearId, branchId } = await t.run(
      async (ctx) => {
        const catechistId = await ctx.db.insert('catechists', {
          memberId: 'GLV0011',
          fullName: 'Board User',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
        const academicYearId = await seedYear(ctx)
        const otherYearId = await ctx.db.insert('academicYears', {
          name: '2023-2024',
          startDate: '2023-09-01',
          endDate: '2024-05-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: false,
          isDeleted: false,
        })

        const branchId = await ctx.db.insert('branches', {
          name: 'Ấu Nhi',
          sortOrder: 1,
          isDeleted: false,
        })
        const otherBranchId = await ctx.db.insert('branches', {
          name: 'Thiếu Nhi',
          sortOrder: 2,
          isDeleted: false,
        })

        const classId = await ctx.db.insert('classes', {
          branchId,
          name: 'Lớp 1A',
          isDeleted: false,
        })
        const classYearId = await ctx.db.insert('classYears', {
          classId,
          academicYearId,
          isDeleted: false,
        })

        // A classYear in a different branch — must not leak into this branch's detail.
        const otherClassId = await ctx.db.insert('classes', {
          branchId: otherBranchId,
          name: 'Lớp Khác',
          isDeleted: false,
        })
        await ctx.db.insert('classYears', {
          classId: otherClassId,
          academicYearId,
          isDeleted: false,
        })

        // A classYear for the same branch but a different (non-target) academic year.
        await ctx.db.insert('classYears', {
          classId,
          academicYearId: otherYearId,
          isDeleted: false,
        })

        // A soft-deleted classYear in this branch/year — must be excluded.
        const deletedClassId = await ctx.db.insert('classes', {
          branchId,
          name: 'Lớp Xóa',
          isDeleted: false,
        })
        await ctx.db.insert('classYears', {
          classId: deletedClassId,
          academicYearId,
          isDeleted: true,
        })

        // Catechists assigned to the class: one active, one soft-deleted.
        const activeCatechistId = await ctx.db.insert('catechists', {
          memberId: 'GLV0012',
          fullName: 'Homeroom Teacher',
          saintName: 'Maria',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
        const deletedCatechistId = await ctx.db.insert('catechists', {
          memberId: 'GLV0013',
          fullName: 'Deleted Teacher',
          role: 'user',
          isActive: true,
          isDeleted: true,
        })
        await ctx.db.insert('classCatechists', {
          catechistId: activeCatechistId,
          classYearId,
          academicYearId,
          role: 'homeroom',
          isDeleted: false,
        })
        // Soft-deleted assignment — must not appear as an assigned catechist.
        await ctx.db.insert('classCatechists', {
          catechistId: deletedCatechistId,
          classYearId,
          academicYearId,
          role: 'co_teacher',
          isDeleted: true,
        })
        // Assignment pointing at a catechist that no longer exists (defensive null-filter).
        const [tempCatechistId] = await Promise.all([
          ctx.db.insert('catechists', {
            memberId: 'GLV0014',
            fullName: 'Temp',
            role: 'user',
            isActive: true,
            isDeleted: false,
          }),
        ])
        await ctx.db.delete('catechists', tempCatechistId)
        await ctx.db.insert('classCatechists', {
          catechistId: tempCatechistId,
          classYearId,
          academicYearId,
          role: 'co_teacher',
          isDeleted: false,
        })

        // Students: one active, one soft-deleted enrollment.
        const student1Id = await ctx.db.insert('students', {
          studentCode: 'HS100',
          fullName: 'Student One',
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
        const student2Id = await ctx.db.insert('students', {
          studentCode: 'HS101',
          fullName: 'Student Two',
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
        await ctx.db.insert('studentClasses', {
          studentId: student1Id,
          classYearId,
          isPrimaryClass: true,
          enrolledDate: '2024-09-05',
          status: 'active',
          isDeleted: false,
        })
        await ctx.db.insert('studentClasses', {
          studentId: student2Id,
          classYearId,
          isPrimaryClass: true,
          enrolledDate: '2024-09-05',
          status: 'active',
          isDeleted: true,
        })

        return {
          catechistId,
          academicYearId,
          otherYearId,
          branchId,
          classYearId,
        }
      },
    )

    const detail = await t.query(api.branches.getBranchDetail, {
      requesterId: catechistId,
      id: branchId,
      academicYearId,
    })

    expect(detail).not.toBeNull()
    expect(detail?.branch.name).toBe('Ấu Nhi')
    // Only one active (non-deleted) classYear for this branch/year.
    expect(detail?.stats.totalClasses).toBe(1)
    expect(detail?.stats.totalStudents).toBe(1) // soft-deleted enrollment excluded
    expect(detail?.stats.totalCatechists).toBe(2) // active + orphaned assignment; soft-deleted excluded
    expect(detail?.classes).toHaveLength(1)
    const classDetail = detail?.classes[0]
    expect(classDetail?.className).toBe('Lớp 1A')
    expect(classDetail?.studentCount).toBe(1)
    // Only the active catechist is returned — the soft-deleted assignment and
    // the orphaned (catechist doc no longer exists) assignment are filtered out.
    expect(classDetail?.assignedCatechists).toHaveLength(1)
    expect(classDetail?.assignedCatechists[0].fullName).toBe('Homeroom Teacher')
    expect(classDetail?.assignedCatechists[0].role).toBe('homeroom')

    // The other academic year has its own classYear for the same class (seeded
    // above to prove classYear filtering is scoped by academicYearId), but with
    // no catechists/students assigned under that year.
    const otherYearDetail = await t.query(api.branches.getBranchDetail, {
      requesterId: catechistId,
      id: branchId,
      academicYearId: otherYearId,
    })
    expect(otherYearDetail?.stats.totalClasses).toBe(1)
    expect(otherYearDetail?.classes[0]?.assignedCatechists).toEqual([])
    expect(otherYearDetail?.classes[0]?.studentCount).toBe(0)
  })

  test('excludes classYears whose parent class doc is soft-deleted', async () => {
    const t = convexTest(schema, modules)
    const { catechistId, academicYearId, branchId } = await t.run(
      async (ctx) => {
        const catechistId = await ctx.db.insert('catechists', {
          memberId: 'GLV0015',
          fullName: 'Board User',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
        const academicYearId = await seedYear(ctx)
        const branchId = await ctx.db.insert('branches', {
          name: 'Nghĩa Sĩ',
          sortOrder: 1,
          isDeleted: false,
        })
        const classId = await ctx.db.insert('classes', {
          branchId,
          name: 'Lớp Xóa Lớp',
          isDeleted: true,
        })
        await ctx.db.insert('classYears', {
          classId,
          academicYearId,
          isDeleted: false,
        })
        return { catechistId, academicYearId, branchId }
      },
    )

    const detail = await t.query(api.branches.getBranchDetail, {
      requesterId: catechistId,
      id: branchId,
      academicYearId,
    })

    expect(detail?.classes).toEqual([])
    expect(detail?.stats.totalClasses).toBe(0)
  })
})
