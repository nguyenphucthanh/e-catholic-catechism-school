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
