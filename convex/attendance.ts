import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  assertBoardMemberOrAdmin,
  assertClassCatechistOrAbove,
  assertValidCatechist,
  assertValidStudent,
  getActiveAcademicYear,
  getEffectivePermissions,
  requireActiveAcademicYear,
} from './lib/authz'
import { findExistingParishSession } from './lib/classSessionHelpers'
import { ATTENDANCE_ERRORS, CLASS_SESSION_ERRORS } from './lib/errors'
import type { MutationCtx, QueryCtx } from './_generated/server'
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
  if (
    session.sessionType === 'mass' ||
    session.sessionType === 'extracurricular'
  ) {
    await assertValidCatechist(ctx, requesterId)
  } else if (session.classYearId) {
    await assertClassCatechistOrAbove(
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
    const sessions = await ctx.db
      .query('classSessions')
      .withIndex('by_class_year_id_and_semester_id', (q) =>
        q.eq('classYearId', classYear._id),
      )
      .collect()

    const activeSessions = sessions.filter((s) => !s.isDeleted)

    activeSessions.sort(
      (a, b) =>
        new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime(),
    )

    // Fetch attendance records in parallel using by_session_id index
    const attendanceRecords = (
      await Promise.all(
        activeSessions.map((session) =>
          ctx.db
            .query('attendanceRecords')
            .withIndex('by_session_id', (q) => q.eq('sessionId', session._id))
            .collect(),
        ),
      )
    ).flat()

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
        semesterId: s.semesterId,
        sessionDate: s.sessionDate,
        sessionType: s.sessionType,
        isCancelled: s.isCancelled,
        notes: s.notes,
      })),
      attendanceMap,
    }
  },
})

async function buildAttendanceRecordsForStudentClass(
  ctx: QueryCtx,
  studentClassId: Id<'studentClasses'>,
) {
  const records = (
    await ctx.db
      .query('attendanceRecords')
      .withIndex('by_student_class_id', (q) =>
        q.eq('studentClassId', studentClassId),
      )
      .collect()
  ).filter((r) => !r.isDeleted)

  const withSession = await Promise.all(
    records.map(async (record) => {
      const session = await ctx.db.get('classSessions', record.sessionId)
      if (!session || session.isDeleted) return null
      return {
        _id: record._id,
        sessionId: session._id,
        sessionDate: session.sessionDate,
        sessionType: session.sessionType,
        status: record.status,
        notes: record.notes,
      }
    }),
  )

  return withSession
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort(
      (a, b) =>
        new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime(),
    )
}

