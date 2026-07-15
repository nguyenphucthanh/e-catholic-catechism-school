/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { AUTHZ_ERRORS, CLASS_SESSION_ERRORS } from './lib/errors'

const modules = import.meta.glob('./**/*.ts')

describe('classSessions backend functions', () => {
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

      const branchHeadId = await ctx.db.insert('catechists', {
        memberId: 'GLV0003',
        fullName: 'Branch Head',
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

      const coTeacherId = await ctx.db.insert('catechists', {
        memberId: 'GLV0005',
        fullName: 'Co-Teacher',
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

      // Board member assignment
      await ctx.db.insert('academicYearAssignments', {
        academicYearId: ayId,
        catechistId: boardId,
        assignmentType: 'board_member',
        isDeleted: false,
      })

      // Branch head assignment
      await ctx.db.insert('branchAssignments', {
        academicYearId: ayId,
        catechistId: branchHeadId,
        branchId,
        isDeleted: false,
      })

      // Homeroom catechist assignment
      await ctx.db.insert('classCatechists', {
        catechistId: homeroomId,
        classYearId,
        academicYearId: ayId,
        role: 'homeroom',
        isDeleted: false,
      })

      // Co-teacher assignment
      await ctx.db.insert('classCatechists', {
        catechistId: coTeacherId,
        classYearId,
        academicYearId: ayId,
        role: 'co_teacher',
        isDeleted: false,
      })

      return {
        adminId,
        boardId,
        branchHeadId,
        homeroomId,
        coTeacherId,
        regularCatechistId,
        branchId,
        classId,
        classYearId,
        semesterId,
        ayId,
        inactiveAyId,
      }
    })

    return { t, ids }
  }

  // ─── Create — class-scoped ─────────────────────────────────────────

  describe('create — class-scoped (catechism)', () => {
    test('admin can create catechism session', async () => {
      const { t, ids } = await setupTest()
      const sessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        classYearId: ids.classYearId,
        semesterId: ids.semesterId,
        sessionDate: '2024-10-01',
        sessionType: 'catechism',
      })
      expect(sessionId).toBeDefined()

      const session = await t.run(async (ctx) => {
        return await ctx.db.get('classSessions', sessionId)
      })
      expect(session).not.toBeNull()
      expect(session!.classYearId).toBe(ids.classYearId)
      expect(session!.semesterId).toBe(ids.semesterId)
      expect(session!.academicYearId).toBeUndefined()
      expect(session!.sessionType).toBe('catechism')
      expect(session!.isCancelled).toBe(false)
      expect(session!.isDeleted).toBe(false)
    })

    test('board member can create catechism session', async () => {
      const { t, ids } = await setupTest()
      const sessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.boardId,
        classYearId: ids.classYearId,
        semesterId: ids.semesterId,
        sessionDate: '2024-10-01',
        sessionType: 'catechism',
      })
      expect(sessionId).toBeDefined()
    })

    test('branch head can create catechism session', async () => {
      const { t, ids } = await setupTest()
      const sessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.branchHeadId,
        classYearId: ids.classYearId,
        semesterId: ids.semesterId,
        sessionDate: '2024-10-01',
        sessionType: 'catechism',
      })
      expect(sessionId).toBeDefined()
    })

    test('homeroom catechist can create catechism session', async () => {
      const { t, ids } = await setupTest()
      const sessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.homeroomId,
        classYearId: ids.classYearId,
        semesterId: ids.semesterId,
        sessionDate: '2024-10-01',
        sessionType: 'catechism',
      })
      expect(sessionId).toBeDefined()
    })

    test('co-teacher can create catechism session', async () => {
      const { t, ids } = await setupTest()
      const sessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.coTeacherId,
        classYearId: ids.classYearId,
        semesterId: ids.semesterId,
        sessionDate: '2024-10-01',
        sessionType: 'catechism',
      })
      expect(sessionId).toBeDefined()
    })

    test('regular catechist cannot create catechism session', async () => {
      const { t, ids } = await setupTest()
      await expect(
        t.mutation(api.classSessions.create, {
          requesterId: ids.regularCatechistId,
          classYearId: ids.classYearId,
          semesterId: ids.semesterId,
          sessionDate: '2024-10-01',
          sessionType: 'catechism',
        }),
      ).rejects.toThrow(AUTHZ_ERRORS.NO_CLASS_ACCESS)
    })

    test('missing classYearId or semesterId throws INVALID_SCOPE', async () => {
      const { t, ids } = await setupTest()
      await expect(
        t.mutation(api.classSessions.create, {
          requesterId: ids.adminId,
          sessionDate: '2024-10-01',
          sessionType: 'catechism',
        }),
      ).rejects.toThrow(CLASS_SESSION_ERRORS.INVALID_SCOPE)

      await expect(
        t.mutation(api.classSessions.create, {
          requesterId: ids.adminId,
          classYearId: ids.classYearId,
          sessionDate: '2024-10-01',
          sessionType: 'supplemental',
        }),
      ).rejects.toThrow(CLASS_SESSION_ERRORS.INVALID_SCOPE)
    })

    test('create on inactive academic year throws', async () => {
      const { t, ids } = await setupTest()
      // Create classYear for inactive year
      const inactiveClassYearId = await t.run(async (ctx) => {
        return await ctx.db.insert('classYears', {
          classId: ids.classId,
          academicYearId: ids.inactiveAyId,
          isDeleted: false,
        })
      })
      const inactiveSemesterId = await t.run(async (ctx) => {
        return await ctx.db.insert('semesters', {
          academicYearId: ids.inactiveAyId,
          semesterNumber: 1,
          isDeleted: false,
        })
      })

      await expect(
        t.mutation(api.classSessions.create, {
          requesterId: ids.adminId,
          classYearId: inactiveClassYearId,
          semesterId: inactiveSemesterId,
          sessionDate: '2024-10-01',
          sessionType: 'catechism',
        }),
      ).rejects.toThrow(CLASS_SESSION_ERRORS.INACTIVE_ACADEMIC_YEAR)
    })
  })

  // ─── Create — parish-scoped ────────────────────────────────────────

  describe('create — parish-scoped (mass)', () => {
    test('admin can create mass session', async () => {
      const { t, ids } = await setupTest()
      const sessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        sessionDate: '2024-10-06',
        sessionType: 'mass',
      })
      expect(sessionId).toBeDefined()

      const session = await t.run(async (ctx) => {
        return await ctx.db.get('classSessions', sessionId)
      })
      expect(session!.classYearId).toBeUndefined()
      expect(session!.semesterId).toBeUndefined()
      expect(session!.academicYearId).toBe(ids.ayId)
      expect(session!.sessionType).toBe('mass')
    })

    test('board member can create mass session', async () => {
      const { t, ids } = await setupTest()
      const sessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.boardId,
        sessionDate: '2024-10-06',
        sessionType: 'mass',
      })
      expect(sessionId).toBeDefined()
    })

    test('branch head cannot create mass session', async () => {
      const { t, ids } = await setupTest()
      await expect(
        t.mutation(api.classSessions.create, {
          requesterId: ids.branchHeadId,
          sessionDate: '2024-10-06',
          sessionType: 'mass',
        }),
      ).rejects.toThrow(AUTHZ_ERRORS.NOT_BOARD_MEMBER)
    })

    test('homeroom catechist cannot create mass session', async () => {
      const { t, ids } = await setupTest()
      await expect(
        t.mutation(api.classSessions.create, {
          requesterId: ids.homeroomId,
          sessionDate: '2024-10-06',
          sessionType: 'mass',
        }),
      ).rejects.toThrow(AUTHZ_ERRORS.NOT_BOARD_MEMBER)
    })

    test('calling create twice for the same date/type reuses the existing session', async () => {
      const { t, ids } = await setupTest()
      const firstId = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        sessionDate: '2024-10-06',
        sessionType: 'mass',
      })

      const secondId = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        sessionDate: '2024-10-06',
        sessionType: 'mass',
      })

      expect(secondId).toBe(firstId)

      const allSessions = await t.run(async (ctx) => {
        return await ctx.db.query('classSessions').collect()
      })
      expect(
        allSessions.filter(
          (s) => s.sessionType === 'mass' && s.sessionDate === '2024-10-06',
        ),
      ).toHaveLength(1)
    })

    test('create throws SESSION_CANCELLED when the existing session for that date/type is cancelled', async () => {
      const { t, ids } = await setupTest()
      const sessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        sessionDate: '2024-10-06',
        sessionType: 'mass',
      })
      await t.run(async (ctx) => {
        await ctx.db.patch('classSessions', sessionId, { isCancelled: true })
      })

      await expect(
        t.mutation(api.classSessions.create, {
          requesterId: ids.adminId,
          sessionDate: '2024-10-06',
          sessionType: 'mass',
        }),
      ).rejects.toThrow(CLASS_SESSION_ERRORS.SESSION_CANCELLED)
    })

    test('no active year throws NO_ACTIVE_YEAR', async () => {
      const { t, ids } = await setupTest()
      // Set active to false on the only active year
      await t.run(async (ctx) => {
        await ctx.db.patch('academicYears', ids.ayId, { isActive: false })
      })

      await expect(
        t.mutation(api.classSessions.create, {
          requesterId: ids.adminId,
          sessionDate: '2024-10-06',
          sessionType: 'mass',
        }),
      ).rejects.toThrow(CLASS_SESSION_ERRORS.NO_ACTIVE_YEAR)
    })
  })

  // ─── List ──────────────────────────────────────────────────────────

  describe('list', () => {
    test('lists all non-deleted sessions', async () => {
      const { t, ids } = await setupTest()
      const s1 = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        classYearId: ids.classYearId,
        semesterId: ids.semesterId,
        sessionDate: '2024-10-01',
        sessionType: 'catechism',
      })
      const s2 = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        sessionDate: '2024-10-06',
        sessionType: 'mass',
      })

      const list = await t.query(api.classSessions.list, {
        requesterId: ids.adminId,
      })
      expect(list).toHaveLength(2)
      expect(list.map((s) => s._id)).toEqual(expect.arrayContaining([s1, s2]))
    })

    test('filters by classYearId', async () => {
      const { t, ids } = await setupTest()
      await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        classYearId: ids.classYearId,
        semesterId: ids.semesterId,
        sessionDate: '2024-10-01',
        sessionType: 'catechism',
      })
      await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        sessionDate: '2024-10-06',
        sessionType: 'mass',
      })

      const list = await t.query(api.classSessions.list, {
        requesterId: ids.adminId,
        classYearId: ids.classYearId,
      })
      expect(list).toHaveLength(1)
      expect(list[0].sessionType).toBe('catechism')
    })

    test('filters by sessionType', async () => {
      const { t, ids } = await setupTest()
      await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        classYearId: ids.classYearId,
        semesterId: ids.semesterId,
        sessionDate: '2024-10-01',
        sessionType: 'catechism',
      })
      await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        sessionDate: '2024-10-06',
        sessionType: 'mass',
      })

      const list = await t.query(api.classSessions.list, {
        requesterId: ids.adminId,
        sessionType: 'mass',
      })
      expect(list).toHaveLength(1)
      expect(list[0].sessionType).toBe('mass')
    })

    test('excludes soft-deleted sessions', async () => {
      const { t, ids } = await setupTest()
      const s1 = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        sessionDate: '2024-10-06',
        sessionType: 'mass',
      })
      const s2 = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        sessionDate: '2024-10-13',
        sessionType: 'mass',
      })

      await t.mutation(api.classSessions.softDelete, {
        requesterId: ids.adminId,
        sessionId: s1,
      })

      const list = await t.query(api.classSessions.list, {
        requesterId: ids.adminId,
      })
      expect(list).toHaveLength(1)
      expect(list[0]._id).toBe(s2)
    })
  })

  // ─── Get ───────────────────────────────────────────────────────────

  describe('get', () => {
    test('returns session by id', async () => {
      const { t, ids } = await setupTest()
      const sessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        classYearId: ids.classYearId,
        semesterId: ids.semesterId,
        sessionDate: '2024-10-01',
        sessionType: 'catechism',
      })

      const session = await t.query(api.classSessions.get, {
        requesterId: ids.adminId,
        id: sessionId,
      })
      expect(session).not.toBeNull()
      expect(session!._id).toBe(sessionId)
    })

    test('returns null for deleted session', async () => {
      const { t, ids } = await setupTest()
      const sessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        sessionDate: '2024-10-06',
        sessionType: 'mass',
      })

      await t.mutation(api.classSessions.softDelete, {
        requesterId: ids.adminId,
        sessionId,
      })

      const session = await t.query(api.classSessions.get, {
        requesterId: ids.adminId,
        id: sessionId,
      })
      expect(session).toBeNull()
    })
  })

  // ─── Update ────────────────────────────────────────────────────────

  describe('update', () => {
    test('updates session fields', async () => {
      const { t, ids } = await setupTest()
      const sessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        classYearId: ids.classYearId,
        semesterId: ids.semesterId,
        sessionDate: '2024-10-01',
        sessionType: 'catechism',
      })

      await t.mutation(api.classSessions.update, {
        requesterId: ids.adminId,
        sessionId,
        sessionDate: '2024-10-15',
        isCancelled: true,
        notes: 'Rescheduled',
      })

      const session = await t.query(api.classSessions.get, {
        requesterId: ids.adminId,
        id: sessionId,
      })
      expect(session!.sessionDate).toBe('2024-10-15')
      expect(session!.isCancelled).toBe(true)
      expect(session!.notes).toBe('Rescheduled')
    })

    test('throws NOT_FOUND for deleted session', async () => {
      const { t, ids } = await setupTest()
      const sessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        sessionDate: '2024-10-06',
        sessionType: 'mass',
      })
      await t.mutation(api.classSessions.softDelete, {
        requesterId: ids.adminId,
        sessionId,
      })

      await expect(
        t.mutation(api.classSessions.update, {
          requesterId: ids.adminId,
          sessionId,
          sessionDate: '2024-11-01',
        }),
      ).rejects.toThrow(CLASS_SESSION_ERRORS.NOT_FOUND)
    })

    test('homeroom catechist can update their class session', async () => {
      const { t, ids } = await setupTest()
      const sessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.homeroomId,
        classYearId: ids.classYearId,
        semesterId: ids.semesterId,
        sessionDate: '2024-10-01',
        sessionType: 'catechism',
      })

      await t.mutation(api.classSessions.update, {
        requesterId: ids.homeroomId,
        sessionId,
        notes: 'Updated by homeroom catechist',
      })

      const session = await t.query(api.classSessions.get, {
        requesterId: ids.adminId,
        id: sessionId,
      })
      expect(session!.notes).toBe('Updated by homeroom catechist')
    })

    test('co-teacher can update session', async () => {
      const { t, ids } = await setupTest()
      const sessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        classYearId: ids.classYearId,
        semesterId: ids.semesterId,
        sessionDate: '2024-10-01',
        sessionType: 'catechism',
      })

      await t.mutation(api.classSessions.update, {
        requesterId: ids.coTeacherId,
        sessionId,
        notes: 'Updated by co-teacher',
      })

      const session = await t.query(api.classSessions.get, {
        requesterId: ids.adminId,
        id: sessionId,
      })
      expect(session!.notes).toBe('Updated by co-teacher')
    })
  })

  // ─── Soft Delete ───────────────────────────────────────────────────

  describe('softDelete', () => {
    test('soft-deletes session', async () => {
      const { t, ids } = await setupTest()
      const sessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        sessionDate: '2024-10-06',
        sessionType: 'mass',
      })

      await t.mutation(api.classSessions.softDelete, {
        requesterId: ids.adminId,
        sessionId,
      })

      const session = await t.run(async (ctx) => {
        return await ctx.db.get('classSessions', sessionId)
      })
      expect(session!.isDeleted).toBe(true)
    })

    test('throws NOT_FOUND for already deleted session', async () => {
      const { t, ids } = await setupTest()
      const sessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        sessionDate: '2024-10-06',
        sessionType: 'mass',
      })
      await t.mutation(api.classSessions.softDelete, {
        requesterId: ids.adminId,
        sessionId,
      })

      await expect(
        t.mutation(api.classSessions.softDelete, {
          requesterId: ids.adminId,
          sessionId,
        }),
      ).rejects.toThrow(CLASS_SESSION_ERRORS.NOT_FOUND)
    })

    test('homeroom catechist can delete their class session', async () => {
      const { t, ids } = await setupTest()
      const sessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.homeroomId,
        classYearId: ids.classYearId,
        semesterId: ids.semesterId,
        sessionDate: '2024-10-01',
        sessionType: 'catechism',
      })

      await t.mutation(api.classSessions.softDelete, {
        requesterId: ids.homeroomId,
        sessionId,
      })

      const session = await t.run(async (ctx) => {
        return await ctx.db.get('classSessions', sessionId)
      })
      expect(session!.isDeleted).toBe(true)
    })
  })

  describe('createWithAttendance', () => {
    test('admin can create catechism session with attendance', async () => {
      const { t, ids } = await setupTest()

      const studentId = await t.run(async (ctx) => {
        const sId = await ctx.db.insert('students', {
          studentCode: 'HS0001',
          fullName: 'Test Student',
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
        await ctx.db.insert('studentClasses', {
          studentId: sId,
          classYearId: ids.classYearId,
          isPrimaryClass: true,
          enrolledDate: '2024-09-01',
          status: 'active',
          isDeleted: false,
        })
        return sId
      })

      const sessionId = await t.mutation(
        api.classSessions.createWithAttendance,
        {
          requesterId: ids.adminId,
          classYearId: ids.classYearId,
          semesterId: ids.semesterId,
          sessionDate: '2024-10-01',
          sessionType: 'catechism',
          notes: 'Initial session',
          attendance: [
            {
              studentId,
              status: 'present',
              notes: 'Good student',
            },
          ],
        },
      )

      expect(sessionId).toBeDefined()

      const records = await t.run(async (ctx) => {
        return await ctx.db.query('attendanceRecords').collect()
      })
      expect(records).toHaveLength(1)
      expect(records[0].sessionId).toBe(sessionId)
      expect(records[0].status).toBe('present')
      expect(records[0].notes).toBe('Good student')
    })

    test('throws if student is not enrolled', async () => {
      const { t, ids } = await setupTest()

      const studentId = await t.run(async (ctx) => {
        return await ctx.db.insert('students', {
          studentCode: 'HS0001',
          fullName: 'Test Student',
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
      })

      await expect(
        t.mutation(api.classSessions.createWithAttendance, {
          requesterId: ids.adminId,
          classYearId: ids.classYearId,
          semesterId: ids.semesterId,
          sessionDate: '2024-10-01',
          sessionType: 'catechism',
          attendance: [
            {
              studentId,
              status: 'present',
            },
          ],
        }),
      ).rejects.toThrow()
    })
  })

  // ─── listMySessionsInRange ───────────────────────────────────────────

  describe('listMySessionsInRange', () => {
    async function setupSessions() {
      const { t, ids } = await setupTest()

      const studentId = await t.run(async (ctx) => {
        const sId = await ctx.db.insert('students', {
          studentCode: 'HS0001',
          fullName: 'Test Student',
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
        await ctx.db.insert('studentClasses', {
          studentId: sId,
          classYearId: ids.classYearId,
          isPrimaryClass: true,
          enrolledDate: '2024-09-01',
          status: 'active',
          isDeleted: false,
        })
        return sId
      })

      // In-range catechism session with one recorded attendance record
      const inRangeSessionId = await t.mutation(
        api.classSessions.createWithAttendance,
        {
          requesterId: ids.adminId,
          classYearId: ids.classYearId,
          semesterId: ids.semesterId,
          sessionDate: '2024-10-08',
          sessionType: 'catechism',
          attendance: [{ studentId, status: 'present' }],
        },
      )

      // In-range supplemental session with no attendance recorded yet
      const supplementalSessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        classYearId: ids.classYearId,
        semesterId: ids.semesterId,
        sessionDate: '2024-10-09',
        sessionType: 'supplemental',
      })

      // Out-of-range session
      const outOfRangeSessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        classYearId: ids.classYearId,
        semesterId: ids.semesterId,
        sessionDate: '2024-11-01',
        sessionType: 'catechism',
      })

      // In-range but wrong session type (should be excluded)
      const massSessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        sessionDate: '2024-10-08',
        sessionType: 'mass',
      })

      // In-range but cancelled
      const cancelledSessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        classYearId: ids.classYearId,
        semesterId: ids.semesterId,
        sessionDate: '2024-10-08',
        sessionType: 'catechism',
      })
      await t.mutation(api.classSessions.update, {
        requesterId: ids.adminId,
        sessionId: cancelledSessionId,
        isCancelled: true,
      })

      // In-range but soft-deleted
      const deletedSessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        classYearId: ids.classYearId,
        semesterId: ids.semesterId,
        sessionDate: '2024-10-08',
        sessionType: 'catechism',
      })
      await t.mutation(api.classSessions.softDelete, {
        requesterId: ids.adminId,
        sessionId: deletedSessionId,
      })

      return {
        t,
        ids,
        studentId,
        inRangeSessionId,
        supplementalSessionId,
        outOfRangeSessionId,
        massSessionId,
        cancelledSessionId,
        deletedSessionId,
      }
    }

    test('homeroom catechist sees their class sessions in range with correct counts', async () => {
      const { t, ids, inRangeSessionId, supplementalSessionId } =
        await setupSessions()

      const results = await t.query(api.classSessions.listMySessionsInRange, {
        requesterId: ids.homeroomId,
        academicYearId: ids.ayId,
        dateFrom: '2024-10-01',
        dateTo: '2024-10-31',
      })

      expect(results).toHaveLength(2)

      const inRange = results.find((r) => r.sessionId === inRangeSessionId)
      expect(inRange).toBeDefined()
      expect(inRange!.classId).toBe(ids.classId)
      expect(inRange!.classYearId).toBe(ids.classYearId)
      expect(inRange!.className).toBe('Test Class')
      expect(inRange!.sessionType).toBe('catechism')
      expect(inRange!.studentCount).toBe(1)
      expect(inRange!.recordedCount).toBe(1)

      const supplemental = results.find(
        (r) => r.sessionId === supplementalSessionId,
      )
      expect(supplemental).toBeDefined()
      expect(supplemental!.sessionType).toBe('supplemental')
      expect(supplemental!.studentCount).toBe(1)
      expect(supplemental!.recordedCount).toBe(0)
    })

    test('excludes sessions outside the date range', async () => {
      const { t, ids, outOfRangeSessionId } = await setupSessions()

      const results = await t.query(api.classSessions.listMySessionsInRange, {
        requesterId: ids.homeroomId,
        academicYearId: ids.ayId,
        dateFrom: '2024-10-01',
        dateTo: '2024-10-31',
      })

      expect(results.some((r) => r.sessionId === outOfRangeSessionId)).toBe(
        false,
      )
    })

    test('excludes mass/extracurricular session types even if in range', async () => {
      const { t, ids, massSessionId } = await setupSessions()

      const results = await t.query(api.classSessions.listMySessionsInRange, {
        requesterId: ids.homeroomId,
        academicYearId: ids.ayId,
        dateFrom: '2024-10-01',
        dateTo: '2024-10-31',
      })

      expect(results.some((r) => r.sessionId === massSessionId)).toBe(false)
    })

    test('excludes cancelled and soft-deleted sessions', async () => {
      const { t, ids, cancelledSessionId, deletedSessionId } =
        await setupSessions()

      const results = await t.query(api.classSessions.listMySessionsInRange, {
        requesterId: ids.homeroomId,
        academicYearId: ids.ayId,
        dateFrom: '2024-10-01',
        dateTo: '2024-10-31',
      })

      expect(results.some((r) => r.sessionId === cancelledSessionId)).toBe(
        false,
      )
      expect(results.some((r) => r.sessionId === deletedSessionId)).toBe(false)
    })

    test('branch-head-only catechist sees sessions for classes in their branch', async () => {
      const { t, ids, inRangeSessionId } = await setupSessions()

      const results = await t.query(api.classSessions.listMySessionsInRange, {
        requesterId: ids.branchHeadId,
        academicYearId: ids.ayId,
        dateFrom: '2024-10-01',
        dateTo: '2024-10-31',
      })

      expect(results.some((r) => r.sessionId === inRangeSessionId)).toBe(true)
    })

    test('catechist with no access to the class sees no sessions', async () => {
      const { t, ids } = await setupSessions()

      const results = await t.query(api.classSessions.listMySessionsInRange, {
        requesterId: ids.regularCatechistId,
        academicYearId: ids.ayId,
        dateFrom: '2024-10-01',
        dateTo: '2024-10-31',
      })

      expect(results).toHaveLength(0)
    })
  })

  // ─── openOrGetParishSession ─────────────────────────────────────────

  describe('openOrGetParishSession', () => {
    test('find-or-create flow', async () => {
      const { t, ids } = await setupTest()

      // 1. Regular catechist opens a session for today (parish-scoped, allowed)
      const sessionDate = '2026-07-08'
      const session = await t.mutation(
        api.classSessions.openOrGetParishSession,
        {
          requesterId: ids.regularCatechistId,
          sessionDate,
          sessionType: 'mass',
        },
      )

      expect(session).toBeDefined()
      expect(session.sessionDate).toBe(sessionDate)
      expect(session.sessionType).toBe('mass')
      expect(session.academicYearId).toBe(ids.ayId)
      expect(session.classYearId).toBeUndefined()

      // 2. Fetch it again, should return the existing one (idempotent)
      const sessionDup = await t.mutation(
        api.classSessions.openOrGetParishSession,
        {
          requesterId: ids.regularCatechistId,
          sessionDate,
          sessionType: 'mass',
        },
      )

      expect(sessionDup._id).toBe(session._id)
    })
  })
})
