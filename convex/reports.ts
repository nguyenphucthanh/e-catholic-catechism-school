import { v } from 'convex/values'
import { query } from './_generated/server'
import { assertValidCatechist } from './lib/authz'
import { ACADEMIC_YEAR_ERRORS } from './lib/errors'
import {
  getActiveClassYearsForAcademicYear,
  getCatechistIdSetForAcademicYear,
  getStudentIdSetForClassYears,
  percentage,
} from './lib/statsHelpers'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'

type ClassYearForReport = Awaited<
  ReturnType<typeof getActiveClassYearsForAcademicYear>
>[number]

async function buildClassReport(ctx: QueryCtx, cy: ClassYearForReport) {
  const classDoc = await ctx.db.get('classes', cy.classId)
  if (!classDoc || classDoc.isDeleted) return null

  const classYearDoc = await ctx.db.get('classYears', cy.classYearId)
  const classType = classYearDoc?.classType ?? 'primary'

  // Fetch active enrollments
  const studentClasses = await ctx.db
    .query('studentClasses')
    .withIndex('by_class_year_id', (q) => q.eq('classYearId', cy.classYearId))
    .collect()

  const activeStudentClasses = studentClasses.filter(
    (sc) => !sc.isDeleted && sc.status === 'active',
  )
  const students = await Promise.all(
    activeStudentClasses.map((sc) => ctx.db.get('students', sc.studentId)),
  )
  const activeEnrollments: Array<{
    studentClassId: Id<'studentClasses'>
    studentId: Id<'students'>
    fullName: string
    studentCode: string
  }> = []
  activeStudentClasses.forEach((sc, i) => {
    const student = students[i]
    if (!student || student.isDeleted) return
    activeEnrollments.push({
      studentClassId: sc._id,
      studentId: sc.studentId,
      fullName: student.fullName,
      studentCode: student.studentCode,
    })
  })

  // Fetch sessions
  const allSessions = await ctx.db
    .query('classSessions')
    .withIndex('by_class_year_id_and_semester_id', (q) =>
      q.eq('classYearId', cy.classYearId),
    )
    .collect()

  const classScopedSessions = allSessions.filter(
    (s) =>
      !s.isDeleted &&
      !s.isCancelled &&
      (s.sessionType === 'catechism' || s.sessionType === 'supplemental'),
  )

  const sortedSessions = classScopedSessions.sort((a, b) =>
    a.sessionDate.localeCompare(b.sessionDate),
  )

  // Fetch attendance records for ALL class sessions
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
  const statusFor = (
    enrollment: (typeof activeEnrollments)[number],
    session: Doc<'classSessions'>,
  ) => statusMap.get(`${enrollment.studentClassId}_${session._id}`)
  const isPresentOrLate = (
    status: Doc<'attendanceRecords'>['status'] | undefined,
  ) => status === 'present' || status === 'late'

  // Calculate overall rate
  let presentOrLateCount = 0
  for (const session of sortedSessions) {
    for (const enrollment of activeEnrollments) {
      if (isPresentOrLate(statusFor(enrollment, session))) {
        presentOrLateCount++
      }
    }
  }
  const totalDenominator = activeEnrollments.length * sortedSessions.length
  const overallRate = percentage(presentOrLateCount, totalDenominator, 0)

  // Last 10 sessions for sparkline
  const last10Sessions = sortedSessions.slice(-10)
  const attendanceHistory = last10Sessions.map((session) => {
    let sessionPresentOrLate = 0
    for (const enrollment of activeEnrollments) {
      if (isPresentOrLate(statusFor(enrollment, session))) {
        sessionPresentOrLate++
      }
    }
    const rate = percentage(sessionPresentOrLate, activeEnrollments.length, 0)
    return {
      sessionDate: session.sessionDate,
      rate,
    }
  })

  // Check streaks (consecutive absences)
  const sessionsDesc = [...sortedSessions].reverse()
  const classAtRisk: Array<{
    studentId: string
    studentCode: string
    fullName: string
    className: string
    consecutiveAbsences: number
  }> = []
  for (const enrollment of activeEnrollments) {
    let streak = 0
    for (const session of sessionsDesc) {
      const status = statusFor(enrollment, session)
      if (status === 'excused_absence' || status === 'unexcused_absence') {
        streak++
        continue
      }
      break
    }
    if (streak >= 3) {
      classAtRisk.push({
        studentId: enrollment.studentId,
        studentCode: enrollment.studentCode,
        fullName: enrollment.fullName,
        className: classDoc.name,
        consecutiveAbsences: streak,
      })
    }
  }

  return {
    classId: cy.classId,
    classYearId: cy.classYearId,
    branchId: cy.branchId,
    className: classDoc.name,
    studentCount: activeEnrollments.length,
    classType,
    sessionCount: sortedSessions.length,
    overallAttendanceRate: overallRate,
    attendanceHistory,
    atRisk: classAtRisk,
  }
}

