import { v } from 'convex/values'
import { query } from './_generated/server'
import { assertValidCatechist } from './lib/authz'
import {
  getActiveClassYearsForAcademicYear,
  getCatechistIdSetForAcademicYear,
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
