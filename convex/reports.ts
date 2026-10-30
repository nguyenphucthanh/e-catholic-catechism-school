import { v } from 'convex/values'
import { query } from './_generated/server'
import { assertBoardMemberOrAdmin } from './lib/authz'
import { isActiveEnrollment } from './lib/enrollment'
import { ACADEMIC_YEAR_ERRORS } from './lib/errors'
import {
  getActiveClassYearsForAcademicYear,
  getCatechistIdSetForAcademicYear,
  percentage,
} from './lib/statsHelpers'
import type { Doc } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'

type ClassYearForReport = Awaited<
  ReturnType<typeof getActiveClassYearsForAcademicYear>
>[number]

async function loadClassBase(ctx: QueryCtx, cy: ClassYearForReport) {
  const classDoc = await ctx.db.get('classes', cy.classId)
  if (!classDoc || classDoc.isDeleted) return null

  const classYearDoc = await ctx.db.get('classYears', cy.classYearId)
  const classType = classYearDoc?.classType ?? 'primary'

  const studentClasses = await ctx.db
    .query('studentClasses')
    .withIndex('by_class_year_id', (q) => q.eq('classYearId', cy.classYearId))
    .collect()

  const activeStudentClasses = studentClasses.filter(
    (sc) => !sc.isDeleted && sc.status === 'active',
  )
  return { classDoc, classType, studentClasses, activeStudentClasses }
}

// Enrollment-only (no attendance reads): cheap enough for the summary query.
async function buildClassSummary(ctx: QueryCtx, cy: ClassYearForReport) {
  const base = await loadClassBase(ctx, cy)
  if (!base) return null
  return {
    classId: cy.classId,
    branchId: cy.branchId,
    className: base.classDoc.name,
    classType: base.classType,
    studentCount: base.activeStudentClasses.length,
    // Looser isActiveEnrollment rule (includes on_leave) for the total-students
    // KPI, unlike studentCount which is status=active.
    enrolledStudentIds: base.studentClasses
      .filter(isActiveEnrollment)
      .map((sc) => sc.studentId),
  }
}

async function buildClassReport(ctx: QueryCtx, cy: ClassYearForReport) {
  const base = await loadClassBase(ctx, cy)
  if (!base) return null
  const { classDoc, classType, activeStudentClasses } = base

  const activeEnrollments = activeStudentClasses.map((sc) => ({
    studentClassId: sc._id,
  }))

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
  }
}

// Summary: enrollment-only, no attendance reads. Per-branch attendance is
// loaded on demand via academicYearBranchReport.
export const academicYearReport = query({
  args: {
    academicYearId: v.id('academicYears'),
  },
  handler: async (ctx, args) => {
    await assertBoardMemberOrAdmin(ctx, args.academicYearId)

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

    const summaries = (
      await Promise.all(
        activeClassYears.map((cy) => buildClassSummary(ctx, cy)),
      )
    ).filter((r): r is NonNullable<typeof r> => r !== null)

    const catechistIds = await getCatechistIdSetForAcademicYear(
      ctx,
      args.academicYearId,
      new Set(activeClassYears.map((cy) => cy.classYearId)),
    )

    const branchIdsWithClasses = new Set(summaries.map((r) => r.branchId))
    const branches = branchesList
      .filter((b) => branchIdsWithClasses.has(b._id))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((b) => ({ branchId: b._id, branchName: b.name }))

    return {
      academicYearName: academicYear.name,
      kpis: {
        totalClasses: summaries.length,
        totalStudents: new Set(summaries.flatMap((r) => r.enrolledStudentIds))
          .size,
        activeCatechists: catechistIds.size,
      },
      classesComparison: summaries.map((c) => ({
        classId: c.classId,
        className: c.className,
        studentCount: c.studentCount,
        classType: c.classType,
      })),
      branches,
    }
  },
})

// Attendance rate + sparkline for the classes of ONE branch. Heavy: reads all
// attendance records of the branch's class-years, so it is fetched on demand.
export const academicYearBranchReport = query({
  args: {
    academicYearId: v.id('academicYears'),
    branchId: v.id('branches'),
  },
  handler: async (ctx, args) => {
    await assertBoardMemberOrAdmin(ctx, args.academicYearId)

    const branch = await ctx.db.get('branches', args.branchId)
    if (!branch || branch.isDeleted) return null

    const classYears = (
      await getActiveClassYearsForAcademicYear(ctx, args.academicYearId)
    ).filter((cy) => cy.branchId === args.branchId)

    const reports = (
      await Promise.all(classYears.map((cy) => buildClassReport(ctx, cy)))
    ).filter((r): r is NonNullable<typeof r> => r !== null)

    return {
      branchId: branch._id,
      branchName: branch.name,
      classes: reports.map((c) => ({
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
  },
})
