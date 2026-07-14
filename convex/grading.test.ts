/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import {
  ANNUAL_RESULT_ERRORS,
  AUTHZ_ERRORS,
  SCORE_COLUMN_ERRORS,
  SCORE_ENTRY_ERRORS,
  SEMESTER_RESULT_ERRORS,
} from './lib/errors'

const modules = import.meta.glob('./**/*.ts')

async function seedBaseData(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const adminId = await ctx.db.insert('catechists', {
      memberId: 'GLV0001',
      fullName: 'Admin User',
      role: 'admin',
      isActive: true,
      isDeleted: false,
    })

    const catechistId = await ctx.db.insert('catechists', {
      memberId: 'GLV0002',
      fullName: 'Regular Catechist',
      role: 'user',
      isActive: true,
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

    const semesterId = await ctx.db.insert('semesters', {
      academicYearId,
      semesterNumber: 1,
      name: 'Học Kỳ 1',
      isDeleted: false,
    })

    const branchId = await ctx.db.insert('branches', {
      name: 'Thiếu Nhi',
      sortOrder: 3,
      isDeleted: false,
    })

    const classId = await ctx.db.insert('classes', {
      branchId,
      name: 'Thiếu Nhi 1',
      isDeleted: false,
    })

    const classYearId = await ctx.db.insert('classYears', {
      classId,
      academicYearId,
      isDeleted: false,
    })

    await ctx.db.insert('classCatechists', {
      catechistId: adminId,
      classYearId,
      academicYearId,
      role: 'homeroom',
      isDeleted: false,
    })

    const studentId = await ctx.db.insert('students', {
      studentCode: 'HS0001',
      fullName: 'Test Student',
      isActive: true,
      createdAt: Date.now(),
      isDeleted: false,
    })

    const studentClassId = await ctx.db.insert('studentClasses', {
      studentId,
      classYearId,
      isPrimaryClass: true,
      enrolledDate: '2024-09-01',
      status: 'active',
      isDeleted: false,
    })

    return {
      adminId,
      catechistId,
      academicYearId,
      semesterId,
      classYearId,
      studentClassId,
    }
  })
}