export const listAttendanceRecordsForStudentClass = query({
  args: {
    requesterId: v.id('catechists'),
    studentClassId: v.id('studentClasses'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    return buildAttendanceRecordsForStudentClass(ctx, args.studentClassId)
  },
})

export const listMyAttendanceRecordsForStudentClass = query({
  args: {
    requesterId: v.id('students'),
    studentClassId: v.id('studentClasses'),
  },
  handler: async (ctx, args) => {
    await assertValidStudent(ctx, args.requesterId)

    const studentClass = await ctx.db.get('studentClasses', args.studentClassId)
    if (
      !studentClass ||
      studentClass.isDeleted ||
      studentClass.studentId !== args.requesterId
    ) {
      return []
    }

    return buildAttendanceRecordsForStudentClass(ctx, args.studentClassId)
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
        v.null(),
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

export const bulkSaveGridAttendance = mutation({
  args: {
    requesterId: v.id('catechists'),
    sessionId: v.id('classSessions'),
    studentIds: v.array(v.id('students')),
    status: v.union(
      v.literal('present'),
      v.literal('excused_absence'),
      v.literal('unexcused_absence'),
      v.literal('late'),
      v.null(),
    ),
  },
  handler: async (ctx, args) => {
    const { requesterId, sessionId, studentIds, status } = args

    const session = await resolveSession(ctx, sessionId)
    const academicYearId = await resolveAcademicYearId(ctx, session)
    await assertActiveAcademicYear(ctx, academicYearId)
    await authCheck(ctx, requesterId, session, academicYearId)

    for (const studentId of studentIds) {
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

      if (status === null) {
        if (existing && !existing.isDeleted) {
          await ctx.db.patch('attendanceRecords', existing._id, {
            isDeleted: true,
          })
        }
        continue
      }

      if (existing) {
        await ctx.db.patch('attendanceRecords', existing._id, {
          status,
          recordedBy: requesterId,
          syncedAt: Date.now(),
          isDeleted: false,
        })
      } else {
        await ctx.db.insert('attendanceRecords', {
          sessionId,
          studentClassId,
          status,
          recordedBy: requesterId,
          deviceQueuedAt: Date.now(),
          syncedAt: Date.now(),
          isDeleted: false,
        })
      }
    }

    return { success: true }
  },
})

// ─── Attendance Health Dashboard Widget ─────────────────────────────────

type AttendanceHealthClassSummary = {
  classId: Id<'classes'>
  classYearId: Id<'classYears'>
  className: string
  rate: number | null
  trend: 'up' | 'down' | 'flat'
}

type AttendanceHealthAtRiskStudent = {
  studentId: Id<'students'>
  studentClassId: Id<'studentClasses'>
  classId: Id<'classes'>
  className: string
  fullName: string
  studentCode: string
  consecutiveAbsences: number
}

function addDaysToIsoDate(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function buildClassAttendanceHealth(
  ctx: QueryCtx,
  classYearId: Id<'classYears'>,
  dateFrom: string,
  dateTo: string,
  midpoint: string,
): Promise<{
  summary: AttendanceHealthClassSummary
  atRisk: Array<AttendanceHealthAtRiskStudent>
} | null> {
  const classYear = await ctx.db.get('classYears', classYearId)
  if (!classYear || classYear.isDeleted) return null

  const classRecord = await ctx.db.get('classes', classYear.classId)
  if (!classRecord || classRecord.isDeleted) return null

  // Full class-scoped session list (not date-filtered) — needed for streaks,
  // which can start before the reporting window.
  const allSessions = await ctx.db
    .query('classSessions')
    .withIndex('by_class_year_id_and_semester_id', (q) =>
      q.eq('classYearId', classYearId),
    )
    .collect()

  const classScopedSessions = allSessions.filter(
    (s) =>
      !s.isDeleted &&
      !s.isCancelled &&
      (s.sessionType === 'catechism' || s.sessionType === 'supplemental'),
  )

  const sessionsInWindow = classScopedSessions
    .filter((s) => s.sessionDate >= dateFrom && s.sessionDate <= dateTo)
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))

  // Active enrollments
  const studentClasses = await ctx.db
    .query('studentClasses')
    .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYearId))
    .collect()

  const activeEnrollments: Array<{
    studentClassId: Id<'studentClasses'>
    studentId: Id<'students'>
    fullName: string
    studentCode: string
  }> = []

  for (const sc of studentClasses) {
    if (sc.isDeleted || sc.status !== 'active') continue
    const student = await ctx.db.get('students', sc.studentId)
    if (!student || student.isDeleted) continue
    activeEnrollments.push({
      studentClassId: sc._id,
      studentId: sc.studentId,
      fullName: student.fullName,
      studentCode: student.studentCode,
    })
  }

  // Attendance records for ALL class-scoped sessions (superset covers the window)
  const attendanceRecords = (
    await Promise.all(
      classScopedSessions.map((session) =>
        ctx.db
          .query('attendanceRecords')
          .withIndex('by_session_id', (q) => q.eq('sessionId', session._id))
          .collect(),
      ),
    )
  ).flat()

  const statusMap = new Map<string, Doc<'attendanceRecords'>['status']>()
  for (const record of attendanceRecords) {
    if (record.isDeleted) continue
    statusMap.set(`${record.studentClassId}_${record.sessionId}`, record.status)
  }

  function computeRate(sessions: typeof sessionsInWindow): number {
    let presentOrLate = 0
    for (const session of sessions) {
      for (const enrollment of activeEnrollments) {
        const status = statusMap.get(
          `${enrollment.studentClassId}_${session._id}`,
        )
        if (status === 'present' || status === 'late') presentOrLate++
      }
    }
    const total = activeEnrollments.length * sessions.length
    return total === 0 ? 0 : Math.round((presentOrLate / total) * 100)
  }

  // Step 3: class rate + trend (windowed sessions only)
  let rate: number | null = null
  let trend: 'up' | 'down' | 'flat' = 'flat'

  if (sessionsInWindow.length > 0 && activeEnrollments.length > 0) {
    rate = computeRate(sessionsInWindow)

    const earlySessions = sessionsInWindow.filter(
      (s) => s.sessionDate < midpoint,
    )
    const lateSessions = sessionsInWindow.filter(
      (s) => s.sessionDate >= midpoint,
    )

    if (earlySessions.length > 0 && lateSessions.length > 0) {
      const earlyRate = computeRate(earlySessions)
      const lateRate = computeRate(lateSessions)
      const delta = lateRate - earlyRate
      trend = delta <= -10 ? 'down' : delta >= 10 ? 'up' : 'flat'
    }
  }

  // Step 4: consecutive absence streaks (full class-scoped session list, most-recent-first)
  const sessionsDesc = [...classScopedSessions].sort((a, b) =>
    b.sessionDate.localeCompare(a.sessionDate),
  )

  const atRisk: Array<AttendanceHealthAtRiskStudent> = []
  for (const enrollment of activeEnrollments) {
    let streak = 0
    for (const session of sessionsDesc) {
      const status = statusMap.get(
        `${enrollment.studentClassId}_${session._id}`,
      )
      if (status === 'excused_absence' || status === 'unexcused_absence') {
        streak++
        continue
      }
      break
    }
    if (streak >= 3) {
      atRisk.push({
        studentId: enrollment.studentId,
        studentClassId: enrollment.studentClassId,
        classId: classRecord._id,
        className: classRecord.name,
        fullName: enrollment.fullName,
        studentCode: enrollment.studentCode,
        consecutiveAbsences: streak,
      })
    }
  }

  return {
    summary: {
      classId: classRecord._id,
      classYearId,
      className: classRecord.name,
      rate,
      trend,
    },
    atRisk,
  }
}

export const getMyAttendanceHealth = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
    dateFrom: v.string(),
    dateTo: v.string(),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const perms = await getEffectivePermissions(
      ctx,
      args.requesterId,
      args.academicYearId,
    )

    const classYearIds = new Set<Id<'classYears'>>()

    for (const classYearId of perms.classCatechistOf) {
      const classYear = await ctx.db.get('classYears', classYearId)
      if (
        classYear &&
        !classYear.isDeleted &&
        classYear.academicYearId === args.academicYearId
      ) {
        classYearIds.add(classYearId)
      }
    }

    if (perms.branchHeadOf.length > 0) {
      const classYears = await ctx.db
        .query('classYears')
        .withIndex('by_academic_year_id', (q) =>
          q.eq('academicYearId', args.academicYearId),
        )
        .collect()

      for (const classYear of classYears.filter((cy) => !cy.isDeleted)) {
        const classRecord = await ctx.db.get('classes', classYear.classId)
        if (
          classRecord &&
          !classRecord.isDeleted &&
          perms.branchHeadOf.includes(classRecord.branchId)
        ) {
          classYearIds.add(classYear._id)
        }
      }
    }

    const midpoint = addDaysToIsoDate(args.dateFrom, 14)

    const results = (
      await Promise.all(
        [...classYearIds].map((classYearId) =>
          buildClassAttendanceHealth(
            ctx,
            classYearId,
            args.dateFrom,
            args.dateTo,
            midpoint,
          ),
        ),
      )
    ).filter((r): r is NonNullable<typeof r> => r !== null)

    const classSummaries = results
      .map((r) => r.summary)
      .sort((a, b) => a.className.localeCompare(b.className))

    const atRiskStudents = results
      .flatMap((r) => r.atRisk)
      .sort((a, b) => {
        if (b.consecutiveAbsences !== a.consecutiveAbsences) {
          return b.consecutiveAbsences - a.consecutiveAbsences
        }
        return a.fullName.localeCompare(b.fullName)
      })

    return { classSummaries, atRiskStudents }
  },
})

