/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

describe('getParishAttendanceReport backend function', () => {
  async function setupTest() {
    const t = convexTest(schema, modules)

    const ids = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert('catechists', {
        memberId: 'GLV0001',
        fullName: 'Admin Name',
        saintName: 'Giuse',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })

      const regularCatechistId = await ctx.db.insert('catechists', {
        memberId: 'GLV0002',
        fullName: 'Catechist Name',
        saintName: 'Maria',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })

      const branchId = await ctx.db.insert('branches', {
        name: 'Chiên Con',
        sortOrder: 1,
        isDeleted: false,
      })

      const classId = await ctx.db.insert('classes', {
        branchId,
        name: 'Chiên Con 1',
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

      const classYearId = await ctx.db.insert('classYears', {
        classId,
        academicYearId: ayId,
        isDeleted: false,
      })

      const studentId = await ctx.db.insert('students', {
        studentCode: 'HV0001',
        fullName: 'Student Name',
        saintName: 'Têrêsa',
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

      const sessionId = await ctx.db.insert('classSessions', {
        classYearId: undefined,
        semesterId: undefined,
        academicYearId: ayId,
        sessionDate: '2026-07-08',
        sessionType: 'mass',
        isCancelled: false,
        isDeleted: false,
      })

      const attendanceRecordId = await ctx.db.insert('attendanceRecords', {
        sessionId,
        studentClassId,
        status: 'present',
        recordedBy: regularCatechistId,
        deviceQueuedAt: 1773043800000, // 2026-07-08 15:30:00
        syncedAt: 1773043805000,
        isDeleted: false,
      })

      return {
        adminId,
        regularCatechistId,
        branchId,
        classId,
        ayId,
        classYearId,
        studentId,
        studentClassId,
        sessionId,
        attendanceRecordId,
      }
    })

    return { t, ids }
  }

  test('returns empty if no session exists for the date/type', async () => {
    const { t, ids } = await setupTest()

    const report = await t.query(
      api.parishAttendance.getParishAttendanceReport,
      {
        requesterId: ids.regularCatechistId,
        sessionDate: '2026-07-09',
        sessionType: 'mass',
      },
    )

    expect(report.session).toBeNull()
    expect(report.records).toHaveLength(0)
  })

  test('returns records if session and attendance records exist', async () => {
    const { t, ids } = await setupTest()

    const report = await t.query(
      api.parishAttendance.getParishAttendanceReport,
      {
        requesterId: ids.regularCatechistId,
        sessionDate: '2026-07-08',
        sessionType: 'mass',
      },
    )

    expect(report.session).not.toBeNull()
    expect(report.session?.sessionType).toBe('mass')
    expect(report.records).toHaveLength(1)
    expect(report.records[0]).toMatchObject({
      status: 'present',
      studentCode: 'HV0001',
      fullName: 'Student Name',
      saintName: 'Têrêsa',
      className: 'Chiên Con 1',
      recordedByCatechistName: 'Maria Catechist Name',
      deviceQueuedAt: 1773043800000,
      syncedAt: 1773043805000,
    })
  })

  test('fails if requester is not a valid catechist', async () => {
    const { t } = await setupTest()

    const invalidId = 'jd7zzzzzzzzzzzzzzzzzzzzzzzzz' as any

    await expect(
      t.query(api.parishAttendance.getParishAttendanceReport, {
        requesterId: invalidId,
        sessionDate: '2026-07-08',
        sessionType: 'mass',
      }),
    ).rejects.toThrow()
  })
})

describe('listMyParishAttendance backend function', () => {
  // Shares the exact fixture shape as getStudentAttendanceHistory in
  // attendanceQueries.test.ts since both call a resolveXForStudent(ctx,
  // studentId)-style helper — listMyParishAttendance just passes
  // args.requesterId (a students._id) straight through as the studentId,
  // scoped only to mass/extracurricular via resolveParishAttendanceForStudent
  // in this file.
  async function setupTest() {
    const t = convexTest(schema, modules)

    const ids = await t.run(async (ctx) => {
      const regularCatechistId = await ctx.db.insert('catechists', {
        memberId: 'GLV0002',
        fullName: 'Catechist Name',
        saintName: 'Maria',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })

      const branchId = await ctx.db.insert('branches', {
        name: 'Chiên Con',
        sortOrder: 1,
        isDeleted: false,
      })

      const classId = await ctx.db.insert('classes', {
        branchId,
        name: 'Chiên Con 1',
        isDeleted: false,
      })

      const activeAyId = await ctx.db.insert('academicYears', {
        name: '2024-2025',
        startDate: '2024-09-01',
        endDate: '2025-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: true,
        isDeleted: false,
      })

      const inactiveAyId = await ctx.db.insert('academicYears', {
        name: '2023-2024',
        startDate: '2023-09-01',
        endDate: '2024-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: false,
        isDeleted: false,
      })

      const classYearId = await ctx.db.insert('classYears', {
        classId,
        academicYearId: activeAyId,
        isDeleted: false,
      })

      const studentId = await ctx.db.insert('students', {
        studentCode: 'HV0001',
        fullName: 'Student Name',
        saintName: 'Têrêsa',
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

      // Mass session in active academic year — should be included
      const massSessionId = await ctx.db.insert('classSessions', {
        classYearId: undefined,
        semesterId: undefined,
        academicYearId: activeAyId,
        sessionDate: '2026-07-08',
        sessionType: 'mass',
        isCancelled: false,
        isDeleted: false,
      })
      const massRecordId = await ctx.db.insert('attendanceRecords', {
        sessionId: massSessionId,
        studentClassId,
        status: 'present',
        recordedBy: regularCatechistId,
        deviceQueuedAt: 1773043800000,
        syncedAt: 1773043805000,
        isDeleted: false,
      })

      // Extracurricular session in active academic year — should be included
      const extraSessionId = await ctx.db.insert('classSessions', {
        classYearId: undefined,
        semesterId: undefined,
        academicYearId: activeAyId,
        sessionDate: '2026-07-09',
        sessionType: 'extracurricular',
        isCancelled: false,
        isDeleted: false,
      })
      const extraRecordId = await ctx.db.insert('attendanceRecords', {
        sessionId: extraSessionId,
        studentClassId,
        status: 'late',
        recordedBy: regularCatechistId,
        deviceQueuedAt: 1773130200000,
        isDeleted: false,
      })

      // Catechism (class-scoped) session — should be filtered out
      const catechismSessionId = await ctx.db.insert('classSessions', {
        classYearId,
        semesterId: undefined,
        sessionDate: '2026-07-10',
        sessionType: 'catechism',
        isCancelled: false,
        isDeleted: false,
      })
      await ctx.db.insert('attendanceRecords', {
        sessionId: catechismSessionId,
        studentClassId,
        status: 'present',
        recordedBy: regularCatechistId,
        deviceQueuedAt: 1773216600000,
        isDeleted: false,
      })

      // Mass session in inactive academic year — should be filtered out
      const inactiveYearSessionId = await ctx.db.insert('classSessions', {
        classYearId: undefined,
        semesterId: undefined,
        academicYearId: inactiveAyId,
        sessionDate: '2024-07-08',
        sessionType: 'mass',
        isCancelled: false,
        isDeleted: false,
      })
      await ctx.db.insert('attendanceRecords', {
        sessionId: inactiveYearSessionId,
        studentClassId,
        status: 'present',
        recordedBy: regularCatechistId,
        deviceQueuedAt: 1720000000000,
        isDeleted: false,
      })

      // Cancelled mass session in active academic year — should be filtered out
      const cancelledSessionId = await ctx.db.insert('classSessions', {
        classYearId: undefined,
        semesterId: undefined,
        academicYearId: activeAyId,
        sessionDate: '2026-07-11',
        sessionType: 'mass',
        isCancelled: true,
        isDeleted: false,
      })
      await ctx.db.insert('attendanceRecords', {
        sessionId: cancelledSessionId,
        studentClassId,
        status: 'present',
        recordedBy: regularCatechistId,
        deviceQueuedAt: 1773303000000,
        isDeleted: false,
      })

      return {
        regularCatechistId,
        studentId,
        studentClassId,
        massRecordId,
        extraRecordId,
      }
    })

    return { t, ids }
  }

  test('a student sees their own mass/extracurricular records for the active academic year, with recordedByCatechistName populated', async () => {
    const { t, ids } = await setupTest()

    const records = await t.query(api.parishAttendance.listMyParishAttendance, {
      requesterId: ids.studentId,
    })

    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({
      _id: ids.extraRecordId,
      status: 'late',
      sessionType: 'extracurricular',
      sessionDate: '2026-07-09',
      recordedByCatechistName: 'Maria Catechist Name',
    })
    expect(records[1]).toMatchObject({
      _id: ids.massRecordId,
      status: 'present',
      sessionType: 'mass',
      sessionDate: '2026-07-08',
      recordedByCatechistName: 'Maria Catechist Name',
    })
    // Cancelled / inactive-year sessions excluded (only the 2 mass/extra
    // records above are returned — catechism is excluded by construction
    // since resolveParishAttendanceForStudent's return type never includes it).
    expect(
      records.some(
        (r) => r.sessionDate === '2026-07-11' || r.sessionDate === '2024-07-08',
      ),
    ).toBe(false)
  })

  test('returns empty array when there is no active academic year', async () => {
    const { t, ids } = await setupTest()

    await t.run(async (ctx) => {
      const years = await ctx.db.query('academicYears').collect()
      for (const y of years) {
        if (y.isActive) {
          await ctx.db.patch('academicYears', y._id, { isActive: false })
        }
      }
    })

    const records = await t.query(api.parishAttendance.listMyParishAttendance, {
      requesterId: ids.studentId,
    })

    expect(records).toEqual([])
  })

  test('fails if requesterId is not a valid student', async () => {
    const { t } = await setupTest()

    const invalidId = 'jd7zzzzzzzzzzzzzzzzzzzzzzzzz' as any

    await expect(
      t.query(api.parishAttendance.listMyParishAttendance, {
        requesterId: invalidId,
      }),
    ).rejects.toThrow()
  })

  // assertValidStudent only checks that requesterId resolves to a valid,
  // non-deleted student account (see convex/lib/authz.ts getBaseStudent) —
  // it does not compare requesterId against a separately-authenticated
  // session id. The handler passes requesterId straight through as the
  // studentId to resolveParishAttendanceForStudent, so "a student cannot
  // query another student's data" isn't enforced as a distinct check inside
  // this function; querying with a different (valid) student's id simply
  // returns *that* student's own records, not a cross-student leak of the
  // caller's data. Real self-scoping relies on the caller (the frontend
  // route) always passing the authenticated user's own userDocId.
  test('requesterId determines whose records are returned — passing a different valid student id returns that other student, not an error', async () => {
    const { t } = await setupTest()

    const otherStudentId = await t.run(async (ctx) => {
      return await ctx.db.insert('students', {
        studentCode: 'HV0002',
        fullName: 'Other Student',
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
    })

    const records = await t.query(api.parishAttendance.listMyParishAttendance, {
      requesterId: otherStudentId,
    })

    // The other student has no studentClasses, so no records — but the call
    // succeeds rather than being blocked, confirming there's no ownership
    // check on requesterId beyond "is this a valid student account".
    expect(records).toEqual([])
  })
})
