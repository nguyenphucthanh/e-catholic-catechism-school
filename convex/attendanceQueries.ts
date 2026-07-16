import { v } from 'convex/values'
import { query } from './_generated/server'
import {
  assertBoardMemberOrAdmin,
  assertClassCatechistOrAbove,
  assertValidCatechist,
  assertValidStudent,
  getActiveAcademicYear,
} from './lib/authz'
import { ATTENDANCE_ERRORS } from './lib/errors'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'

// ─── Grid Query ──────────────────────────────────────────────────────────

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

// ─── Offline QR-First Attendance Helper & Query ───────────────────────────

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

// ─── Student Attendance History (all session types) ────────────────────────

async function resolveStudentAttendanceHistory(
  ctx: QueryCtx,
  studentId: Id<'students'>,
) {
  const activeAcademicYearId = await getActiveAcademicYear(ctx)
  if (!activeAcademicYearId) {
    return []
  }

  const studentClasses = await ctx.db
    .query('studentClasses')
    .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
    .collect()

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

  // Parish-scoped sessions (mass, extracurricular) carry no classYearId of
  // their own — the student's class comes from the studentClass the record
  // was taken against instead.
  const classYearIdByStudentClassId = new Map(
    studentClasses.map((sc) => [sc._id, sc.classYearId]),
  )

  const resolved = await Promise.all(
    attendanceRecords.map(async (record) => {
      const session = await ctx.db.get('classSessions', record.sessionId)
      if (!session || session.isDeleted || session.isCancelled) return null

      const isParishScoped =
        session.sessionType === 'mass' ||
        session.sessionType === 'extracurricular'

      // Class-scoped sessions (catechism, supplemental) have no
      // academicYearId of their own — resolve it via their classYearId.
      let sessionAcademicYearId: Id<'academicYears'> | null = null
      if (isParishScoped) {
        sessionAcademicYearId = session.academicYearId ?? null
      } else if (session.classYearId) {
        const classYear = await ctx.db.get('classYears', session.classYearId)
        sessionAcademicYearId = classYear?.academicYearId ?? null
      }
      if (sessionAcademicYearId !== activeAcademicYearId) return null

      // Class-scoped sessions are the source of truth for which class the
      // session belongs to; parish-scoped sessions have no class of their
      // own, so fall back to the student's enrollment at record time.
      const classYearId = isParishScoped
        ? classYearIdByStudentClassId.get(record.studentClassId)
        : session.classYearId

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

export const getStudentAttendanceHistory = query({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    return resolveStudentAttendanceHistory(ctx, args.studentId)
  },
})
