import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  assertBoardMemberOrAdmin,
  assertHomeroomCatechistOrAbove,
  assertValidCatechist,
} from './lib/authz'
import { ATTENDANCE_ERRORS } from './lib/errors'
import type { MutationCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'

// ─── Helpers ─────────────────────────────────────────────────────────────

async function resolveSession(
  ctx: MutationCtx,
  sessionId: Id<'classSessions'>,
) {
  const session = await ctx.db.get('classSessions', sessionId)
  if (!session || session.isDeleted) {
    throw new Error(ATTENDANCE_ERRORS.SESSION_NOT_FOUND)
  }
  if (session.isCancelled) {
    throw new Error(ATTENDANCE_ERRORS.SESSION_CANCELLED)
  }
  return session
}

async function resolveAcademicYearId(
  ctx: MutationCtx,
  session: Doc<'classSessions'>,
) {
  if (session.classYearId) {
    const classYear = await ctx.db.get('classYears', session.classYearId)
    if (!classYear || classYear.isDeleted) {
      throw new Error(ATTENDANCE_ERRORS.SESSION_NOT_FOUND)
    }
    return classYear.academicYearId
  }
  if (session.academicYearId) {
    return session.academicYearId
  }
  throw new Error(ATTENDANCE_ERRORS.SESSION_NOT_FOUND)
}

async function assertActiveAcademicYear(
  ctx: MutationCtx,
  academicYearId: Id<'academicYears'>,
) {
  const academicYear = await ctx.db.get('academicYears', academicYearId)
  if (!academicYear || academicYear.isDeleted) {
    throw new Error(ATTENDANCE_ERRORS.SESSION_NOT_FOUND)
  }
  if (!academicYear.isActive) {
    throw new Error(ATTENDANCE_ERRORS.INACTIVE_ACADEMIC_YEAR)
  }
}

async function resolveStudentClassId(
  ctx: MutationCtx,
  studentId: Id<'students'>,
  session: Doc<'classSessions'>,
  academicYearId: Id<'academicYears'>,
): Promise<Id<'studentClasses'>> {
  if (session.classYearId) {
    const studentClass = await ctx.db
      .query('studentClasses')
      .withIndex('by_student_id_and_class_year_id', (q) =>
        q.eq('studentId', studentId).eq('classYearId', session.classYearId!),
      )
      .unique()

    if (
      !studentClass ||
      studentClass.isDeleted ||
      studentClass.status !== 'active'
    ) {
      throw new Error(ATTENDANCE_ERRORS.STUDENT_NOT_ENROLLED)
    }
    return studentClass._id
  }

  const studentClasses = await ctx.db
    .query('studentClasses')
    .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
    .collect()

  const matching = studentClasses.filter(
    (sc) => !sc.isDeleted && sc.status === 'active' && sc.isPrimaryClass,
  )

  for (const sc of matching) {
    const classYear = await ctx.db.get('classYears', sc.classYearId)
    if (
      classYear &&
      !classYear.isDeleted &&
      classYear.academicYearId === academicYearId
    ) {
      return sc._id
    }
  }

  throw new Error(ATTENDANCE_ERRORS.STUDENT_NOT_ENROLLED)
}

async function authCheck(
  ctx: MutationCtx,
  requesterId: Id<'catechists'>,
  session: Doc<'classSessions'>,
  academicYearId: Id<'academicYears'>,
) {
  if (session.classYearId) {
    await assertHomeroomCatechistOrAbove(
      ctx,
      requesterId,
      academicYearId,
      session.classYearId,
    )
  } else {
    await assertBoardMemberOrAdmin(ctx, requesterId, academicYearId)
  }
}

async function checkDuplicate(
  ctx: MutationCtx,
  sessionId: Id<'classSessions'>,
  studentClassId: Id<'studentClasses'>,
) {
  const existing = await ctx.db
    .query('attendanceRecords')
    .withIndex('by_session_id_and_student_class_id', (q) =>
      q.eq('sessionId', sessionId).eq('studentClassId', studentClassId),
    )
    .unique()

  if (existing && !existing.isDeleted) {
    throw new Error(ATTENDANCE_ERRORS.ALREADY_RECORDED)
  }
}

// ─── Mutations ───────────────────────────────────────────────────────────

export const recordAttendance = mutation({
  args: {
    requesterId: v.id('catechists'),
    sessionId: v.id('classSessions'),
    studentId: v.id('students'),
    status: v.union(
      v.literal('present'),
      v.literal('excused_absence'),
      v.literal('unexcused_absence'),
      v.literal('late'),
    ),
    notes: v.optional(v.string()),
    deviceQueuedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const { requesterId, sessionId, studentId, status, notes, deviceQueuedAt } =
      args

    const session = await resolveSession(ctx, sessionId)
    const academicYearId = await resolveAcademicYearId(ctx, session)
    await assertActiveAcademicYear(ctx, academicYearId)
    await authCheck(ctx, requesterId, session, academicYearId)

    const studentClassId = await resolveStudentClassId(
      ctx,
      studentId,
      session,
      academicYearId,
    )
    await checkDuplicate(ctx, sessionId, studentClassId)

    return await ctx.db.insert('attendanceRecords', {
      sessionId,
      studentClassId,
      status,
      notes,
      recordedBy: requesterId,
      deviceQueuedAt,
      syncedAt: Date.now(),
      isDeleted: false,
    })
  },
})

export const bulkRecordAttendance = mutation({
  args: {
    requesterId: v.id('catechists'),
    sessionId: v.id('classSessions'),
    records: v.array(
      v.object({
        studentId: v.id('students'),
        status: v.union(
          v.literal('present'),
          v.literal('excused_absence'),
          v.literal('unexcused_absence'),
          v.literal('late'),
        ),
        notes: v.optional(v.string()),
        deviceQueuedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { requesterId, sessionId, records } = args

    const session = await resolveSession(ctx, sessionId)
    const academicYearId = await resolveAcademicYearId(ctx, session)
    await assertActiveAcademicYear(ctx, academicYearId)
    await authCheck(ctx, requesterId, session, academicYearId)

    const results: Array<Id<'attendanceRecords'>> = []

    for (const record of records) {
      const studentClassId = await resolveStudentClassId(
        ctx,
        record.studentId,
        session,
        academicYearId,
      )
      await checkDuplicate(ctx, sessionId, studentClassId)

      const id = await ctx.db.insert('attendanceRecords', {
        sessionId,
        studentClassId,
        status: record.status,
        notes: record.notes,
        recordedBy: requesterId,
        deviceQueuedAt: record.deviceQueuedAt,
        syncedAt: Date.now(),
        isDeleted: false,
      })
      results.push(id)
    }

    return results
  },
})

export const updateAttendance = mutation({
  args: {
    requesterId: v.id('catechists'),
    attendanceId: v.id('attendanceRecords'),
    status: v.optional(
      v.union(
        v.literal('present'),
        v.literal('excused_absence'),
        v.literal('unexcused_absence'),
        v.literal('late'),
      ),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { requesterId, attendanceId, status, notes } = args

    const record = await ctx.db.get('attendanceRecords', attendanceId)
    if (!record || record.isDeleted) {
      throw new Error(ATTENDANCE_ERRORS.RECORD_NOT_FOUND)
    }

    const session = await resolveSession(ctx, record.sessionId)
    const academicYearId = await resolveAcademicYearId(ctx, session)
    await assertActiveAcademicYear(ctx, academicYearId)
    await authCheck(ctx, requesterId, session, academicYearId)

    const patch: Record<string, unknown> = {}
    if (status !== undefined) patch.status = status
    if (notes !== undefined) patch.notes = notes

    await ctx.db.patch('attendanceRecords', attendanceId, patch)
  },
})

// ─── Grid Queries & Mutations ────────────────────────────────────────────

export const getAttendanceGrid = query({
  args: {
    classId: v.id('classes'),
    academicYearId: v.id('academicYears'),
    requesterId: v.id('catechists'),
  },
  handler: async (ctx, args) => {
    const { classId, academicYearId, requesterId } = args

    await assertValidCatechist(ctx, requesterId)

    // Fetch active classYear
    const classYears = await ctx.db
      .query('classYears')
      .withIndex('by_class_id_and_academic_year_id', (q) =>
        q.eq('classId', classId).eq('academicYearId', academicYearId),
      )
      .collect()

    const classYear = classYears.find((cy) => !cy.isDeleted)
    if (!classYear) {
      return { students: [], sessions: [], attendanceMap: {} }
    }

    // Fetch active students enrolled in this classYear
    const studentClasses = await ctx.db
      .query('studentClasses')
      .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYear._id))
      .collect()

    const activeStudentClasses = studentClasses.filter(
      (sc) => !sc.isDeleted && sc.status === 'active',
    )

    // Fetch student details
    const students: Array<{
      studentClassId: Id<'studentClasses'>
      studentId: Id<'students'>
      fullName: string
      saintName: string | null
      studentCode: string
    }> = []

    for (const sc of activeStudentClasses) {
      const student = await ctx.db.get('students', sc.studentId)
      if (student && !student.isDeleted) {
        students.push({
          studentClassId: sc._id,
          studentId: sc.studentId,
          fullName: student.fullName,
          saintName: student.saintName ?? null,
          studentCode: student.studentCode,
        })
      }
    }

    // Fetch sessions for this classYear (class-scoped only: catechism, supplemental)
    let sessions = await ctx.db
      .query('classSessions')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()

    sessions = sessions.filter((s) => s.classYearId === classYear._id)

    const activeSessions = sessions.sort(
      (a, b) =>
        new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime(),
    )

    // Fetch attendance records
    const attendanceRecords = await ctx.db.query('attendanceRecords').collect()

    const sessionIds = new Set(activeSessions.map((s) => s._id))
    const attendanceMap: Record<
      string,
      { _id: Id<'attendanceRecords'>; status: string; notes?: string }
    > = {}

    for (const record of attendanceRecords) {
      if (!record.isDeleted && sessionIds.has(record.sessionId)) {
        const key = `${record.studentClassId}_${record.sessionId}`
        attendanceMap[key] = {
          _id: record._id,
          status: record.status,
          notes: record.notes,
        }
      }
    }

    return {
      students,
      sessions: activeSessions.map((s) => ({
        _id: s._id,
        sessionDate: s.sessionDate,
        sessionType: s.sessionType,
        isCancelled: s.isCancelled,
        notes: s.notes,
      })),
      attendanceMap,
    }
  },
})

export const saveGridAttendance = mutation({
  args: {
    requesterId: v.id('catechists'),
    sessionId: v.id('classSessions'),
    studentId: v.id('students'),
    status: v.optional(
      v.union(
        v.literal('present'),
        v.literal('excused_absence'),
        v.literal('unexcused_absence'),
        v.literal('late'),
      ),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { requesterId, sessionId, studentId, status, notes } = args

    const session = await resolveSession(ctx, sessionId)
    const academicYearId = await resolveAcademicYearId(ctx, session)
    await assertActiveAcademicYear(ctx, academicYearId)
    await authCheck(ctx, requesterId, session, academicYearId)

    const studentClassId = await resolveStudentClassId(
      ctx,
      studentId,
      session,
      academicYearId,
    )

    const existing = await ctx.db
      .query('attendanceRecords')
      .withIndex('by_session_id_and_student_class_id', (q) =>
        q.eq('sessionId', sessionId).eq('studentClassId', studentClassId),
      )
      .unique()

    // If status is null, mark record as soft-deleted (clear/unset)
    if (status === null || status === undefined) {
      if (existing && !existing.isDeleted) {
        await ctx.db.patch('attendanceRecords', existing._id, {
          isDeleted: true,
        })
      }
      return { success: true }
    }

    // If status is provided
    if (existing) {
      // Update existing record (recover from soft-deletion if needed)
      await ctx.db.patch('attendanceRecords', existing._id, {
        status,
        notes,
        recordedBy: requesterId,
        syncedAt: Date.now(),
        isDeleted: false,
      })
    } else {
      // Insert new record
      await ctx.db.insert('attendanceRecords', {
        sessionId,
        studentClassId,
        status,
        notes,
        recordedBy: requesterId,
        deviceQueuedAt: Date.now(),
        syncedAt: Date.now(),
        isDeleted: false,
      })
    }

    return { success: true }
  },
})
