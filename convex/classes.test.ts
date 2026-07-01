/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { CLASS_ERRORS } from './lib/errors'

const modules = import.meta.glob('./**/*.ts')

describe('classes backend functions', () => {
  test('board CRUD operations', async () => {
    const t = convexTest(schema, modules)

    const { boardId, catechistId, branchId } = await t.run(async (ctx) => {
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

      const brId = await ctx.db.insert('branches', {
        name: 'Ấu Nhi',
        sortOrder: 1,
        isDeleted: false,
      })

      return { boardId: bId, catechistId: cId, branchId: brId }
    })

    // 1. Initial list empty
    const initialList = await t.query(api.classes.list, {
      requesterId: boardId,
    })
    expect(initialList).toEqual([])

    // 2. Reject non-board create
    await expect(
      t.mutation(api.classes.create, {
        requesterId: catechistId,
        branchId,
        name: 'Ấu Nhi 1',
      }),
    ).rejects.toThrow('Unauthorized')

    // 3. Accept board create
    const class1Id = await t.mutation(api.classes.create, {
      requesterId: boardId,
      branchId,
      name: 'Ấu Nhi 1',
    })
    expect(class1Id).toBeDefined()

    // 4. Create another class
    const class2Id = await t.mutation(api.classes.create, {
      requesterId: boardId,
      branchId,
      name: 'Ấu Nhi 2',
    })

    // 5. Test list query
    const list = await t.query(api.classes.list, { requesterId: boardId })
    expect(list).toHaveLength(2)

    // 6. Test update
    await t.mutation(api.classes.update, {
      requesterId: boardId,
      classId: class1Id,
      name: 'Ấu Nhi 1 Updated',
    })

    const updatedList = await t.query(api.classes.list, {
      requesterId: boardId,
    })
    expect(updatedList.find((c) => c._id === class1Id)?.name).toBe(
      'Ấu Nhi 1 Updated',
    )

    // 7. Soft delete
    await t.mutation(api.classes.softDelete, {
      requesterId: boardId,
      classId: class2Id,
    })

    const listAfterDelete = await t.query(api.classes.list, {
      requesterId: boardId,
    })
    expect(listAfterDelete).toHaveLength(1)
    expect(listAfterDelete[0]._id).toBe(class1Id)
  })

  test('duplicate name check scopes to same branch and ignores soft-deleted classes', async () => {
    const t = convexTest(schema, modules)
    const { boardId, branch1Id, branch2Id } = await t.run(async (ctx) => {
      const bId = await ctx.db.insert('catechists', {
        memberId: 'GLV0003',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
      const br1Id = await ctx.db.insert('branches', {
        name: 'Branch 1',
        sortOrder: 1,
        isDeleted: false,
      })
      const br2Id = await ctx.db.insert('branches', {
        name: 'Branch 2',
        sortOrder: 2,
        isDeleted: false,
      })
      return { boardId: bId, branch1Id: br1Id, branch2Id: br2Id }
    })

    const class1Id = await t.mutation(api.classes.create, {
      requesterId: boardId,
      branchId: branch1Id,
      name: 'Class A',
    })

    // Duplicate in same branch
    await expect(
      t.mutation(api.classes.create, {
        requesterId: boardId,
        branchId: branch1Id,
        name: 'Class A',
      }),
    ).rejects.toThrow(CLASS_ERRORS.DUPLICATE_NAME)

    // Same name in different branch is ok
    await t.mutation(api.classes.create, {
      requesterId: boardId,
      branchId: branch2Id,
      name: 'Class A',
    })

    // Delete first one, then recreating in first branch is ok
    await t.mutation(api.classes.softDelete, {
      requesterId: boardId,
      classId: class1Id,
    })

    const class3Id = await t.mutation(api.classes.create, {
      requesterId: boardId,
      branchId: branch1Id,
      name: 'Class A',
    })
    expect(class3Id).toBeDefined()
  })

  test('softDelete throws if class in use by a classYear', async () => {
    const t = convexTest(schema, modules)
    const { boardId, class1Id } = await t.run(async (ctx) => {
      const bId = await ctx.db.insert('catechists', {
        memberId: 'GLV0003',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
      const brId = await ctx.db.insert('branches', {
        name: 'Branch 1',
        sortOrder: 1,
        isDeleted: false,
      })
      const cId = await ctx.db.insert('classes', {
        branchId: brId,
        name: 'Class 1',
        isDeleted: false,
      })
      return { boardId: bId, class1Id: cId }
    })

    await t.run(async (ctx) => {
      const acId = await ctx.db.insert('academicYears', {
        name: '2023-2024',
        startDate: '2023-09-01',
        endDate: '2024-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: true,
        isDeleted: false,
      })
      await ctx.db.insert('classYears', {
        classId: class1Id,
        academicYearId: acId,
        classType: 'primary',
        isDeleted: false,
      })
    })

    await expect(
      t.mutation(api.classes.softDelete, {
        requesterId: boardId,
        classId: class1Id,
      }),
    ).rejects.toThrow(CLASS_ERRORS.IN_USE_BY_CLASS_YEAR)
  })

  test('update throws NOT_FOUND for non-existent class', async () => {
    const t = convexTest(schema, modules)
    const { boardId, branchId } = await t.run(async (ctx) => {
      const bId = await ctx.db.insert('catechists', {
        memberId: 'GLV0004',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
      const brId = await ctx.db.insert('branches', {
        name: 'Branch 1',
        sortOrder: 1,
        isDeleted: false,
      })
      return { boardId: bId, branchId: brId }
    })

    const class1Id = await t.mutation(api.classes.create, {
      requesterId: boardId,
      branchId,
      name: 'Temp Class',
    })
    await t.mutation(api.classes.softDelete, {
      requesterId: boardId,
      classId: class1Id,
    })

    await expect(
      t.mutation(api.classes.update, {
        requesterId: boardId,
        classId: class1Id,
        name: 'New Name',
      }),
    ).rejects.toThrow(CLASS_ERRORS.NOT_FOUND)
  })

  test('update rename throws DUPLICATE_NAME for existing class in same branch', async () => {
    const t = convexTest(schema, modules)
    const { boardId, branchId } = await t.run(async (ctx) => {
      const bId = await ctx.db.insert('catechists', {
        memberId: 'GLV0005',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
      const brId = await ctx.db.insert('branches', {
        name: 'Branch 1',
        sortOrder: 1,
        isDeleted: false,
      })
      return { boardId: bId, branchId: brId }
    })

    const class1Id = await t.mutation(api.classes.create, {
      requesterId: boardId,
      branchId,
      name: 'Class 1',
    })
    await t.mutation(api.classes.create, {
      requesterId: boardId,
      branchId,
      name: 'Class 2',
    })

    await expect(
      t.mutation(api.classes.update, {
        requesterId: boardId,
        classId: class1Id,
        name: 'Class 2',
      }),
    ).rejects.toThrow(CLASS_ERRORS.DUPLICATE_NAME)
  })

  test('softDelete throws NOT_FOUND for non-existent class', async () => {
    const t = convexTest(schema, modules)
    const { boardId, branchId } = await t.run(async (ctx) => {
      const bId = await ctx.db.insert('catechists', {
        memberId: 'GLV0006',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
      const brId = await ctx.db.insert('branches', {
        name: 'Branch 1',
        sortOrder: 1,
        isDeleted: false,
      })
      return { boardId: bId, branchId: brId }
    })

    const class1Id = await t.mutation(api.classes.create, {
      requesterId: boardId,
      branchId,
      name: 'Temp Class 2',
    })
    await t.mutation(api.classes.softDelete, {
      requesterId: boardId,
      classId: class1Id,
    })

    await expect(
      t.mutation(api.classes.softDelete, {
        requesterId: boardId,
        classId: class1Id,
      }),
    ).rejects.toThrow(CLASS_ERRORS.NOT_FOUND)
  })

  describe('bulkCreate', () => {
    test('board member can bulk create classes across multiple branches', async () => {
      const t = convexTest(schema, modules)
      const { boardId, branch1Id, branch2Id } = await t.run(async (ctx) => {
        const bId = await ctx.db.insert('catechists', {
          memberId: 'GLV0007',
          fullName: 'Board User',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
        const br1Id = await ctx.db.insert('branches', {
          name: 'Branch 1',
          sortOrder: 1,
          isDeleted: false,
        })
        const br2Id = await ctx.db.insert('branches', {
          name: 'Branch 2',
          sortOrder: 2,
          isDeleted: false,
        })
        return { boardId: bId, branch1Id: br1Id, branch2Id: br2Id }
      })

      const ids = await t.mutation(api.classes.bulkCreate, {
        requesterId: boardId,
        classes: [
          { branchId: branch1Id, name: 'Class 1A' },
          { branchId: branch1Id, name: 'Class 1B' },
          { branchId: branch2Id, name: 'Class 2A' },
        ],
      })

      expect(ids).toHaveLength(3)

      const list = await t.query(api.classes.list, { requesterId: boardId })
      expect(list).toHaveLength(3)
      expect(
        list.some((c) => c.name === 'Class 1A' && c.branchId === branch1Id),
      ).toBe(true)
      expect(
        list.some((c) => c.name === 'Class 1B' && c.branchId === branch1Id),
      ).toBe(true)
      expect(
        list.some((c) => c.name === 'Class 2A' && c.branchId === branch2Id),
      ).toBe(true)
    })

    test('non-board member is rejected', async () => {
      const t = convexTest(schema, modules)
      const { catechistId, branch1Id } = await t.run(async (ctx) => {
        const cId = await ctx.db.insert('catechists', {
          memberId: 'GLV0008',
          fullName: 'Catechist User',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
        const br1Id = await ctx.db.insert('branches', {
          name: 'Branch 1',
          sortOrder: 1,
          isDeleted: false,
        })
        return { catechistId: cId, branch1Id: br1Id }
      })

      await expect(
        t.mutation(api.classes.bulkCreate, {
          requesterId: catechistId,
          classes: [{ branchId: branch1Id, name: 'Class 1A' }],
        }),
      ).rejects.toThrow('Unauthorized')
    })

    test('duplicate name in the same branch in the batch is rejected', async () => {
      const t = convexTest(schema, modules)
      const { boardId, branch1Id } = await t.run(async (ctx) => {
        const bId = await ctx.db.insert('catechists', {
          memberId: 'GLV0009',
          fullName: 'Board User',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
        const br1Id = await ctx.db.insert('branches', {
          name: 'Branch 1',
          sortOrder: 1,
          isDeleted: false,
        })
        return { boardId: bId, branch1Id: br1Id }
      })

      await expect(
        t.mutation(api.classes.bulkCreate, {
          requesterId: boardId,
          classes: [
            { branchId: branch1Id, name: 'Class 1A' },
            { branchId: branch1Id, name: 'Class 1A' },
          ],
        }),
      ).rejects.toThrow(CLASS_ERRORS.DUPLICATE_NAME)
    })

    test('empty name is rejected', async () => {
      const t = convexTest(schema, modules)
      const { boardId, branch1Id } = await t.run(async (ctx) => {
        const bId = await ctx.db.insert('catechists', {
          memberId: 'GLV0010',
          fullName: 'Board User',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
        const br1Id = await ctx.db.insert('branches', {
          name: 'Branch 1',
          sortOrder: 1,
          isDeleted: false,
        })
        return { boardId: bId, branch1Id: br1Id }
      })

      await expect(
        t.mutation(api.classes.bulkCreate, {
          requesterId: boardId,
          classes: [{ branchId: branch1Id, name: '  ' }],
        }),
      ).rejects.toThrow(CLASS_ERRORS.EMPTY_NAME)
    })

    test('existing duplicate name in DB is rejected', async () => {
      const t = convexTest(schema, modules)
      const { boardId, branch1Id } = await t.run(async (ctx) => {
        const bId = await ctx.db.insert('catechists', {
          memberId: 'GLV0011',
          fullName: 'Board User',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
        const br1Id = await ctx.db.insert('branches', {
          name: 'Branch 1',
          sortOrder: 1,
          isDeleted: false,
        })
        return { boardId: bId, branch1Id: br1Id }
      })

      await t.mutation(api.classes.create, {
        requesterId: boardId,
        branchId: branch1Id,
        name: 'Class 1A',
      })

      await expect(
        t.mutation(api.classes.bulkCreate, {
          requesterId: boardId,
          classes: [{ branchId: branch1Id, name: 'Class 1A' }],
        }),
      ).rejects.toThrow(CLASS_ERRORS.DUPLICATE_NAME)
    })
  })
})
