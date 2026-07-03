/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

describe('attendance grid board query and mutation', () => {
  async function setupTest() {
    const t = convexTest(schema, modules)

    const ids = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert('catechists', {
        memberId: 'GLV0001',
        fullName: 'Admin User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })

      const homeroomId = await ctx.db.insert('catechists', {
        memberId: 'GLV0004',
        fullName: 'Homeroom User',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })

      const regularId = await ctx.db.insert('catechists', {
        memberId: 'GLV0006',
        fullName: 'Regular Catechist',
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

      const semesterId = await ctx.db.insert('semesters', {
        academicYearId: ayId,
        semesterNumber: 1,
        isDeleted: false,
      })

      const studentId = await ctx.db.insert('students', {
        fullName: 'Nguyễn Văn A',
        saintName: 'Giuse',
        studentCode: 'HS0001',
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })

      const studentClassId = await ctx.db.insert('studentClasses', {
        studentId,
        classYearId,
        enrolledDate: '2024-09-05',
        isPrimaryClass: true,
        status: 'active',
        isDeleted: false,
      })

      // Class sessions
      const sessionId1 = await ctx.db.insert('classSessions', {
        classYearId,
        semesterId,
        sessionDate: '2024-09-10',
        sessionType: 'catechism',
        isCancelled: false,
        isDeleted: false,
      })

      const sessionId2 = await ctx.db.insert('classSessions', {
        classYearId,
        semesterId,
        sessionDate: '2024-09-17',
        sessionType: 'catechism',
        isCancelled: false,
        isDeleted: false,
      })

      // Teach assignments
      await ctx.db.insert('classCatechists', {
        catechistId: homeroomId,
        classYearId,
        academicYearId: ayId,
        role: 'homeroom',
        isDeleted: false,
      })

      return {
        adminId,
        homeroomId,
        regularId,
        classId,
        ayId,
        classYearId,
        semesterId,
        studentId,
        studentClassId,
        sessionId1,
        sessionId2,
      }
    })

    return { t, ids }
  }

  test('getAttendanceGrid retrieves enrolled students and sorted sessions', async () => {
    const { t, ids } = await setupTest()

    const grid = await t.query(api.attendance.getAttendanceGrid, {
      classId: ids.classId,
      academicYearId: ids.ayId,
      requesterId: ids.adminId,
    })

    expect(grid.students).toHaveLength(1)
    expect(grid.students[0]).toMatchObject({
      studentId: ids.studentId,
      studentClassId: ids.studentClassId,
      fullName: 'Nguyễn Văn A',
      saintName: 'Giuse',
      studentCode: 'HS0001',
    })

    // Sorted descending: sessionId2 (09-17) is first, sessionId1 (09-10) is second
    expect(grid.sessions).toHaveLength(2)
    expect(grid.sessions[0]._id).toBe(ids.sessionId2)
    expect(grid.sessions[1]._id).toBe(ids.sessionId1)
    expect(grid.attendanceMap).toEqual({})
  })

  test('saveGridAttendance creates, updates, and clears records', async () => {
    const { t, ids } = await setupTest()

    // 1. Save new attendance (present)
    await t.mutation(api.attendance.saveGridAttendance, {
      requesterId: ids.homeroomId,
      sessionId: ids.sessionId1,
      studentId: ids.studentId,
      status: 'present',
      notes: 'Came early',
    })

    let grid = await t.query(api.attendance.getAttendanceGrid, {
      classId: ids.classId,
      academicYearId: ids.ayId,
      requesterId: ids.homeroomId,
    })

    const key1 = `${ids.studentClassId}_${ids.sessionId1}`
    expect(grid.attendanceMap[key1]).toMatchObject({
      status: 'present',
      notes: 'Came early',
    })

    // 2. Update status and notes
    await t.mutation(api.attendance.saveGridAttendance, {
      requesterId: ids.homeroomId,
      sessionId: ids.sessionId1,
      studentId: ids.studentId,
      status: 'late',
      notes: 'Late 10m',
    })

    grid = await t.query(api.attendance.getAttendanceGrid, {
      classId: ids.classId,
      academicYearId: ids.ayId,
      requesterId: ids.homeroomId,
    })
    expect(grid.attendanceMap[key1]).toMatchObject({
      status: 'late',
      notes: 'Late 10m',
    })

    // 3. Clear attendance (unset/null)
    await t.mutation(api.attendance.saveGridAttendance, {
      requesterId: ids.homeroomId,
      sessionId: ids.sessionId1,
      studentId: ids.studentId,
      status: null,
    })

    grid = await t.query(api.attendance.getAttendanceGrid, {
      classId: ids.classId,
      academicYearId: ids.ayId,
      requesterId: ids.homeroomId,
    })
    expect(grid.attendanceMap[key1]).toBeUndefined()
  })

  test('non-homeroom teacher cannot save attendance', async () => {
    const { t, ids } = await setupTest()

    await expect(
      t.mutation(api.attendance.saveGridAttendance, {
        requesterId: ids.regularId,
        sessionId: ids.sessionId1,
        studentId: ids.studentId,
        status: 'present',
      }),
    ).rejects.toThrow('Unauthorized')
  })

  test('bulkSaveGridAttendance marks all provided students present in one call', async () => {
    const { t, ids } = await setupTest()

    await t.mutation(api.attendance.bulkSaveGridAttendance, {
      requesterId: ids.homeroomId,
      sessionId: ids.sessionId1,
      studentIds: [ids.studentId],
      status: 'present',
    })

    const grid = await t.query(api.attendance.getAttendanceGrid, {
      classId: ids.classId,
      academicYearId: ids.ayId,
      requesterId: ids.homeroomId,
    })

    const key1 = `${ids.studentClassId}_${ids.sessionId1}`
    expect(grid.attendanceMap[key1]).toMatchObject({ status: 'present' })
  })

  test('bulkSaveGridAttendance with status null soft-deletes existing records', async () => {
    const { t, ids } = await setupTest()

    await t.mutation(api.attendance.bulkSaveGridAttendance, {
      requesterId: ids.homeroomId,
      sessionId: ids.sessionId1,
      studentIds: [ids.studentId],
      status: 'present',
    })

    let grid = await t.query(api.attendance.getAttendanceGrid, {
      classId: ids.classId,
      academicYearId: ids.ayId,
      requesterId: ids.homeroomId,
    })
    const key1 = `${ids.studentClassId}_${ids.sessionId1}`
    expect(grid.attendanceMap[key1]).toMatchObject({ status: 'present' })

    await t.mutation(api.attendance.bulkSaveGridAttendance, {
      requesterId: ids.homeroomId,
      sessionId: ids.sessionId1,
      studentIds: [ids.studentId],
      status: null,
    })

    grid = await t.query(api.attendance.getAttendanceGrid, {
      classId: ids.classId,
      academicYearId: ids.ayId,
      requesterId: ids.homeroomId,
    })
    expect(grid.attendanceMap[key1]).toBeUndefined()
  })

  test('non-homeroom teacher cannot bulk save attendance', async () => {
    const { t, ids } = await setupTest()

    await expect(
      t.mutation(api.attendance.bulkSaveGridAttendance, {
        requesterId: ids.regularId,
        sessionId: ids.sessionId1,
        studentIds: [ids.studentId],
        status: 'present',
      }),
    ).rejects.toThrow('Unauthorized')
  })
})
