import { v } from 'convex/values'
import { query } from './_generated/server'
import { assertValidCatechist } from './lib/authz'
import {
  getActiveClassYearsForAcademicYear,
  getCatechistIdSetForAcademicYear,
  getStudentIdSetForClassYears,
} from './lib/statsHelpers'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'

const MAX_YEARS = 5

type ActiveClassYear = {
  classYearId: Id<'classYears'>
  classId: Id<'classes'>
  branchId: Id<'branches'>
}

type EnrollmentByClass = {
  classId: Id<'classes'>
  className: string
  count: number
}

type EnrollmentRow = {
  academicYearId: Id<'academicYears'>
  totalActive: number
  byClass: Array<EnrollmentByClass>
}

type AttendanceRow = {
  academicYearId: Id<'academicYears'>
  massAttendanceRate: number | null
  extracurricularAttendanceRate: number | null
  classAttendanceRate: number | null
}

type GradesRow = {
  academicYearId: Id<'academicYears'>
  passRate: number | null
  averageScore: number | null
}

type StaffingRow = {
  academicYearId: Id<'academicYears'>
  catechistCount: number
  classCount: number
  branchCount: number
}

// Percentage (0-100) rounded to `decimals` places; returns null for empty
// (zero-denominator) inputs so charts can render "no data" instead of a
// misleading 0%.
function percentage(
  numerator: number,
  denominator: number,
  decimals: number,
): number | null {
  if (denominator === 0) return null
  const factor = 10 ** decimals
  return Math.round((numerator / denominator) * 100 * factor) / factor
}

async function buildEnrollmentRow(
  ctx: QueryCtx,
  academicYearId: Id<'academicYears'>,
  activeClassYears: Array<ActiveClassYear>,
): Promise<EnrollmentRow> {
  const byClass = await Promise.all(
    activeClassYears.map(async (cy): Promise<EnrollmentByClass> => {
      const enrollments = await ctx.db
        .query('studentClasses')
        .withIndex('by_class_year_id', (q) =>
          q.eq('classYearId', cy.classYearId),
        )
        .collect()
      const activePrimary = enrollments.filter(
        (sc) => !sc.isDeleted && sc.isPrimaryClass && sc.status === 'active',
      )
      const classDoc = await ctx.db.get('classes', cy.classId)
      return {
        classId: cy.classId,
        className: classDoc?.name ?? 'Unknown',
        count: activePrimary.length,
      }
    }),
  )

  const totalActive = byClass.reduce((sum, row) => sum + row.count, 0)
  return { academicYearId, totalActive, byClass }
}

// present + late over all non-cancelled/non-deleted attendance records for a
// set of sessions. Fans out per-session (Promise.all) rather than looping.
async function computeAttendanceRate(
  ctx: QueryCtx,
  sessions: Array<Doc<'classSessions'>>,
): Promise<number | null> {
  const recordsPerSession = await Promise.all(
    sessions.map((s) =>
      ctx.db
        .query('attendanceRecords')
        .withIndex('by_session_id', (q) => q.eq('sessionId', s._id))
        .collect(),
    ),
  )

  let numerator = 0
  let denominator = 0
  for (const records of recordsPerSession) {
    for (const r of records) {
      if (r.isDeleted) continue
      denominator++
      if (r.status === 'present' || r.status === 'late') numerator++
    }
  }
  return percentage(numerator, denominator, 1)
}

async function buildAttendanceRow(
  ctx: QueryCtx,
  year: Doc<'academicYears'>,
  classYearIds: Array<Id<'classYears'>>,
): Promise<AttendanceRow> {
  // Parish-scoped (mass/extracurricular): classSessions carry academicYearId
  // directly. Query via the indexed sessionType+sessionDate range bounded to
  // this year's date span, then defensively re-check academicYearId in case
  // of overlapping date ranges across years.
  async function loadParishSessions(
    sessionType: 'mass' | 'extracurricular',
  ): Promise<Array<Doc<'classSessions'>>> {
    const all = await ctx.db
      .query('classSessions')
      .withIndex('by_session_type_and_session_date', (q) =>
        q
          .eq('sessionType', sessionType)
          .gte('sessionDate', year.startDate)
          .lte('sessionDate', year.endDate),
      )
      .collect()
    return all.filter(
      (s) => !s.isDeleted && !s.isCancelled && s.academicYearId === year._id,
    )
  }

  // Class-scoped (catechism/supplemental): fan out per classYearId via the
  // real index, then filter sessionType in-memory (house style).
  async function loadClassSessions(): Promise<Array<Doc<'classSessions'>>> {
    const perClassYear = await Promise.all(
      classYearIds.map((classYearId) =>
        ctx.db
          .query('classSessions')
          .withIndex('by_class_year_id_and_semester_id', (q) =>
            q.eq('classYearId', classYearId),
          )
          .collect(),
      ),
    )
    return perClassYear
      .flat()
      .filter(
        (s) =>
          !s.isDeleted &&
          !s.isCancelled &&
          (s.sessionType === 'catechism' || s.sessionType === 'supplemental'),
      )
  }

  const [massSessions, extraSessions, classSessions] = await Promise.all([
    loadParishSessions('mass'),
    loadParishSessions('extracurricular'),
    loadClassSessions(),
  ])

  const [
    massAttendanceRate,
    extracurricularAttendanceRate,
    classAttendanceRate,
  ] = await Promise.all([
    computeAttendanceRate(ctx, massSessions),
    computeAttendanceRate(ctx, extraSessions),
    computeAttendanceRate(ctx, classSessions),
  ])

  return {
    academicYearId: year._id,
    massAttendanceRate,
    extracurricularAttendanceRate,
    classAttendanceRate,
  }
}