// ─── Offline QR-First Attendance Helpers & Functions ──────────────────────

async function getSessionStudentsHelper(
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<'classSessions'>,
  requesterId: Id<'catechists'>,
) {
  // Check valid catechist
  await assertValidCatechist(ctx, requesterId)

  const session = await ctx.db.get('classSessions', sessionId)
  if (!session || session.isDeleted) {
    throw new Error(ATTENDANCE_ERRORS.SESSION_NOT_FOUND)
  }

  const academicYearId = session.classYearId
    ? (await ctx.db.get('classYears', session.classYearId))?.academicYearId
    : session.academicYearId

  if (!academicYearId) {
    throw new Error(ATTENDANCE_ERRORS.SESSION_NOT_FOUND)
  }

  // Check permissions
  if (
    session.sessionType === 'mass' ||
    session.sessionType === 'extracurricular'
  ) {
    // any active catechist is allowed, already verified via assertValidCatechist
  } else if (session.classYearId) {
    await assertClassCatechistOrAbove(
      ctx,
      requesterId,
      academicYearId,
      session.classYearId,
    )
  } else {
    await assertBoardMemberOrAdmin(ctx, requesterId, academicYearId)
  }

  // Determine students in scope
  let activeStudentClasses: Array<Doc<'studentClasses'>> = []

  if (session.classYearId) {
    // catechism / supplemental -> class scope
    const studentClasses = await ctx.db
      .query('studentClasses')
      .withIndex('by_class_year_id', (q) =>
        q.eq('classYearId', session.classYearId!),
      )
      .collect()

    activeStudentClasses = studentClasses.filter(
      (sc) => !sc.isDeleted && sc.status === 'active',
    )
  } else {
    // mass / extracurricular -> parish scope (all active primary students in academic year)
    const classYears = await ctx.db
      .query('classYears')
      .withIndex('by_academic_year_id', (q) =>
        q.eq('academicYearId', academicYearId),
      )
      .collect()

    const activeClassYearIds = new Set(
      classYears.filter((cy) => !cy.isDeleted).map((cy) => cy._id),
    )

    const studentClassesLists = await Promise.all(
      Array.from(activeClassYearIds).map((classYearId) =>
        ctx.db
          .query('studentClasses')
          .withIndex('by_class_year_id', (q) =>
            q.eq('classYearId', classYearId),
          )
          .collect(),
      ),
    )

    activeStudentClasses = studentClassesLists
      .flat()
      .filter((sc) => !sc.isDeleted && sc.status === 'active')
  }

  // Deduplicate by studentId, prioritizing primary classes to avoid duplicate listings of the same student
  const studentClassMap = new Map<
    string,
    (typeof activeStudentClasses)[number]
  >()
  for (const sc of activeStudentClasses) {
    const existing = studentClassMap.get(sc.studentId)
    if (!existing || (!existing.isPrimaryClass && sc.isPrimaryClass)) {
      studentClassMap.set(sc.studentId, sc)
    }
  }
  const deduplicatedStudentClasses = Array.from(studentClassMap.values())

  // Fetch student info and class info for display
  const students: Array<{
    studentId: Id<'students'>
    studentClassId: Id<'studentClasses'>
    studentCode: string
    fullName: string
    saintName: string | null
    className: string
  }> = []

  const studentInfo = await Promise.all(
    deduplicatedStudentClasses.map(async (sc) => {
      const student = await ctx.db.get('students', sc.studentId)
      if (!student || student.isDeleted) return null

      const classYear = await ctx.db.get('classYears', sc.classYearId)
      if (!classYear || classYear.isDeleted) return null

      const classRecord = await ctx.db.get('classes', classYear.classId)
      if (!classRecord || classRecord.isDeleted) return null

      return {
        studentId: sc.studentId,
        studentClassId: sc._id,
        studentCode: student.studentCode,
        fullName: student.fullName,
        saintName: student.saintName ?? null,
        className: classRecord.name,
      }
    }),
  )

  for (const info of studentInfo) {
    if (info) students.push(info)
  }

  // Fetch existing attendance records for this session
  const records = (
    await ctx.db
      .query('attendanceRecords')
      .withIndex('by_session_id', (q) => q.eq('sessionId', sessionId))
      .collect()
  ).filter((r) => !r.isDeleted)

  const activeStudentClassIds = new Set(
    activeStudentClasses.map((sc) => sc._id),
  )
  const filteredRecords = records
    .filter((r) => activeStudentClassIds.has(r.studentClassId))
    .map((r) => ({
      studentClassId: r.studentClassId,
      status: r.status,
      notes: r.notes,
      recordedBy: r.recordedBy,
      deviceQueuedAt: r.deviceQueuedAt,
      syncedAt: r.syncedAt,
    }))

  return {
    students,
    records: filteredRecords,
  }
}

