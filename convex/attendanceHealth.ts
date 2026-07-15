import { v } from 'convex/values'
import { query } from './_generated/server'
import { assertValidCatechist, getEffectivePermissions } from './lib/authz'
import type { QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'

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
