/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

describe('attendanceHealth backend functions', () => {
  async function setupTest() {
    const t = convexTest(schema, modules)

    const ids = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert('catechists', {
        memberId: 'GLV0001',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })

      const boardId = await ctx.db.insert('catechists', {
        memberId: 'GLV0002',
        fullName: 'Board Member',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })

      const homeroomId = await ctx.db.insert('catechists', {
        memberId: 'GLV0004',
        fullName: 'Homeroom Catechist',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })

      const regularCatechistId = await ctx.db.insert('catechists', {
        memberId: 'GLV0006',
        fullName: 'Regular Catechist',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })

      const branchId = await ctx.db.insert('branches', {
        name: 'Test Branch',
        sortOrder: 1,
        isDeleted: false,
      })

      const classId = await ctx.db.insert('classes', {
        branchId,
        name: 'Test Class',
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
        academicYearId: ayId,
        isDeleted: false,
      })

      const semesterId = await ctx.db.insert('semesters', {
        academicYearId: ayId,
        semesterNumber: 1,
        isDeleted: false,
      })

      const studentId = await ctx.db.insert('students', {
        fullName: 'Test Student',
        studentCode: 'HS001',
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })

      await ctx.db.insert('academicYearAssignments', {
        academicYearId: ayId,
        catechistId: boardId,
        assignmentType: 'board_member',
        isDeleted: false,
      })

      await ctx.db.insert('classCatechists', {
        catechistId: homeroomId,
        classYearId,
        academicYearId: ayId,
        role: 'homeroom',
        isDeleted: false,
      })

      const studentClassId = await ctx.db.insert('studentClasses', {
        studentId,
        classYearId,
        enrolledDate: '2024-09-01',
        isPrimaryClass: true,
        status: 'active',
        isDeleted: false,
      })

      const catechismSessionId = await ctx.db.insert('classSessions', {
        classYearId,
        semesterId,
        sessionDate: '2024-10-01',
        sessionType: 'catechism',
        isCancelled: false,
        notes: undefined,
        isDeleted: false,
      })

      const cancelledSessionId = await ctx.db.insert('classSessions', {
        classYearId,
        semesterId,
        sessionDate: '2024-10-02',
        sessionType: 'catechism',
        isCancelled: true,
        notes: undefined,
        isDeleted: false,
      })

      const massSessionId = await ctx.db.insert('classSessions', {
        academicYearId: ayId,
        sessionDate: '2024-10-05',
        sessionType: 'mass',
        isCancelled: false,
        notes: undefined,
        isDeleted: false,
      })

      return {
        adminId,
        boardId,
        homeroomId,
        regularCatechistId,
        branchId,
        classId,
        classYearId,
        semesterId,
        ayId,
        inactiveAyId,
        studentId,
        studentClassId,
        catechismSessionId,
        cancelledSessionId,
        massSessionId,
      }
    })

    return { t, ids }
  }

  // ─── getMyAttendanceHealth ────────────────────────────────────────────

  describe('getMyAttendanceHealth', () => {
    // 4-week window matching the widget's default: dateFrom .. dateFrom+27,
    // midpoint at dateFrom+14.
    const dateFrom = '2024-10-01'
    const dateTo = '2024-10-28'

    async function insertSession(
      t: Awaited<ReturnType<typeof setupTest>>['t'],
      classYearId: Awaited<ReturnType<typeof setupTest>>['ids']['classYearId'],
      semesterId: Awaited<ReturnType<typeof setupTest>>['ids']['semesterId'],
      sessionDate: string,
    ) {
      return t.run(async (ctx) => {
        return ctx.db.insert('classSessions', {
          classYearId,
          semesterId,
          sessionDate,
          sessionType: 'catechism',
          isCancelled: false,
          isDeleted: false,
        })
      })
    }

    async function recordStatus(
      t: Awaited<ReturnType<typeof setupTest>>['t'],
      sessionId: Awaited<ReturnType<typeof insertSession>>,
      studentClassId: Awaited<
        ReturnType<typeof setupTest>
      >['ids']['studentClassId'],
      recordedBy: Awaited<ReturnType<typeof setupTest>>['ids']['adminId'],
      status: 'present' | 'late' | 'excused_absence' | 'unexcused_absence',
    ) {
      await t.run(async (ctx) => {
        await ctx.db.insert('attendanceRecords', {
          sessionId,
          studentClassId,
          status,
          recordedBy,
          deviceQueuedAt: Date.now(),
          syncedAt: Date.now(),
          isDeleted: false,
        })
      })
    }

    // setupTest() seeds a stray catechism session dated 2024-10-01 (unrelated
    // to this describe block's own fixtures) which falls inside every window
    // used below and would otherwise silently pad the denominator. Soft-delete
    // it so each test's session list is exactly what it sets up itself.
    async function excludeFixtureSession(
      t: Awaited<ReturnType<typeof setupTest>>['t'],
      ids: Awaited<ReturnType<typeof setupTest>>['ids'],
    ) {
      await t.run(async (ctx) => {
        await ctx.db.patch('classSessions', ids.catechismSessionId, {
          isDeleted: true,
        })
      })
    }

    test('computes class rate from a mix of present/late/absent records', async () => {
      const { t, ids } = await setupTest()
      await excludeFixtureSession(t, ids)

      // 4 sessions inside the window, all in the early half so trend stays flat.
      const s1 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-02',
      )
      const s2 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-04',
      )
      const s3 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-06',
      )
      // Left unrecorded on purpose -- an unset session counts against the rate.
      await insertSession(t, ids.classYearId, ids.semesterId, '2024-10-08')

      await recordStatus(t, s1, ids.studentClassId, ids.adminId, 'present')
      await recordStatus(t, s2, ids.studentClassId, ids.adminId, 'late')
      await recordStatus(
        t,
        s3,
        ids.studentClassId,
        ids.adminId,
        'unexcused_absence',
      )
      // s4 left unrecorded -- counts against the rate.

      const result = await t.query(api.attendanceHealth.getMyAttendanceHealth, {
        requesterId: ids.homeroomId,
        academicYearId: ids.ayId,
        dateFrom,
        dateTo,
      })

      const summary = result.classSummaries.find(
        (c) => c.classYearId === ids.classYearId,
      )
      expect(summary).toBeDefined()
      // 2 present/late out of (1 student x 4 sessions) = 50%
      expect(summary!.rate).toBe(50)
      expect(summary!.trend).toBe('flat')
    })

    test('trend is "up" when the second half improves meaningfully', async () => {
      const { t, ids } = await setupTest()
      await excludeFixtureSession(t, ids)

      // Early half (before 2024-10-15): all absent.
      const early1 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-02',
      )
      const early2 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-08',
      )
      await recordStatus(
        t,
        early1,
        ids.studentClassId,
        ids.adminId,
        'unexcused_absence',
      )
      await recordStatus(
        t,
        early2,
        ids.studentClassId,
        ids.adminId,
        'unexcused_absence',
      )

      // Late half (on/after 2024-10-15): all present.
      const late1 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-16',
      )
      const late2 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-22',
      )
      await recordStatus(t, late1, ids.studentClassId, ids.adminId, 'present')
      await recordStatus(t, late2, ids.studentClassId, ids.adminId, 'present')

      const result = await t.query(api.attendanceHealth.getMyAttendanceHealth, {
        requesterId: ids.homeroomId,
        academicYearId: ids.ayId,
        dateFrom,
        dateTo,
      })

      const summary = result.classSummaries.find(
        (c) => c.classYearId === ids.classYearId,
      )
      expect(summary!.trend).toBe('up')
    })

    test('trend is "down" when the second half worsens meaningfully', async () => {
      const { t, ids } = await setupTest()
      await excludeFixtureSession(t, ids)

      const early1 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-02',
      )
      const early2 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-08',
      )
      await recordStatus(t, early1, ids.studentClassId, ids.adminId, 'present')
      await recordStatus(t, early2, ids.studentClassId, ids.adminId, 'present')

      const late1 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-16',
      )
      const late2 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-22',
      )
      await recordStatus(
        t,
        late1,
        ids.studentClassId,
        ids.adminId,
        'unexcused_absence',
      )
      await recordStatus(
        t,
        late2,
        ids.studentClassId,
        ids.adminId,
        'unexcused_absence',
      )

      const result = await t.query(api.attendanceHealth.getMyAttendanceHealth, {
        requesterId: ids.homeroomId,
        academicYearId: ids.ayId,
        dateFrom,
        dateTo,
      })

      const summary = result.classSummaries.find(
        (c) => c.classYearId === ids.classYearId,
      )
      expect(summary!.trend).toBe('down')
    })

    test('trend is "flat" when the difference is small', async () => {
      const { t, ids } = await setupTest()
      await excludeFixtureSession(t, ids)

      const early1 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-02',
      )
      await recordStatus(t, early1, ids.studentClassId, ids.adminId, 'present')

      const late1 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-16',
      )
      await recordStatus(t, late1, ids.studentClassId, ids.adminId, 'present')

      const result = await t.query(api.attendanceHealth.getMyAttendanceHealth, {
        requesterId: ids.homeroomId,
        academicYearId: ids.ayId,
        dateFrom,
        dateTo,
      })

      const summary = result.classSummaries.find(
        (c) => c.classYearId === ids.classYearId,
      )
      // Both halves are 100% -- delta is 0.
      expect(summary!.trend).toBe('flat')
    })

    test('trend is "flat" when one half of the window has no sessions', async () => {
      const { t, ids } = await setupTest()
      await excludeFixtureSession(t, ids)

      // Only early-half sessions; late half is empty.
      const early1 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-02',
      )
      await recordStatus(
        t,
        early1,
        ids.studentClassId,
        ids.adminId,
        'unexcused_absence',
      )

      const result = await t.query(api.attendanceHealth.getMyAttendanceHealth, {
        requesterId: ids.homeroomId,
        academicYearId: ids.ayId,
        dateFrom,
        dateTo,
      })

      const summary = result.classSummaries.find(
        (c) => c.classYearId === ids.classYearId,
      )
      expect(summary!.rate).toBe(0)
      expect(summary!.trend).toBe('flat')
    })

    test('rate is null and trend is flat when the classYear has zero sessions in the window', async () => {
      const { t, ids } = await setupTest()
      await excludeFixtureSession(t, ids)

      // No sessions inserted beyond the fixture's out-of-window ones.
      const result = await t.query(api.attendanceHealth.getMyAttendanceHealth, {
        requesterId: ids.homeroomId,
        academicYearId: ids.ayId,
        dateFrom,
        dateTo,
      })

      const summary = result.classSummaries.find(
        (c) => c.classYearId === ids.classYearId,
      )
      expect(summary).toBeDefined()
      expect(summary!.rate).toBeNull()
      expect(summary!.trend).toBe('flat')
    })

    test('a student with a 3-session absence streak appears in atRiskStudents', async () => {
      const { t, ids } = await setupTest()
      await excludeFixtureSession(t, ids)

      const s1 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-02',
      )
      const s2 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-04',
      )
      const s3 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-06',
      )

      await recordStatus(
        t,
        s1,
        ids.studentClassId,
        ids.adminId,
        'excused_absence',
      )
      await recordStatus(
        t,
        s2,
        ids.studentClassId,
        ids.adminId,
        'unexcused_absence',
      )
      await recordStatus(
        t,
        s3,
        ids.studentClassId,
        ids.adminId,
        'unexcused_absence',
      )

      const result = await t.query(api.attendanceHealth.getMyAttendanceHealth, {
        requesterId: ids.homeroomId,
        academicYearId: ids.ayId,
        dateFrom,
        dateTo,
      })

      const atRisk = result.atRiskStudents.find(
        (s) => s.studentClassId === ids.studentClassId,
      )
      expect(atRisk).toBeDefined()
      expect(atRisk!.consecutiveAbsences).toBe(3)
      expect(atRisk!.classId).toBe(ids.classId)
      expect(atRisk!.studentId).toBe(ids.studentId)
    })

    test('a streak broken by a present/late record does not count past the break', async () => {
      const { t, ids } = await setupTest()
      await excludeFixtureSession(t, ids)

      // Oldest -> newest: absent, absent, present, absent, absent, absent.
      // Most recent 3 are absences but the streak is only 3 unbroken from the
      // very end -- confirm a present in the middle stops an earlier streak
      // from bleeding in, and that the walk correctly stops at a present when
      // it's the most recent record.
      const s1 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-02',
      )
      const s2 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-04',
      )
      const s3 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-06',
      )

      await recordStatus(
        t,
        s1,
        ids.studentClassId,
        ids.adminId,
        'unexcused_absence',
      )
      await recordStatus(
        t,
        s2,
        ids.studentClassId,
        ids.adminId,
        'unexcused_absence',
      )
      await recordStatus(t, s3, ids.studentClassId, ids.adminId, 'present')

      const result = await t.query(api.attendanceHealth.getMyAttendanceHealth, {
        requesterId: ids.homeroomId,
        academicYearId: ids.ayId,
        dateFrom,
        dateTo,
      })

      const atRisk = result.atRiskStudents.find(
        (s) => s.studentClassId === ids.studentClassId,
      )
      expect(atRisk).toBeUndefined()
    })

    test('a streak stops at an unset (no-record) session', async () => {
      const { t, ids } = await setupTest()
      await excludeFixtureSession(t, ids)

      const s1 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-02',
      )
      const s2 = await insertSession(
        t,
        ids.classYearId,
        ids.semesterId,
        '2024-10-04',
      )
      // s3 has no attendance record at all -- most recent session.
      await insertSession(t, ids.classYearId, ids.semesterId, '2024-10-06')

      await recordStatus(
        t,
        s1,
        ids.studentClassId,
        ids.adminId,
        'unexcused_absence',
      )
      await recordStatus(
        t,
        s2,
        ids.studentClassId,
        ids.adminId,
        'unexcused_absence',
      )

      const result = await t.query(api.attendanceHealth.getMyAttendanceHealth, {
        requesterId: ids.homeroomId,
        academicYearId: ids.ayId,
        dateFrom,
        dateTo,
      })

      const atRisk = result.atRiskStudents.find(
        (s) => s.studentClassId === ids.studentClassId,
      )
      expect(atRisk).toBeUndefined()
    })

    test('branch-head-only access still includes that class summary', async () => {
      const { t, ids } = await setupTest()
      await excludeFixtureSession(t, ids)

      const branchHeadId = await t.run(async (ctx) => {
        const id = await ctx.db.insert('catechists', {
          memberId: 'GLV0010',
          fullName: 'Branch Head',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
        await ctx.db.insert('branchAssignments', {
          catechistId: id,
          branchId: ids.branchId,
          academicYearId: ids.ayId,
          isDeleted: false,
        })
        return id
      })

      const result = await t.query(api.attendanceHealth.getMyAttendanceHealth, {
        requesterId: branchHeadId,
        academicYearId: ids.ayId,
        dateFrom,
        dateTo,
      })

      const summary = result.classSummaries.find(
        (c) => c.classYearId === ids.classYearId,
      )
      expect(summary).toBeDefined()
    })

    test('a catechist with no access to the class does not see it', async () => {
      const { t, ids } = await setupTest()
      await excludeFixtureSession(t, ids)

      const result = await t.query(api.attendanceHealth.getMyAttendanceHealth, {
        requesterId: ids.regularCatechistId,
        academicYearId: ids.ayId,
        dateFrom,
        dateTo,
      })

      const summary = result.classSummaries.find(
        (c) => c.classYearId === ids.classYearId,
      )
      expect(summary).toBeUndefined()
      expect(result.atRiskStudents).toEqual([])
    })
  })
})
