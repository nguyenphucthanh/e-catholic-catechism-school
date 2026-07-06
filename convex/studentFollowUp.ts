import { v } from 'convex/values'
import { query } from './_generated/server'
import { assertValidCatechist, getEffectivePermissions } from './lib/authz'
import type { QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'

type FollowUpStudent = {
  studentId: Id<'students'>
  studentClassId: Id<'studentClasses'>
  className: string
  fullName: string
  attendanceRate: number
  scoreEntriesCount: number
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

  // Sessions for this classYear (class-scoped only)
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

  if (classScopedSessions.length === 0 || activeEnrollments.length === 0) {
    return []
  }

  // Attendance records
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

  // Score entries for this class year
  const scoreColumns = await ctx.db
    .query('scoreColumns')
    .withIndex('by_class_year_id_and_semester_id', (q) =>
      q.eq('classYearId', classYearId),
    )
    .collect()

  const activeColumns = scoreColumns
    .filter((c) => !c.isDeleted)
    .map((c) => c._id)

  const scoreEntries = (
    await Promise.all(
      activeColumns.map((columnId) =>
        ctx.db
          .query('scoreEntries')
          .withIndex('by_score_column_id', (q) =>
            q.eq('scoreColumnId', columnId),
          )
          .collect(),
      ),
    )
  ).flat()

  const scoreEntriesByStudent = new Map<
    Id<'studentClasses'>,
    Array<Doc<'scoreEntries'>>
  >()
  for (const entry of scoreEntries) {
    if (entry.isDeleted) continue
    const current = scoreEntriesByStudent.get(entry.studentClassId) ?? []
    current.push(entry)
    scoreEntriesByStudent.set(entry.studentClassId, current)
  }

  // Compute metrics per student
  const result: Array<FollowUpStudent> = []

  for (const enrollment of activeEnrollments) {
    // Attendance rate
    let presentOrLate = 0
    for (const session of classScopedSessions) {
      const status = statusMap.get(
        `${enrollment.studentClassId}_${session._id}`,
      )
      if (status === 'present' || status === 'late') presentOrLate++
    }
    const attendanceRate = Math.round(
      (presentOrLate / classScopedSessions.length) * 100,
    )

    // Score entries count
    const entries = scoreEntriesByStudent.get(enrollment.studentClassId) ?? []
    const scoreEntriesCount = entries.length

    // Filter: attendance < 75% AND (low score engagement OR few entries)
    if (attendanceRate < 75 && scoreEntriesCount < 3) {
      result.push({
        studentId: enrollment.studentId,
        studentClassId: enrollment.studentClassId,
        className: classRecord.name,
        fullName: enrollment.fullName,
        attendanceRate,
        scoreEntriesCount,
      })
    }
  }

  return result.sort((a, b) => a.fullName.localeCompare(b.fullName))
}

export const getStudentsNeedingFollowUp = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
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
