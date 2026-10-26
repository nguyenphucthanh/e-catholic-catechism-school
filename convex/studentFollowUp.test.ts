/// <reference types="vite/client" />

/* eslint-disable no-shadow */

import { describe, expect, test } from 'vitest'
import { authedConvexTest } from '../test-utils/authedConvexTest'
import { api } from './_generated/api'
import schema from './schema'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

// ─── Shared seed helpers ──────────────────────────────────────────────────

function seedCatechist(
  ctx: any,
  memberId: string,
  fullName: string,
  role: 'admin' | 'user' = 'user',
): Promise<Id<'catechists'>> {
  return ctx.db.insert('catechists', {
    memberId,
    fullName,
    role,
    isActive: true,
    isDeleted: false,
  })
}

function seedYear(ctx: any, isActive = true): Promise<Id<'academicYears'>> {
  return ctx.db.insert('academicYears', {
    name: '2024-2025',
    startDate: '2024-09-01',
    endDate: '2025-05-31',
    timezone: 'Asia/Ho_Chi_Minh',
    isActive,
    isDeleted: false,
  })
}

function seedBranch(ctx: any, name: string): Promise<Id<'branches'>> {
  return ctx.db.insert('branches', { name, sortOrder: 1, isDeleted: false })
}

function seedClass(
  ctx: any,
  branchId: Id<'branches'>,
  name: string,
  isDeleted = false,
): Promise<Id<'classes'>> {
  return ctx.db.insert('classes', { branchId, name, isDeleted })
}

function seedClassYear(
  ctx: any,
  classId: Id<'classes'>,
  academicYearId: Id<'academicYears'>,
  isDeleted = false,
): Promise<Id<'classYears'>> {
  return ctx.db.insert('classYears', { classId, academicYearId, isDeleted })
}

function seedStudent(ctx: any, studentCode: string): Promise<Id<'students'>> {
  return ctx.db.insert('students', {
    studentCode,
    fullName: `Student ${studentCode}`,
    isActive: true,
    createdAt: Date.now(),
    isDeleted: false,
  })
}

function seedStudentClass(
  ctx: any,
  studentId: Id<'students'>,
  classYearId: Id<'classYears'>,
  overrides: Partial<{
    status: 'active' | 'on_leave' | 'withdrawn'
    isDeleted: boolean
  }> = {},
): Promise<Id<'studentClasses'>> {
  return ctx.db.insert('studentClasses', {
    studentId,
    classYearId,
    isPrimaryClass: true,
    enrolledDate: '2024-09-05',
    status: overrides.status ?? 'active',
    isDeleted: overrides.isDeleted ?? false,
  })
}

function seedSession(
  ctx: any,
  classYearId: Id<'classYears'>,
  sessionDate: string,
  overrides: Partial<{
    sessionType: 'mass' | 'catechism' | 'supplemental' | 'extracurricular'
    isCancelled: boolean
    isDeleted: boolean
  }> = {},
): Promise<Id<'classSessions'>> {
  return ctx.db.insert('classSessions', {
    classYearId,
    sessionDate,
    sessionType: overrides.sessionType ?? 'catechism',
    isCancelled: overrides.isCancelled ?? false,
    isDeleted: overrides.isDeleted ?? false,
  })
}

function seedAttendanceRecord(
  ctx: any,
  sessionId: Id<'classSessions'>,
  studentClassId: Id<'studentClasses'>,
  status: 'present' | 'excused_absence' | 'unexcused_absence' | 'late',
  recordedBy: Id<'catechists'>,
  isDeleted = false,
): Promise<Id<'attendanceRecords'>> {
  return ctx.db.insert('attendanceRecords', {
    sessionId,
    studentClassId,
    status,
    recordedBy,
    deviceQueuedAt: Date.now(),
    isDeleted,
  })
}

