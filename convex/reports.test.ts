/// <reference types="vite/client" />

/* eslint-disable no-shadow */

import { describe, expect, test } from 'vitest'
import { authedConvexTest } from '../test-utils/authedConvexTest'
import { api } from './_generated/api'
import { percentage } from './lib/statsHelpers'
import schema from './schema'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

describe('percentage pure math helper', () => {
  test('correctly rounds percentage to specified decimal places', () => {
    expect(percentage(1, 3, 1)).toBe(33.3)
    expect(percentage(2, 3, 2)).toBe(66.67)
  })

  test('returns null for zero or negative denominators', () => {
    expect(percentage(5, 0, 1)).toBeNull()
    expect(percentage(5, -1, 1)).toBeNull()
  })

  test('returns null for non-finite inputs', () => {
    expect(percentage(NaN, 10, 1)).toBeNull()
    expect(percentage(5, Infinity, 1)).toBeNull()
  })
})

// ─── Shared seed helpers ──────────────────────────────────────────────────

function seedCatechist(
  ctx: any,
  role: 'user' | 'admin' = 'user',
): Promise<Id<'catechists'>> {
  return ctx.db.insert('catechists', {
    memberId: 'GLV01',
    fullName: 'Catechist One',
    role,
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

describe('academicYearReport', () => {
  test('summary returns KPIs and class sizes; branch report returns rates and sparkline', async () => {
    const t = authedConvexTest(schema, modules)

    const { catechistId, targetYearId } = await t.run(async (ctx) => {
      const catechistId = await seedCatechist(ctx, 'admin')
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

    const branchReport = await t.query(api.reports.academicYearBranchReport, {
      requesterId: catechistId,
      academicYearId: targetYearId,
      branchId: result.branches[0].branchId,
    })
    expect(branchReport?.classes).toHaveLength(1)
    expect(branchReport?.classes[0]).toMatchObject({
      className: 'Ấu Nhi 1',
      studentCount: 2,
      sessionCount: 4,
      overallAttendanceRate: 63, // 5 of 8 present/late = 62.5% -> 63%
    })
    // Sparkline history has 4 sessions
    expect(branchReport?.classes[0].attendanceHistory).toHaveLength(4)
  })

  test('rejects unauthorized/invalid requester', async () => {
    const t = authedConvexTest(schema, modules)
    const fakeId = 'catechists|does-not-exist' as unknown as Id<'catechists'>
    const targetYearId = 'academicYears|fake' as unknown as Id<'academicYears'>

    await expect(
      t.query(api.reports.academicYearReport, {
        requesterId: fakeId,
        academicYearId: targetYearId,
      }),
    ).rejects.toThrow()
  })

  test('rejects a plain catechist who is not admin or board member', async () => {
    const t = authedConvexTest(schema, modules)

    const { catechistId, yearId } = await t.run(async (ctx) => ({
      catechistId: await seedCatechist(ctx, 'user'),
      yearId: await seedYear(
        ctx,
        '2024-2025',
        '2024-09-01',
        '2025-05-31',
        true,
      ),
    }))

    await expect(
      t.query(api.reports.academicYearReport, {
        requesterId: catechistId,
        academicYearId: yearId,
      }),
    ).rejects.toThrow(/NOT_BOARD_MEMBER/)
  })
})
