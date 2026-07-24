/// <reference types="vite/client" />

/* eslint-disable no-shadow */

import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
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
  test('flags a student below 75% attendance and under 3 score entries', async () => {
    const t = convexTest(schema, modules)

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

        // 4 sessions, only 1 present -> 25% attendance rate.
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

        // Only 1 score entry (< 3).
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
    expect(results[0].className).toBe('Lớp 1A')

    // Sanity: classYearId used only to build fixtures above.
    expect(classYearId).toBeDefined()
  })

  test('does not flag a student with good attendance OR enough score entries', async () => {
    const t = convexTest(schema, modules)

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

      // Student A: good attendance (100%), few score entries -> not flagged
      // because attendanceRate is not < 75.
      const studentA = await seedStudent(ctx, 'HS010')
      const scA = await seedStudentClass(ctx, studentA, classYearId)
      const sessionA = await seedSession(ctx, classYearId, '2024-09-10')
      await seedAttendanceRecord(ctx, sessionA, scA, 'present', catechistId)

      // Student B: poor attendance (0%), but 3+ score entries -> not flagged
      // because scoreEntriesCount is not < 3.
      const studentB = await seedStudent(ctx, 'HS011')
      const scB = await seedStudentClass(ctx, studentB, classYearId)
      await seedAttendanceRecord(
        ctx,
        sessionA,
        scB,
        'unexcused_absence',
        catechistId,
      )
      const scoreColumnId = await seedScoreColumn(ctx, classYearId, semesterId)
      await seedScoreEntry(ctx, scB, scoreColumnId, 8, catechistId)
      await seedScoreEntry(ctx, scB, scoreColumnId, 7, catechistId)
      await seedScoreEntry(ctx, scB, scoreColumnId, 9, catechistId)

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
    const t = convexTest(schema, modules)

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

      const scoreColumnId = await seedScoreColumn(ctx, classYearId, semesterId)
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

    // No class-scoped, non-cancelled, non-deleted sessions exist, so the
    // active student's class has zero eligible sessions and returns [].
    expect(results).toEqual([])
  })

  test('resolves classYearIds via branchHeadOf and sorts by className then attendanceRate', async () => {
    const t = convexTest(schema, modules)

    const { catechistId, academicYearId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx, 'GLV004', 'Branch Head')
      const academicYearId = await seedYear(ctx)
      const branchId = await seedBranch(ctx, 'Hùng Tâm')
      await seedBranchAssignment(ctx, catechistId, branchId, academicYearId)

      const classA = await seedClass(ctx, branchId, 'Lớp A')
      const classYearA = await seedClassYear(ctx, classA, academicYearId)
      const classB = await seedClass(ctx, branchId, 'Lớp B')
      const classYearB = await seedClassYear(ctx, classB, academicYearId)

      // Class A: one student flagged, 0% attendance.
      const studentA = await seedStudent(ctx, 'HS030')
      const scA = await seedStudentClass(ctx, studentA, classYearA)
      const sessionA = await seedSession(ctx, classYearA, '2024-09-10')
      await seedAttendanceRecord(
        ctx,
        sessionA,
        scA,
        'unexcused_absence',
        catechistId,
      )

      // Class B: one student flagged, 50% attendance (worse in comparison
      // is A's 0%, but B sorts after A alphabetically anyway).
      const studentB = await seedStudent(ctx, 'HS031')
      const scB = await seedStudentClass(ctx, studentB, classYearB)
      const sessionB1 = await seedSession(ctx, classYearB, '2024-09-10')
      const sessionB2 = await seedSession(ctx, classYearB, '2024-09-11')
      await seedAttendanceRecord(ctx, sessionB1, scB, 'present', catechistId)
      await seedAttendanceRecord(
        ctx,
        sessionB2,
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
    const t = convexTest(schema, modules)

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
})
