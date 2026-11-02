/// <reference types="vite/client" />
import { describe, expect, test } from 'vitest'
import { authedConvexTest } from '../test-utils/authedConvexTest'
import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

describe('offline QR attendance endpoints', () => {
  async function setupTest() {
    const t = authedConvexTest(schema, modules)

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
  describe('Mass scan -> catechism auto-link', () => {
    const DATE = '2026-07-08'

    async function linkSetup() {
      const { t, ids } = await setupTest()
      const semesterId = await t.run((ctx) =>
        ctx.db.insert('semesters', {
          academicYearId: ids.ayId,
          semesterNumber: 1,
          isDeleted: false,
        }),
      )
      const massSession = await t.mutation(
        api.classSessions.openOrGetParishSession,
        { requesterId: ids.regularId, sessionDate: DATE, sessionType: 'mass' },
      )
      const scan = (
        studentClassId: any,
        over: Record<string, unknown> = {},
        sem: any = semesterId,
      ) =>
        t.mutation(api.attendance.recordBatch, {
          requesterId: ids.regularId,
          records: [
            {
              localId: 'l',
              sessionId: massSession._id,
              studentClassId,
              status: 'present' as const,
              deviceQueuedAt: 1000,
              catechismLink: { semesterId: sem },
              ...over,
            },
          ],
        })
      const catechismSessions = () =>
        t.run((ctx) =>
          ctx.db
            .query('classSessions')
            .withIndex('by_session_type_and_session_date', (q) =>
              q.eq('sessionType', 'catechism'),
            )
            .collect(),
        )
      const recordsFor = (sessionId: any, studentClassId: any) =>
        t.run((ctx) =>
          ctx.db
            .query('attendanceRecords')
            .withIndex('by_session_id_and_student_class_id', (q) =>
              q.eq('sessionId', sessionId).eq('studentClassId', studentClassId),
            )
            .collect(),
        )
      const seedCatechism = (over: Record<string, unknown> = {}) =>
        t.run((ctx) =>
          ctx.db.insert('classSessions', {
            classYearId: ids.classYearId,
            semesterId,
            sessionDate: DATE,
            sessionType: 'catechism',
            isCancelled: false,
            isDeleted: false,
            ...over,
          }),
        )
      return {
        t,
        ids,
        semesterId,
        massSession,
        scan,
        catechismSessions,
        recordsFor,
        seedCatechism,
      }
    }

    test('creates catechism session and present record with source mass_qr', async () => {
      const c = await linkSetup()
      const res = await c.scan(c.ids.studentClassId1)
      expect(res).toEqual([
        {
          localId: 'l',
          status: 'synced',
          catechismLink: { outcome: 'created' },
        },
      ])
      const sessions = await c.catechismSessions()
      expect(sessions).toHaveLength(1)
      expect(sessions[0]).toMatchObject({
        classYearId: c.ids.classYearId,
        semesterId: c.semesterId,
        sessionDate: DATE,
        isCancelled: false,
      })
      const recs = await c.recordsFor(sessions[0]._id, c.ids.studentClassId1)
      expect(recs).toHaveLength(1)
      expect(recs[0]).toMatchObject({
        status: 'present',
        source: 'mass_qr',
        isDeleted: false,
      })
    })

    test('second student of the same class reuses the session', async () => {
      const c = await linkSetup()
      await c.scan(c.ids.studentClassId1)
      const res = await c.scan(c.ids.studentClassId2)
      expect(res[0].catechismLink).toEqual({ outcome: 'created' })
      const sessions = await c.catechismSessions()
      expect(sessions).toHaveLength(1)
      expect(
        await c.recordsFor(sessions[0]._id, c.ids.studentClassId2),
      ).toHaveLength(1)
    })

    test('same student again reports exists and adds no record', async () => {
      const c = await linkSetup()
      await c.scan(c.ids.studentClassId1)
      // Pre-existing catechism record found by a link call; force a fresh Mass
      // record by removing the Mass one so the scan syncs again.
      await c.t.run(async (ctx) => {
        const rows = await ctx.db.query('attendanceRecords').collect()
        for (const r of rows)
          if (r.sessionId === c.massSession._id)
            await ctx.db.delete('attendanceRecords', r._id)
      })
      const res = await c.scan(c.ids.studentClassId1)
      expect(res[0].catechismLink).toEqual({ outcome: 'exists' })
      const sessions = await c.catechismSessions()
      expect(
        await c.recordsFor(sessions[0]._id, c.ids.studentClassId1),
      ).toHaveLength(1)
    })

    test('leaves a pre-existing live record untouched', async () => {
      const c = await linkSetup()
      const sid = await c.seedCatechism()
      await c.t.run((ctx) =>
        ctx.db.insert('attendanceRecords', {
          sessionId: sid,
          studentClassId: c.ids.studentClassId1,
          status: 'excused_absence',
          recordedBy: c.ids.adminId,
          deviceQueuedAt: 1,
          syncedAt: 1,
          isDeleted: false,
        }),
      )
      const res = await c.scan(c.ids.studentClassId1)
      expect(res[0].catechismLink).toEqual({ outcome: 'exists' })
      const recs = await c.recordsFor(sid, c.ids.studentClassId1)
      expect(recs).toHaveLength(1)
      expect(recs[0].status).toBe('excused_absence')
      expect(recs[0].source).toBeUndefined()
    })

    test('reactivates a soft-deleted record without duplicating', async () => {
      const c = await linkSetup()
      const sid = await c.seedCatechism()
      await c.t.run((ctx) =>
        ctx.db.insert('attendanceRecords', {
          sessionId: sid,
          studentClassId: c.ids.studentClassId1,
          status: 'unexcused_absence',
          recordedBy: c.ids.adminId,
          deviceQueuedAt: 1,
          syncedAt: 1,
          isDeleted: true,
        }),
      )
      const res = await c.scan(c.ids.studentClassId1)
      expect(res[0].catechismLink).toEqual({ outcome: 'created' })
      const recs = await c.recordsFor(sid, c.ids.studentClassId1)
      expect(recs).toHaveLength(1)
      expect(recs[0]).toMatchObject({
        status: 'present',
        source: 'mass_qr',
        isDeleted: false,
      })
    })

    test('skips with session_cancelled when catechism session is cancelled', async () => {
      const c = await linkSetup()
      const sid = await c.seedCatechism({ isCancelled: true })
      const res = await c.scan(c.ids.studentClassId1)
      expect(res[0]).toMatchObject({
        status: 'synced',
        catechismLink: { outcome: 'skipped', reason: 'session_cancelled' },
      })
      expect(await c.recordsFor(sid, c.ids.studentClassId1)).toHaveLength(0)
    })

    test.each([
      ['non-primary', { isPrimaryClass: false }],
      ['withdrawn', { status: 'withdrawn' }],
      ['on_leave', { status: 'on_leave' }],
    ])('skips with not_primary_class for %s enrollment', async (_n, patch) => {
      const c = await linkSetup()
      await c.t.run((ctx) =>
        ctx.db.patch('studentClasses', c.ids.studentClassId1, patch as any),
      )
      const res = await c.scan(c.ids.studentClassId1)
      expect(res[0]).toMatchObject({
        status: 'synced',
        catechismLink: { outcome: 'skipped', reason: 'not_primary_class' },
      })
      expect(await c.catechismSessions()).toHaveLength(0)
    })

    test('skips with invalid_semester for another year or deleted semester', async () => {
      const c = await linkSetup()
      const { otherSem, deletedSem } = await c.t.run(async (ctx) => {
        const ay2 = await ctx.db.insert('academicYears', {
          name: '2025-2026',
          startDate: '2025-09-01',
          endDate: '2026-05-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: false,
          isDeleted: false,
        })
        return {
          otherSem: await ctx.db.insert('semesters', {
            academicYearId: ay2,
            semesterNumber: 1,
            isDeleted: false,
          }),
          deletedSem: await ctx.db.insert('semesters', {
            academicYearId: c.ids.ayId,
            semesterNumber: 2,
            isDeleted: true,
          }),
        }
      })
      // distinct students: a repeat scan of one student would conflict
      for (const [sc, sem] of [
        [c.ids.studentClassId1, otherSem],
        [c.ids.studentClassId2, deletedSem],
      ] as const) {
        const res = await c.scan(sc, {}, sem)
        expect(res[0].catechismLink).toEqual({
          outcome: 'skipped',
          reason: 'invalid_semester',
        })
      }
      expect(await c.catechismSessions()).toHaveLength(0)
    })

    test('skips with year_mismatch when class year is in a different year', async () => {
      const c = await linkSetup()
      await c.t.run(async (ctx) => {
        const ay2 = await ctx.db.insert('academicYears', {
          name: '2025-2026',
          startDate: '2025-09-01',
          endDate: '2026-05-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: false,
          isDeleted: false,
        })
        const cy2 = await ctx.db.insert('classYears', {
          classId: c.ids.classId,
          academicYearId: ay2,
          isDeleted: false,
        })
        await ctx.db.patch('studentClasses', c.ids.studentClassId1, {
          classYearId: cy2,
        })
      })
      const res = await c.scan(c.ids.studentClassId1)
      expect(res[0].catechismLink).toEqual({
        outcome: 'skipped',
        reason: 'year_mismatch',
      })
      expect(await c.catechismSessions()).toHaveLength(0)
    })

    test.each([
      ['late status', { status: 'late' }],
      ['excused status', { status: 'excused_absence' }],
      ['no catechismLink', { catechismLink: undefined }],
    ])('does not link for %s', async (_n, over) => {
      const c = await linkSetup()
      const res = await c.scan(c.ids.studentClassId1, over)
      expect(res).toEqual([{ localId: 'l', status: 'synced' }])
      expect(await c.catechismSessions()).toHaveLength(0)
    })

    test('does not link for a non-mass session', async () => {
      const c = await linkSetup()
      const sid = await c.seedCatechism({ sessionDate: '2026-07-15' })
      const res = await c.t.mutation(api.attendance.recordBatch, {
        requesterId: c.ids.adminId,
        records: [
          {
            localId: 'x',
            sessionId: sid,
            studentClassId: c.ids.studentClassId1,
            status: 'present',
            deviceQueuedAt: 1,
            catechismLink: { semesterId: c.semesterId },
          },
        ],
      })
      expect(res).toEqual([{ localId: 'x', status: 'synced' }])
      expect(await c.catechismSessions()).toHaveLength(1)
    })

    test('mass record stays synced regardless of link outcome', async () => {
      const c = await linkSetup()
      await c.seedCatechism({ isCancelled: true })
      const res = await c.scan(c.ids.studentClassId1)
      expect(res[0].status).toBe('synced')
      const massRecs = await c.recordsFor(
        c.massSession._id,
        c.ids.studentClassId1,
      )
      expect(massRecs).toHaveLength(1)
      expect(massRecs[0].status).toBe('present')
    })

    test('duplicate mass scan conflicts and does not link', async () => {
      const c = await linkSetup()
      await c.scan(c.ids.studentClassId1)
      const res = await c.scan(c.ids.studentClassId1, {
        deviceQueuedAt: 99999,
        localId: 'dup',
      })
      expect(res).toEqual([{ localId: 'dup', status: 'conflict' }])
      const sessions = await c.catechismSessions()
      expect(
        await c.recordsFor(sessions[0]._id, c.ids.studentClassId1),
      ).toHaveLength(1)
    })
  })
})
