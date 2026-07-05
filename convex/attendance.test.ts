/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { ATTENDANCE_ERRORS } from './lib/errors'

const modules = import.meta.glob('./**/*.ts')

describe('attendance backend functions', () => {
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

  // ─── recordAttendance ───────────────────────────────────────────────

  describe('recordAttendance', () => {
    test('admin can record attendance for enrolled student', async () => {
      const { t, ids } = await setupTest()
      const attendanceId = await t.mutation(api.attendance.recordAttendance, {
        requesterId: ids.adminId,
        sessionId: ids.catechismSessionId,
        studentId: ids.studentId,
        status: 'present',
        deviceQueuedAt: 1727700000000,
      })
      expect(attendanceId).toBeDefined()

      const record = await t.run(async (ctx) => {
        return await ctx.db.get('attendanceRecords', attendanceId)
      })
      expect(record).not.toBeNull()
      expect(record!.sessionId).toBe(ids.catechismSessionId)
      expect(record!.studentClassId).toBe(ids.studentClassId)
      expect(record!.status).toBe('present')
      expect(record!.recordedBy).toBe(ids.adminId)
      expect(record!.deviceQueuedAt).toBe(1727700000000)
      expect(record!.syncedAt).toBeDefined()
      expect(record!.isDeleted).toBe(false)
    })

    test('homeroom catechist can record attendance', async () => {
      const { t, ids } = await setupTest()
      const attendanceId = await t.mutation(api.attendance.recordAttendance, {
        requesterId: ids.homeroomId,
        sessionId: ids.catechismSessionId,
        studentId: ids.studentId,
        status: 'late',
        deviceQueuedAt: 1727700000000,
      })
      expect(attendanceId).toBeDefined()
    })

    test('board member can record attendance for parish-scoped session', async () => {
      const { t, ids } = await setupTest()
      const attendanceId = await t.mutation(api.attendance.recordAttendance, {
        requesterId: ids.boardId,
        sessionId: ids.massSessionId,
        studentId: ids.studentId,
        status: 'present',
        deviceQueuedAt: 1727700000000,
      })
      expect(attendanceId).toBeDefined()
    })

    test('regular catechist cannot record attendance', async () => {
      const { t, ids } = await setupTest()
      await expect(
        t.mutation(api.attendance.recordAttendance, {
          requesterId: ids.regularCatechistId,
          sessionId: ids.catechismSessionId,
          studentId: ids.studentId,
          status: 'present',
          deviceQueuedAt: 1727700000000,
        }),
      ).rejects.toThrow('Unauthorized')
    })

    test('throws error on cancelled session', async () => {
      const { t, ids } = await setupTest()
      await expect(
        t.mutation(api.attendance.recordAttendance, {
          requesterId: ids.adminId,
          sessionId: ids.cancelledSessionId,
          studentId: ids.studentId,
          status: 'present',
          deviceQueuedAt: 1727700000000,
        }),
      ).rejects.toThrow(ATTENDANCE_ERRORS.SESSION_CANCELLED)
    })

    test('throws error on duplicate record', async () => {
      const { t, ids } = await setupTest()
      await t.mutation(api.attendance.recordAttendance, {
        requesterId: ids.adminId,
        sessionId: ids.catechismSessionId,
        studentId: ids.studentId,
        status: 'present',
        deviceQueuedAt: 1727700000000,
      })
      await expect(
        t.mutation(api.attendance.recordAttendance, {
          requesterId: ids.adminId,
          sessionId: ids.catechismSessionId,
          studentId: ids.studentId,
          status: 'late',
          deviceQueuedAt: 1727700000000,
        }),
      ).rejects.toThrow(ATTENDANCE_ERRORS.ALREADY_RECORDED)
    })

    test('throws error on unenrolled student', async () => {
      const { t, ids } = await setupTest()
      const unenrolledStudentId = await t.run(async (ctx) => {
        return await ctx.db.insert('students', {
          fullName: 'Unenrolled Student',
          studentCode: 'HS002',
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
      })
      await expect(
        t.mutation(api.attendance.recordAttendance, {
          requesterId: ids.adminId,
          sessionId: ids.catechismSessionId,
          studentId: unenrolledStudentId,
          status: 'present',
          deviceQueuedAt: 1727700000000,
        }),
      ).rejects.toThrow(ATTENDANCE_ERRORS.STUDENT_NOT_ENROLLED)
    })

    test('records notes when provided', async () => {
      const { t, ids } = await setupTest()
      const attendanceId = await t.mutation(api.attendance.recordAttendance, {
        requesterId: ids.adminId,
        sessionId: ids.catechismSessionId,
        studentId: ids.studentId,
        status: 'excused_absence',
        notes: 'Family trip',
        deviceQueuedAt: 1727700000000,
      })
      const record = await t.run(async (ctx) => {
        return await ctx.db.get('attendanceRecords', attendanceId)
      })
      expect(record!.notes).toBe('Family trip')
    })

    test('throws error on inactive academic year', async () => {
      const { t, ids } = await setupTest()
      const inactiveSessionId = await t.run(async (ctx) => {
        const inactiveClassYearId = await ctx.db.insert('classYears', {
          classId: ids.classId,
          academicYearId: ids.inactiveAyId,
          isDeleted: false,
        })
        return await ctx.db.insert('classSessions', {
          classYearId: inactiveClassYearId,
          semesterId: ids.semesterId,
          sessionDate: '2023-10-01',
          sessionType: 'catechism',
          isCancelled: false,
          notes: undefined,
          isDeleted: false,
        })
      })
      await expect(
        t.mutation(api.attendance.recordAttendance, {
          requesterId: ids.adminId,
          sessionId: inactiveSessionId,
          studentId: ids.studentId,
          status: 'present',
          deviceQueuedAt: 1727700000000,
        }),
      ).rejects.toThrow(ATTENDANCE_ERRORS.INACTIVE_ACADEMIC_YEAR)
    })

    test('throws error for withdrawn enrollment', async () => {
      const { t, ids } = await setupTest()
      const withdrawnStudentId = await t.run(async (ctx) => {
        const sid = await ctx.db.insert('students', {
          fullName: 'Withdrawn Student',
          studentCode: 'HS003',
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
        await ctx.db.insert('studentClasses', {
          studentId: sid,
          classYearId: ids.classYearId,
          enrolledDate: '2024-09-01',
          isPrimaryClass: true,
          status: 'withdrawn',
          leftDate: '2024-10-15',
          isDeleted: false,
        })
        return sid
      })
      await expect(
        t.mutation(api.attendance.recordAttendance, {
          requesterId: ids.adminId,
          sessionId: ids.catechismSessionId,
          studentId: withdrawnStudentId,
          status: 'present',
          deviceQueuedAt: 1727700000000,
        }),
      ).rejects.toThrow(ATTENDANCE_ERRORS.STUDENT_NOT_ENROLLED)
    })
  })

  // ─── bulkRecordAttendance ───────────────────────────────────────────

  describe('bulkRecordAttendance', () => {
    test('admin can record attendance for multiple students', async () => {
      const { t, ids } = await setupTest()
      const student2Id = await t.run(async (ctx) => {
        const sid = await ctx.db.insert('students', {
          fullName: 'Student 2',
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

      const result = await t.mutation(api.attendance.bulkRecordAttendance, {
        requesterId: ids.adminId,
        sessionId: ids.catechismSessionId,
        records: [
          {
            studentId: ids.studentId,
            status: 'present',
            deviceQueuedAt: 1727700000000,
          },
          {
            studentId: student2Id,
            status: 'excused_absence',
            deviceQueuedAt: 1727700000001,
            notes: 'Sick',
          },
        ],
      })
      expect(result).toHaveLength(2)
    })

    test('throws if any student is not enrolled', async () => {
      const { t, ids } = await setupTest()
      const unenrolledId = await t.run(async (ctx) => {
        return await ctx.db.insert('students', {
          fullName: 'Unenrolled',
          studentCode: 'HS099',
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
      })
      await expect(
        t.mutation(api.attendance.bulkRecordAttendance, {
          requesterId: ids.adminId,
          sessionId: ids.catechismSessionId,
          records: [
            {
              studentId: ids.studentId,
              status: 'present',
              deviceQueuedAt: 1727700000000,
            },
            {
              studentId: unenrolledId,
              status: 'late',
              deviceQueuedAt: 1727700000001,
            },
          ],
        }),
      ).rejects.toThrow(ATTENDANCE_ERRORS.STUDENT_NOT_ENROLLED)
    })
  })

  // ─── updateAttendance ───────────────────────────────────────────────

  describe('updateAttendance', () => {
    test('admin can update attendance status and notes', async () => {
      const { t, ids } = await setupTest()
      const attendanceId = await t.mutation(api.attendance.recordAttendance, {
        requesterId: ids.adminId,
        sessionId: ids.catechismSessionId,
        studentId: ids.studentId,
        status: 'present',
        deviceQueuedAt: 1727700000000,
      })

      await t.mutation(api.attendance.updateAttendance, {
        requesterId: ids.adminId,
        attendanceId,
        status: 'late',
        notes: 'Arrived 15 min late',
      })

      const record = await t.run(async (ctx) => {
        return await ctx.db.get('attendanceRecords', attendanceId)
      })
      expect(record!.status).toBe('late')
      expect(record!.notes).toBe('Arrived 15 min late')
      expect(record!.deviceQueuedAt).toBe(1727700000000)
    })

    test('throws on deleted record', async () => {
      const { t, ids } = await setupTest()
      const attendanceId = await t.mutation(api.attendance.recordAttendance, {
        requesterId: ids.adminId,
        sessionId: ids.catechismSessionId,
        studentId: ids.studentId,
        status: 'present',
        deviceQueuedAt: 1727700000000,
      })
      await t.run(async (ctx) => {
        await ctx.db.patch('attendanceRecords', attendanceId, {
          isDeleted: true,
        })
      })
      await expect(
        t.mutation(api.attendance.updateAttendance, {
          requesterId: ids.adminId,
          attendanceId,
          status: 'late',
        }),
      ).rejects.toThrow(ATTENDANCE_ERRORS.RECORD_NOT_FOUND)
    })
  })

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
        api.attendance.listAttendanceRecordsForStudentClass,
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
        api.attendance.listAttendanceRecordsForStudentClass,
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
        api.attendance.listAttendanceRecordsForStudentClass,
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
        t.query(api.attendance.listAttendanceRecordsForStudentClass, {
          requesterId: deletedCatechistId,
          studentClassId: ids.studentClassId,
        }),
      ).rejects.toThrow('Unauthorized')
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
        api.attendance.listMyAttendanceRecordsForStudentClass,
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
        api.attendance.listMyAttendanceRecordsForStudentClass,
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
        api.attendance.listMyAttendanceRecordsForStudentClass,
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
        t.query(api.attendance.listMyAttendanceRecordsForStudentClass, {
          requesterId: inactiveStudentId,
          studentClassId: ids.studentClassId,
        }),
      ).rejects.toThrow('Unauthorized')
    })
  })

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

      const result = await t.query(api.attendance.getMyAttendanceHealth, {
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

      const result = await t.query(api.attendance.getMyAttendanceHealth, {
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

      const result = await t.query(api.attendance.getMyAttendanceHealth, {
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

      const result = await t.query(api.attendance.getMyAttendanceHealth, {
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

      const result = await t.query(api.attendance.getMyAttendanceHealth, {
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
      const result = await t.query(api.attendance.getMyAttendanceHealth, {
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

      const result = await t.query(api.attendance.getMyAttendanceHealth, {
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

      const result = await t.query(api.attendance.getMyAttendanceHealth, {
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

      const result = await t.query(api.attendance.getMyAttendanceHealth, {
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

      const result = await t.query(api.attendance.getMyAttendanceHealth, {
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

      const result = await t.query(api.attendance.getMyAttendanceHealth, {
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