function seedScoreColumn(
  ctx: any,
  classYearId: Id<'classYears'>,
  semesterId: Id<'semesters'>,
  isDeleted = false,
): Promise<Id<'scoreColumns'>> {
  return ctx.db.insert('scoreColumns', {
    classYearId,
    semesterId,
    columnName: 'Quiz 1',
    columnType: 'short_quiz',
    scaleType: 'scale_10',
    sortOrder: 0,
    isDeleted,
  })
}

function seedScoreEntry(
  ctx: any,
  studentClassId: Id<'studentClasses'>,
  scoreColumnId: Id<'scoreColumns'>,
  scoreValue: number,
  enteredBy: Id<'catechists'>,
  isDeleted = false,
): Promise<Id<'scoreEntries'>> {
  return ctx.db.insert('scoreEntries', {
    studentClassId,
    scoreColumnId,
    scoreValue,
    enteredBy,
    enteredAt: Date.now(),
    isDeleted,
  })
}

function seedClassCatechist(
  ctx: any,
  catechistId: Id<'catechists'>,
  classYearId: Id<'classYears'>,
  academicYearId: Id<'academicYears'>,
): Promise<Id<'classCatechists'>> {
  return ctx.db.insert('classCatechists', {
    catechistId,
    classYearId,
    academicYearId,
    role: 'homeroom',
    isDeleted: false,
  })
}

function seedBranchAssignment(
  ctx: any,
  catechistId: Id<'catechists'>,
  branchId: Id<'branches'>,
  academicYearId: Id<'academicYears'>,
): Promise<Id<'branchAssignments'>> {
  return ctx.db.insert('branchAssignments', {
    academicYearId,
    catechistId,
    branchId,
    isDeleted: false,
  })
}

