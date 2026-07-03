/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { CLASS_SESSION_ERRORS } from './lib/errors'

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

    test('co-teacher cannot create catechism session', async () => {
      const { t, ids } = await setupTest()
      await expect(
        t.mutation(api.classSessions.create, {
          requesterId: ids.coTeacherId,
          classYearId: ids.classYearId,
          semesterId: ids.semesterId,
          sessionDate: '2024-10-01',
          sessionType: 'catechism',
        }),
      ).rejects.toThrow('Unauthorized')
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
      ).rejects.toThrow('Unauthorized')
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
      ).rejects.toThrow('Unauthorized')
    })

    test('homeroom catechist cannot create mass session', async () => {
      const { t, ids } = await setupTest()
      await expect(
        t.mutation(api.classSessions.create, {
          requesterId: ids.homeroomId,
          sessionDate: '2024-10-06',
          sessionType: 'mass',
        }),
      ).rejects.toThrow('Unauthorized')
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

    test('co-teacher cannot update session', async () => {
      const { t, ids } = await setupTest()
      const sessionId = await t.mutation(api.classSessions.create, {
        requesterId: ids.adminId,
        classYearId: ids.classYearId,
        semesterId: ids.semesterId,
        sessionDate: '2024-10-01',
        sessionType: 'catechism',
      })

      await expect(
        t.mutation(api.classSessions.update, {
          requesterId: ids.coTeacherId,
          sessionId,
          notes: 'Trying to update',
        }),
      ).rejects.toThrow('Unauthorized')
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

      const sessionId = await t.mutation(api.classSessions.createWithAttendance, {
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
          }
        ]
      })

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
            }
          ]
        })
      ).rejects.toThrow()
    })
  })
})