async function buildGradesRow(
  ctx: QueryCtx,
  academicYearId: Id<'academicYears'>,
  classYearIds: Array<Id<'classYears'>>,
): Promise<GradesRow> {
  const studentClassesPerClassYear = await Promise.all(
    classYearIds.map((classYearId) =>
      ctx.db
        .query('studentClasses')
        .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYearId))
        .collect(),
    ),
  )
  const studentClassIds = studentClassesPerClassYear
    .flat()
    .filter((sc) => !sc.isDeleted)
    .map((sc) => sc._id)

  const annualResultsPerStudentClass = await Promise.all(
    studentClassIds.map((studentClassId) =>
      ctx.db
        .query('annualResults')
        .withIndex('by_student_class_id', (q) =>
          q.eq('studentClassId', studentClassId),
        )
        .collect(),
    ),
  )
  const annualResults = annualResultsPerStudentClass
    .flat()
    .filter((r) => !r.isDeleted)
  const passCount = annualResults.filter((r) => r.isCompleted === true).length
  const passRate = percentage(passCount, annualResults.length, 1)

  // annualResults has no numeric score field (only conductGrade/isCompleted/
  // remark per schema) — "average score" is derived from scale_10 scoreEntries
  // tied to the year's classYears instead. Simple mean (scoreColumns carries
  // no `weight` field in this schema, so a weighted average isn't available).
  const scoreColumnsPerClassYear = await Promise.all(
    classYearIds.map((classYearId) =>
      ctx.db
        .query('scoreColumns')
        .withIndex('by_class_year_id_and_semester_id', (q) =>
          q.eq('classYearId', classYearId),
        )
        .collect(),
    ),
  )
  const scoreColumns = scoreColumnsPerClassYear
    .flat()
    .filter((c) => !c.isDeleted && (c.scaleType ?? 'scale_10') === 'scale_10')

  const entriesPerColumn = await Promise.all(
    scoreColumns.map((column) =>
      ctx.db
        .query('scoreEntries')
        .withIndex('by_score_column_id', (q) =>
          q.eq('scoreColumnId', column._id),
        )
        .collect(),
    ),
  )
  const scoreValues = entriesPerColumn
    .flat()
    .filter((e) => !e.isDeleted && e.scoreValue !== undefined)
    .map((e) => e.scoreValue as number)

  const averageScore =
    scoreValues.length > 0
      ? Math.round(
          (scoreValues.reduce((sum, val) => sum + val, 0) /
            scoreValues.length) *
            100,
        ) / 100
      : null

  return { academicYearId, passRate, averageScore }
}

/**
 * 5-year academic year comparison report. Returns the most recent (up to)
 * `MAX_YEARS` academic years in chronological order, alongside per-year
 * enrollment / attendance / grades / staffing rows aligned by array index
 * for charting.
 *
 * Access: any active catechist (mirrors getParishAttendanceReport /
 * getStudentAttendanceReport in convex/attendance.ts) — not admin-only.
 */
