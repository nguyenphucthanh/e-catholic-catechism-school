import { v } from 'convex/values'
import { query } from './_generated/server'
import {
  assertValidCatechist,
  assertValidStudent,
  getActiveAcademicYear,
} from './lib/authz'
import type { QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

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

export const listMyParishAttendance = query({
  args: {
    requesterId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertValidStudent(ctx, args.requesterId)
    return resolveParishAttendanceForStudent(ctx, args.requesterId)
  },
})
