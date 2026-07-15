/// <reference types="vite/client" />

/* eslint-disable no-shadow */

import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

// ─── Shared seed helpers ──────────────────────────────────────────────────

function seedCatechist(ctx: any): Promise<Id<'catechists'>> {
  return ctx.db.insert('catechists', {
    memberId: 'GLV01',
    fullName: 'Catechist One',
    role: 'user',
    isActive: true,
    isDeleted: false,
  })
}

function seedYear(
  ctx: any,
  name: string,
  startDate: string,
  endDate: string,
  isActive = false,
): Promise<Id<'academicYears'>> {
  return ctx.db.insert('academicYears', {
    name,
    startDate,
    endDate,
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
): Promise<Id<'classes'>> {
  return ctx.db.insert('classes', { branchId, name, isDeleted: false })
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
  overrides: Partial<{ isPrimaryClass: boolean; status: string }> = {},
): Promise<Id<'studentClasses'>> {
  return ctx.db.insert('studentClasses', {
    studentId,
    classYearId,
    isPrimaryClass: overrides.isPrimaryClass ?? true,
    enrolledDate: '2024-09-05',
    status: overrides.status ?? 'active',
    isDeleted: false,
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

function seedSession(
  ctx: any,
  overrides: Partial<{
    classYearId: Id<'classYears'>
    semesterId: Id<'semesters'>
    academicYearId: Id<'academicYears'>
    sessionDate: string
    sessionType: 'mass' | 'catechism' | 'supplemental' | 'extracurricular'
    isCancelled: boolean
  }>,
): Promise<Id<'classSessions'>> {
  return ctx.db.insert('classSessions', {
    sessionDate: overrides.sessionDate ?? '2024-10-01',
    sessionType: overrides.sessionType ?? 'catechism',
    isCancelled: overrides.isCancelled ?? false,
    classYearId: overrides.classYearId,
    semesterId: overrides.semesterId,
    academicYearId: overrides.academicYearId,
    isDeleted: false,
  })
}

function seedAttendanceRecord(
  ctx: any,
  sessionId: Id<'classSessions'>,
  studentClassId: Id<'studentClasses'>,
  status: 'present' | 'excused_absence' | 'unexcused_absence' | 'late',
  recordedBy: Id<'catechists'>,
): Promise<Id<'attendanceRecords'>> {
  return ctx.db.insert('attendanceRecords', {
    sessionId,
    studentClassId,
    status,
    recordedBy,
    deviceQueuedAt: Date.now(),
    isDeleted: false,
  })
}

function seedAnnualResult(
  ctx: any,
  studentClassId: Id<'studentClasses'>,
  isCompleted: boolean,
): Promise<Id<'annualResults'>> {
  return ctx.db.insert('annualResults', {
    studentClassId,
    isCompleted,
    isDeleted: false,
  })
}

function seedScoreColumn(
  ctx: any,
  classYearId: Id<'classYears'>,
  semesterId: Id<'semesters'>,
): Promise<Id<'scoreColumns'>> {
  return ctx.db.insert('scoreColumns', {
    classYearId,
    semesterId,
    columnName: 'Quiz 1',
    columnType: 'short_quiz',
    scaleType: 'scale_10',
    sortOrder: 0,
    isDeleted: false,
  })
}

function seedScoreEntry(
  ctx: any,
  studentClassId: Id<'studentClasses'>,
  scoreColumnId: Id<'scoreColumns'>,
  scoreValue: number,
  enteredBy: Id<'catechists'>,
): Promise<Id<'scoreEntries'>> {
  return ctx.db.insert('scoreEntries', {
    studentClassId,
    scoreColumnId,
    scoreValue,
    enteredBy,
    enteredAt: Date.now(),
    isDeleted: false,
  })
}

// ─── academicYearComparison ────────────────────────────────────────────────

describe('academicYearComparison', () => {
  test('normal case: aggregates enrollment/attendance/grades/staffing across years, chronological order, caps at 5', async () => {
    const t = convexTest(schema, modules)

    const { catechistId, yearIds, classYearId, semesterId } = await t.run(
      async (ctx) => {
        const catechistId = await seedCatechist(ctx)
        const branchId = await seedBranch(ctx, 'Ấu Nhi')
        const classId = await seedClass(ctx, branchId, 'Lớp 1A')

        // Seed 6 years to verify the 5-most-recent cap.
        const yearIds: Array<Id<'academicYears'>> = []
        for (let i = 0; i < 6; i++) {
          const y = await seedYear(
            ctx,
            `20${18 + i}-20${19 + i}`,
            `20${18 + i}-09-01`,
            `20${19 + i}-05-31`,
          )
          yearIds.push(y)
        }

        // Only fully build out the most recent year (index 5) with real data.
        const targetYearId = yearIds[5]
        const classYearId = await seedClassYear(ctx, classId, targetYearId)
        const semesterId = await ctx.db.insert('semesters', {
          academicYearId: targetYearId,
          semesterNumber: 1,
          isDeleted: false,
        })

        await seedClassCatechist(ctx, catechistId, classYearId, targetYearId)

        const s1 = await seedStudent(ctx, 'HS001')
        const s2 = await seedStudent(ctx, 'HS002')
        const sc1 = await seedStudentClass(ctx, s1, classYearId)
        const sc2 = await seedStudentClass(ctx, s2, classYearId)

        // Class-scoped attendance: 1 present, 1 unexcused -> 50%
        const catechismSession = await seedSession(ctx, {
          classYearId,
          semesterId,
          sessionType: 'catechism',
          sessionDate: '2023-10-01',
        })
        await seedAttendanceRecord(
          ctx,
          catechismSession,
          sc1,
          'present',
          catechistId,
        )
        await seedAttendanceRecord(
          ctx,
          catechismSession,
          sc2,
          'unexcused_absence',
          catechistId,
        )

        // Mass attendance: 1 present -> 100%
        const massSession = await seedSession(ctx, {
          academicYearId: targetYearId,
          sessionType: 'mass',
          sessionDate: '2023-10-02',
        })
        await seedAttendanceRecord(
          ctx,
          massSession,
          sc1,
          'present',
          catechistId,
        )

        // Grades: one pass, one incomplete -> 50% pass rate
        await seedAnnualResult(ctx, sc1, true)
        await seedAnnualResult(ctx, sc2, false)

        // Scores: average of 8 and 6 = 7
        const column = await seedScoreColumn(ctx, classYearId, semesterId)
        await seedScoreEntry(ctx, sc1, column, 8, catechistId)
        await seedScoreEntry(ctx, sc2, column, 6, catechistId)

        return { catechistId, yearIds, classYearId, semesterId }
      },
    )

    const result = await t.query(api.reports.academicYearComparison, {
      requesterId: catechistId,
    })

    expect(result.years).toHaveLength(5)
    // Chronological order: oldest of the 5 kept years first.
    expect(result.years[0].academicYearId).toBe(yearIds[1])
    expect(result.years[4].academicYearId).toBe(yearIds[5])

    const targetIndex = 4
    expect(result.enrollment[targetIndex]).toMatchObject({
      totalActive: 2,
      byClass: [{ classId: expect.anything(), className: 'Lớp 1A', count: 2 }],
    })
    expect(result.attendance[targetIndex]).toMatchObject({
      classAttendanceRate: 50,
      massAttendanceRate: 100,
      extracurricularAttendanceRate: null,
    })
    expect(result.grades[targetIndex]).toMatchObject({
      passRate: 50,
      averageScore: 7,
    })
    expect(result.staffing[targetIndex]).toMatchObject({
      catechistCount: 1,
      classCount: 1,
      branchCount: 1,
    })

    // Earlier, untouched years should have zeroed/null aggregates, not throw.
    expect(result.enrollment[0]).toMatchObject({ totalActive: 0, byClass: [] })
    expect(result.attendance[0]).toMatchObject({
      massAttendanceRate: null,
      extracurricularAttendanceRate: null,
      classAttendanceRate: null,
    })
    expect(result.grades[0]).toMatchObject({
      passRate: null,
      averageScore: null,
    })
    expect(result.staffing[0]).toMatchObject({
      catechistCount: 0,
      classCount: 0,
      branchCount: 0,
    })
    void classYearId
    void semesterId
  })

  test('fewer than 5 academic years exist: returns all without erroring', async () => {
    const t = convexTest(schema, modules)

    const { catechistId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx)
      await seedYear(ctx, '2023-2024', '2023-09-01', '2024-05-31')
      await seedYear(ctx, '2024-2025', '2024-09-01', '2025-05-31')
      return { catechistId }
    })

    const result = await t.query(api.reports.academicYearComparison, {
      requesterId: catechistId,
    })

    expect(result.years).toHaveLength(2)
    expect(result.years[0].label).toBe('2023-2024')
    expect(result.years[1].label).toBe('2024-2025')
    expect(result.enrollment).toHaveLength(2)
    expect(result.attendance).toHaveLength(2)
    expect(result.grades).toHaveLength(2)
    expect(result.staffing).toHaveLength(2)
  })

  test('no academic years exist: returns empty arrays', async () => {
    const t = convexTest(schema, modules)

    const { catechistId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx)
      return { catechistId }
    })

    const result = await t.query(api.reports.academicYearComparison, {
      requesterId: catechistId,
    })

    expect(result).toEqual({
      years: [],
      enrollment: [],
      attendance: [],
      grades: [],
      staffing: [],
    })
  })

  test('a year with zero enrollment/sessions produces null rates, not division-by-zero errors', async () => {
    const t = convexTest(schema, modules)

    const { catechistId, yearId, branchId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx)
      const yearId = await seedYear(
        ctx,
        '2024-2025',
        '2024-09-01',
        '2025-05-31',
      )
      const branchId = await seedBranch(ctx, 'Ấu Nhi')
      return { catechistId, yearId, branchId }
    })

    const result = await t.query(api.reports.academicYearComparison, {
      requesterId: catechistId,
    })

    expect(result.years).toHaveLength(1)
    expect(result.enrollment[0]).toMatchObject({ totalActive: 0, byClass: [] })
    expect(result.attendance[0]).toMatchObject({
      massAttendanceRate: null,
      extracurricularAttendanceRate: null,
      classAttendanceRate: null,
    })
    expect(result.grades[0]).toMatchObject({
      passRate: null,
      averageScore: null,
    })
    expect(result.staffing[0]).toMatchObject({
      catechistCount: 0,
      classCount: 0,
      branchCount: 0,
    })
    void yearId
    void branchId
  })

  test('excludes soft-deleted academic years from the comparison', async () => {
    const t = convexTest(schema, modules)

    const { catechistId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx)
      await seedYear(ctx, '2024-2025', '2024-09-01', '2025-05-31')
      const deletedYear = await seedYear(
        ctx,
        '2025-2026',
        '2025-09-01',
        '2026-05-31',
      )
      await ctx.db.patch('academicYears', deletedYear, { isDeleted: true })
      return { catechistId }
    })

    const result = await t.query(api.reports.academicYearComparison, {
      requesterId: catechistId,
    })

    expect(result.years).toHaveLength(1)
    expect(result.years[0].label).toBe('2024-2025')
  })

  test('rejects an unauthorized/invalid requester', async () => {
    const t = convexTest(schema, modules)

    const fakeId = 'catechists|does-not-exist' as unknown as Id<'catechists'>

    await expect(
      t.query(api.reports.academicYearComparison, { requesterId: fakeId }),
    ).rejects.toThrow()
  })

  test('classAttendanceRate counts an unscanned enrolled student as a miss', async () => {
    const t = convexTest(schema, modules)

    const { catechistId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx)
      const branchId = await seedBranch(ctx, 'Ấu Nhi')
      const classId = await seedClass(ctx, branchId, 'Lớp 1A')
      const targetYearId = await seedYear(
        ctx,
        '2024-2025',
        '2024-09-01',
        '2025-05-31',
        true,
      )
      const classYearId = await seedClassYear(ctx, classId, targetYearId)
      const semesterId = await ctx.db.insert('semesters', {
        academicYearId: targetYearId,
        semesterNumber: 1,
        isDeleted: false,
      })
      await seedClassCatechist(ctx, catechistId, classYearId, targetYearId)

      // 3 active enrollments, but only 2 ever get scanned for this session.
      const s1 = await seedStudent(ctx, 'HS001')
      const s2 = await seedStudent(ctx, 'HS002')
      const s3 = await seedStudent(ctx, 'HS003')
      const sc1 = await seedStudentClass(ctx, s1, classYearId)
      const sc2 = await seedStudentClass(ctx, s2, classYearId)
      await seedStudentClass(ctx, s3, classYearId)

      const session = await seedSession(ctx, {
        classYearId,
        semesterId,
        sessionType: 'catechism',
        sessionDate: '2024-10-01',
      })
      await seedAttendanceRecord(ctx, session, sc1, 'present', catechistId)
      await seedAttendanceRecord(
        ctx,
        session,
        sc2,
        'unexcused_absence',
        catechistId,
      )
      // sc3 has no attendance record at all for this session.

      return { catechistId }
    })

    const result = await t.query(api.reports.academicYearComparison, {
      requesterId: catechistId,
    })

    // Enrollment-based denominator: 1 present / 3 active enrollments = 33.3%,
    // not 1 present / 2 recorded = 50% — the unscanned student counts as a miss.
    expect(result.attendance[result.attendance.length - 1]).toMatchObject({
      classAttendanceRate: 33.3,
    })
  })
})