export const academicYearComparison = query({
  args: {
    requesterId: v.id('catechists'),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    years: Array<{
      academicYearId: Id<'academicYears'>
      label: string
      startDate: string
    }>
    enrollment: Array<EnrollmentRow>
    attendance: Array<AttendanceRow>
    grades: Array<GradesRow>
    staffing: Array<StaffingRow>
  }> => {
    await assertValidCatechist(ctx, args.requesterId)

    const allYearsDesc = await ctx.db
      .query('academicYears')
      .withIndex('by_start_date')
      .order('desc')
      .collect()
    const recentDesc = allYearsDesc
      .filter((y) => !y.isDeleted)
      .slice(0, MAX_YEARS)
    // Reverse to chronological (oldest first) order for charting.
    const years = [...recentDesc].reverse()

    const yearsOut = years.map((y) => ({
      academicYearId: y._id,
      label: y.name,
      startDate: y.startDate,
    }))

    const enrollment: Array<EnrollmentRow> = []
    const attendance: Array<AttendanceRow> = []
    const grades: Array<GradesRow> = []
    const staffing: Array<StaffingRow> = []

    for (const year of years) {
      const activeClassYears = await getActiveClassYearsForAcademicYear(
        ctx,
        year._id,
      )
      const classYearIds = activeClassYears.map((cy) => cy.classYearId)

      const [enrollmentRow, attendanceRow, gradesRow, catechistIds] =
        await Promise.all([
          buildEnrollmentRow(ctx, year._id, activeClassYears),
          buildAttendanceRow(ctx, year, classYearIds),
          buildGradesRow(ctx, year._id, classYearIds),
          getCatechistIdSetForAcademicYear(
            ctx,
            year._id,
            new Set(classYearIds),
          ),
        ])

      enrollment.push(enrollmentRow)
      attendance.push(attendanceRow)
      grades.push(gradesRow)

      const branchIds = new Set(activeClassYears.map((cy) => cy.branchId))
      staffing.push({
        academicYearId: year._id,
        catechistCount: catechistIds.size,
        classCount: activeClassYears.length,
        branchCount: branchIds.size,
      })
    }

    return { years: yearsOut, enrollment, attendance, grades, staffing }
  },
})

export const academicYearReport = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const academicYear = await ctx.db.get('academicYears', args.academicYearId)
    if (!academicYear || academicYear.isDeleted) {
      throw new Error('Academic year not found')
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
    const sortedBranches = branchesList.sort((a, b) => a.sortOrder - b.sortOrder)

    const classReports = await Promise.all(
      activeClassYears.map(async (cy) => {
        const classDoc = await ctx.db.get('classes', cy.classId)
        if (!classDoc || classDoc.isDeleted) return null

        const classYearDoc = await ctx.db.get('classYears', cy.classYearId)
        const classType = classYearDoc?.classType ?? 'primary'

        // Fetch active enrollments
        const studentClasses = await ctx.db
          .query('studentClasses')
          .withIndex('by_class_year_id', (q) => q.eq('classYearId', cy.classYearId))
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

        // Calculate overall rate
        let presentOrLateCount = 0
        for (const session of sortedSessions) {
          for (const enrollment of activeEnrollments) {
            const status = statusMap.get(
              `${enrollment.studentClassId}_${session._id}`,
            )
            if (status === 'present' || status === 'late') {
              presentOrLateCount++
            }
          }
        }
        const totalDenominator = activeEnrollments.length * sortedSessions.length
        const overallRate = totalDenominator === 0
          ? null
          : Math.round((presentOrLateCount / totalDenominator) * 100)

        // Last 10 sessions for sparkline
        const last10Sessions = sortedSessions.slice(-10)
        const attendanceHistory = last10Sessions.map((session) => {
          let sessionPresentOrLate = 0
          for (const enrollment of activeEnrollments) {
            const status = statusMap.get(
              `${enrollment.studentClassId}_${session._id}`,
            )
            if (status === 'present' || status === 'late') {
              sessionPresentOrLate++
            }
          }
          const rate = activeEnrollments.length === 0
            ? null
            : Math.round((sessionPresentOrLate / activeEnrollments.length) * 100)
          return {
            sessionDate: session.sessionDate,
            rate,
          }
        })

        // Check streaks (consecutive absences)
        const sessionsDesc = [...sortedSessions].reverse()
        const classAtRisk = []
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
          overallAttendanceRate: overallRate,
          attendanceHistory,
          atRisk: classAtRisk,
        }
      }),
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
    const allStudentIdsSet = await getStudentIdSetForClassYears(ctx, classYearIds)
    const totalStudents = allStudentIdsSet.size

    const catechistIds = await getCatechistIdSetForAcademicYear(
      ctx,
      args.academicYearId,
      new Set(classYearIds),
    )

    const kpis = {
      totalClasses: validClassReports.length,
      totalStudents,
      averageAttendanceRate: rateCount === 0 ? null : Math.round(sumRates / rateCount),
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

    const atRiskStudents = validClassReports.flatMap((c) => c.atRisk).sort((a, b) => {
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

