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

    const { boardId, catechistId, branchId, academicYearId } = await t.run(
      async (ctx) => {
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

        const ayId = await ctx.db.insert('academicYears', {
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-05-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
          isDeleted: false,
        })

        return {
          boardId: bId,
          catechistId: cId,
          branchId: brId,
          academicYearId: ayId,
        }
      },
    )

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
        academicYearId,
      }),
    ).rejects.toThrow('Unauthorized')

    // 3. Accept board create
    const class1Id = await t.mutation(api.classes.create, {
      requesterId: boardId,
      branchId,
      name: 'Ấu Nhi 1',
      academicYearId,
    })
    expect(class1Id).toBeDefined()

    // 3a. ClassYear created automatically
    const classYears1 = await t.run(async (ctx) => {
      return await ctx.db
        .query('classYears')
        .withIndex('by_class_id_and_academic_year_id', (q) =>
          q.eq('classId', class1Id).eq('academicYearId', academicYearId),
        )
        .unique()
    })
    expect(classYears1).not.toBeNull()
    expect(classYears1!.isDeleted).toBe(false)

    // 4. Create another class
    const class2Id = await t.mutation(api.classes.create, {
      requesterId: boardId,
      branchId,
      name: 'Ấu Nhi 2',
      academicYearId,
    })

    // 4a. Verify listed when filtering by academicYearId
    const filteredList = await t.query(api.classes.list, {
      requesterId: boardId,
      academicYearId,
    })
    expect(filteredList).toHaveLength(2)

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
    await t.run(async (ctx) => {
      const cy = await ctx.db
        .query('classYears')
        .withIndex('by_class_id_and_academic_year_id', (q) =>
          q.eq('classId', class2Id).eq('academicYearId', academicYearId),
        )
        .unique()
      if (cy) {
        await ctx.db.delete('classYears', cy._id)
      }
    })
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
    const { boardId, branchId, academicYearId } = await t.run(async (ctx) => {
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
      const ayId = await ctx.db.insert('academicYears', {
        name: '2024-2025',
        startDate: '2024-09-01',
        endDate: '2025-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: true,
        isDeleted: false,
      })
      return { boardId: bId, branchId: brId, academicYearId: ayId }
    })

    const class1Id = await t.mutation(api.classes.create, {
      requesterId: boardId,
      branchId,
      name: 'Temp Class',
      academicYearId,
    })
    await t.run(async (ctx) => {
      const cy = await ctx.db
        .query('classYears')
        .withIndex('by_class_id_and_academic_year_id', (q) =>
          q.eq('classId', class1Id).eq('academicYearId', academicYearId),
        )
        .unique()
      if (cy) {
        await ctx.db.delete('classYears', cy._id)
      }
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

  test('softDelete throws NOT_FOUND for non-existent class', async () => {
    const t = convexTest(schema, modules)
    const { boardId, branchId, academicYearId } = await t.run(async (ctx) => {
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
      const ayId = await ctx.db.insert('academicYears', {
        name: '2024-2025',
        startDate: '2024-09-01',
        endDate: '2025-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: true,
        isDeleted: false,
      })
      return { boardId: bId, branchId: brId, academicYearId: ayId }
    })

    const class1Id = await t.mutation(api.classes.create, {
      requesterId: boardId,
      branchId,
      name: 'Temp Class 2',
      academicYearId,
    })
    await t.run(async (ctx) => {
      const cy = await ctx.db
        .query('classYears')
        .withIndex('by_class_id_and_academic_year_id', (q) =>
          q.eq('classId', class1Id).eq('academicYearId', academicYearId),
        )
        .unique()
      if (cy) {
        await ctx.db.delete('classYears', cy._id)
      }
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
      const { boardId, branch1Id, branch2Id, academicYearId } = await t.run(
        async (ctx) => {
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
          const ayId = await ctx.db.insert('academicYears', {
            name: '2024-2025',
            startDate: '2024-09-01',
            endDate: '2025-05-31',
            timezone: 'Asia/Ho_Chi_Minh',
            isActive: true,
            isDeleted: false,
          })
          return {
            boardId: bId,
            branch1Id: br1Id,
            branch2Id: br2Id,
            academicYearId: ayId,
          }
        },
      )

      const ids = await t.mutation(api.classes.bulkCreate, {
        requesterId: boardId,
        academicYearId,
        classes: [
          { branchId: branch1Id, name: 'Class 1A' },
          { branchId: branch1Id, name: 'Class 1B' },
          { branchId: branch2Id, name: 'Class 2A' },
        ],
      })

      expect(ids).toHaveLength(3)

      // Verify classYears were created
      for (const id of ids) {
        const classYear = await t.run(async (ctx) => {
          return await ctx.db
            .query('classYears')
            .withIndex('by_class_id_and_academic_year_id', (q) =>
              q.eq('classId', id).eq('academicYearId', academicYearId),
            )
            .unique()
        })
        expect(classYear).not.toBeNull()
        expect(classYear!.isDeleted).toBe(false)
      }

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
      const { catechistId, branch1Id, academicYearId } = await t.run(
        async (ctx) => {
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
          const ayId = await ctx.db.insert('academicYears', {
            name: '2024-2025',
            startDate: '2024-09-01',
            endDate: '2025-05-31',
            timezone: 'Asia/Ho_Chi_Minh',
            isActive: true,
            isDeleted: false,
          })
          return { catechistId: cId, branch1Id: br1Id, academicYearId: ayId }
        },
      )

      await expect(
        t.mutation(api.classes.bulkCreate, {
          requesterId: catechistId,
          academicYearId,
          classes: [
            {
              branchId: branch1Id,
              name: 'Class 1A',
            },
          ],
        }),
      ).rejects.toThrow('Unauthorized')
    })

    test('empty name is rejected', async () => {
      const t = convexTest(schema, modules)
      const { boardId, branch1Id, academicYearId } = await t.run(
        async (ctx) => {
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
          const ayId = await ctx.db.insert('academicYears', {
            name: '2024-2025',
            startDate: '2024-09-01',
            endDate: '2025-05-31',
            timezone: 'Asia/Ho_Chi_Minh',
            isActive: true,
            isDeleted: false,
          })
          return { boardId: bId, branch1Id: br1Id, academicYearId: ayId }
        },
      )

      await expect(
        t.mutation(api.classes.bulkCreate, {
          requesterId: boardId,
          academicYearId,
          classes: [
            {
              branchId: branch1Id,
              name: '  ',
            },
          ],
        }),
      ).rejects.toThrow(CLASS_ERRORS.EMPTY_NAME)
    })
  })
})