export const academicYearReport = query({
  args: {
    academicYearId: v.id('academicYears'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx)

    const academicYear = await ctx.db.get('academicYears', args.academicYearId)
    if (!academicYear || academicYear.isDeleted) {
      throw new Error(ACADEMIC_YEAR_ERRORS.NOT_FOUND)
    }

    const activeClassYears = await getActiveClassYearsForAcademicYear(
      ctx,
      args.academicYearId,
    )

    const branchesList = await ctx.db
      .query('branches')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()
    // Sort branches by sortOrder
    const sortedBranches = branchesList.sort(
      (a, b) => a.sortOrder - b.sortOrder,
    )

    const classReports = await Promise.all(
      activeClassYears.map((cy) => buildClassReport(ctx, cy)),
    )

    const validClassReports = classReports.filter(
      (r): r is NonNullable<typeof r> => r !== null,
    )

    // Compute KPIs
    let sumRates = 0
    let rateCount = 0
    for (const r of validClassReports) {
      if (r.overallAttendanceRate !== null) {
        sumRates += r.overallAttendanceRate
        rateCount++
      }
    }
    // Get unique active student IDs
    const classYearIds = activeClassYears.map((cy) => cy.classYearId)
    const allStudentIdsSet = await getStudentIdSetForClassYears(
      ctx,
      classYearIds,
    )
    const totalStudents = allStudentIdsSet.size

    const catechistIds = await getCatechistIdSetForAcademicYear(
      ctx,
      args.academicYearId,
      new Set(classYearIds),
    )

    const kpis = {
      totalClasses: validClassReports.length,
      totalStudents,
      averageAttendanceRate:
        rateCount === 0 ? null : Math.round(sumRates / rateCount),
      activeCatechists: catechistIds.size,
    }

    // Group classes by branch
    const branchReports = sortedBranches.map((branch) => {
      const classesForBranch = validClassReports.filter(
        (r) => r.branchId === branch._id,
      )
      return {
        branchId: branch._id,
        branchName: branch.name,
        classes: classesForBranch.map((c) => ({
          classId: c.classId,
          classYearId: c.classYearId,
          className: c.className,
          studentCount: c.studentCount,
          sessionCount: c.sessionCount,
          classType: c.classType,
          overallAttendanceRate: c.overallAttendanceRate,
          attendanceHistory: c.attendanceHistory,
        })),
      }
    })

    const classesComparison = validClassReports.map((c) => ({
      classId: c.classId,
      className: c.className,
      studentCount: c.studentCount,
      classType: c.classType,
    }))

    const atRiskStudents = validClassReports
      .flatMap((c) => c.atRisk)
      .sort((a, b) => {
        if (b.consecutiveAbsences !== a.consecutiveAbsences) {
          return b.consecutiveAbsences - a.consecutiveAbsences
        }
        return a.fullName.localeCompare(b.fullName)
      })

    return {
      academicYearName: academicYear.name,
      kpis,
      classesComparison,
      branches: branchReports,
      atRiskStudents,
    }
  },
})
