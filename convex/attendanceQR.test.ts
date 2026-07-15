/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

describe('offline QR attendance endpoints', () => {
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

      const regularId = await ctx.db.insert('catechists', {
        memberId: 'GLV0003',
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

      const classYearId = await ctx.db.insert('classYears', {
        classId,
        academicYearId: ayId,
        isDeleted: false,
      })

      const studentId1 = await ctx.db.insert('students', {
        fullName: 'Student 1',
        studentCode: 'S001',
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })

      const studentId2 = await ctx.db.insert('students', {
        fullName: 'Student 2',
        studentCode: 'S002',
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })

      const studentClassId1 = await ctx.db.insert('studentClasses', {
        studentId: studentId1,
        classYearId,
        isPrimaryClass: true,
        enrolledDate: '2026-07-08',
        status: 'active',
        isDeleted: false,
      })

      const studentClassId2 = await ctx.db.insert('studentClasses', {
        studentId: studentId2,
        classYearId,
        isPrimaryClass: true,
        enrolledDate: '2026-07-08',
        status: 'active',
        isDeleted: false,
      })

      // Assignment for board member
      await ctx.db.insert('academicYearAssignments', {
        academicYearId: ayId,
        catechistId: boardId,
        assignmentType: 'board_member',
        isDeleted: false,
      })

      return {
        adminId,
        boardId,
        regularId,
        branchId,
        classId,
        ayId,
        classYearId,
        studentId1,
        studentId2,
        studentClassId1,
        studentClassId2,
      }
    })

    return { t, ids }
  }

  test('recordBatch with conflict resolution (First-Write-Wins)', async () => {
    const { t, ids } = await setupTest()

    const session = await t.mutation(api.classSessions.openOrGetParishSession, {
      requesterId: ids.regularId,
      sessionDate: '2026-07-08',
      sessionType: 'mass',
    })

    // Batch upload two scans
    const timestamp1 = Date.now()
    const results = await t.mutation(api.attendance.recordBatch, {
      requesterId: ids.regularId,
      records: [
        {
          localId: 'scan_1',
          sessionId: session._id,
          studentClassId: ids.studentClassId1,
          status: 'present',
          deviceQueuedAt: timestamp1,
        },
        {
          localId: 'scan_2',
          sessionId: session._id,
          studentClassId: ids.studentClassId2,
          status: 'present',
          deviceQueuedAt: timestamp1,
        },
      ],
    })

    expect(results).toEqual([
      { localId: 'scan_1', status: 'synced' },
      { localId: 'scan_2', status: 'synced' },
    ])

    // Attempt double-scan with LATER timestamp (should trigger conflict and discard)
    const resultsConflict = await t.mutation(api.attendance.recordBatch, {
      requesterId: ids.regularId,
      records: [
        {
          localId: 'scan_1_dup',
          sessionId: session._id,
          studentClassId: ids.studentClassId1,
          status: 'late',
          deviceQueuedAt: timestamp1 + 5000,
        },
      ],
    })
    expect(resultsConflict).toEqual([
      { localId: 'scan_1_dup', status: 'conflict' },
    ])

    // Attempt scan with EARLIER timestamp (should overwrite/sync)
    const resultsOverwrite = await t.mutation(api.attendance.recordBatch, {
      requesterId: ids.regularId,
      records: [
        {
          localId: 'scan_1_earlier',
          sessionId: session._id,
          studentClassId: ids.studentClassId1,
          status: 'late',
          deviceQueuedAt: timestamp1 - 5000,
        },
      ],
    })
    expect(resultsOverwrite).toEqual([
      { localId: 'scan_1_earlier', status: 'synced' },
    ])

    // Verify overwritten record status
    const data = await t.query(api.attendanceQueries.getSessionStudents, {
      sessionId: session._id,
      requesterId: ids.regularId,
    })
    const record1 = data.records.find(
      (r) => r.studentClassId === ids.studentClassId1,
    )
    expect(record1?.status).toBe('late')
  })
})
