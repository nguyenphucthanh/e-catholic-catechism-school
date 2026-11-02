import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

export type CatechismLinkResult =
  | { outcome: 'created' | 'exists' }
  | {
      outcome: 'skipped'
      reason:
        | 'not_primary_class'
        | 'invalid_semester'
        | 'session_cancelled'
        | 'year_mismatch'
    }

// Records `present` for a Mass-scanned student in their primary class's catechism
// session on the Mass date, creating that session on first use. Insert-only: an
// existing live record is never modified. All validation runs before any write so
// a caller that catches a throw never keeps a half-linked session.
export async function linkMassScanToCatechism(
  ctx: MutationCtx,
  args: {
    massSession: Doc<'classSessions'>
    studentClassId: Id<'studentClasses'>
    semesterId: Id<'semesters'>
    recordedBy: Id<'catechists'>
    deviceQueuedAt: number
  },
): Promise<CatechismLinkResult> {
  const { massSession, studentClassId, semesterId } = args

  const studentClass = await ctx.db.get('studentClasses', studentClassId)
  if (
    !studentClass ||
    studentClass.isDeleted ||
    studentClass.status !== 'active' ||
    !studentClass.isPrimaryClass
  ) {
    return { outcome: 'skipped', reason: 'not_primary_class' }
  }

  const classYear = await ctx.db.get('classYears', studentClass.classYearId)
  if (
    !classYear ||
    classYear.isDeleted ||
    classYear.academicYearId !== massSession.academicYearId
  ) {
    return { outcome: 'skipped', reason: 'year_mismatch' }
  }

  const semester = await ctx.db.get('semesters', semesterId)
  if (
    !semester ||
    semester.isDeleted ||
    semester.academicYearId !== classYear.academicYearId
  ) {
    return { outcome: 'skipped', reason: 'invalid_semester' }
  }

  const sessions = await ctx.db
    .query('classSessions')
    .withIndex('by_class_year_id_and_session_date', (q) =>
      q
        .eq('classYearId', classYear._id)
        .eq('sessionDate', massSession.sessionDate),
    )
    .collect()
  const existingSession = sessions.find(
    (s) => s.sessionType === 'catechism' && !s.isDeleted,
  )
  if (existingSession?.isCancelled) {
    return { outcome: 'skipped', reason: 'session_cancelled' }
  }

  const record = {
    status: 'present' as const,
    recordedBy: args.recordedBy,
    deviceQueuedAt: args.deviceQueuedAt,
    syncedAt: Date.now(),
    source: 'mass_qr' as const,
    isDeleted: false,
  }

  if (!existingSession) {
    const sessionId = await ctx.db.insert('classSessions', {
      classYearId: classYear._id,
      semesterId,
      sessionDate: massSession.sessionDate,
      sessionType: 'catechism',
      isCancelled: false,
      isDeleted: false,
    })
    await ctx.db.insert('attendanceRecords', {
      sessionId,
      studentClassId,
      ...record,
    })
    return { outcome: 'created' }
  }

  const rows = await ctx.db
    .query('attendanceRecords')
    .withIndex('by_session_id_and_student_class_id', (q) =>
      q
        .eq('sessionId', existingSession._id)
        .eq('studentClassId', studentClassId),
    )
    .collect()
  if (rows.some((r) => !r.isDeleted)) return { outcome: 'exists' }

  // A soft-deleted row is reactivated so the (session, student) pair stays unique.
  if (rows.length > 0) {
    await ctx.db.patch('attendanceRecords', rows[0]._id, record)
  } else {
    await ctx.db.insert('attendanceRecords', {
      sessionId: existingSession._id,
      studentClassId,
      ...record,
    })
  }
  return { outcome: 'created' }
}
