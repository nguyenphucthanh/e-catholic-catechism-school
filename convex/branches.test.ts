/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { BRANCH_ERRORS } from './lib/errors'

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
    const initialList = await t.query(api.branches.list)
    expect(initialList).toEqual([])

    // 2. Reject non-board create
    await expect(
      t.mutation(api.branches.create, {
        requesterId: catechistId,
        name: 'Ấu Nhi',
      }),
    ).rejects.toThrow('Unauthorized')

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
    const list = await t.query(api.branches.list)
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

    const updatedList = await t.query(api.branches.list)
    expect(updatedList[0].name).toBe('Ấu Nhi Updated')

    // 7. Test move up / down
    // branch2 moves up (direction = up) -> swaps with branch1
    await t.mutation(api.branches.reorder, {
      requesterId: boardId,
      branchId: branch2Id,
      direction: 'up',
    })

    const reorderedList1 = await t.query(api.branches.list)
    expect(reorderedList1[0]._id).toBe(branch2Id) // sortOrder 1
    expect(reorderedList1[1]._id).toBe(branch1Id) // sortOrder 2

    // branch2 moves down -> swaps back
    await t.mutation(api.branches.reorder, {
      requesterId: boardId,
      branchId: branch2Id,
      direction: 'down',
    })

    const reorderedList2 = await t.query(api.branches.list)
    expect(reorderedList2[0]._id).toBe(branch1Id) // sortOrder 1
    expect(reorderedList2[1]._id).toBe(branch2Id) // sortOrder 2

    // 8. Move up boundary no-op
    await t.mutation(api.branches.reorder, {
      requesterId: boardId,
      branchId: branch1Id,
      direction: 'up',
    })

    const listAfterNoop = await t.query(api.branches.list)
    expect(listAfterNoop[0]._id).toBe(branch1Id)

    // 9. Soft delete
    await t.mutation(api.branches.softDelete, {
      requesterId: boardId,
      branchId: branch2Id,
    })

    const listAfterDelete = await t.query(api.branches.list)
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
})
