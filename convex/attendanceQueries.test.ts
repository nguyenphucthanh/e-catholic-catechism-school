/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { AUTHZ_ERRORS } from './lib/errors'

const modules = import.meta.glob('./**/*.ts')

describe('attendanceQueries backend functions', () => {
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

  // ─── listAttendanceRecordsForStudentClass ────────────────────────────

  describe('listAttendanceRecordsForStudentClass', () => {
    test('returns records joined with session info, sorted by date descending', async () => {
      const { t, ids } = await setupTest()

      await t.run(async (ctx) => {
        await ctx.db.insert('attendanceRecords', {
          sessionId: ids.catechismSessionId,
          studentClassId: ids.studentClassId,
          status: 'present',
          recordedBy: ids.adminId,
          deviceQueuedAt: 1,
          isDeleted: false,
        })
        await ctx.db.insert('attendanceRecords', {
          sessionId: ids.massSessionId,
          studentClassId: ids.studentClassId,
          status: 'excused_absence',
          notes: 'Sick',
          recordedBy: ids.adminId,
          deviceQueuedAt: 2,
          isDeleted: false,
        })
      })

      const records = await t.query(
        api.attendanceQueries.listAttendanceRecordsForStudentClass,
        { requesterId: ids.adminId, studentClassId: ids.studentClassId },
      )

      expect(records).toHaveLength(2)
      // massSessionId is dated 2024-10-05, catechismSessionId is 2024-10-01 -- desc order.
      expect(records[0].sessionId).toBe(ids.massSessionId)
      expect(records[0].status).toBe('excused_absence')
      expect(records[0].notes).toBe('Sick')
      expect(records[0].sessionType).toBe('mass')
      expect(records[1].sessionId).toBe(ids.catechismSessionId)
      expect(records[1].status).toBe('present')
    })

    test('excludes soft-deleted attendance records', async () => {
      const { t, ids } = await setupTest()

      await t.run(async (ctx) => {
        await ctx.db.insert('attendanceRecords', {
          sessionId: ids.catechismSessionId,
          studentClassId: ids.studentClassId,
          status: 'present',
          recordedBy: ids.adminId,
          deviceQueuedAt: 1,
          isDeleted: true,
        })
      })

      const records = await t.query(
        api.attendanceQueries.listAttendanceRecordsForStudentClass,
        { requesterId: ids.adminId, studentClassId: ids.studentClassId },
      )

      expect(records).toHaveLength(0)
    })

    test('excludes records whose session is deleted', async () => {
      const { t, ids } = await setupTest()

      const deletedSessionId = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert('classSessions', {
          classYearId: ids.classYearId,
          semesterId: ids.semesterId,
          sessionDate: '2024-11-01',
          sessionType: 'catechism',
          isCancelled: false,
          isDeleted: true,
        })
        await ctx.db.insert('attendanceRecords', {
          sessionId,
          studentClassId: ids.studentClassId,
          status: 'late',
          recordedBy: ids.adminId,
          deviceQueuedAt: 1,
          isDeleted: false,
        })
        return sessionId
      })

      const records = await t.query(
        api.attendanceQueries.listAttendanceRecordsForStudentClass,
        { requesterId: ids.adminId, studentClassId: ids.studentClassId },
      )

      expect(
        records.find((r) => r.sessionId === deletedSessionId),
      ).toBeUndefined()
    })

    test('throws for an invalid requester', async () => {
      const { t, ids } = await setupTest()

      const deletedCatechistId = await t.run(async (ctx) => {
        const id = await ctx.db.insert('catechists', {
          memberId: 'GLV9999',
          fullName: 'Removed Catechist',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
        await ctx.db.delete('catechists', id)
        return id
      })

      await expect(
        t.query(api.attendanceQueries.listAttendanceRecordsForStudentClass, {
          requesterId: deletedCatechistId,
          studentClassId: ids.studentClassId,
        }),
      ).rejects.toThrow(AUTHZ_ERRORS.CATECHIST_NOT_FOUND)
    })
  })

  // ─── listMyAttendanceRecordsForStudentClass ──────────────────────────

  describe('listMyAttendanceRecordsForStudentClass', () => {
    test('returns records for the owning student', async () => {
      const { t, ids } = await setupTest()

      await t.run(async (ctx) => {
        await ctx.db.insert('attendanceRecords', {
          sessionId: ids.catechismSessionId,
          studentClassId: ids.studentClassId,
          status: 'present',
          recordedBy: ids.adminId,
          deviceQueuedAt: 1,
          isDeleted: false,
        })
      })

      const records = await t.query(
        api.attendanceQueries.listMyAttendanceRecordsForStudentClass,
        { requesterId: ids.studentId, studentClassId: ids.studentClassId },
      )

      expect(records).toHaveLength(1)
      expect(records[0].status).toBe('present')
    })

    test('returns empty array when the studentClassId belongs to a different student', async () => {
      const { t, ids } = await setupTest()

      const otherStudentId = await t.run(async (ctx) => {
        return await ctx.db.insert('students', {
          fullName: 'Other Student',
          studentCode: 'HS002',
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
      })

      await t.run(async (ctx) => {
        await ctx.db.insert('attendanceRecords', {
          sessionId: ids.catechismSessionId,
          studentClassId: ids.studentClassId,
          status: 'present',
          recordedBy: ids.adminId,
          deviceQueuedAt: 1,
          isDeleted: false,
        })
      })

      const records = await t.query(
        api.attendanceQueries.listMyAttendanceRecordsForStudentClass,
        { requesterId: otherStudentId, studentClassId: ids.studentClassId },
      )

      expect(records).toEqual([])
    })

    test('returns empty array for a deleted studentClassId', async () => {
      const { t, ids } = await setupTest()

      await t.run(async (ctx) => {
        await ctx.db.patch('studentClasses', ids.studentClassId, {
          isDeleted: true,
        })
      })

      const records = await t.query(
        api.attendanceQueries.listMyAttendanceRecordsForStudentClass,
        { requesterId: ids.studentId, studentClassId: ids.studentClassId },
      )

      expect(records).toEqual([])
    })

    test('throws for an inactive requester', async () => {
      const { t, ids } = await setupTest()

      const inactiveStudentId = await t.run(async (ctx) => {
        return await ctx.db.insert('students', {
          fullName: 'Inactive Student',
          studentCode: 'HS003',
          isActive: false,
          createdAt: Date.now(),
          isDeleted: false,
        })
      })

      await expect(
        t.query(api.attendanceQueries.listMyAttendanceRecordsForStudentClass, {
          requesterId: inactiveStudentId,
          studentClassId: ids.studentClassId,
        }),
      ).rejects.toThrow(AUTHZ_ERRORS.ACCOUNT_INACTIVE)
    })
  })

  // ─── getSessionStudents ────────────────────────────────────────────────

  describe('getSessionStudents', () => {
    test('retrieves students in scope', async () => {
      const { t, ids } = await setupTest()

      const otherStudentId = await t.run(async (ctx) => {
        const sid = await ctx.db.insert('students', {
          fullName: 'Other Student',
          studentCode: 'HS002',
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
        await ctx.db.insert('studentClasses', {
          studentId: sid,
          classYearId: ids.classYearId,
          enrolledDate: '2024-09-01',
          isPrimaryClass: true,
          status: 'active',
          isDeleted: false,
        })
        return sid
      })

      const data = await t.query(api.attendanceQueries.getSessionStudents, {
        sessionId: ids.catechismSessionId,
        requesterId: ids.homeroomId,
      })

      expect(data.students.length).toBe(2)
      expect(data.students.map((s) => s.studentId).sort()).toEqual(
        [ids.studentId, otherStudentId].sort(),
      )
      expect(data.records.length).toBe(0)
    })

    test('mass/extracurricular session pulls parish-wide scope', async () => {
      const { t, ids } = await setupTest()

      const data = await t.query(api.attendanceQueries.getSessionStudents, {
        sessionId: ids.massSessionId,
        requesterId: ids.regularCatechistId,
      })

      expect(data.students.length).toBe(1)
      expect(data.students[0].studentId).toBe(ids.studentId)
    })
  })
})

// ─── getStudentAttendanceHistory ──────────────────────────────────────────

describe('getStudentAttendanceHistory backend function', () => {
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

      // Extracurricular session in active academic year — should be included, later timestamp
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
        deviceQueuedAt: 1773130200000, // one day later
        isDeleted: false,
      })

      // Catechism session (class-scoped, no academicYearId of its own) in the
      // active academic year via classYearId — should now be included.
      const catechismSessionId = await ctx.db.insert('classSessions', {
        classYearId,
        semesterId: undefined,
        sessionDate: '2026-07-10',
        sessionType: 'catechism',
        isCancelled: false,
        isDeleted: false,
      })
      const catechismRecordId = await ctx.db.insert('attendanceRecords', {
        sessionId: catechismSessionId,
        studentClassId,
        status: 'present',
        recordedBy: regularCatechistId,
        deviceQueuedAt: 1773216600000,
        isDeleted: false,
      })

      // Supplemental session (class-scoped) in the active academic year via
      // classYearId — should now be included.
      const supplementalSessionId = await ctx.db.insert('classSessions', {
        classYearId,
        semesterId: undefined,
        sessionDate: '2026-07-14',
        sessionType: 'supplemental',
        isCancelled: false,
        isDeleted: false,
      })
      const supplementalRecordId = await ctx.db.insert('attendanceRecords', {
        sessionId: supplementalSessionId,
        studentClassId,
        status: 'present',
        recordedBy: regularCatechistId,
        deviceQueuedAt: 1773562200000,
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

      // Deleted mass session in active academic year — should be filtered out
      const deletedSessionId = await ctx.db.insert('classSessions', {
        classYearId: undefined,
        semesterId: undefined,
        academicYearId: activeAyId,
        sessionDate: '2026-07-12',
        sessionType: 'mass',
        isCancelled: false,
        isDeleted: true,
      })
      await ctx.db.insert('attendanceRecords', {
        sessionId: deletedSessionId,
        studentClassId,
        status: 'present',
        recordedBy: regularCatechistId,
        deviceQueuedAt: 1773389400000,
        isDeleted: false,
      })

      // Deleted attendance record on an otherwise-valid mass session — should be filtered out
      const deletedRecordSessionId = await ctx.db.insert('classSessions', {
        classYearId: undefined,
        semesterId: undefined,
        academicYearId: activeAyId,
        sessionDate: '2026-07-13',
        sessionType: 'mass',
        isCancelled: false,
        isDeleted: false,
      })
      await ctx.db.insert('attendanceRecords', {
        sessionId: deletedRecordSessionId,
        studentClassId,
        status: 'present',
        recordedBy: regularCatechistId,
        deviceQueuedAt: 1773475800000,
        isDeleted: true,
      })

      // A second class + classYear under the INACTIVE academic year — used to
      // prove that a class-scoped session's year is resolved via its own
      // classYearId -> classYear.academicYearId, even though the session
      // itself carries no academicYearId field.
      const inactiveYearClassId = await ctx.db.insert('classes', {
        branchId,
        name: 'Chiên Con Old',
        isDeleted: false,
      })
      const inactiveYearClassYearId = await ctx.db.insert('classYears', {
        classId: inactiveYearClassId,
        academicYearId: inactiveAyId,
        isDeleted: false,
      })
      const catechismInactiveYearSessionId = await ctx.db.insert(
        'classSessions',
        {
          classYearId: inactiveYearClassYearId,
          semesterId: undefined,
          sessionDate: '2024-07-10',
          sessionType: 'catechism',
          isCancelled: false,
          isDeleted: false,
        },
      )
      const catechismInactiveYearRecordId = await ctx.db.insert(
        'attendanceRecords',
        {
          sessionId: catechismInactiveYearSessionId,
          studentClassId,
          status: 'present',
          recordedBy: regularCatechistId,
          deviceQueuedAt: 1720086400000,
          isDeleted: false,
        },
      )

      // A second class (still under the active academic year) that the
      // student is NOT currently enrolled in — used to prove that a
      // class-scoped session resolves className via its own classYearId,
      // not via the student's current studentClass -> classYear mapping.
      const otherClassId = await ctx.db.insert('classes', {
        branchId,
        name: 'Chiên Con 2',
        isDeleted: false,
      })
      const otherClassYearId = await ctx.db.insert('classYears', {
        classId: otherClassId,
        academicYearId: activeAyId,
        isDeleted: false,
      })
      // Session recorded against the OTHER class's classYearId, but the
      // attendanceRecord uses the student's own studentClassId (enrolled in
      // classYearId, "Chiên Con 1") — className should resolve to "Chiên Con
      // 2" (the session's own class), not "Chiên Con 1".
      const crossClassSessionId = await ctx.db.insert('classSessions', {
        classYearId: otherClassYearId,
        semesterId: undefined,
        sessionDate: '2026-07-15',
        sessionType: 'catechism',
        isCancelled: false,
        isDeleted: false,
      })
      const crossClassRecordId = await ctx.db.insert('attendanceRecords', {
        sessionId: crossClassSessionId,
        studentClassId,
        status: 'present',
        recordedBy: regularCatechistId,
        deviceQueuedAt: 1773648600000,
        isDeleted: false,
      })

      return {
        regularCatechistId,
        studentId,
        studentClassId,
        massRecordId,
        extraRecordId,
        catechismRecordId,
        supplementalRecordId,
        catechismInactiveYearRecordId,
        crossClassRecordId,
        otherClassYearId,
      }
    })

    return { t, ids }
  }

  test('returns mass and extracurricular records for the active academic year sorted by most recent first', async () => {
    const { t, ids } = await setupTest()

    const report = await t.query(
      api.attendanceQueries.getStudentAttendanceHistory,
      {
        requesterId: ids.regularCatechistId,
        studentId: ids.studentId,
      },
    )

    const massRecord = report.find((r) => r._id === ids.massRecordId)
    const extraRecord = report.find((r) => r._id === ids.extraRecordId)

    expect(massRecord).toMatchObject({
      status: 'present',
      sessionType: 'mass',
      sessionDate: '2026-07-08',
      recordedByCatechistName: 'Maria Catechist Name',
    })
    expect(extraRecord).toMatchObject({
      status: 'late',
      sessionType: 'extracurricular',
      sessionDate: '2026-07-09',
      recordedByCatechistName: 'Maria Catechist Name',
    })

    // Sorted by deviceQueuedAt descending overall.
    const queuedAts = report.map((r) => r.deviceQueuedAt)
    expect(queuedAts).toEqual([...queuedAts].sort((a, b) => b - a))
  })

  test('includes catechism and supplemental records (previously excluded)', async () => {
    const { t, ids } = await setupTest()

    const report = await t.query(
      api.attendanceQueries.getStudentAttendanceHistory,
      {
        requesterId: ids.regularCatechistId,
        studentId: ids.studentId,
      },
    )

    const catechismRecord = report.find((r) => r._id === ids.catechismRecordId)
    const supplementalRecord = report.find(
      (r) => r._id === ids.supplementalRecordId,
    )

    expect(catechismRecord).toMatchObject({
      status: 'present',
      sessionType: 'catechism',
      sessionDate: '2026-07-10',
      className: 'Chiên Con 1',
    })
    expect(supplementalRecord).toMatchObject({
      status: 'present',
      sessionType: 'supplemental',
      sessionDate: '2026-07-14',
      className: 'Chiên Con 1',
    })
  })

  test('excludes a class-scoped session whose classYear.academicYearId does not match the active year', async () => {
    const { t, ids } = await setupTest()

    const report = await t.query(
      api.attendanceQueries.getStudentAttendanceHistory,
      {
        requesterId: ids.regularCatechistId,
        studentId: ids.studentId,
      },
    )

    expect(
      report.some((r) => r._id === ids.catechismInactiveYearRecordId),
    ).toBe(false)
  })

  test('resolves className for a class-scoped session via the session own classYearId, not the student current studentClass mapping', async () => {
    const { t, ids } = await setupTest()

    const report = await t.query(
      api.attendanceQueries.getStudentAttendanceHistory,
      {
        requesterId: ids.regularCatechistId,
        studentId: ids.studentId,
      },
    )

    const crossClassRecord = report.find(
      (r) => r._id === ids.crossClassRecordId,
    )

    // The attendanceRecord's studentClassId points at "Chiên Con 1", but the
    // session itself was recorded against "Chiên Con 2" (otherClassYearId) —
    // className must reflect the session's own class.
    expect(crossClassRecord?.className).toBe('Chiên Con 2')
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

    const report = await t.query(
      api.attendanceQueries.getStudentAttendanceHistory,
      {
        requesterId: ids.regularCatechistId,
        studentId: ids.studentId,
      },
    )

    expect(report).toEqual([])
  })

  test('returns empty array when student has no studentClasses', async () => {
    const { t, ids } = await setupTest()

    const otherStudentId = await t.run(async (ctx) => {
      return await ctx.db.insert('students', {
        studentCode: 'HV0002',
        fullName: 'Other Student',
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
    })

    const report = await t.query(
      api.attendanceQueries.getStudentAttendanceHistory,
      {
        requesterId: ids.regularCatechistId,
        studentId: otherStudentId,
      },
    )

    expect(report).toEqual([])
  })

  test('fails if requester is not a valid catechist', async () => {
    const { t, ids } = await setupTest()

    const invalidId = 'jd7zzzzzzzzzzzzzzzzzzzzzzzzz' as any

    await expect(
      t.query(api.attendanceQueries.getStudentAttendanceHistory, {
        requesterId: invalidId,
        studentId: ids.studentId,
      }),
    ).rejects.toThrow()
  })
})