export const getSessionStudents = query({
  args: {
    sessionId: v.id('classSessions'),
    requesterId: v.id('catechists'),
  },
  handler: async (ctx, args) => {
    return await getSessionStudentsHelper(ctx, args.sessionId, args.requesterId)
  },
})

export const openOrGetParishSession = mutation({
  args: {
    requesterId: v.id('catechists'),
    sessionDate: v.string(),
    sessionType: v.union(v.literal('mass'), v.literal('extracurricular')),
  },
  handler: async (ctx, args) => {
    const { requesterId, sessionDate, sessionType } = args

    // Verify catechist permissions
    await assertValidCatechist(ctx, requesterId)

    // Look up existing active session for this type and date
    const activeSession = await findExistingParishSession(
      ctx,
      sessionType,
      sessionDate,
    )
    if (activeSession) {
      if (activeSession.isCancelled) {
        throw new Error(ATTENDANCE_ERRORS.SESSION_CANCELLED)
      }
      return activeSession
    }

    // Resolve active academic year
    const activeYearId = await requireActiveAcademicYear(
      ctx,
      CLASS_SESSION_ERRORS.NO_ACTIVE_YEAR,
    )

    const sessionId = await ctx.db.insert('classSessions', {
      classYearId: undefined,
      semesterId: undefined,
      academicYearId: activeYearId,
      sessionDate,
      sessionType,
      isCancelled: false,
      isDeleted: false,
    })

    const session = await ctx.db.get('classSessions', sessionId)
    if (!session) throw new Error('Failed to create session')
    return session
  },
})

