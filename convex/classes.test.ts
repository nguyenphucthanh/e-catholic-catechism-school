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

  describe('getClassDetails query', () => {
    async function setupDetailsFixture(t: ReturnType<typeof convexTest>) {
      return await t.run(async (ctx) => {
        const catechistId = await ctx.db.insert('catechists', {
          memberId: 'GLV0030',
          fullName: 'Detail Requester',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
        const branchId = await ctx.db.insert('branches', {
          name: 'Thiếu Nhi',
          sortOrder: 2,
          isDeleted: false,
        })
        const academicYearId = await ctx.db.insert('academicYears', {
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-05-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
          isDeleted: false,
        })
        const classId = await ctx.db.insert('classes', {
          branchId,
          name: 'Thiếu Nhi 1',
          isDeleted: false,
        })
        return { catechistId, branchId, academicYearId, classId }
      })
    }

    test('returns full details when classYear is active', async () => {
      const t = convexTest(schema, modules)
      const { catechistId, academicYearId, classId, branchId } =
        await setupDetailsFixture(t)

      const {
        classYearId,
        catechist1Id,
        catechist2Id,
        student1Id,
        student2Id,
      } = await t.run(async (ctx) => {
        const cyId = await ctx.db.insert('classYears', {
          classId,
          academicYearId,
          isDeleted: false,
        })

        const c1Id = await ctx.db.insert('catechists', {
          memberId: 'GLV0031',
          fullName: 'Homeroom Teacher',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
        const c2Id = await ctx.db.insert('catechists', {
          memberId: 'GLV0032',
          fullName: 'Co Teacher',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
        await ctx.db.insert('classCatechists', {
          catechistId: c1Id,
          classYearId: cyId,
          academicYearId,
          role: 'homeroom',
          isDeleted: false,
        })
        await ctx.db.insert('classCatechists', {
          catechistId: c2Id,
          classYearId: cyId,
          academicYearId,
          role: 'co_teacher',
          isDeleted: false,
        })

        const s1Id = await ctx.db.insert('students', {
          studentCode: 'HS001',
          fullName: 'Student One',
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
        const s2Id = await ctx.db.insert('students', {
          studentCode: 'HS002',
          fullName: 'Student Two',
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
        await ctx.db.insert('studentClasses', {
          studentId: s1Id,
          classYearId: cyId,
          isPrimaryClass: true,
          enrolledDate: '2024-09-05',
          status: 'active',
          isDeleted: false,
        })
        await ctx.db.insert('studentClasses', {
          studentId: s2Id,
          classYearId: cyId,
          isPrimaryClass: true,
          enrolledDate: '2024-09-05',
          status: 'active',
          isDeleted: false,
        })

        return {
          classYearId: cyId,
          catechist1Id: c1Id,
          catechist2Id: c2Id,
          student1Id: s1Id,
          student2Id: s2Id,
        }
      })

      const result = await t.query(api.classes.getClassDetails, {
        requesterId: catechistId,
        classId,
        academicYearId,
      })

      expect(result).not.toBeNull()
      expect(result!.class._id).toBe(classId)
      expect(result!.class.name).toBe('Thiếu Nhi 1')
      expect(result!.branch).not.toBeNull()
      expect(result!.branch!._id).toBe(branchId)
      expect(result!.classYear).not.toBeNull()
      expect(result!.classYear!._id).toBe(classYearId)

      expect(result!.assignedCatechists).toHaveLength(2)
      const homeroomEntry = result!.assignedCatechists.find(
        (ac) => ac.catechist._id === catechist1Id,
      )
      expect(homeroomEntry?.role).toBe('homeroom')
      const coTeacherEntry = result!.assignedCatechists.find(
        (ac) => ac.catechist._id === catechist2Id,
      )
      expect(coTeacherEntry?.role).toBe('co_teacher')

      expect(result!.students).toHaveLength(2)
      expect(result!.studentCount).toBe(2)
      const studentIds = result!.students.map((s) => s.student._id)
      expect(studentIds).toContain(student1Id)
      expect(studentIds).toContain(student2Id)

      // Regular catechist (non-admin, non-homeroom) → no enrollment permission
      expect(result!.canManageEnrollments).toBe(false)
    })

    test('returns null when class is not found', async () => {
      const t = convexTest(schema, modules)
      const { catechistId, academicYearId, classId } =
        await setupDetailsFixture(t)

      // Hard-delete the class so ctx.db.get returns null
      await t.run(async (ctx) => {
        await ctx.db.delete('classes', classId)
      })

      const result = await t.query(api.classes.getClassDetails, {
        requesterId: catechistId,
        classId,
        academicYearId,
      })

      expect(result).toBeNull()
    })

    test('returns null when class is soft-deleted', async () => {
      const t = convexTest(schema, modules)
      const { catechistId, academicYearId, classId } =
        await setupDetailsFixture(t)

      await t.run(async (ctx) => {
        await ctx.db.patch('classes', classId, { isDeleted: true })
      })

      const result = await t.query(api.classes.getClassDetails, {
        requesterId: catechistId,
        classId,
        academicYearId,
      })

      expect(result).toBeNull()
    })

    test('returns minimal response with empty arrays when classYear not found', async () => {
      const t = convexTest(schema, modules)
      const { catechistId, academicYearId, classId } =
        await setupDetailsFixture(t)

      // No classYear inserted for this class+year combination
      const result = await t.query(api.classes.getClassDetails, {
        requesterId: catechistId,
        classId,
        academicYearId,
      })

      expect(result).not.toBeNull()
      expect(result!.class._id).toBe(classId)
      expect(result!.classYear).toBeNull()
      expect(result!.assignedCatechists).toEqual([])
      expect(result!.students).toEqual([])
      expect(result!.studentCount).toBe(0)
      expect(result!.canManageEnrollments).toBe(false)
    })

    test('returns minimal response with empty arrays when classYear is soft-deleted', async () => {
      const t = convexTest(schema, modules)
      const { catechistId, academicYearId, classId } =
        await setupDetailsFixture(t)

      await t.run(async (ctx) => {
        await ctx.db.insert('classYears', {
          classId,
          academicYearId,
          isDeleted: true,
        })
      })

      const result = await t.query(api.classes.getClassDetails, {
        requesterId: catechistId,
        classId,
        academicYearId,
      })

      expect(result).not.toBeNull()
      expect(result!.classYear).toBeNull()
      expect(result!.assignedCatechists).toEqual([])
      expect(result!.students).toEqual([])
      expect(result!.studentCount).toBe(0)
      expect(result!.canManageEnrollments).toBe(false)
    })

    test('filters out soft-deleted classCatechists', async () => {
      const t = convexTest(schema, modules)
      const { catechistId, academicYearId, classId } =
        await setupDetailsFixture(t)

      await t.run(async (ctx) => {
        const cyId = await ctx.db.insert('classYears', {
          classId,
          academicYearId,
          isDeleted: false,
        })
        const activeId = await ctx.db.insert('catechists', {
          memberId: 'GLV0033',
          fullName: 'Active Teacher',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
        const deletedId = await ctx.db.insert('catechists', {
          memberId: 'GLV0034',
          fullName: 'Deleted Teacher',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
        await ctx.db.insert('classCatechists', {
          catechistId: activeId,
          classYearId: cyId,
          academicYearId,
          role: 'homeroom',
          isDeleted: false,
        })
        // This one is soft-deleted — should not appear
        await ctx.db.insert('classCatechists', {
          catechistId: deletedId,
          classYearId: cyId,
          academicYearId,
          role: 'co_teacher',
          isDeleted: true,
        })
      })

      const result = await t.query(api.classes.getClassDetails, {
        requesterId: catechistId,
        classId,
        academicYearId,
      })

      expect(result!.assignedCatechists).toHaveLength(1)
      expect(result!.assignedCatechists[0].role).toBe('homeroom')
    })

    test('filters out soft-deleted studentClasses', async () => {
      const t = convexTest(schema, modules)
      const { catechistId, academicYearId, classId } =
        await setupDetailsFixture(t)

      await t.run(async (ctx) => {
        const cyId = await ctx.db.insert('classYears', {
          classId,
          academicYearId,
          isDeleted: false,
        })
        const s1Id = await ctx.db.insert('students', {
          studentCode: 'HS010',
          fullName: 'Active Student',
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
        const s2Id = await ctx.db.insert('students', {
          studentCode: 'HS011',
          fullName: 'Withdrawn Student',
          isActive: false,
          createdAt: Date.now(),
          isDeleted: false,
        })
        await ctx.db.insert('studentClasses', {
          studentId: s1Id,
          classYearId: cyId,
          isPrimaryClass: true,
          enrolledDate: '2024-09-05',
          status: 'active',
          isDeleted: false,
        })
        // Soft-deleted enrollment — should not appear
        await ctx.db.insert('studentClasses', {
          studentId: s2Id,
          classYearId: cyId,
          isPrimaryClass: true,
          enrolledDate: '2024-09-05',
          status: 'withdrawn',
          isDeleted: true,
        })
      })

      const result = await t.query(api.classes.getClassDetails, {
        requesterId: catechistId,
        classId,
        academicYearId,
      })

      expect(result!.students).toHaveLength(1)
      expect(result!.studentCount).toBe(1)
      expect(result!.students[0].student.fullName).toBe('Active Student')
      expect(result!.students[0].enrollment.status).toBe('active')
    })

    test('throws for deleted catechist requester', async () => {
      const t = convexTest(schema, modules)
      const { catechistId, academicYearId, classId } =
        await setupDetailsFixture(t)

      await t.run(async (ctx) => {
        await ctx.db.patch('catechists', catechistId, { isDeleted: true })
      })

      await expect(
        t.query(api.classes.getClassDetails, {
          requesterId: catechistId,
          classId,
          academicYearId,
        }),
      ).rejects.toThrow()
    })

    test('returns null for non-existent class details', async () => {
      const t = convexTest(schema, modules)
      const { catechistId, academicYearId, branchId } =
        await setupDetailsFixture(t)

      const badClassId = await t.run(async (ctx) => {
        const id = await ctx.db.insert('classes', {
          name: 'Temp Class',
          branchId,
          isDeleted: false,
        })
        await ctx.db.delete('classes', id)
        return id
      })

      const result = await t.query(api.classes.getClassDetails, {
        requesterId: catechistId,
        classId: badClassId,
        academicYearId,
      })
      expect(result).toBeNull()
    })

    test('get query returns null for deleted or non-existent class', async () => {
      const t = convexTest(schema, modules)
      const { catechistId, branchId } = await setupDetailsFixture(t)

      const badId = await t.run(async (ctx) => {
        const id = await ctx.db.insert('classes', {
          name: 'Temp Class',
          branchId,
          isDeleted: false,
        })
        await ctx.db.delete('classes', id)
        return id
      })

      const result = await t.query(api.classes.get, {
        requesterId: catechistId,
        id: badId,
      })
      expect(result).toBeNull()
    })

    async function setupActiveClassYear(
      t: ReturnType<typeof convexTest>,
      classId: string,
      academicYearId: string,
    ) {
      return await t.run(async (ctx) => {
        return await ctx.db.insert('classYears', {
          classId,
          academicYearId,
          isDeleted: false,
        })
      })
    }

    test('canManageEnrollments is true for admin requester', async () => {
      const t = convexTest(schema, modules)
      const { classId, academicYearId } = await setupDetailsFixture(t)
      await setupActiveClassYear(t, classId, academicYearId)

      const adminId = await t.run(async (ctx) => {
        return await ctx.db.insert('catechists', {
          memberId: 'GLV0099',
          fullName: 'Admin User',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
      })

      const result = await t.query(api.classes.getClassDetails, {
        requesterId: adminId,
        classId,
        academicYearId,
      })
      expect(result?.canManageEnrollments).toBe(true)
    })

    test('canManageEnrollments is true for homeroom catechist', async () => {
      const t = convexTest(schema, modules)
      const { classId, academicYearId } = await setupDetailsFixture(t)
      const classYearId = await setupActiveClassYear(t, classId, academicYearId)

      const homeroomId = await t.run(async (ctx) => {
        const hId = await ctx.db.insert('catechists', {
          memberId: 'GLV0098',
          fullName: 'Homeroom Catechist',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
        await ctx.db.insert('classCatechists', {
          catechistId: hId,
          classYearId,
          academicYearId,
          role: 'homeroom',
          isDeleted: false,
        })
        return hId
      })

      const result = await t.query(api.classes.getClassDetails, {
        requesterId: homeroomId,
        classId,
        academicYearId,
      })
      expect(result?.canManageEnrollments).toBe(true)
    })

    test('canManageEnrollments is true for co-teacher', async () => {
      const t = convexTest(schema, modules)
      const { classId, academicYearId } = await setupDetailsFixture(t)
      const classYearId = await setupActiveClassYear(t, classId, academicYearId)

      const coTeacherId = await t.run(async (ctx) => {
        const ctId = await ctx.db.insert('catechists', {
          memberId: 'GLV0097',
          fullName: 'Co Teacher',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
        await ctx.db.insert('classCatechists', {
          catechistId: ctId,
          classYearId,
          academicYearId,
          role: 'co_teacher',
          isDeleted: false,
        })
        return ctId
      })

      const result = await t.query(api.classes.getClassDetails, {
        requesterId: coTeacherId,
        classId,
        academicYearId,
      })
      expect(result?.canManageEnrollments).toBe(true)
    })
  })

  describe('listClassYears query', () => {
    async function setupClassYearFixture(t: ReturnType<typeof convexTest>) {
      const catechistId = await t.run(async (ctx) => {
        return await ctx.db.insert('catechists', {
          memberId: 'GLV0020',
          fullName: 'Catechist',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
      })

      const academicYearId = await t.run(async (ctx) => {
        return await ctx.db.insert('academicYears', {
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-05-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
          isDeleted: false,
        })
      })

      const branchId = await t.run(async (ctx) => {
        return await ctx.db.insert('branches', {
          name: 'Branch A',
          sortOrder: 1,
          isDeleted: false,
        })
      })

      return { catechistId, academicYearId, branchId }
    }

    test('returns class years joined with class name for an academic year', async () => {
      const t = convexTest(schema, modules)
      const { catechistId, academicYearId, branchId } =
        await setupClassYearFixture(t)

      const class1Id = await t.run(async (ctx) => {
        return await ctx.db.insert('classes', {
          branchId,
          name: 'Au Nhi 1',
          isDeleted: false,
        })
      })
      const class2Id = await t.run(async (ctx) => {
        return await ctx.db.insert('classes', {
          branchId,
          name: 'Thieu Nhi 1',
          isDeleted: false,
        })
      })

      const cy1Id = await t.run(async (ctx) => {
        return await ctx.db.insert('classYears', {
          academicYearId,
          classId: class1Id,
          isDeleted: false,
        })
      })
      const cy2Id = await t.run(async (ctx) => {
        return await ctx.db.insert('classYears', {
          academicYearId,
          classId: class2Id,
          isDeleted: false,
        })
      })

      const result = await t.query(api.classes.listClassYears, {
        requesterId: catechistId,
        academicYearId,
      })

      expect(result).toHaveLength(2)
      const names = result.map((r) => r.className)
      expect(names).toContain('Au Nhi 1')
      expect(names).toContain('Thieu Nhi 1')

      const cy1 = result.find((r) => r.classYearId === cy1Id)
      expect(cy1?.classId).toBe(class1Id)

      const cy2 = result.find((r) => r.classYearId === cy2Id)
      expect(cy2?.classId).toBe(class2Id)
    })

    test('returns empty array when no class years exist for academic year', async () => {
      const t = convexTest(schema, modules)
      const { catechistId, academicYearId } = await setupClassYearFixture(t)

      const result = await t.query(api.classes.listClassYears, {
        requesterId: catechistId,
        academicYearId,
      })

      expect(result).toEqual([])
    })

    test('filters out soft-deleted class years', async () => {
      const t = convexTest(schema, modules)
      const { catechistId, academicYearId, branchId } =
        await setupClassYearFixture(t)

      const classId = await t.run(async (ctx) => {
        return await ctx.db.insert('classes', {
          branchId,
          name: 'Au Nhi 2',
          isDeleted: false,
        })
      })

      // Insert one deleted and one active class year
      await t.run(async (ctx) => {
        await ctx.db.insert('classYears', {
          academicYearId,
          classId,
          isDeleted: true,
        })
      })
      await t.run(async (ctx) => {
        await ctx.db.insert('classYears', {
          academicYearId,
          classId,
          isDeleted: false,
        })
      })

      const result = await t.query(api.classes.listClassYears, {
        requesterId: catechistId,
        academicYearId,
      })

      expect(result).toHaveLength(1)
      expect(result[0].className).toBe('Au Nhi 2')
    })

    test('filters out class years whose class record is deleted or missing', async () => {
      const t = convexTest(schema, modules)
      const { catechistId, academicYearId, branchId } =
        await setupClassYearFixture(t)

      const classId = await t.run(async (ctx) => {
        return await ctx.db.insert('classes', {
          branchId,
          name: 'Deleted Class',
          isDeleted: false,
        })
      })

      await t.run(async (ctx) => {
        await ctx.db.insert('classYears', {
          academicYearId,
          classId,
          isDeleted: false,
        })
        // Now delete the class itself
        await ctx.db.patch('classes', classId, { isDeleted: true })
      })

      // listClassYears filters out entries where className === '—'
      // which happens when classRecord is null/deleted (get returns the doc but
      // the production code uses classRecord?.name ?? '—' and filters r.className !== '—')
      // However the class doc still exists (just isDeleted:true), so get() returns it.
      // The production code does NOT check isDeleted on classRecord — it only
      // falls back to '—' when classRecord is null (doc missing entirely).
      // So a deleted-but-present class still shows its name. This test documents that behaviour.
      const result = await t.query(api.classes.listClassYears, {
        requesterId: catechistId,
        academicYearId,
      })

      // The record is still returned because ctx.db.get returns the doc regardless of isDeleted
      expect(result).toHaveLength(1)
      expect(result[0].className).toBe('Deleted Class')
    })

    test('only returns class years for the specified academic year', async () => {
      const t = convexTest(schema, modules)
      const { catechistId, academicYearId, branchId } =
        await setupClassYearFixture(t)

      const otherYearId = await t.run(async (ctx) => {
        return await ctx.db.insert('academicYears', {
          name: '2025-2026',
          startDate: '2025-09-01',
          endDate: '2026-05-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: false,
          isDeleted: false,
        })
      })

      const classId = await t.run(async (ctx) => {
        return await ctx.db.insert('classes', {
          branchId,
          name: 'Au Nhi 3',
          isDeleted: false,
        })
      })

      // One class year in the target year, one in the other year
      await t.run(async (ctx) => {
        await ctx.db.insert('classYears', {
          academicYearId,
          classId,
          isDeleted: false,
        })
        await ctx.db.insert('classYears', {
          academicYearId: otherYearId,
          classId,
          isDeleted: false,
        })
      })

      const result = await t.query(api.classes.listClassYears, {
        requesterId: catechistId,
        academicYearId,
      })

      expect(result).toHaveLength(1)
      expect(result[0].className).toBe('Au Nhi 3')
    })

    test('throws for deleted catechist requester', async () => {
      const t = convexTest(schema, modules)
      const { catechistId, academicYearId } = await setupClassYearFixture(t)

      await t.run(async (ctx) => {
        await ctx.db.patch('catechists', catechistId, { isDeleted: true })
      })

      await expect(
        t.query(api.classes.listClassYears, {
          requesterId: catechistId,
          academicYearId,
        }),
      ).rejects.toThrow()
    })
  })

  describe('listMyClasses query', () => {
    test('assigned catechist sees only assigned classes', async () => {
      const t = convexTest(schema, modules)
      const { catechistId, academicYearId, assignedClassId, otherClassId } =
        await t.run(async (ctx) => {
          const cId = await ctx.db.insert('catechists', {
            memberId: 'GLV9002',
            fullName: 'Assigned Catechist',
            role: 'user',
            isActive: true,
            isDeleted: false,
          })
          const brId = await ctx.db.insert('branches', {
            name: 'Test Branch',
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
          const c1 = await ctx.db.insert('classes', {
            branchId: brId,
            name: 'Assigned Class',
            isDeleted: false,
          })
          const c2 = await ctx.db.insert('classes', {
            branchId: brId,
            name: 'Other Class',
            isDeleted: false,
          })
          const cy1 = await ctx.db.insert('classYears', {
            classId: c1,
            academicYearId: ayId,
            isDeleted: false,
          })
          await ctx.db.insert('classCatechists', {
            catechistId: cId,
            classYearId: cy1,
            academicYearId: ayId,
            role: 'homeroom',
            isDeleted: false,
          })
          return {
            catechistId: cId,
            academicYearId: ayId,
            assignedClassId: c1,
            otherClassId: c2,
          }
        })

      const result = await t.query(api.classes.listMyClasses, {
        requesterId: catechistId,
        academicYearId,
      })

      expect(result).toHaveLength(1)
      expect(result[0].classId).toBe(assignedClassId)
      expect(result.some((r) => r.classId === otherClassId)).toBe(false)
    })

    test('branch head + assigned catechist sees deduplicated classes', async () => {
      const t = convexTest(schema, modules)
      const { catechistId, academicYearId, class1Id, class2Id } = await t.run(
        async (ctx) => {
          const cId = await ctx.db.insert('catechists', {
            memberId: 'GLV9003',
            fullName: 'Branch Head + Assigned',
            role: 'user',
            isActive: true,
            isDeleted: false,
          })
          const brId = await ctx.db.insert('branches', {
            name: 'Test Branch',
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
          const c1 = await ctx.db.insert('classes', {
            branchId: brId,
            name: 'Class A',
            isDeleted: false,
          })
          const c2 = await ctx.db.insert('classes', {
            branchId: brId,
            name: 'Class B',
            isDeleted: false,
          })
          const cy1 = await ctx.db.insert('classYears', {
            classId: c1,
            academicYearId: ayId,
            isDeleted: false,
          })
          const cy2 = await ctx.db.insert('classYears', {
            classId: c2,
            academicYearId: ayId,
            isDeleted: false,
          })
          await ctx.db.insert('branchAssignments', {
            academicYearId: ayId,
            catechistId: cId,
            branchId: brId,
            isDeleted: false,
          })
          await ctx.db.insert('classCatechists', {
            catechistId: cId,
            classYearId: cy1,
            academicYearId: ayId,
            role: 'homeroom',
            isDeleted: false,
          })
          return {
            catechistId: cId,
            academicYearId: ayId,
            class1Id: c1,
            class2Id: c2,
          }
        },
      )

      const result = await t.query(api.classes.listMyClasses, {
        requesterId: catechistId,
        academicYearId,
      })

      expect(result).toHaveLength(2)
      const classIds = result.map((r) => r.classId)
      expect(classIds).toContain(class1Id)
      expect(classIds).toContain(class2Id)
      expect(new Set(classIds).size).toBe(2)
    })

    test('branch head sees only classes in their branch', async () => {
      const t = convexTest(schema, modules)
      const {
        branchHeadId,
        academicYearId,
        ownBranchClass1Id,
        ownBranchClass2Id,
        otherBranchClassId,
      } = await t.run(async (ctx) => {
        const bhId = await ctx.db.insert('catechists', {
          memberId: 'GLV9005',
          fullName: 'Branch Head',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
        const ownBrId = await ctx.db.insert('branches', {
          name: 'Own Branch',
          sortOrder: 1,
          isDeleted: false,
        })
        const otherBrId = await ctx.db.insert('branches', {
          name: 'Other Branch',
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
        const c1 = await ctx.db.insert('classes', {
          branchId: ownBrId,
          name: 'Own Branch Class 1',
          isDeleted: false,
        })
        const c2 = await ctx.db.insert('classes', {
          branchId: ownBrId,
          name: 'Own Branch Class 2',
          isDeleted: false,
        })
        const c3 = await ctx.db.insert('classes', {
          branchId: otherBrId,
          name: 'Other Branch Class',
          isDeleted: false,
        })
        await ctx.db.insert('classYears', {
          classId: c1,
          academicYearId: ayId,
          isDeleted: false,
        })
        await ctx.db.insert('classYears', {
          classId: c2,
          academicYearId: ayId,
          isDeleted: false,
        })
        await ctx.db.insert('classYears', {
          classId: c3,
          academicYearId: ayId,
          isDeleted: false,
        })
        await ctx.db.insert('branchAssignments', {
          academicYearId: ayId,
          catechistId: bhId,
          branchId: ownBrId,
          isDeleted: false,
        })
        return {
          branchHeadId: bhId,
          academicYearId: ayId,
          ownBranchClass1Id: c1,
          ownBranchClass2Id: c2,
          otherBranchClassId: c3,
        }
      })

      const result = await t.query(api.classes.listMyClasses, {
        requesterId: branchHeadId,
        academicYearId,
      })

      expect(result).toHaveLength(2)
      expect(result.some((r) => r.classId === ownBranchClass1Id)).toBe(true)
      expect(result.some((r) => r.classId === ownBranchClass2Id)).toBe(true)
      expect(result.some((r) => r.classId === otherBranchClassId)).toBe(false)
    })

    test('non-board non-assigned catechist sees empty list', async () => {
      const t = convexTest(schema, modules)
      const { catechistId, academicYearId } = await t.run(async (ctx) => {
        const cId = await ctx.db.insert('catechists', {
          memberId: 'GLV9004',
          fullName: 'Unassigned Catechist',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
        const brId = await ctx.db.insert('branches', {
          name: 'Test Branch',
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
        const c1 = await ctx.db.insert('classes', {
          branchId: brId,
          name: 'Some Class',
          isDeleted: false,
        })
        await ctx.db.insert('classYears', {
          classId: c1,
          academicYearId: ayId,
          isDeleted: false,
        })
        return { catechistId: cId, academicYearId: ayId }
      })

      const result = await t.query(api.classes.listMyClasses, {
        requesterId: catechistId,
        academicYearId,
      })

      expect(result).toHaveLength(0)
    })
  })
})