describe('ScoreColumn', () => {
  test('CRUD operations', async () => {
    const t = convexTest(schema, modules)
    const { adminId, catechistId, classYearId, semesterId } =
      await seedBaseData(t)

    // 1. Query list is initially empty
    const initialList = await t.query(api.grading.listScoreColumns, {
      requesterId: adminId,
      classYearId,
      semesterId,
    })
    expect(initialList).toEqual([])

    // 2. Create rejects non-admin
    await expect(
      t.mutation(api.grading.createScoreColumn, {
        requesterId: catechistId,
        classYearId,
        semesterId,
        columnName: '15-min Quiz 1',
        columnType: 'short_quiz',
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.NO_CLASS_ACCESS)

    // 3. Create accepts admin
    const col1Id = await t.mutation(api.grading.createScoreColumn, {
      requesterId: adminId,
      classYearId,
      semesterId,
      columnName: '15-min Quiz 1',
      columnType: 'short_quiz',
      sortOrder: 1,
    })
    expect(col1Id).toBeDefined()

    const col2Id = await t.mutation(api.grading.createScoreColumn, {
      requesterId: adminId,
      classYearId,
      semesterId,
      columnName: 'Semester Exam',
      columnType: 'semester_exam',
      scaleType: 'scale_10',
      sortOrder: 5,
    })
    expect(col2Id).toBeDefined()

    // 4. List returns columns sorted by sortOrder
    const list = await t.query(api.grading.listScoreColumns, {
      requesterId: adminId,
      classYearId,
      semesterId,
    })
    expect(list).toHaveLength(2)
    expect(list[0]._id).toBe(col1Id)
    expect(list[0].sortOrder).toBe(1)
    expect(list[0].scaleType).toBe('scale_10')
    expect(list[1]._id).toBe(col2Id)
    expect(list[1].sortOrder).toBe(5)

    // 5. Get single column
    const col1 = await t.query(api.grading.getScoreColumn, {
      requesterId: adminId,
      id: col1Id,
    })
    expect(col1?.columnName).toBe('15-min Quiz 1')

    // 6. Update column
    await t.mutation(api.grading.updateScoreColumn, {
      requesterId: adminId,
      id: col1Id,
      columnName: '15-min Quiz 1 Updated',
      sortOrder: 2,
    })
    const updatedCol = await t.query(api.grading.getScoreColumn, {
      requesterId: adminId,
      id: col1Id,
    })
    expect(updatedCol?.columnName).toBe('15-min Quiz 1 Updated')
    expect(updatedCol?.sortOrder).toBe(2)

    // 7. Soft delete
    await t.mutation(api.grading.softDeleteScoreColumn, {
      requesterId: adminId,
      id: col1Id,
    })
    const listAfterDelete = await t.query(api.grading.listScoreColumns, {
      requesterId: adminId,
      classYearId,
      semesterId,
    })
    expect(listAfterDelete).toHaveLength(1)
    expect(listAfterDelete[0]._id).toBe(col2Id)

    // 8. Delete again throws not found
    await expect(
      t.mutation(api.grading.softDeleteScoreColumn, {
        requesterId: adminId,
        id: col1Id,
      }),
    ).rejects.toThrow(SCORE_COLUMN_ERRORS.NOT_FOUND)
  })

  test('soft delete with entries throws IN_USE_BY_ENTRIES', async () => {
    const t = convexTest(schema, modules)
    const { adminId, classYearId, semesterId, studentClassId } =
      await seedBaseData(t)

    const colId = await t.mutation(api.grading.createScoreColumn, {
      requesterId: adminId,
      classYearId,
      semesterId,
      columnName: 'Quiz 1',
      columnType: 'short_quiz',
      sortOrder: 1,
    })

    await t.mutation(api.grading.upsertScoreEntry, {
      requesterId: adminId,
      studentClassId,
      scoreColumnId: colId,
      scoreValue: 8.5,
    })

    await expect(
      t.mutation(api.grading.softDeleteScoreColumn, {
        requesterId: adminId,
        id: colId,
      }),
    ).rejects.toThrow(SCORE_COLUMN_ERRORS.IN_USE_BY_ENTRIES)
  })

  test('update throws on non-existent or soft-deleted column', async () => {
    const t = convexTest(schema, modules)
    const { adminId, classYearId, semesterId } = await seedBaseData(t)

    const colId = await t.mutation(api.grading.createScoreColumn, {
      requesterId: adminId,
      classYearId,
      semesterId,
      columnName: 'Temp Column',
      columnType: 'short_quiz',
      sortOrder: 1,
    })

    await t.mutation(api.grading.softDeleteScoreColumn, {
      requesterId: adminId,
      id: colId,
    })

    await expect(
      t.mutation(api.grading.updateScoreColumn, {
        requesterId: adminId,
        id: colId,
        columnName: 'New Name',
      }),
    ).rejects.toThrow(SCORE_COLUMN_ERRORS.NOT_FOUND)
  })

  test('create with pass_fail scale type', async () => {
    const t = convexTest(schema, modules)
    const { adminId, classYearId, semesterId } = await seedBaseData(t)

    const colId = await t.mutation(api.grading.createScoreColumn, {
      requesterId: adminId,
      classYearId,
      semesterId,
      columnName: 'Pass/Fail Quiz',
      columnType: 'short_quiz',
      scaleType: 'pass_fail',
      sortOrder: 1,
    })

    const col = await t.query(api.grading.getScoreColumn, {
      requesterId: adminId,
      id: colId,
    })
    expect(col?.scaleType).toBe('pass_fail')
  })
})

describe('ScoreColumn weight validation', () => {
  test('createScoreColumn accepts valid weights and defaults to 1 when omitted', async () => {
    const t = convexTest(schema, modules)
    const { adminId, classYearId, semesterId } = await seedBaseData(t)

    for (const weight of [1, 2, 3] as const) {
      const colId = await t.mutation(api.grading.createScoreColumn, {
        requesterId: adminId,
        classYearId,
        semesterId,
        columnName: `Weighted col ${weight}`,
        columnType: 'short_quiz',
        weight,
      })
      const col = await t.query(api.grading.getScoreColumn, {
        requesterId: adminId,
        id: colId,
      })
      expect(col?.weight).toBe(weight)
    }

    const defaultedId = await t.mutation(api.grading.createScoreColumn, {
      requesterId: adminId,
      classYearId,
      semesterId,
      columnName: 'No weight given',
      columnType: 'short_quiz',
    })
    const defaultedCol = await t.query(api.grading.getScoreColumn, {
      requesterId: adminId,
      id: defaultedId,
    })
    expect(defaultedCol?.weight).toBe(1)
  })

  test('createScoreColumn rejects invalid weights', async () => {
    const t = convexTest(schema, modules)
    const { adminId, classYearId, semesterId } = await seedBaseData(t)

    for (const weight of [0, 4, 2.5]) {
      await expect(
        t.mutation(api.grading.createScoreColumn, {
          requesterId: adminId,
          classYearId,
          semesterId,
          columnName: 'Invalid weight col',
          columnType: 'short_quiz',
          weight,
        }),
      ).rejects.toThrow(SCORE_COLUMN_ERRORS.INVALID_WEIGHT)
    }
  })

  test('updateScoreColumn accepts valid weights and rejects invalid ones', async () => {
    const t = convexTest(schema, modules)
    const { adminId, classYearId, semesterId } = await seedBaseData(t)

    const colId = await t.mutation(api.grading.createScoreColumn, {
      requesterId: adminId,
      classYearId,
      semesterId,
      columnName: 'Updatable col',
      columnType: 'short_quiz',
    })

    await t.mutation(api.grading.updateScoreColumn, {
      requesterId: adminId,
      id: colId,
      weight: 2,
    })
    const updated = await t.query(api.grading.getScoreColumn, {
      requesterId: adminId,
      id: colId,
    })
    expect(updated?.weight).toBe(2)

    // Omitted weight is a no-op (assertValidWeight no-op on undefined)
    await t.mutation(api.grading.updateScoreColumn, {
      requesterId: adminId,
      id: colId,
      columnName: 'Updatable col renamed',
    })
    const afterNoopUpdate = await t.query(api.grading.getScoreColumn, {
      requesterId: adminId,
      id: colId,
    })
    expect(afterNoopUpdate?.weight).toBe(2)

    for (const weight of [0, 4, 2.5]) {
      await expect(
        t.mutation(api.grading.updateScoreColumn, {
          requesterId: adminId,
          id: colId,
          weight,
        }),
      ).rejects.toThrow(SCORE_COLUMN_ERRORS.INVALID_WEIGHT)
    }
  })
})

describe('ScoreEntry', () => {
  test('upsert create, update with audit trail, soft delete', async () => {
    const t = convexTest(schema, modules)
    const { adminId, classYearId, semesterId, studentClassId } =
      await seedBaseData(t)

    const colId = await t.mutation(api.grading.createScoreColumn, {
      requesterId: adminId,
      classYearId,
      semesterId,
      columnName: 'Quiz 1',
      columnType: 'short_quiz',
      sortOrder: 1,
    })

    // 1. Create score entry
    const entryId = await t.mutation(api.grading.upsertScoreEntry, {
      requesterId: adminId,
      studentClassId,
      scoreColumnId: colId,
      scoreValue: 8.5,
    })
    expect(entryId).toBeDefined()

    // 2. List entries for column
    const entries = await t.query(api.grading.listScoreEntries, {
      requesterId: adminId,
      scoreColumnId: colId,
    })
    expect(entries).toHaveLength(1)
    expect(entries[0].scoreValue).toBe(8.5)
    expect(entries[0].enteredBy).toBe(adminId)
    expect(entries[0].enteredAt).toBeDefined()
    expect(entries[0].updatedAt).toBeUndefined()

    // 3. List student scores
    const studentScores = await t.query(api.grading.listStudentScores, {
      requesterId: adminId,
      studentClassId,
    })
    expect(studentScores).toHaveLength(1)

    // 4. Check history is empty (initial create has no history)
    const history = await t.query(api.grading.listScoreEntryHistory, {
      requesterId: adminId,
      scoreEntryId: entryId,
    })
    expect(history).toHaveLength(0)

    // 5. Update score entry
    await t.mutation(api.grading.upsertScoreEntry, {
      requesterId: adminId,
      studentClassId,
      scoreColumnId: colId,
      scoreValue: 9.0,
    })
    const updatedEntry = await t.query(api.grading.listScoreEntries, {
      requesterId: adminId,
      scoreColumnId: colId,
    })
    expect(updatedEntry[0].scoreValue).toBe(9.0)
    expect(updatedEntry[0].updatedAt).toBeDefined()

    // 6. Verify audit trail has one entry
    const historyAfterUpdate = await t.query(
      api.grading.listScoreEntryHistory,
      {
        requesterId: adminId,
        scoreEntryId: entryId,
      },
    )
    expect(historyAfterUpdate).toHaveLength(1)
    expect(historyAfterUpdate[0].oldScoreValue).toBe(8.5)
    expect(historyAfterUpdate[0].newScoreValue).toBe(9.0)
    expect(historyAfterUpdate[0].changedBy).toBe(adminId)

    // 7. Soft delete
    await t.mutation(api.grading.softDeleteScoreEntry, {
      requesterId: adminId,
      id: entryId,
    })
    const entriesAfterDelete = await t.query(api.grading.listScoreEntries, {
      requesterId: adminId,
      scoreColumnId: colId,
    })
    expect(entriesAfterDelete).toHaveLength(0)

    // 8. Delete again throws not found
    await expect(
      t.mutation(api.grading.softDeleteScoreEntry, {
        requesterId: adminId,
        id: entryId,
      }),
    ).rejects.toThrow(SCORE_ENTRY_ERRORS.NOT_FOUND)
  })

  test('upsert recreates after soft delete', async () => {
    const t = convexTest(schema, modules)
    const { adminId, classYearId, semesterId, studentClassId } =
      await seedBaseData(t)

    const colId = await t.mutation(api.grading.createScoreColumn, {
      requesterId: adminId,
      classYearId,
      semesterId,
      columnName: 'Quiz 1',
      columnType: 'short_quiz',
      sortOrder: 1,
    })

    const entryId = await t.mutation(api.grading.upsertScoreEntry, {
      requesterId: adminId,
      studentClassId,
      scoreColumnId: colId,
      scoreValue: 7.0,
    })

    await t.mutation(api.grading.softDeleteScoreEntry, {
      requesterId: adminId,
      id: entryId,
    })

    const newEntryId = await t.mutation(api.grading.upsertScoreEntry, {
      requesterId: adminId,
      studentClassId,
      scoreColumnId: colId,
      scoreValue: 9.5,
    })

    expect(newEntryId).toBe(entryId)

    const entries = await t.query(api.grading.listScoreEntries, {
      requesterId: adminId,
      scoreColumnId: colId,
    })
    expect(entries).toHaveLength(1)
    expect(entries[0].scoreValue).toBe(9.5)
    expect(entries[0].isDeleted).toBe(false)
  })

  test('rejects non-homeroom catechist', async () => {
    const t = convexTest(schema, modules)
    const { catechistId, adminId, classYearId, semesterId, studentClassId } =
      await seedBaseData(t)

    const colId = await t.mutation(api.grading.createScoreColumn, {
      requesterId: adminId,
      classYearId,
      semesterId,
      columnName: 'Quiz 1',
      columnType: 'short_quiz',
      sortOrder: 1,
    })

    await expect(
      t.mutation(api.grading.upsertScoreEntry, {
        requesterId: catechistId,
        studentClassId,
        scoreColumnId: colId,
        scoreValue: 8.0,
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.NO_CLASS_ACCESS)
  })
})

describe('SemesterResult', () => {
  test('upsert, get, update, soft delete', async () => {
    const t = convexTest(schema, modules)
    const { adminId, semesterId, studentClassId } = await seedBaseData(t)

    // 1. Query initial state returns null
    const initial = await t.query(api.grading.getSemesterResult, {
      requesterId: adminId,
      studentClassId,
      semesterId,
    })
    expect(initial).toBeNull()

    // 2. Upsert create
    const resultId = await t.mutation(api.grading.upsertSemesterResult, {
      requesterId: adminId,
      studentClassId,
      semesterId,
      morality: 'good',
      teacherNote: 'Good progress',
      isCompleted: false,
    })
    expect(resultId).toBeDefined()

    // 3. Get
    const result = await t.query(api.grading.getSemesterResult, {
      requesterId: adminId,
      studentClassId,
      semesterId,
    })
    expect(result?.morality).toBe('good')
    expect(result?.teacherNote).toBe('Good progress')
    expect(result?.recordedBy).toBe(adminId)

    // 4. Upsert update
    await t.mutation(api.grading.upsertSemesterResult, {
      requesterId: adminId,
      studentClassId,
      semesterId,
      morality: 'excellent',
      isCompleted: true,
    })
    const updated = await t.query(api.grading.getSemesterResult, {
      requesterId: adminId,
      studentClassId,
      semesterId,
    })
    expect(updated?.morality).toBe('excellent')
    expect(updated?.isCompleted).toBe(true)
    expect(updated?.teacherNote).toBe('Good progress')

    // 5. Soft delete
    await t.mutation(api.grading.softDeleteSemesterResult, {
      requesterId: adminId,
      id: resultId,
    })
    const deleted = await t.query(api.grading.getSemesterResult, {
      requesterId: adminId,
      studentClassId,
      semesterId,
    })
    expect(deleted).toBeNull()

    // 6. Delete again throws not found
    await expect(
      t.mutation(api.grading.softDeleteSemesterResult, {
        requesterId: adminId,
        id: resultId,
      }),
    ).rejects.toThrow(SEMESTER_RESULT_ERRORS.NOT_FOUND)
  })

  test('listSemesterResults by classYearId and semesterId', async () => {
    const t = convexTest(schema, modules)
    const { adminId, classYearId, semesterId, studentClassId } =
      await seedBaseData(t)

    const results = await t.query(api.grading.listSemesterResults, {
      requesterId: adminId,
      classYearId,
      semesterId,
    })
    expect(results).toHaveLength(0)

    await t.mutation(api.grading.upsertSemesterResult, {
      requesterId: adminId,
      studentClassId,
      semesterId,
      morality: 'good',
    })

    const resultsAfter = await t.query(api.grading.listSemesterResults, {
      requesterId: adminId,
      classYearId,
      semesterId,
    })
    expect(resultsAfter).toHaveLength(1)
    expect(resultsAfter[0].morality).toBe('good')
  })

  test('listSemesterResultsByClassYear returns results across all semesters', async () => {
    const t = convexTest(schema, modules)
    const { adminId, academicYearId, classYearId, studentClassId } =
      await seedBaseData(t)

    // Empty case: no results exist yet
    const initial = await t.query(api.grading.listSemesterResultsByClassYear, {
      requesterId: adminId,
      classYearId,
    })
    expect(initial).toHaveLength(0)

    // Seed a second semester for the same academic year
    const semester2Id = await t.run(async (ctx) => {
      return await ctx.db.insert('semesters', {
        academicYearId,
        semesterNumber: 2,
        name: 'Học Kỳ 2',
        isDeleted: false,
      })
    })

    const semester1Id = await t.run(async (ctx) => {
      const semesters = await ctx.db.query('semesters').collect()
      return semesters.find((s) => s.semesterNumber === 1)!._id
    })

    // Create semester result for semester 1
    const result1Id = await t.mutation(api.grading.upsertSemesterResult, {
      requesterId: adminId,
      studentClassId,
      semesterId: semester1Id,
      morality: 'good',
      teacherNote: 'Semester 1 note',
    })

    // Create semester result for semester 2
    const result2Id = await t.mutation(api.grading.upsertSemesterResult, {
      requesterId: adminId,
      studentClassId,
      semesterId: semester2Id,
      morality: 'excellent',
      teacherNote: 'Semester 2 note',
    })

    // Results across both semesters are returned together
    const results = await t.query(api.grading.listSemesterResultsByClassYear, {
      requesterId: adminId,
      classYearId,
    })
    expect(results).toHaveLength(2)
    const resultIds = results.map((r) => r._id).sort()
    expect(resultIds).toEqual([result1Id, result2Id].sort())

    // Soft-deleted results are excluded
    await t.mutation(api.grading.softDeleteSemesterResult, {
      requesterId: adminId,
      id: result1Id,
    })

    const resultsAfterDelete = await t.query(
      api.grading.listSemesterResultsByClassYear,
      {
        requesterId: adminId,
        classYearId,
      },
    )
    expect(resultsAfterDelete).toHaveLength(1)
    expect(resultsAfterDelete[0]._id).toBe(result2Id)
  })
})

describe('AnnualResult', () => {
  test('upsert, get, update, soft delete', async () => {
    const t = convexTest(schema, modules)
    const { adminId, studentClassId } = await seedBaseData(t)

    // 1. Query initial state returns null
    const initial = await t.query(api.grading.getAnnualResult, {
      requesterId: adminId,
      studentClassId,
    })
    expect(initial).toBeNull()

    // 2. Upsert create
    const resultId = await t.mutation(api.grading.upsertAnnualResult, {
      requesterId: adminId,
      studentClassId,
      conductGrade: 'good',
      remark: 'Good student',
      isCompleted: true,
    })
    expect(resultId).toBeDefined()

    // 3. Get
    const result = await t.query(api.grading.getAnnualResult, {
      requesterId: adminId,
      studentClassId,
    })
    expect(result?.conductGrade).toBe('good')
    expect(result?.remark).toBe('Good student')
    expect(result?.isCompleted).toBe(true)

    // 4. Upsert update
    await t.mutation(api.grading.upsertAnnualResult, {
      requesterId: adminId,
      studentClassId,
      conductGrade: 'excellent',
    })
    const updated = await t.query(api.grading.getAnnualResult, {
      requesterId: adminId,
      studentClassId,
    })
    expect(updated?.conductGrade).toBe('excellent')
    expect(updated?.remark).toBe('Good student')

    // 5. Soft delete
    await t.mutation(api.grading.softDeleteAnnualResult, {
      requesterId: adminId,
      id: resultId,
    })
    const deleted = await t.query(api.grading.getAnnualResult, {
      requesterId: adminId,
      studentClassId,
    })
    expect(deleted).toBeNull()

    // 6. Delete again throws not found
    await expect(
      t.mutation(api.grading.softDeleteAnnualResult, {
        requesterId: adminId,
        id: resultId,
      }),
    ).rejects.toThrow(ANNUAL_RESULT_ERRORS.NOT_FOUND)
  })

  test('listAnnualResults by classYearId', async () => {
    const t = convexTest(schema, modules)
    const { adminId, classYearId, studentClassId } = await seedBaseData(t)

    const results = await t.query(api.grading.listAnnualResults, {
      requesterId: adminId,
      classYearId,
    })
    expect(results).toHaveLength(0)

    await t.mutation(api.grading.upsertAnnualResult, {
      requesterId: adminId,
      studentClassId,
      conductGrade: 'excellent',
    })

    const resultsAfter = await t.query(api.grading.listAnnualResults, {
      requesterId: adminId,
      classYearId,
    })
    expect(resultsAfter).toHaveLength(1)
    expect(resultsAfter[0].conductGrade).toBe('excellent')
  })
})

describe('Grades & Scores Grid Board', () => {
  test('getScoresGrid query and createColumnWithScores mutation', async () => {
    const t = convexTest(schema, modules)
    const { adminId, classYearId, semesterId, studentClassId } =
      await seedBaseData(t)

    // Verify initial grid
    const initialGrid = await t.query(api.grading.getScoresGrid, {
      requesterId: adminId,
      classId: await t.run(async (ctx) => {
        const cy = await ctx.db.get('classYears', classYearId)
        return cy!.classId
      }),
      academicYearId: await t.run(async (ctx) => {
        const cy = await ctx.db.get('classYears', classYearId)
        return cy!.academicYearId
      }),
    })

    expect(initialGrid.students).toHaveLength(1)
    expect(initialGrid.scoreColumns).toHaveLength(0)
    expect(initialGrid.scoreEntriesMap).toEqual({})

    // Create column with scores bulk mutation
    const colId = await t.mutation(api.grading.createColumnWithScores, {
      requesterId: adminId,
      classYearId,
      semesterId,
      columnName: 'Midterm test 1',
      columnType: 'midterm_test',
      scaleType: 'scale_10',
      sortOrder: 1,
      scores: [
        {
          studentId: await t.run(async (ctx) => {
            const sc = await ctx.db.get('studentClasses', studentClassId)
            return sc!.studentId
          }),
          scoreValue: 8.5,
        },
      ],
    })

    expect(colId).toBeDefined()

    // Fetch grid again and verify populated columns and map
    const gridAfter = await t.query(api.grading.getScoresGrid, {
      requesterId: adminId,
      classId: await t.run(async (ctx) => {
        const cy = await ctx.db.get('classYears', classYearId)
        return cy!.classId
      }),
      academicYearId: await t.run(async (ctx) => {
        const cy = await ctx.db.get('classYears', classYearId)
        return cy!.academicYearId
      }),
    })

    expect(gridAfter.scoreColumns).toHaveLength(1)
    expect(gridAfter.scoreColumns[0].columnName).toBe('Midterm test 1')

    const cellKey = `${studentClassId}_${colId}`
    expect(gridAfter.scoreEntriesMap[cellKey]).toBeDefined()
    expect(gridAfter.scoreEntriesMap[cellKey].scoreValue).toBe(8.5)
  })

  test('createColumnWithScores validates weight, defaults to 1, and getScoresGrid returns it', async () => {
    const t = convexTest(schema, modules)
    const { adminId, classYearId, semesterId, studentClassId } =
      await seedBaseData(t)

    const studentId = await t.run(async (ctx) => {
      const sc = await ctx.db.get('studentClasses', studentClassId)
      return sc!.studentId
    })

    await expect(
      t.mutation(api.grading.createColumnWithScores, {
        requesterId: adminId,
        classYearId,
        semesterId,
        columnName: 'Invalid weight bulk col',
        columnType: 'midterm_test',
        weight: 4,
        scores: [],
      }),
    ).rejects.toThrow(SCORE_COLUMN_ERRORS.INVALID_WEIGHT)

    const weightedColId = await t.mutation(api.grading.createColumnWithScores, {
      requesterId: adminId,
      classYearId,
      semesterId,
      columnName: 'Weighted bulk col',
      columnType: 'midterm_test',
      weight: 3,
      scores: [{ studentId, scoreValue: 9 }],
    })

    const defaultedColId = await t.mutation(
      api.grading.createColumnWithScores,
      {
        requesterId: adminId,
        classYearId,
        semesterId,
        columnName: 'Defaulted bulk col',
        columnType: 'midterm_test',
        scores: [],
      },
    )

    const classId = await t.run(async (ctx) => {
      const cy = await ctx.db.get('classYears', classYearId)
      return cy!.classId
    })
    const academicYearId = await t.run(async (ctx) => {
      const cy = await ctx.db.get('classYears', classYearId)
      return cy!.academicYearId
    })
    const grid = await t.query(api.grading.getScoresGrid, {
      requesterId: adminId,
      classId,
      academicYearId,
    })

    const weightedCol = grid.scoreColumns.find((c) => c._id === weightedColId)
    const defaultedCol = grid.scoreColumns.find((c) => c._id === defaultedColId)
    expect(weightedCol?.weight).toBe(3)
    expect(defaultedCol?.weight).toBe(1)
  })

  test('score update reason audit log and populated name', async () => {
    const t = convexTest(schema, modules)
    const { adminId, classYearId, semesterId, studentClassId } =
      await seedBaseData(t)

    const colId = await t.mutation(api.grading.createScoreColumn, {
      requesterId: adminId,
      classYearId,
      semesterId,
      columnName: 'Quiz 1',
      columnType: 'short_quiz',
      sortOrder: 1,
    })

    // Create entry
    const entryId = await t.mutation(api.grading.upsertScoreEntry, {
      requesterId: adminId,
      studentClassId,
      scoreColumnId: colId,
      scoreValue: 7.0,
    })

    // Update entry with reason
    await t.mutation(api.grading.upsertScoreEntry, {
      requesterId: adminId,
      studentClassId,
      scoreColumnId: colId,
      scoreValue: 9.0,
      reason: 'Đổi điểm phúc khảo',
    })

    // Get audit trail and check reason and name
    const history = await t.query(api.grading.listScoreEntryHistory, {
      requesterId: adminId,
      scoreEntryId: entryId,
    })

    expect(history).toHaveLength(1)
    expect(history[0].oldScoreValue).toBe(7.0)
    expect(history[0].newScoreValue).toBe(9.0)
    expect(history[0].reason).toBe('Đổi điểm phúc khảo')
    expect(history[0].changedByName).toBe('Admin User')
  })

  test('homeroom catechist permissions for score columns', async () => {
    const t = convexTest(schema, modules)
    const { catechistId, classYearId, semesterId } = await seedBaseData(t)

    // Regular catechist (non-homeroom) cannot create columns
    await expect(
      t.mutation(api.grading.createScoreColumn, {
        requesterId: catechistId,
        classYearId,
        semesterId,
        columnName: 'Quiz 1',
        columnType: 'short_quiz',
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.NO_CLASS_ACCESS)

    // Make the user a co-teacher or check that they are not homeroom
    // Now seed homeroom role for regular catechist for classYearId
    await t.run(async (ctx) => {
      await ctx.db.insert('classCatechists', {
        catechistId,
        classYearId,
        academicYearId: (await ctx.db.get('classYears', classYearId))!
          .academicYearId,
        role: 'homeroom',
        isDeleted: false,
      })
    })

    // Homeroom catechist can now create columns
    const colId = await t.mutation(api.grading.createScoreColumn, {
      requesterId: catechistId,
      classYearId,
      semesterId,
      columnName: 'Quiz 2',
      columnType: 'short_quiz',
    })

    expect(colId).toBeDefined()
  })
})

describe('getMyGradingProgress', () => {
  test('excludes fully-graded columns, includes partially-graded ones', async () => {
    const t = convexTest(schema, modules)
    const { adminId, academicYearId, classYearId, semesterId, studentClassId } =
      await seedBaseData(t)

    // Fully-graded column: single active student, single entry with a value
    const fullColId = await t.mutation(api.grading.createScoreColumn, {
      requesterId: adminId,
      classYearId,
      semesterId,
      columnName: 'Fully Graded Quiz',
      columnType: 'short_quiz',
      sortOrder: 1,
    })
    await t.mutation(api.grading.upsertScoreEntry, {
      requesterId: adminId,
      studentClassId,
      scoreColumnId: fullColId,
      scoreValue: 9.0,
    })

    // Partially-graded column: no entries yet
    const partialColId = await t.mutation(api.grading.createScoreColumn, {
      requesterId: adminId,
      classYearId,
      semesterId,
      columnName: 'Partially Graded Quiz',
      columnType: 'short_quiz',
      sortOrder: 2,
    })

    const progress = await t.query(api.grading.getMyGradingProgress, {
      requesterId: adminId,
      academicYearId,
    })

    expect(progress).toHaveLength(1)
    expect(progress[0].scoreColumnId).toBe(partialColId)
    expect(progress[0].columnName).toBe('Partially Graded Quiz')
    expect(progress[0].enteredCount).toBe(0)
    expect(progress[0].studentCount).toBe(1)
    expect(progress[0].semesterNumber).toBe(1)
    expect(progress[0].classYearId).toBe(classYearId)
  })

  test('withdrawn students do not count toward studentCount or enteredCount', async () => {
    const t = convexTest(schema, modules)
    const { adminId, academicYearId, classYearId, semesterId } =
      await seedBaseData(t)

    // Second student, withdrawn, with a score entry recorded before withdrawal
    const withdrawnStudentClassId = await t.run(async (ctx) => {
      const studentId = await ctx.db.insert('students', {
        studentCode: 'HS0002',
        fullName: 'Withdrawn Student',
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
      return await ctx.db.insert('studentClasses', {
        studentId,
        classYearId,
        isPrimaryClass: true,
        enrolledDate: '2024-09-01',
        status: 'withdrawn',
        isDeleted: false,
      })
    })

    const colId = await t.mutation(api.grading.createScoreColumn, {
      requesterId: adminId,
      classYearId,
      semesterId,
      columnName: 'Quiz 1',
      columnType: 'short_quiz',
      sortOrder: 1,
    })

    // Entry for the still-active student (leaves the column incomplete)
    // is intentionally omitted; only the withdrawn student's entry exists.
    await t.run(async (ctx) => {
      await ctx.db.insert('scoreEntries', {
        studentClassId: withdrawnStudentClassId,
        scoreColumnId: colId,
        scoreValue: 7.0,
        enteredBy: adminId,
        enteredAt: Date.now(),
        isDeleted: false,
      })
    })

    const progress = await t.query(api.grading.getMyGradingProgress, {
      requesterId: adminId,
      academicYearId,
    })

    expect(progress).toHaveLength(1)
    // studentCount reflects only the active enrollment (studentClassId), not
    // the withdrawn one.
    expect(progress[0].studentCount).toBe(1)
    // The withdrawn student's entry must not count toward enteredCount.
    expect(progress[0].enteredCount).toBe(0)
  })

  test('classYear with zero active students is skipped entirely', async () => {
    const t = convexTest(schema, modules)
    const { adminId, academicYearId, classYearId, semesterId, studentClassId } =
      await seedBaseData(t)

    // Withdraw the only enrolled student
    await t.run(async (ctx) => {
      await ctx.db.patch('studentClasses', studentClassId, {
        status: 'withdrawn',
      })
    })

    await t.mutation(api.grading.createScoreColumn, {
      requesterId: adminId,
      classYearId,
      semesterId,
      columnName: 'Quiz 1',
      columnType: 'short_quiz',
      sortOrder: 1,
    })

    const progress = await t.query(api.grading.getMyGradingProgress, {
      requesterId: adminId,
      academicYearId,
    })

    expect(progress).toHaveLength(0)
  })

  test('branch-head-only access includes that class incomplete columns', async () => {
    const t = convexTest(schema, modules)
    const { catechistId, academicYearId, classYearId, semesterId } =
      await seedBaseData(t)

    // Grant branch-head access (not a direct classCatechist assignment) for
    // the branch that owns classYearId.
    await t.run(async (ctx) => {
      const classYear = await ctx.db.get('classYears', classYearId)
      const classRecord = await ctx.db.get('classes', classYear!.classId)
      await ctx.db.insert('branchAssignments', {
        academicYearId,
        catechistId,
        branchId: classRecord!.branchId,
        isDeleted: false,
      })
    })

    await t.mutation(api.grading.createScoreColumn, {
      requesterId: catechistId,
      classYearId,
      semesterId,
      columnName: 'Quiz 1',
      columnType: 'short_quiz',
      sortOrder: 1,
    })

    const progress = await t.query(api.grading.getMyGradingProgress, {
      requesterId: catechistId,
      academicYearId,
    })

    expect(progress).toHaveLength(1)
    expect(progress[0].columnName).toBe('Quiz 1')
  })

  test('catechist with no access to a class does not see its columns', async () => {
    const t = convexTest(schema, modules)
    const { adminId, catechistId, academicYearId, classYearId, semesterId } =
      await seedBaseData(t)

    await t.mutation(api.grading.createScoreColumn, {
      requesterId: adminId,
      classYearId,
      semesterId,
      columnName: 'Quiz 1',
      columnType: 'short_quiz',
      sortOrder: 1,
    })

    // catechistId has no classCatechists/branchAssignments/board membership
    // rows tying it to classYearId's branch or class.
    const progress = await t.query(api.grading.getMyGradingProgress, {
      requesterId: catechistId,
      academicYearId,
    })

    expect(progress).toHaveLength(0)
  })

  test('sorts by className, then semesterNumber, then sortOrder', async () => {
    const t = convexTest(schema, modules)
    const { adminId, academicYearId, classYearId, semesterId } =
      await seedBaseData(t)

    // Second semester in the same academic year
    const semester2Id = await t.run(async (ctx) => {
      return await ctx.db.insert('semesters', {
        academicYearId,
        semesterNumber: 2,
        name: 'Học Kỳ 2',
        isDeleted: false,
      })
    })

    // Second class ("Ấu Nhi 1" sorts before "Thiếu Nhi 1"), same branch,
    // with its own active enrollment.
    const { classYearId2 } = await t.run(async (ctx) => {
      const classYear = await ctx.db.get('classYears', classYearId)
      const classRecord = await ctx.db.get('classes', classYear!.classId)
      const classId2 = await ctx.db.insert('classes', {
        branchId: classRecord!.branchId,
        name: 'Ấu Nhi 1',
        isDeleted: false,
      })
      const newClassYearId2 = await ctx.db.insert('classYears', {
        classId: classId2,
        academicYearId,
        isDeleted: false,
      })
      await ctx.db.insert('classCatechists', {
        catechistId: adminId,
        classYearId: newClassYearId2,
        academicYearId,
        role: 'homeroom',
        isDeleted: false,
      })
      const studentId2 = await ctx.db.insert('students', {
        studentCode: 'HS0003',
        fullName: 'Second Class Student',
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
      await ctx.db.insert('studentClasses', {
        studentId: studentId2,
        classYearId: newClassYearId2,
        isPrimaryClass: true,
        enrolledDate: '2024-09-01',
        status: 'active',
        isDeleted: false,
      })
      return { classYearId2: newClassYearId2 }
    })

    // classYearId (Thiếu Nhi 1): semester 2 column, sortOrder 1
    const thieuNhiSem2Col = await t.mutation(api.grading.createScoreColumn, {
      requesterId: adminId,
      classYearId,
      semesterId: semester2Id,
      columnName: 'Thieu Nhi Sem2 Quiz',
      columnType: 'short_quiz',
      sortOrder: 1,
    })

    // classYearId (Thiếu Nhi 1): semester 1, two columns, sortOrder 2 then 1
    const thieuNhiSem1ColB = await t.mutation(api.grading.createScoreColumn, {
      requesterId: adminId,
      classYearId,
      semesterId,
      columnName: 'Thieu Nhi Sem1 Quiz B',
      columnType: 'short_quiz',
      sortOrder: 2,
    })
    const thieuNhiSem1ColA = await t.mutation(api.grading.createScoreColumn, {
      requesterId: adminId,
      classYearId,
      semesterId,
      columnName: 'Thieu Nhi Sem1 Quiz A',
      columnType: 'short_quiz',
      sortOrder: 1,
    })

    // classYearId2 (Ấu Nhi 1): semester 1 column
    const auNhiCol = await t.mutation(api.grading.createScoreColumn, {
      requesterId: adminId,
      classYearId: classYearId2,
      semesterId,
      columnName: 'Au Nhi Quiz',
      columnType: 'short_quiz',
      sortOrder: 1,
    })

    const progress = await t.query(api.grading.getMyGradingProgress, {
      requesterId: adminId,
      academicYearId,
    })

    expect(progress.map((p) => p.scoreColumnId)).toEqual([
      auNhiCol,
      thieuNhiSem1ColA,
      thieuNhiSem1ColB,
      thieuNhiSem2Col,
    ])
  })
})