export const recordBatch = mutation({
  args: {
    requesterId: v.id('catechists'),
    records: v.array(
      v.object({
        localId: v.string(),
        sessionId: v.id('classSessions'),
        studentClassId: v.id('studentClasses'),
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
    const { requesterId, records } = args

    // Check valid catechist
    await assertValidCatechist(ctx, requesterId)

    const results: Array<{
      localId: string
      status: 'synced' | 'conflict' | 'error'
      error?: string
    }> = []

    for (const record of records) {
      try {
        const session = await ctx.db.get('classSessions', record.sessionId)
        if (!session || session.isDeleted) {
          results.push({
            localId: record.localId,
            status: 'error',
            error: 'Session not found',
          })
          continue
        }

        const academicYearId = await resolveAcademicYearId(ctx, session)
        await assertActiveAcademicYear(ctx, academicYearId)

        // Auth check
        await authCheck(ctx, requesterId, session, academicYearId)

        // Conflict check: unique (sessionId, studentClassId)
        const existing = await ctx.db
          .query('attendanceRecords')
          .withIndex('by_session_id_and_student_class_id', (q) =>
            q
              .eq('sessionId', record.sessionId)
              .eq('studentClassId', record.studentClassId),
          )
          .unique()

        if (existing && !existing.isDeleted) {
          // Compare deviceQueuedAt: First-Write-Wins (earlier deviceQueuedAt wins)
          if (record.deviceQueuedAt < existing.deviceQueuedAt) {
            // Overwrite existing record
            await ctx.db.patch('attendanceRecords', existing._id, {
              status: record.status,
              notes: record.notes,
              recordedBy: requesterId,
              deviceQueuedAt: record.deviceQueuedAt,
              syncedAt: Date.now(),
            })
            results.push({
              localId: record.localId,
              status: 'synced',
            })
          } else {
            // Discard incoming record
            results.push({
              localId: record.localId,
              status: 'conflict',
            })
          }
        } else if (existing && existing.isDeleted) {
          // Re-enable and update deleted record
          await ctx.db.patch('attendanceRecords', existing._id, {
            status: record.status,
            notes: record.notes,
            recordedBy: requesterId,
            deviceQueuedAt: record.deviceQueuedAt,
            syncedAt: Date.now(),
            isDeleted: false,
          })
          results.push({
            localId: record.localId,
            status: 'synced',
          })
        } else {
          // Insert new record
          await ctx.db.insert('attendanceRecords', {
            sessionId: record.sessionId,
            studentClassId: record.studentClassId,
            status: record.status,
            notes: record.notes,
            recordedBy: requesterId,
            deviceQueuedAt: record.deviceQueuedAt,
            syncedAt: Date.now(),
            isDeleted: false,
          })
          results.push({
            localId: record.localId,
            status: 'synced',
          })
        }
      } catch (err: any) {
        results.push({
          localId: record.localId,
          status: 'error',
          error: err.message || 'Unknown error occurred',
        })
      }
    }

    return results
  },
})

export const getParishAttendanceReport = query({
  args: {
    requesterId: v.id('catechists'),
    sessionDate: v.string(),
    sessionType: v.union(v.literal('mass'), v.literal('extracurricular')),
  },
  handler: async (ctx, args) => {
    const { requesterId, sessionDate, sessionType } = args
    await assertValidCatechist(ctx, requesterId)

    // 1. Find active session
    const existing = await ctx.db
      .query('classSessions')
      .withIndex('by_session_type_and_session_date', (q) =>
        q.eq('sessionType', sessionType).eq('sessionDate', sessionDate),
      )
      .collect()

    const activeSession = existing.find((s) => !s.isDeleted)
    if (!activeSession) {
      return { session: null, records: [] }
    }

    // 2. Fetch attendance records
    const records = await ctx.db
      .query('attendanceRecords')
      .withIndex('by_session_id', (q) => q.eq('sessionId', activeSession._id))
      .collect()

    const activeRecords = records.filter((r) => !r.isDeleted)

    // 3. Resolve details
    const resolved = await Promise.all(
      activeRecords.map(async (record) => {
        const studentClass = await ctx.db.get(
          'studentClasses',
          record.studentClassId,
        )
        if (!studentClass || studentClass.isDeleted) return null

        const [student, classYear, catechist] = await Promise.all([
          ctx.db.get('students', studentClass.studentId),
          ctx.db.get('classYears', studentClass.classYearId),
          ctx.db.get('catechists', record.recordedBy),
        ])
        if (!student || student.isDeleted) return null
        if (!classYear || classYear.isDeleted) return null

        const classRecord = await ctx.db.get('classes', classYear.classId)
        if (!classRecord || classRecord.isDeleted) return null

        const recordedByCatechistName = catechist
          ? `${catechist.saintName ? catechist.saintName + ' ' : ''}${catechist.fullName}`
          : 'Unknown'

        return {
          _id: record._id,
          status: record.status,
          notes: record.notes ?? null,
          deviceQueuedAt: record.deviceQueuedAt,
          syncedAt: record.syncedAt ?? null,
          studentId: student._id,
          studentCode: student.studentCode,
          fullName: student.fullName,
          saintName: student.saintName ?? null,
          classId: classRecord._id,
          className: classRecord.name,
          recordedByCatechistId: catechist?._id ?? null,
          recordedByCatechistName,
        }
      }),
    )
    const resultRecords = resolved.filter((r) => r !== null)

    return {
      session: {
        _id: activeSession._id,
        sessionDate: activeSession.sessionDate,
        sessionType: activeSession.sessionType,
        isCancelled: activeSession.isCancelled,
      },
      records: resultRecords,
    }
  },
})

async function resolveParishAttendanceForStudent(
  ctx: QueryCtx,
  studentId: Id<'students'>,
) {
  // 1. Determine the active academic year.
  const activeAcademicYearId = await getActiveAcademicYear(ctx)
  if (!activeAcademicYearId) {
    return []
  }

  // 2. Find all studentClasses docs for this student.
  const studentClasses = await ctx.db
    .query('studentClasses')
    .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
    .collect()

  // 3. Fetch attendance records for each studentClass in parallel.
  const recordsPerStudentClass = await Promise.all(
    studentClasses.map((studentClass) =>
      ctx.db
        .query('attendanceRecords')
        .withIndex('by_student_class_id', (q) =>
          q.eq('studentClassId', studentClass._id),
        )
        .collect(),
    ),
  )
  const attendanceRecords = recordsPerStudentClass
    .flat()
    .filter((r) => !r.isDeleted)

  // Mass/extracurricular sessions are parish-scoped and never carry their
  // own classYearId — the student's class comes from the studentClass the
  // record was taken against instead.
  const classYearIdByStudentClassId = new Map(
    studentClasses.map((sc) => [sc._id, sc.classYearId]),
  )

  // 4. Resolve session + join details for each record in parallel.
  const resolved = await Promise.all(
    attendanceRecords.map(async (record) => {
      const session = await ctx.db.get('classSessions', record.sessionId)
      if (!session || session.isDeleted || session.isCancelled) return null
      if (
        session.sessionType !== 'mass' &&
        session.sessionType !== 'extracurricular'
      ) {
        return null
      }
      if (session.academicYearId !== activeAcademicYearId) return null

      const classYearId = classYearIdByStudentClassId.get(record.studentClassId)
      const [catechist, classYear] = await Promise.all([
        ctx.db.get('catechists', record.recordedBy),
        classYearId
          ? ctx.db.get('classYears', classYearId)
          : Promise.resolve(null),
      ])

      let classId: Id<'classes'> | null = null
      let className: string | null = null
      if (classYear && !classYear.isDeleted) {
        const classRecord = await ctx.db.get('classes', classYear.classId)
        if (classRecord && !classRecord.isDeleted) {
          classId = classRecord._id
          className = classRecord.name
        }
      }

      const recordedByCatechistName = catechist
        ? `${catechist.saintName ? catechist.saintName + ' ' : ''}${catechist.fullName}`
        : 'Unknown'

      return {
        _id: record._id,
        status: record.status,
        notes: record.notes ?? null,
        deviceQueuedAt: record.deviceQueuedAt,
        sessionType: session.sessionType,
        sessionDate: session.sessionDate,
        classId,
        className,
        recordedByCatechistId: catechist?._id ?? null,
        recordedByCatechistName,
      }
    }),
  )

  return resolved
    .filter((r) => r !== null)
    .sort((a, b) => b.deviceQueuedAt - a.deviceQueuedAt)
}

export const getStudentAttendanceReport = query({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    return resolveParishAttendanceForStudent(ctx, args.studentId)
  },
})

export const listMyParishAttendance = query({
  args: {
    requesterId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertValidStudent(ctx, args.requesterId)
    return resolveParishAttendanceForStudent(ctx, args.requesterId)
  },
})