describe('getStudentsNeedingFollowUp', () => {
  test('flags a student below 75% attendance and with >= 3 sessions without check-in', async () => {
    const t = authedConvexTest(schema, modules)

    const { catechistId, academicYearId, classYearId } = await t.run(
      async (ctx) => {
        const catechistId = await seedCatechist(ctx, 'GLV001', 'Teacher One')
        const academicYearId = await seedYear(ctx)
        const branchId = await seedBranch(ctx, 'Ấu Nhi')
        const classId = await seedClass(ctx, branchId, 'Lớp 1A')
        const classYearId = await seedClassYear(ctx, classId, academicYearId)
        const semesterId = await ctx.db.insert('semesters', {
          academicYearId,
          semesterNumber: 1,
          isDeleted: false,
        })

        await seedClassCatechist(ctx, catechistId, classYearId, academicYearId)

        const studentId = await seedStudent(ctx, 'HS001')
        const studentClassId = await seedStudentClass(
          ctx,
          studentId,
          classYearId,
        )

        // 4 sessions, only 1 present -> 25% attendance rate (3 without check-in).
        const sessionDates = [
          '2024-09-10',
          '2024-09-17',
          '2024-09-24',
          '2024-10-01',
        ]
        const sessionIds = await Promise.all(
          sessionDates.map((d) => seedSession(ctx, classYearId, d)),
        )
        await seedAttendanceRecord(
          ctx,
          sessionIds[0],
          studentClassId,
          'present',
          catechistId,
        )
        await seedAttendanceRecord(
          ctx,
          sessionIds[1],
          studentClassId,
          'unexcused_absence',
          catechistId,
        )
        await seedAttendanceRecord(
          ctx,
          sessionIds[2],
          studentClassId,
          'unexcused_absence',
          catechistId,
        )
        await seedAttendanceRecord(
          ctx,
          sessionIds[3],
          studentClassId,
          'unexcused_absence',
          catechistId,
        )

        // 1 exam created and student took it -> no score issue.
        const scoreColumnId = await seedScoreColumn(
          ctx,
          classYearId,
          semesterId,
        )
        await seedScoreEntry(ctx, studentClassId, scoreColumnId, 5, catechistId)

        return { catechistId, academicYearId, classYearId }
      },
    )

    const results = await t.query(
      api.studentFollowUp.getStudentsNeedingFollowUp,
      {
        requesterId: catechistId,
        academicYearId,
      },
    )

    expect(results).toHaveLength(1)
    expect(results[0].fullName).toBe('Student HS001')
    expect(results[0].attendanceRate).toBe(25)
    expect(results[0].scoreEntriesCount).toBe(1)
    expect(results[0].totalExams).toBe(1)
    expect(results[0].missedExamsCount).toBe(0)
    expect(results[0].hasAttendanceIssue).toBe(true)
    expect(results[0].hasScoreIssue).toBe(false)
    expect(results[0].className).toBe('Lớp 1A')

    // Sanity: classYearId used only to build fixtures above.
    expect(classYearId).toBeDefined()
  })

  test('flags a student who missed >= 30% of exams even if attendance is good', async () => {
    const t = authedConvexTest(schema, modules)

    const { catechistId, academicYearId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx, 'GLV002', 'Teacher Two')
      const academicYearId = await seedYear(ctx)
      const branchId = await seedBranch(ctx, 'Thiếu Nhi')
      const classId = await seedClass(ctx, branchId, 'Lớp 2A')
      const classYearId = await seedClassYear(ctx, classId, academicYearId)
      const semesterId = await ctx.db.insert('semesters', {
        academicYearId,
        semesterNumber: 1,
        isDeleted: false,
      })
      await seedClassCatechist(ctx, catechistId, classYearId, academicYearId)

      // Student has 100% attendance (4 sessions present).
      const student = await seedStudent(ctx, 'HS010')
      const sc = await seedStudentClass(ctx, student, classYearId)
      const s1 = await seedSession(ctx, classYearId, '2024-09-10')
      const s2 = await seedSession(ctx, classYearId, '2024-09-17')
      const s3 = await seedSession(ctx, classYearId, '2024-09-24')
      const s4 = await seedSession(ctx, classYearId, '2024-10-01')
      await seedAttendanceRecord(ctx, s1, sc, 'present', catechistId)
      await seedAttendanceRecord(ctx, s2, sc, 'present', catechistId)
      await seedAttendanceRecord(ctx, s3, sc, 'present', catechistId)
      await seedAttendanceRecord(ctx, s4, sc, 'present', catechistId)

      // Class has 2 exams. Student only took 1 -> missed 1/2 = 50% (>= 30%).
      const col1 = await seedScoreColumn(ctx, classYearId, semesterId)
      await ctx.db.insert('scoreColumns', {
        classYearId,
        semesterId,
        columnName: 'Midterm',
        columnType: 'midterm_test',
        sortOrder: 1,
        isDeleted: false,
      })
      await seedScoreEntry(ctx, sc, col1, 8, catechistId)

      return { catechistId, academicYearId }
    })

    const results = await t.query(
      api.studentFollowUp.getStudentsNeedingFollowUp,
      {
        requesterId: catechistId,
        academicYearId,
      },
    )

    expect(results).toHaveLength(1)
    expect(results[0].fullName).toBe('Student HS010')
    expect(results[0].attendanceRate).toBe(100)
    expect(results[0].hasAttendanceIssue).toBe(false)
    expect(results[0].hasScoreIssue).toBe(true)
    expect(results[0].totalExams).toBe(2)
    expect(results[0].missedExamsCount).toBe(1)
    expect(results[0].scoreEntriesCount).toBe(1)
  })

  test('does not flag a student without attendance or score issues', async () => {
    const t = authedConvexTest(schema, modules)

    const { catechistId, academicYearId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx, 'GLV002B', 'Teacher Two B')
      const academicYearId = await seedYear(ctx)
      const branchId = await seedBranch(ctx, 'Thiếu Nhi')
      const classId = await seedClass(ctx, branchId, 'Lớp 2B')
      const classYearId = await seedClassYear(ctx, classId, academicYearId)
      const semesterId = await ctx.db.insert('semesters', {
        academicYearId,
        semesterNumber: 1,
        isDeleted: false,
      })
      await seedClassCatechist(ctx, catechistId, classYearId, academicYearId)

      // Student A: 100% attendance and took all exams -> not flagged.
      const studentA = await seedStudent(ctx, 'HS010A')
      const scA = await seedStudentClass(ctx, studentA, classYearId)
      const sessionA = await seedSession(ctx, classYearId, '2024-09-10')
      await seedAttendanceRecord(ctx, sessionA, scA, 'present', catechistId)

      // Student B: 100% attendance, missed 1 of 4 exams (25% < 30%) -> not flagged.
      const studentB = await seedStudent(ctx, 'HS011B')
      const scB = await seedStudentClass(ctx, studentB, classYearId)
      await seedAttendanceRecord(ctx, sessionA, scB, 'present', catechistId)

      const col1 = await seedScoreColumn(ctx, classYearId, semesterId)
      const col2 = await ctx.db.insert('scoreColumns', {
        classYearId,
        semesterId,
        columnName: 'Exam 2',
        columnType: 'short_quiz',
        sortOrder: 1,
        isDeleted: false,
      })
      const col3 = await ctx.db.insert('scoreColumns', {
        classYearId,
        semesterId,
        columnName: 'Exam 3',
        columnType: 'short_quiz',
        sortOrder: 2,
        isDeleted: false,
      })
      const col4 = await ctx.db.insert('scoreColumns', {
        classYearId,
        semesterId,
        columnName: 'Exam 4',
        columnType: 'short_quiz',
        sortOrder: 3,
        isDeleted: false,
      })

      // Student A took all 4
      await seedScoreEntry(ctx, scA, col1, 9, catechistId)
      await seedScoreEntry(ctx, scA, col2, 8, catechistId)
      await seedScoreEntry(ctx, scA, col3, 7, catechistId)
      await seedScoreEntry(ctx, scA, col4, 10, catechistId)

      // Student B took 3 of 4 (missed 1/4 = 25% < 30%)
      await seedScoreEntry(ctx, scB, col1, 8, catechistId)
      await seedScoreEntry(ctx, scB, col2, 7, catechistId)
      await seedScoreEntry(ctx, scB, col3, 9, catechistId)

      return { catechistId, academicYearId }
    })

    const results = await t.query(
      api.studentFollowUp.getStudentsNeedingFollowUp,
      {
        requesterId: catechistId,
        academicYearId,
      },
    )

    expect(results).toEqual([])
  })

  test('excludes non-active enrollments, cancelled/deleted sessions, mass sessions, and soft-deleted attendance/score rows', async () => {
    const t = authedConvexTest(schema, modules)

    const { catechistId, academicYearId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx, 'GLV003', 'Teacher Three')
      const academicYearId = await seedYear(ctx)
      const branchId = await seedBranch(ctx, 'Nghĩa Sĩ')
      const classId = await seedClass(ctx, branchId, 'Lớp 3A')
      const classYearId = await seedClassYear(ctx, classId, academicYearId)
      const semesterId = await ctx.db.insert('semesters', {
        academicYearId,
        semesterNumber: 1,
        isDeleted: false,
      })
      await seedClassCatechist(ctx, catechistId, classYearId, academicYearId)

      // Withdrawn enrollment — excluded regardless of attendance.
      const withdrawnStudent = await seedStudent(ctx, 'HS020')
      await seedStudentClass(ctx, withdrawnStudent, classYearId, {
        status: 'withdrawn',
      })

      // Soft-deleted enrollment — excluded.
      const deletedEnrollmentStudent = await seedStudent(ctx, 'HS021')
      await seedStudentClass(ctx, deletedEnrollmentStudent, classYearId, {
        isDeleted: true,
      })

      // Active student with a mass session (parish-scoped, excluded from
      // the classScopedSessions calc), a cancelled session, and a deleted
      // session — none should count toward the denominator.
      const activeStudent = await seedStudent(ctx, 'HS022')
      const sc = await seedStudentClass(ctx, activeStudent, classYearId)

      await seedSession(ctx, classYearId, '2024-09-10', {
        sessionType: 'mass',
      })
      await seedSession(ctx, classYearId, '2024-09-11', {
        isCancelled: true,
      })
      await seedSession(ctx, classYearId, '2024-09-12', {
        isDeleted: true,
      })

      // Soft-deleted score column is excluded.
      const scoreColumnId = await seedScoreColumn(
        ctx,
        classYearId,
        semesterId,
        true,
      )
      // Soft-deleted score entry does not count toward scoreEntriesCount.
      await seedScoreEntry(ctx, sc, scoreColumnId, 9, catechistId, true)

      return { catechistId, academicYearId }
    })

    const results = await t.query(
      api.studentFollowUp.getStudentsNeedingFollowUp,
      {
        requesterId: catechistId,
        academicYearId,
      },
    )

    // No class-scoped, non-cancelled, non-deleted sessions exist, and no active score columns exist,
    // so the active student's class has zero eligible sessions and exams, returning [].
    expect(results).toEqual([])
  })

  test('resolves classYearIds via branchHeadOf and sorts by className then attendanceRate', async () => {
    const t = authedConvexTest(schema, modules)

    const { catechistId, academicYearId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx, 'GLV004', 'Branch Head')
      const academicYearId = await seedYear(ctx)
      const branchId = await seedBranch(ctx, 'Hùng Tâm')
      await seedBranchAssignment(ctx, catechistId, branchId, academicYearId)

      const classA = await seedClass(ctx, branchId, 'Lớp A')
      const classYearA = await seedClassYear(ctx, classA, academicYearId)
      const classB = await seedClass(ctx, branchId, 'Lớp B')
      const classYearB = await seedClassYear(ctx, classB, academicYearId)

      // Class A: one student flagged, 0% attendance (3 sessions, all absent).
      const studentA = await seedStudent(ctx, 'HS030')
      const scA = await seedStudentClass(ctx, studentA, classYearA)
      const sessionA1 = await seedSession(ctx, classYearA, '2024-09-10')
      const sessionA2 = await seedSession(ctx, classYearA, '2024-09-17')
      const sessionA3 = await seedSession(ctx, classYearA, '2024-09-24')
      await seedAttendanceRecord(
        ctx,
        sessionA1,
        scA,
        'unexcused_absence',
        catechistId,
      )
      await seedAttendanceRecord(
        ctx,
        sessionA2,
        scA,
        'unexcused_absence',
        catechistId,
      )
      await seedAttendanceRecord(
        ctx,
        sessionA3,
        scA,
        'unexcused_absence',
        catechistId,
      )

      // Class B: one student flagged, 25% attendance (4 sessions: 1 present, 3 absent).
      const studentB = await seedStudent(ctx, 'HS031')
      const scB = await seedStudentClass(ctx, studentB, classYearB)
      const sessionB1 = await seedSession(ctx, classYearB, '2024-09-10')
      const sessionB2 = await seedSession(ctx, classYearB, '2024-09-11')
      const sessionB3 = await seedSession(ctx, classYearB, '2024-09-12')
      const sessionB4 = await seedSession(ctx, classYearB, '2024-09-13')
      await seedAttendanceRecord(ctx, sessionB1, scB, 'present', catechistId)
      await seedAttendanceRecord(
        ctx,
        sessionB2,
        scB,
        'unexcused_absence',
        catechistId,
      )
      await seedAttendanceRecord(
        ctx,
        sessionB3,
        scB,
        'unexcused_absence',
        catechistId,
      )
      await seedAttendanceRecord(
        ctx,
        sessionB4,
        scB,
        'unexcused_absence',
        catechistId,
      )

      return { catechistId, academicYearId }
    })

    const results = await t.query(
      api.studentFollowUp.getStudentsNeedingFollowUp,
      {
        requesterId: catechistId,
        academicYearId,
      },
    )

    expect(results).toHaveLength(2)
    expect(results[0].className).toBe('Lớp A')
    expect(results[1].className).toBe('Lớp B')
  })

  test('returns empty when requester has no classCatechistOf or branchHeadOf assignments', async () => {
    const t = authedConvexTest(schema, modules)

    const { catechistId, academicYearId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx, 'GLV005', 'No Access')
      const academicYearId = await seedYear(ctx)
      return { catechistId, academicYearId }
    })

    const results = await t.query(
      api.studentFollowUp.getStudentsNeedingFollowUp,
      {
        requesterId: catechistId,
        academicYearId,
      },
    )

    expect(results).toEqual([])
  })

  test('does not flag students if class has fewer than 3 sessions, or student has fewer than 3 sessions without check-in', async () => {
    const t = authedConvexTest(schema, modules)

    const { catechistId, academicYearId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx, 'GLV006', 'Teacher Six')
      const academicYearId = await seedYear(ctx)
      const branchId = await seedBranch(ctx, 'Ấu Nhi')

      // Class 1: Only 2 sessions made so far. Student missed both, but class has < 3 sessions.
      const classEarly = await seedClass(ctx, branchId, 'Lớp Early')
      const classYearEarlyId = await seedClassYear(
        ctx,
        classEarly,
        academicYearId,
      )
      await seedClassCatechist(
        ctx,
        catechistId,
        classYearEarlyId,
        academicYearId,
      )
      const studentEarly = await seedStudent(ctx, 'HS_EARLY')
      const scEarly = await seedStudentClass(
        ctx,
        studentEarly,
        classYearEarlyId,
      )
      const sEarly1 = await seedSession(ctx, classYearEarlyId, '2024-09-10')
      const sEarly2 = await seedSession(ctx, classYearEarlyId, '2024-09-17')
      await seedAttendanceRecord(
        ctx,
        sEarly1,
        scEarly,
        'unexcused_absence',
        catechistId,
      )
      await seedAttendanceRecord(
        ctx,
        sEarly2,
        scEarly,
        'unexcused_absence',
        catechistId,
      )

      // Class 2: 3 sessions made.
      // Student A has attended 1 session, missed 2 sessions (only 2 without check-in -> NOT flagged).
      // Student B has 3 sessions without check-in -> FLAGGED.
      const classActive = await seedClass(ctx, branchId, 'Lớp Active')
      const classYearActiveId = await seedClassYear(
        ctx,
        classActive,
        academicYearId,
      )
      await seedClassCatechist(
        ctx,
        catechistId,
        classYearActiveId,
        academicYearId,
      )

      const studentA = await seedStudent(ctx, 'HS_TWO_MISSED')
      const scA = await seedStudentClass(ctx, studentA, classYearActiveId)

      const studentB = await seedStudent(ctx, 'HS_THREE_MISSED')
      const scB = await seedStudentClass(ctx, studentB, classYearActiveId)

      const s1 = await seedSession(ctx, classYearActiveId, '2024-09-10')
      const s2 = await seedSession(ctx, classYearActiveId, '2024-09-17')
      const s3 = await seedSession(ctx, classYearActiveId, '2024-09-24')

      // Student A attends session 1, misses sessions 2 and 3
      await seedAttendanceRecord(ctx, s1, scA, 'present', catechistId)
      await seedAttendanceRecord(ctx, s2, scA, 'unexcused_absence', catechistId)
      await seedAttendanceRecord(ctx, s3, scA, 'unexcused_absence', catechistId)

      // Student B misses all 3 sessions (3 without check-in)
      await seedAttendanceRecord(ctx, s1, scB, 'unexcused_absence', catechistId)
      await seedAttendanceRecord(ctx, s2, scB, 'unexcused_absence', catechistId)
      await seedAttendanceRecord(ctx, s3, scB, 'unexcused_absence', catechistId)

      return {
        catechistId,
        academicYearId,
      }
    })

    const results = await t.query(
      api.studentFollowUp.getStudentsNeedingFollowUp,
      {
        requesterId: catechistId,
        academicYearId,
      },
    )

    // Neither student from Class Early (only 2 sessions) nor Student A (only 2 missed) is flagged.
    // Only Student B (3 sessions in class, 3 without check-in) is flagged.
    expect(results).toHaveLength(1)
    expect(results[0].fullName).toBe('Student HS_THREE_MISSED')
    expect(results[0].className).toBe('Lớp Active')
  })
})
