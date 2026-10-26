import { v } from 'convex/values'
import { query } from './_generated/server'
import { assertValidCatechist, getEffectivePermissions } from './lib/authz'
import {
  computeAttendanceSummary,
  isClassScopedSession,
} from './lib/attendance'
import type { QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'

type FollowUpStudent = {
  studentId: Id<'students'>
  studentClassId: Id<'studentClasses'>
  className: string
  fullName: string
  attendanceRate: number
  scoreEntriesCount: number
  totalExams: number
  missedExamsCount: number
  hasAttendanceIssue: boolean
  hasScoreIssue: boolean
}

async function buildStudentsNeedingFollowUp(
  ctx: QueryCtx,
  classYearId: Id<'classYears'>,
): Promise<Array<FollowUpStudent>> {
  const classYear = await ctx.db.get('classYears', classYearId)
  if (!classYear || classYear.isDeleted) return []

  const classRecord = await ctx.db.get('classes', classYear.classId)
  if (!classRecord || classRecord.isDeleted) return []

  // Active enrollments
  const studentClasses = await ctx.db
    .query('studentClasses')
    .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYearId))
    .collect()

  const activeEnrollments: Array<{
    studentClassId: Id<'studentClasses'>
    studentId: Id<'students'>
    fullName: string
  }> = []

  for (const sc of studentClasses) {
    if (sc.isDeleted || sc.status !== 'active') continue
    const student = await ctx.db.get('students', sc.studentId)
    if (!student || student.isDeleted) continue
    activeEnrollments.push({
      studentClassId: sc._id,
      studentId: sc.studentId,
      fullName: student.fullName,
    })
  }

  if (activeEnrollments.length === 0) {
    return []
  }

  // Sessions for this classYear (class-scoped only)
  const allSessions = await ctx.db
    .query('classSessions')
    .withIndex('by_class_year_id_and_semester_id', (q) =>
      q.eq('classYearId', classYearId),
    )
    .collect()

  const classScopedSessions = allSessions.filter(isClassScopedSession)

  // Score columns for this class year
  const scoreColumns = await ctx.db
    .query('scoreColumns')
    .withIndex('by_class_year_id_and_semester_id', (q) =>
      q.eq('classYearId', classYearId),
    )
    .collect()

  const activeColumns = scoreColumns.filter((c) => !c.isDeleted)
  const totalExams = activeColumns.length

  if (classScopedSessions.length < 3 && totalExams === 0) {
    return []
  }

  // Attendance records
  const attendanceRecords =
    classScopedSessions.length > 0
      ? (
          await Promise.all(
            classScopedSessions.map((session) =>
              ctx.db
                .query('attendanceRecords')
                .withIndex('by_session_id', (q) =>
                  q.eq('sessionId', session._id),
                )
                .collect(),
            ),
          )
        ).flat()
      : []

  const statusByStudentClass = new Map<
    Id<'studentClasses'>,
    Map<Id<'classSessions'>, Doc<'attendanceRecords'>['status']>
  >()
  for (const record of attendanceRecords) {
    if (record.isDeleted) continue
    const perSession =
      statusByStudentClass.get(record.studentClassId) ?? new Map()
    perSession.set(record.sessionId, record.status)
    statusByStudentClass.set(record.studentClassId, perSession)
  }

  // Score entries for active columns
  const scoreEntries =
    activeColumns.length > 0
      ? (
          await Promise.all(
            activeColumns.map((column) =>
              ctx.db
                .query('scoreEntries')
                .withIndex('by_score_column_id', (q) =>
                  q.eq('scoreColumnId', column._id),
                )
                .collect(),
            ),
          )
        ).flat()
      : []

  const takenColumnIdsByStudent = new Map<
    Id<'studentClasses'>,
    Set<Id<'scoreColumns'>>
  >()
  for (const entry of scoreEntries) {
    if (entry.isDeleted) continue
    if (entry.scoreValue === undefined && entry.scoreLabel === undefined)
      continue
    let set = takenColumnIdsByStudent.get(entry.studentClassId)
    if (!set) {
      set = new Set()
      takenColumnIdsByStudent.set(entry.studentClassId, set)
    }
    set.add(entry.scoreColumnId)
  }

  // Compute metrics per student
  const result: Array<FollowUpStudent> = []
  const scheduledSessionIds = classScopedSessions.map((s) => s._id)

  for (const enrollment of activeEnrollments) {
    const summary = computeAttendanceSummary(
      scheduledSessionIds,
      statusByStudentClass.get(enrollment.studentClassId) ?? new Map(),
    )
    const attendanceRate = Math.round(summary.rate * 100)
    const checkIns = summary.present + summary.late
    const sessionsWithoutCheckIn = scheduledSessionIds.length - checkIns

    const takenExamsCount =
      takenColumnIdsByStudent.get(enrollment.studentClassId)?.size ?? 0
    const missedExamsCount = Math.max(0, totalExams - takenExamsCount)

    const hasAttendanceIssue =
      classScopedSessions.length >= 3 &&
      sessionsWithoutCheckIn >= 3 &&
      attendanceRate < 75

    const hasScoreIssue =
      totalExams >= 1 && missedExamsCount / totalExams >= 0.3

    if (hasAttendanceIssue || hasScoreIssue) {
      result.push({
        studentId: enrollment.studentId,
        studentClassId: enrollment.studentClassId,
        className: classRecord.name,
        fullName: enrollment.fullName,
        attendanceRate,
        scoreEntriesCount: takenExamsCount,
        totalExams,
        missedExamsCount,
        hasAttendanceIssue,
        hasScoreIssue,
      })
    }
  }

  return result.sort((a, b) => a.fullName.localeCompare(b.fullName))
}

export const getStudentsNeedingFollowUp = query({
  args: {
    academicYearId: v.id('academicYears'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx)

    const perms = await getEffectivePermissions(ctx, args.academicYearId)

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

    const results = (
      await Promise.all(
        [...classYearIds].map((classYearId) =>
          buildStudentsNeedingFollowUp(ctx, classYearId),
        ),
      )
    ).flat()

    return results.sort((a, b) => {
      const classCompare = a.className.localeCompare(b.className)
      if (classCompare !== 0) return classCompare
      return a.attendanceRate - b.attendanceRate
    })
  },
})
