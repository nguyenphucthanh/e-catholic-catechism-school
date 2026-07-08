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

    const report = await t.query(api.attendance.getParishAttendanceReport, {
      requesterId: ids.regularCatechistId,
      sessionDate: '2026-07-09',
      sessionType: 'mass',
    })

    expect(report.session).toBeNull()
    expect(report.records).toHaveLength(0)
  })

  test('returns records if session and attendance records exist', async () => {
    const { t, ids } = await setupTest()

    const report = await t.query(api.attendance.getParishAttendanceReport, {
      requesterId: ids.regularCatechistId,
      sessionDate: '2026-07-08',
      sessionType: 'mass',
    })

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
      t.query(api.attendance.getParishAttendanceReport, {
        requesterId: invalidId,
        sessionDate: '2026-07-08',
        sessionType: 'mass',
      }),
    ).rejects.toThrow()
  })
})