describe('academicYearReport', () => {
  test('aggregates correct KPIs, class counts, sparkline data, and at-risk students', async () => {
    const t = convexTest(schema, modules)

    const { catechistId, targetYearId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx)
      const branchId = await seedBranch(ctx, 'Ấu Nhi')
      const classId = await seedClass(ctx, branchId, 'Ấu Nhi 1')
      const targetYearId = await seedYear(
        ctx,
        '2024-2025',
        '2024-09-01',
        '2025-05-31',
        true,
      )

      const classYearId = await seedClassYear(ctx, classId, targetYearId)
      const semesterId = await ctx.db.insert('semesters', {
        academicYearId: targetYearId,
        semesterNumber: 1,
        isDeleted: false,
      })

      await seedClassCatechist(ctx, catechistId, classYearId, targetYearId)

      const s1 = await seedStudent(ctx, 'HS001')
      const s2 = await seedStudent(ctx, 'HS002')
      const sc1 = await seedStudentClass(ctx, s1, classYearId)
      const sc2 = await seedStudentClass(ctx, s2, classYearId)

      // Seed 4 class-scoped sessions
      const sess1 = await seedSession(ctx, {
        classYearId,
        semesterId,
        sessionType: 'catechism',
        sessionDate: '2024-10-01',
      })
      const sess2 = await seedSession(ctx, {
        classYearId,
        semesterId,
        sessionType: 'catechism',
        sessionDate: '2024-10-08',
      })
      const sess3 = await seedSession(ctx, {
        classYearId,
        semesterId,
        sessionType: 'catechism',
        sessionDate: '2024-10-15',
      })
      const sess4 = await seedSession(ctx, {
        classYearId,
        semesterId,
        sessionType: 'catechism',
        sessionDate: '2024-10-22',
      })

      // Attendance record:
      // s1: present for all 4
      await seedAttendanceRecord(ctx, sess1, sc1, 'present', catechistId)
      await seedAttendanceRecord(ctx, sess2, sc1, 'present', catechistId)
      await seedAttendanceRecord(ctx, sess3, sc1, 'present', catechistId)
      await seedAttendanceRecord(ctx, sess4, sc1, 'present', catechistId)

      // s2: present for 1st, then excused for 3 -> streak of 3 -> at risk!
      await seedAttendanceRecord(ctx, sess1, sc2, 'present', catechistId)
      await seedAttendanceRecord(
        ctx,
        sess2,
        sc2,
        'excused_absence',
        catechistId,
      )
      await seedAttendanceRecord(
        ctx,
        sess3,
        sc2,
        'excused_absence',
        catechistId,
      )
      await seedAttendanceRecord(
        ctx,
        sess4,
        sc2,
        'excused_absence',
        catechistId,
      )

      return { catechistId, targetYearId, classId }
    })

    const result = await t.query(api.reports.academicYearReport, {
      requesterId: catechistId,
      academicYearId: targetYearId,
    })

    expect(result.academicYearName).toBe('2024-2025')
    expect(result.kpis).toEqual({
      totalClasses: 1,
      totalStudents: 2,
      averageAttendanceRate: 63, // 5 out of 8 present/late records = 62.5% -> 63%
      activeCatechists: 1,
    })

    expect(result.classesComparison).toHaveLength(1)
    expect(result.classesComparison[0]).toMatchObject({
      className: 'Ấu Nhi 1',
      studentCount: 2,
      classType: 'primary',
    })

    expect(result.branches).toHaveLength(1)
    expect(result.branches[0].branchName).toBe('Ấu Nhi')
    expect(result.branches[0].classes).toHaveLength(1)
    expect(result.branches[0].classes[0]).toMatchObject({
      className: 'Ấu Nhi 1',
      studentCount: 2,
      overallAttendanceRate: 63,
    })

    // Sparkline history has 4 sessions
    expect(result.branches[0].classes[0].attendanceHistory).toHaveLength(4)
    // Check consecutive absence student
    expect(result.atRiskStudents).toHaveLength(1)
    expect(result.atRiskStudents[0]).toMatchObject({
      fullName: 'Student HS002',
      className: 'Ấu Nhi 1',
      consecutiveAbsences: 3,
    })
  })

  test('rejects unauthorized/invalid requester', async () => {
    const t = convexTest(schema, modules)
    const fakeId = 'catechists|does-not-exist' as unknown as Id<'catechists'>
    const targetYearId = 'academicYears|fake' as unknown as Id<'academicYears'>

    await expect(
      t.query(api.reports.academicYearReport, {
        requesterId: fakeId,
        academicYearId: targetYearId,
      }),
    ).rejects.toThrow()
  })
})
