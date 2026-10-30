/// <reference types="vite/client" />
import { describe, expect, test } from 'vitest'
import { authedConvexTest } from '../test-utils/authedConvexTest'
import { api } from './_generated/api'
import schema from './schema'
import { ACADEMIC_YEAR_ERRORS, AUTHZ_ERRORS } from './lib/errors'

const modules = import.meta.glob('./**/*.ts')

describe('academicYears backend functions', () => {
  test('board CRUD operations and switcher queries', async () => {
    const t = authedConvexTest(schema, modules)

    // Seed requester profiles (one board, one non-board)
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

    // 1. Test query list is initially empty
    const initialList = await t.query(api.academicYears.list, {
      requesterId: boardId,
    })
    expect(initialList).toEqual([])

    // 2. Test create year rejects non-board
    await expect(
      t.mutation(api.academicYears.create, {
        requesterId: catechistId,
        name: '2024-2025',
        startDate: '2024-09-01',
        endDate: '2025-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        numberOfSemesters: 2,
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.ADMIN_REQUIRED)

    // 3. Test create year accepts board
    const year1Id = await t.mutation(api.academicYears.create, {
      requesterId: boardId,
      name: '2024-2025',
      startDate: '2024-09-01',
      endDate: '2025-05-31',
      timezone: 'Asia/Ho_Chi_Minh',
      numberOfSemesters: 2,
    })
    expect(year1Id).toBeDefined()

    // 4. Create another year to test ordering and list limits
    const year2Id = await t.mutation(api.academicYears.create, {
      requesterId: boardId,
      name: '2025-2026',
      startDate: '2025-09-01',
      endDate: '2026-05-31',
      timezone: 'Asia/Ho_Chi_Minh',
      numberOfSemesters: 2,
    })

    // 5. Test list query (non-deleted, sorted by startDate desc)
    const list = await t.query(api.academicYears.list, { requesterId: boardId })
    expect(list).toHaveLength(2)
    expect(list[0]._id).toBe(year2Id) // 2025-2026 should be first (desc)
    expect(list[1]._id).toBe(year1Id) // 2024-2025 should be second

    // 6. Test getActive when no year is active
    const initialActive = await t.query(api.academicYears.getActive, {
      requesterId: boardId,
    })
    expect(initialActive).toBeNull()

    // 7. Test setActive sets target to active and deactivates others
    await t.mutation(api.academicYears.setActive, {
      requesterId: boardId,
      academicYearId: year1Id,
    })

    const activeYear1 = await t.query(api.academicYears.getActive, {
      requesterId: boardId,
    })
    expect(activeYear1?._id).toBe(year1Id)
    expect(activeYear1?.isActive).toBe(true)

    // Test getActiveYearContext aggregate
    const context = await t.query(api.academicYears.getActiveYearContext, {
      requesterId: boardId,
    })
    expect(context.activeYear?._id).toBe(year1Id)
    expect(context.semesters).toHaveLength(2)
    expect(context.recentYears).toHaveLength(2)

    // Set other year active, verify year1 gets deactivated
    await t.mutation(api.academicYears.setActive, {
      requesterId: boardId,
      academicYearId: year2Id,
    })

    const activeYear2 = await t.query(api.academicYears.getActive, {
      requesterId: boardId,
    })
    expect(activeYear2?._id).toBe(year2Id)

    const updatedYear1 = await t.run(async (ctx) => {
      return await ctx.db.get('academicYears', year1Id)
    })
    expect(updatedYear1?.isActive).toBe(false)

    // 8. Test update year details
    await t.mutation(api.academicYears.update, {
      requesterId: boardId,
      academicYearId: year1Id,
      name: '2024-2025 Updated',
      timezone: 'America/Los_Angeles',
    })

    const year1Doc = await t.run(async (ctx) => {
      return await ctx.db.get('academicYears', year1Id)
    })
    expect(year1Doc?.name).toBe('2024-2025 Updated')
    expect(year1Doc?.timezone).toBe('America/Los_Angeles')

    // 9. Test soft delete active year throws error
    await expect(
      t.mutation(api.academicYears.softDelete, {
        requesterId: boardId,
        academicYearId: year2Id, // Currently active
      }),
    ).rejects.toThrow(ACADEMIC_YEAR_ERRORS.CANNOT_DELETE_ACTIVE)

    // 10. Test soft delete inactive year passes
    await t.mutation(api.academicYears.softDelete, {
      requesterId: boardId,
      academicYearId: year1Id,
    })

    const listAfterDelete = await t.query(api.academicYears.list, {
      requesterId: boardId,
    })
    expect(listAfterDelete).toHaveLength(1)
    expect(listAfterDelete[0]._id).toBe(year2Id)
  })

  test('reusing a soft-deleted year name does not break later create/update calls', async () => {
    const t = authedConvexTest(schema, modules)

    const boardId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV0003',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    // Create, delete, and recreate a year under the same name twice — this
    // leaves 2+ soft-deleted rows sharing the name, which used to make the
    // duplicate-name check's .unique() call throw.
    for (let i = 0; i < 2; i++) {
      const yearId = await t.mutation(api.academicYears.create, {
        requesterId: boardId,
        name: 'Reused Name',
        startDate: '2024-09-01',
        endDate: '2025-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        numberOfSemesters: 2,
      })
      await t.mutation(api.academicYears.softDelete, {
        requesterId: boardId,
        academicYearId: yearId,
      })
    }

    // A third create with the same name must still succeed cleanly.
    const thirdYearId = await t.mutation(api.academicYears.create, {
      requesterId: boardId,
      name: 'Reused Name',
      startDate: '2024-09-01',
      endDate: '2025-05-31',
      timezone: 'Asia/Ho_Chi_Minh',
      numberOfSemesters: 2,
    })
    expect(thirdYearId).toBeDefined()

    // Creating a second *active* year with the same name must still be
    // rejected as a duplicate.
    await expect(
      t.mutation(api.academicYears.create, {
        requesterId: boardId,
        name: 'Reused Name',
        startDate: '2024-09-01',
        endDate: '2025-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        numberOfSemesters: 2,
      }),
    ).rejects.toThrow(ACADEMIC_YEAR_ERRORS.DUPLICATE_NAME)
  })

  test('update throws when year does not exist (line 107)', async () => {
    const t = authedConvexTest(schema, modules)
    const boardId = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0010',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    // Create and then soft-delete the year so its ID still exists but isDeleted = true
    const yearId = await t.mutation(api.academicYears.create, {
      requesterId: boardId,
      name: 'Temp Year',
      startDate: '2024-09-01',
      endDate: '2025-05-31',
      timezone: 'Asia/Ho_Chi_Minh',
      numberOfSemesters: 2,
    })
    await t.mutation(api.academicYears.softDelete, {
      requesterId: boardId,
      academicYearId: yearId,
    })

    await expect(
      t.mutation(api.academicYears.update, {
        requesterId: boardId,
        academicYearId: yearId,
        name: 'New Name',
      }),
    ).rejects.toThrow(ACADEMIC_YEAR_ERRORS.NOT_FOUND)
  })

  test('update throws on duplicate name when updating to an existing active name (line 120)', async () => {
    const t = authedConvexTest(schema, modules)
    const boardId = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0011',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const year1Id = await t.mutation(api.academicYears.create, {
      requesterId: boardId,
      name: '2024-2025',
      startDate: '2024-09-01',
      endDate: '2025-05-31',
      timezone: 'Asia/Ho_Chi_Minh',
      numberOfSemesters: 2,
    })
    await t.mutation(api.academicYears.create, {
      requesterId: boardId,
      name: '2025-2026',
      startDate: '2025-09-01',
      endDate: '2026-05-31',
      timezone: 'Asia/Ho_Chi_Minh',
      numberOfSemesters: 2,
    })

    // Try to rename 2024-2025 to the already-existing active name 2025-2026
    await expect(
      t.mutation(api.academicYears.update, {
        requesterId: boardId,
        academicYearId: year1Id,
        name: '2025-2026',
      }),
    ).rejects.toThrow(ACADEMIC_YEAR_ERRORS.DUPLICATE_NAME)
  })

  test('setActive throws when year does not exist (line 142)', async () => {
    const t = authedConvexTest(schema, modules)
    const boardId = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0012',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    // Create and soft-delete the year
    const yearId = await t.mutation(api.academicYears.create, {
      requesterId: boardId,
      name: 'Gone Year',
      startDate: '2023-09-01',
      endDate: '2024-05-31',
      timezone: 'Asia/Ho_Chi_Minh',
      numberOfSemesters: 2,
    })
    await t.mutation(api.academicYears.softDelete, {
      requesterId: boardId,
      academicYearId: yearId,
    })

    await expect(
      t.mutation(api.academicYears.setActive, {
        requesterId: boardId,
        academicYearId: yearId,
      }),
    ).rejects.toThrow(ACADEMIC_YEAR_ERRORS.NOT_FOUND)
  })

  test('softDelete throws when year does not exist (line 174)', async () => {
    const t = authedConvexTest(schema, modules)
    const boardId = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0013',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    // Create and delete the year, then try to delete again
    const yearId = await t.mutation(api.academicYears.create, {
      requesterId: boardId,
      name: 'Double Delete',
      startDate: '2023-09-01',
      endDate: '2024-05-31',
      timezone: 'Asia/Ho_Chi_Minh',
      numberOfSemesters: 2,
    })
    await t.mutation(api.academicYears.softDelete, {
      requesterId: boardId,
      academicYearId: yearId,
    })

    // Second delete should throw "not found" (year.isDeleted = true)
    await expect(
      t.mutation(api.academicYears.softDelete, {
        requesterId: boardId,
        academicYearId: yearId,
      }),
    ).rejects.toThrow(ACADEMIC_YEAR_ERRORS.NOT_FOUND)
  })

  test('listRecent returns at most limit results', async () => {
    const t = authedConvexTest(schema, modules)
    const boardId = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0014',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    // Create 3 years
    for (let i = 1; i <= 3; i++) {
      await t.mutation(api.academicYears.create, {
        requesterId: boardId,
        name: `Year ${i}`,
        startDate: `202${i}-09-01`,
        endDate: `202${i + 1}-05-31`,
        timezone: 'Asia/Ho_Chi_Minh',
        numberOfSemesters: 2,
      })
    }

    const recent = await t.query(api.academicYears.listRecent, {
      requesterId: boardId,
      limit: 2,
    })
    expect(recent).toHaveLength(2)

    const recentDefault = await t.query(api.academicYears.listRecent, {
      requesterId: boardId,
    })
    expect(recentDefault).toHaveLength(3) // all 3 are within the default limit of 5
  })

  test('creates numberOfSemesters rows in semesters table and enforces validation', async () => {
    const t = authedConvexTest(schema, modules)
    const boardId = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0020',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    // 1. Create with numberOfSemesters = 1
    const year1Id = await t.mutation(api.academicYears.create, {
      requesterId: boardId,
      name: 'Year 1 Sem',
      startDate: '2024-09-01',
      endDate: '2025-05-31',
      timezone: 'Asia/Ho_Chi_Minh',
      numberOfSemesters: 1,
    })

    const sems1 = await t.run(async (ctx) => {
      return ctx.db
        .query('semesters')
        .withIndex('by_academic_year_id_and_semester_number', (q) =>
          q.eq('academicYearId', year1Id),
        )
        .collect()
    })
    expect(sems1).toHaveLength(1)
    expect(sems1[0].semesterNumber).toBe(1)

    // 2. Create with numberOfSemesters = 4
    const year4Id = await t.mutation(api.academicYears.create, {
      requesterId: boardId,
      name: 'Year 4 Sem',
      startDate: '2025-09-01',
      endDate: '2026-05-31',
      timezone: 'Asia/Ho_Chi_Minh',
      numberOfSemesters: 4,
    })

    const sems4 = await t.run(async (ctx) => {
      return ctx.db
        .query('semesters')
        .withIndex('by_academic_year_id_and_semester_number', (q) =>
          q.eq('academicYearId', year4Id),
        )
        .collect()
    })
    expect(sems4).toHaveLength(4)
    expect(sems4.map((s) => s.semesterNumber)).toEqual([1, 2, 3, 4])

    // 3. Validation: 0
    await expect(
      t.mutation(api.academicYears.create, {
        requesterId: boardId,
        name: 'Year 0 Sem',
        startDate: '2026-09-01',
        endDate: '2027-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        numberOfSemesters: 0,
      }),
    ).rejects.toThrow(ACADEMIC_YEAR_ERRORS.INVALID_SEMESTER_COUNT)

    // 4. Validation: 5
    await expect(
      t.mutation(api.academicYears.create, {
        requesterId: boardId,
        name: 'Year 5 Sem',
        startDate: '2026-09-01',
        endDate: '2027-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        numberOfSemesters: 5,
      }),
    ).rejects.toThrow(ACADEMIC_YEAR_ERRORS.INVALID_SEMESTER_COUNT)

    // 5. Validation: 1.5
    await expect(
      t.mutation(api.academicYears.create, {
        requesterId: boardId,
        name: 'Year 1.5 Sem',
        startDate: '2026-09-01',
        endDate: '2027-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        numberOfSemesters: 1.5,
      }),
    ).rejects.toThrow(ACADEMIC_YEAR_ERRORS.INVALID_SEMESTER_COUNT)
  })

  test('listSemesters returns non-deleted semesters for the given academic year only', async () => {
    const t = authedConvexTest(schema, modules)
    const boardId = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0030',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    // Year with 2 semesters
    const year1Id = await t.mutation(api.academicYears.create, {
      requesterId: boardId,
      name: 'Year Sem List 1',
      startDate: '2024-09-01',
      endDate: '2025-05-31',
      timezone: 'Asia/Ho_Chi_Minh',
      numberOfSemesters: 2,
    })

    // A second, unrelated academic year with its own semesters — must not
    // leak into year1's results.
    const year2Id = await t.mutation(api.academicYears.create, {
      requesterId: boardId,
      name: 'Year Sem List 2',
      startDate: '2025-09-01',
      endDate: '2026-05-31',
      timezone: 'Asia/Ho_Chi_Minh',
      numberOfSemesters: 1,
    })

    // Returns semesters for the academic year, ascending by semesterNumber
    const semesters1 = await t.query(api.academicYears.listSemesters, {
      requesterId: boardId,
      academicYearId: year1Id,
    })
    expect(semesters1).toHaveLength(2)
    expect(semesters1.map((s) => s.semesterNumber)).toEqual([1, 2])
    expect(semesters1.every((s) => s.academicYearId === year1Id)).toBe(true)

    // Excludes semesters from other academic years
    const semesters2 = await t.query(api.academicYears.listSemesters, {
      requesterId: boardId,
      academicYearId: year2Id,
    })
    expect(semesters2).toHaveLength(1)
    expect(semesters2[0].academicYearId).toBe(year2Id)

    // Soft-delete one of year1's semesters and confirm it's excluded
    await t.run(async (ctx) => {
      await ctx.db.patch('semesters', semesters1[0]._id, { isDeleted: true })
    })

    const semestersAfterDelete = await t.query(
      api.academicYears.listSemesters,
      {
        requesterId: boardId,
        academicYearId: year1Id,
      },
    )
    expect(semestersAfterDelete).toHaveLength(1)
    expect(semestersAfterDelete[0]._id).toBe(semesters1[1]._id)
  })

  describe('semester start dates', () => {
    const base = {
      timezone: 'Asia/Ho_Chi_Minh',
      startDate: '2024-09-01',
      endDate: '2025-05-31',
    }
    const setup = async () => {
      const t = authedConvexTest(schema, modules)
      const requesterId = await t.run((ctx) =>
        ctx.db.insert('catechists', {
          memberId: 'GLV0090',
          fullName: 'Board User',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        }),
      )
      const semesters = (id: any) =>
        t.run((ctx) =>
          ctx.db
            .query('semesters')
            .withIndex('by_academic_year_id_and_semester_number', (q) =>
              q.eq('academicYearId', id),
            )
            .collect(),
        )
      return { t, requesterId, semesters }
    }

    test('create stores startDate on semesters 2..N and none on semester 1', async () => {
      const { t, requesterId, semesters } = await setup()
      const id = await t.mutation(api.academicYears.create, {
        requesterId,
        name: 'Y',
        ...base,
        numberOfSemesters: 3,
        semesterStartDates: ['2025-01-10', '2025-04-01'],
      })
      const sems = await semesters(id)
      expect(sems.map((s) => s.startDate)).toEqual([
        undefined,
        '2025-01-10',
        '2025-04-01',
      ])
    })

    test.each([
      ['wrong count', ['2025-01-10']],
      ['non-ascending', ['2025-04-01', '2025-01-10']],
      ['equal dates', ['2025-01-10', '2025-01-10']],
      ['after year end', ['2025-01-10', '2025-06-01']],
      ['not after year start', ['2024-09-01', '2025-01-10']],
      ['before year start', ['2024-08-01', '2025-01-10']],
      ['malformed', ['not-a-date', '2025-04-01']],
    ])('create rejects %s', async (_label, dates) => {
      const { t, requesterId } = await setup()
      await expect(
        t.mutation(api.academicYears.create, {
          requesterId,
          name: 'Y',
          ...base,
          numberOfSemesters: 3,
          semesterStartDates: dates,
        }),
      ).rejects.toThrow(ACADEMIC_YEAR_ERRORS.INVALID_SEMESTER_DATES)
    })

    test('create accepts a date equal to the year end', async () => {
      const { t, requesterId } = await setup()
      await expect(
        t.mutation(api.academicYears.create, {
          requesterId,
          name: 'Y',
          ...base,
          numberOfSemesters: 2,
          semesterStartDates: ['2025-05-31'],
        }),
      ).resolves.toBeDefined()
    })

    test('update patches semester dates and rejects wrong length', async () => {
      const { t, requesterId, semesters } = await setup()
      const id = await t.mutation(api.academicYears.create, {
        requesterId,
        name: 'Y',
        ...base,
        numberOfSemesters: 3,
        semesterStartDates: ['2025-01-10', '2025-04-01'],
      })
      await t.mutation(api.academicYears.update, {
        requesterId,
        academicYearId: id,
        semesterStartDates: ['2025-02-01', '2025-03-01'],
      })
      expect((await semesters(id)).map((s) => s.startDate)).toEqual([
        undefined,
        '2025-02-01',
        '2025-03-01',
      ])
      await expect(
        t.mutation(api.academicYears.update, {
          requesterId,
          academicYearId: id,
          semesterStartDates: ['2025-02-01'],
        }),
      ).rejects.toThrow(ACADEMIC_YEAR_ERRORS.INVALID_SEMESTER_DATES)
    })

    test('update rejects shrinking endDate past a stored date', async () => {
      const { t, requesterId } = await setup()
      const id = await t.mutation(api.academicYears.create, {
        requesterId,
        name: 'Y',
        ...base,
        numberOfSemesters: 2,
        semesterStartDates: ['2025-04-01'],
      })
      await expect(
        t.mutation(api.academicYears.update, {
          requesterId,
          academicYearId: id,
          endDate: '2025-03-01',
        }),
      ).rejects.toThrow(ACADEMIC_YEAR_ERRORS.INVALID_SEMESTER_DATES)
    })

    test('update rejects moving startDate to or past a stored date', async () => {
      const { t, requesterId } = await setup()
      const id = await t.mutation(api.academicYears.create, {
        requesterId,
        name: 'Y',
        ...base,
        numberOfSemesters: 2,
        semesterStartDates: ['2025-04-01'],
      })
      await expect(
        t.mutation(api.academicYears.update, {
          requesterId,
          academicYearId: id,
          startDate: '2025-04-01',
        }),
      ).rejects.toThrow(ACADEMIC_YEAR_ERRORS.INVALID_SEMESTER_DATES)
    })

    test('legacy years without dates can still be updated', async () => {
      const { t, requesterId, semesters } = await setup()
      const id = await t.mutation(api.academicYears.create, {
        requesterId,
        name: 'Legacy',
        ...base,
        numberOfSemesters: 2,
      })
      await t.mutation(api.academicYears.update, {
        requesterId,
        academicYearId: id,
        name: 'Legacy 2',
        endDate: '2025-03-01',
      })
      const sems = await semesters(id)
      expect(sems.every((s) => s.startDate === undefined)).toBe(true)
      const year = await t.run((ctx) => ctx.db.get('academicYears', id))
      expect(year?.name).toBe('Legacy 2')
    })
  })
})
