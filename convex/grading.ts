import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  assertClassCatechistOrAbove,
  assertValidCatechist,
  getEffectivePermissions,
} from './lib/authz'
import {
  ANNUAL_RESULT_ERRORS,
  GRADING_ERRORS,
  SCORE_COLUMN_ERRORS,
  SCORE_ENTRY_ERRORS,
  SEMESTER_RESULT_ERRORS,
} from './lib/errors'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

function assertValidWeight(weight: number | undefined) {
  if (weight === undefined) return
  if (!Number.isInteger(weight) || weight < 1 || weight > 3) {
    throw new Error(SCORE_COLUMN_ERRORS.INVALID_WEIGHT)
  }
}

// ─── ScoreColumn Queries ─────────────────────────────────────────────────────

export const listScoreColumns = query({
  args: {
    requesterId: v.id('catechists'),
    classYearId: v.id('classYears'),
    semesterId: v.id('semesters'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const columns = await ctx.db
      .query('scoreColumns')
      .withIndex('by_class_year_id_and_semester_id', (q) =>
        q.eq('classYearId', args.classYearId).eq('semesterId', args.semesterId),
      )
      .collect()
    return columns
      .filter((c) => !c.isDeleted)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  },
})

export const getScoreColumn = query({
  args: { requesterId: v.id('catechists'), id: v.id('scoreColumns') },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const column = await ctx.db.get('scoreColumns', args.id)
    if (!column || column.isDeleted) return null
    return column
  },
})

// ─── ScoreColumn Mutations ────────────────────────────────────────────────────

export const createScoreColumn = mutation({
  args: {
    requesterId: v.id('catechists'),
    classYearId: v.id('classYears'),
    semesterId: v.id('semesters'),
    columnName: v.string(),
    columnType: v.string(),
    scaleType: v.optional(
      v.union(
        v.literal('scale_10'),
        v.literal('pass_fail'),
        v.literal('letter_af'),
      ),
    ),
    weight: v.optional(v.number()),
    examDate: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertValidWeight(args.weight)

    const classYear = await ctx.db.get('classYears', args.classYearId)
    if (!classYear || classYear.isDeleted) {
      throw new Error(GRADING_ERRORS.CLASS_YEAR_NOT_FOUND)
    }

    await assertClassCatechistOrAbove(
      ctx,
      args.requesterId,
      classYear.academicYearId,
      args.classYearId,
    )

    const { requesterId, ...fields } = args
    const columnId = await ctx.db.insert('scoreColumns', {
      ...fields,
      scaleType: fields.scaleType ?? 'scale_10',
      weight: fields.weight ?? 1,
      sortOrder: fields.sortOrder ?? 0,
      isDeleted: false,
    })
    return columnId
  },
})

export const updateScoreColumn = mutation({
  args: {
    requesterId: v.id('catechists'),
    id: v.id('scoreColumns'),
    columnName: v.optional(v.string()),
    columnType: v.optional(v.string()),
    scaleType: v.optional(
      v.union(
        v.literal('scale_10'),
        v.literal('pass_fail'),
        v.literal('letter_af'),
      ),
    ),
    weight: v.optional(v.number()),
    examDate: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertValidWeight(args.weight)

    const column = await ctx.db.get('scoreColumns', args.id)
    if (!column || column.isDeleted) {
      throw new Error(SCORE_COLUMN_ERRORS.NOT_FOUND)
    }

    const classYear = await ctx.db.get('classYears', column.classYearId)
    if (!classYear || classYear.isDeleted) {
      throw new Error(SCORE_COLUMN_ERRORS.NOT_FOUND)
    }

    await assertClassCatechistOrAbove(
      ctx,
      args.requesterId,
      classYear.academicYearId,
      column.classYearId,
    )

    const { requesterId, id, ...fields } = args
    await ctx.db.patch('scoreColumns', id, fields)
  },
})

export const softDeleteScoreColumn = mutation({
  args: {
    requesterId: v.id('catechists'),
    id: v.id('scoreColumns'),
  },
  handler: async (ctx, args) => {
    const column = await ctx.db.get('scoreColumns', args.id)
    if (!column || column.isDeleted) {
      throw new Error(SCORE_COLUMN_ERRORS.NOT_FOUND)
    }

    const classYear = await ctx.db.get('classYears', column.classYearId)
    if (!classYear || classYear.isDeleted) {
      throw new Error(SCORE_COLUMN_ERRORS.NOT_FOUND)
    }

    await assertClassCatechistOrAbove(
      ctx,
      args.requesterId,
      classYear.academicYearId,
      column.classYearId,
    )

    const entries = await ctx.db
      .query('scoreEntries')
      .withIndex('by_score_column_id', (q) => q.eq('scoreColumnId', args.id))
      .collect()

    if (entries.some((e) => !e.isDeleted)) {
      throw new Error(SCORE_COLUMN_ERRORS.IN_USE_BY_ENTRIES)
    }

    await ctx.db.patch('scoreColumns', args.id, { isDeleted: true })
  },
})

// ─── ScoreEntry Queries ──────────────────────────────────────────────────────

export const listScoreEntries = query({
  args: {
    requesterId: v.id('catechists'),
    scoreColumnId: v.id('scoreColumns'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const entries = await ctx.db
      .query('scoreEntries')
      .withIndex('by_score_column_id', (q) =>
        q.eq('scoreColumnId', args.scoreColumnId),
      )
      .collect()
    return entries.filter((e) => !e.isDeleted)
  },
})

export const listStudentScores = query({
  args: {
    requesterId: v.id('catechists'),
    studentClassId: v.id('studentClasses'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const entries = await ctx.db
      .query('scoreEntries')
      .withIndex('by_student_class_id', (q) =>
        q.eq('studentClassId', args.studentClassId),
      )
      .collect()
    return entries.filter((e) => !e.isDeleted)
  },
})

export const listScoreEntryHistory = query({
  args: {
    requesterId: v.id('catechists'),
    scoreEntryId: v.id('scoreEntries'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const history = await ctx.db
      .query('scoreEntryHistories')
      .withIndex('by_score_entry_id', (q) =>
        q.eq('scoreEntryId', args.scoreEntryId),
      )
      .collect()

    const populated = await Promise.all(
      history.map(async (h) => {
        const catechist = await ctx.db.get('catechists', h.changedBy)
        const saint = catechist?.saintName ? catechist.saintName + ' ' : ''
        const fullName = catechist?.fullName ?? 'Unknown'
        return {
          ...h,
          changedByName: catechist ? `${saint}${fullName}` : 'Unknown',
        }
      }),
    )

    return populated.sort((a, b) => a.changedAt - b.changedAt)
  },
})

// ─── ScoreEntry Mutations ─────────────────────────────────────────────────────

async function resolveAcademicYearIdFromScoreEntry(
  ctx: QueryCtx | MutationCtx,
  scoreColumnId: Id<'scoreColumns'>,
  studentClassId: Id<'studentClasses'>,
) {
  const column = await ctx.db.get('scoreColumns', scoreColumnId)
  if (!column || column.isDeleted) {
    throw new Error(SCORE_ENTRY_ERRORS.COLUMN_NOT_FOUND)
  }
  const classYear = await ctx.db.get('classYears', column.classYearId)
  if (!classYear || classYear.isDeleted) {
    throw new Error(SCORE_ENTRY_ERRORS.COLUMN_NOT_FOUND)
  }
  const studentClass = await ctx.db.get('studentClasses', studentClassId)
  if (!studentClass || studentClass.isDeleted) {
    throw new Error(SCORE_ENTRY_ERRORS.NOT_FOUND)
  }
  return {
    academicYearId: classYear.academicYearId,
    classYearId: column.classYearId,
  }
}

export const upsertScoreEntry = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentClassId: v.id('studentClasses'),
    scoreColumnId: v.id('scoreColumns'),
    scoreValue: v.optional(v.number()),
    scoreLabel: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { academicYearId, classYearId } =
      await resolveAcademicYearIdFromScoreEntry(
        ctx,
        args.scoreColumnId,
        args.studentClassId,
      )

    await assertClassCatechistOrAbove(
      ctx,
      args.requesterId,
      academicYearId,
      classYearId,
    )

    const now = Date.now()
    const existing = await ctx.db
      .query('scoreEntries')
      .withIndex('by_student_class_id_and_score_column_id', (q) =>
        q
          .eq('studentClassId', args.studentClassId)
          .eq('scoreColumnId', args.scoreColumnId),
      )
      .first()

    if (existing && !existing.isDeleted) {
      const { requesterId, reason, ...fields } = args
      await ctx.db.patch('scoreEntries', existing._id, {
        scoreValue: fields.scoreValue,
        scoreLabel: fields.scoreLabel,
        updatedAt: now,
      })

      await ctx.db.insert('scoreEntryHistories', {
        scoreEntryId: existing._id,
        oldScoreValue: existing.scoreValue,
        newScoreValue: fields.scoreValue,
        oldScoreLabel: existing.scoreLabel,
        newScoreLabel: fields.scoreLabel,
        changedBy: args.requesterId,
        changedAt: now,
        reason: reason || undefined,
      })

      return existing._id
    }

    if (existing && existing.isDeleted) {
      const { requesterId, reason, ...fields } = args
      await ctx.db.patch('scoreEntries', existing._id, {
        scoreValue: fields.scoreValue,
        scoreLabel: fields.scoreLabel,
        enteredAt: now,
        updatedAt: undefined,
        isDeleted: false,
      })

      return existing._id
    }

    const { requesterId, reason, ...fields } = args
    const entryId = await ctx.db.insert('scoreEntries', {
      ...fields,
      enteredBy: args.requesterId,
      enteredAt: now,
      isDeleted: false,
    })
    return entryId
  },
})

export const softDeleteScoreEntry = mutation({
  args: {
    requesterId: v.id('catechists'),
    id: v.id('scoreEntries'),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get('scoreEntries', args.id)
    if (!entry || entry.isDeleted) {
      throw new Error(SCORE_ENTRY_ERRORS.NOT_FOUND)
    }

    const { academicYearId, classYearId } =
      await resolveAcademicYearIdFromScoreEntry(
        ctx,
        entry.scoreColumnId,
        entry.studentClassId,
      )

    await assertClassCatechistOrAbove(
      ctx,
      args.requesterId,
      academicYearId,
      classYearId,
    )

    await ctx.db.patch('scoreEntries', args.id, { isDeleted: true })
  },
})

// ─── SemesterResult Queries ──────────────────────────────────────────────────

export const getSemesterResult = query({
  args: {
    requesterId: v.id('catechists'),
    studentClassId: v.id('studentClasses'),
    semesterId: v.id('semesters'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const result = await ctx.db
      .query('semesterResults')
      .withIndex('by_student_class_id_and_semester_id', (q) =>
        q
          .eq('studentClassId', args.studentClassId)
          .eq('semesterId', args.semesterId),
      )
      .first()
    if (!result || result.isDeleted) return null
    return result
  },
})

export const listSemesterResults = query({
  args: {
    requesterId: v.id('catechists'),
    classYearId: v.id('classYears'),
    semesterId: v.id('semesters'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const studentClasses = await ctx.db
      .query('studentClasses')
      .withIndex('by_class_year_id', (q) =>
        q.eq('classYearId', args.classYearId),
      )
      .collect()

    const activeEnrollments = studentClasses.filter((sc) => !sc.isDeleted)
    const results = await Promise.all(
      activeEnrollments.map(async (sc) => {
        const result = await ctx.db
          .query('semesterResults')
          .withIndex('by_student_class_id_and_semester_id', (q) =>
            q.eq('studentClassId', sc._id).eq('semesterId', args.semesterId),
          )
          .first()
        return result && !result.isDeleted ? result : null
      }),
    )
    return results.filter((r): r is NonNullable<typeof r> => r !== null)
  },
})

export const listSemesterResultsByClassYear = query({
  args: {
    requesterId: v.id('catechists'),
    classYearId: v.id('classYears'),
  },
  handler: async (ctx, args): Promise<Array<Doc<'semesterResults'>>> => {
    await assertValidCatechist(ctx, args.requesterId)

    const studentClasses = await ctx.db
      .query('studentClasses')
      .withIndex('by_class_year_id', (q) =>
        q.eq('classYearId', args.classYearId),
      )
      .collect()

    const activeEnrollments = studentClasses.filter((sc) => !sc.isDeleted)
    const resultsByStudentClass = await Promise.all(
      activeEnrollments.map(async (sc) => {
        const results = await ctx.db
          .query('semesterResults')
          .withIndex('by_student_class_id_and_semester_id', (q) =>
            q.eq('studentClassId', sc._id),
          )
          .collect()
        return results.filter((r) => !r.isDeleted)
      }),
    )
    return resultsByStudentClass.flat()
  },
})

// ─── SemesterResult Mutations ────────────────────────────────────────────────

async function resolveClassYearIdFromStudentClass(
  ctx: QueryCtx | MutationCtx,
  studentClassId: Id<'studentClasses'>,
) {
  const studentClass = await ctx.db.get('studentClasses', studentClassId)
  if (!studentClass || studentClass.isDeleted) {
    throw new Error(SEMESTER_RESULT_ERRORS.NOT_FOUND)
  }
  const classYear = await ctx.db.get('classYears', studentClass.classYearId)
  if (!classYear || classYear.isDeleted) {
    throw new Error(SEMESTER_RESULT_ERRORS.NOT_FOUND)
  }
  return {
    academicYearId: classYear.academicYearId,
    classYearId: studentClass.classYearId,
  }
}

export const upsertSemesterResult = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentClassId: v.id('studentClasses'),
    semesterId: v.id('semesters'),
    morality: v.optional(
      v.union(
        v.literal('excellent'),
        v.literal('good'),
        v.literal('average'),
        v.literal('below_average'),
        v.literal('poor'),
      ),
    ),
    teacherNote: v.optional(v.string()),
    isCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { academicYearId, classYearId } =
      await resolveClassYearIdFromStudentClass(ctx, args.studentClassId)

    await assertClassCatechistOrAbove(
      ctx,
      args.requesterId,
      academicYearId,
      classYearId,
    )

    const now = Date.now()
    const existing = await ctx.db
      .query('semesterResults')
      .withIndex('by_student_class_id_and_semester_id', (q) =>
        q
          .eq('studentClassId', args.studentClassId)
          .eq('semesterId', args.semesterId),
      )
      .first()

    if (existing && !existing.isDeleted) {
      const { requesterId, ...fields } = args
      await ctx.db.patch('semesterResults', existing._id, {
        ...fields,
        recordedBy: args.requesterId,
        recordedAt: now,
      })
      return existing._id
    }

    if (existing && existing.isDeleted) {
      const { requesterId, ...fields } = args
      await ctx.db.patch('semesterResults', existing._id, {
        ...fields,
        recordedBy: args.requesterId,
        recordedAt: now,
        isDeleted: false,
      })
      return existing._id
    }

    const { requesterId, ...fields } = args
    const resultId = await ctx.db.insert('semesterResults', {
      ...fields,
      recordedBy: args.requesterId,
      recordedAt: now,
      isDeleted: false,
    })
    return resultId
  },
})

export const softDeleteSemesterResult = mutation({
  args: {
    requesterId: v.id('catechists'),
    id: v.id('semesterResults'),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db.get('semesterResults', args.id)
    if (!result || result.isDeleted) {
      throw new Error(SEMESTER_RESULT_ERRORS.NOT_FOUND)
    }

    const { academicYearId, classYearId } =
      await resolveClassYearIdFromStudentClass(ctx, result.studentClassId)

    await assertClassCatechistOrAbove(
      ctx,
      args.requesterId,
      academicYearId,
      classYearId,
    )

    await ctx.db.patch('semesterResults', args.id, { isDeleted: true })
  },
})

// ─── AnnualResult Queries ────────────────────────────────────────────────────

export const getAnnualResult = query({
  args: {
    requesterId: v.id('catechists'),
    studentClassId: v.id('studentClasses'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const result = await ctx.db
      .query('annualResults')
      .withIndex('by_student_class_id', (q) =>
        q.eq('studentClassId', args.studentClassId),
      )
      .first()
    if (!result || result.isDeleted) return null
    return result
  },
})

export const listAnnualResults = query({
  args: {
    requesterId: v.id('catechists'),
    classYearId: v.id('classYears'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const studentClasses = await ctx.db
      .query('studentClasses')
      .withIndex('by_class_year_id', (q) =>
        q.eq('classYearId', args.classYearId),
      )
      .collect()

    const activeEnrollments = studentClasses.filter((sc) => !sc.isDeleted)
    const results = await Promise.all(
      activeEnrollments.map(async (sc) => {
        const result = await ctx.db
          .query('annualResults')
          .withIndex('by_student_class_id', (q) =>
            q.eq('studentClassId', sc._id),
          )
          .first()
        return result && !result.isDeleted ? result : null
      }),
    )
    return results.filter((r): r is NonNullable<typeof r> => r !== null)
  },
})

// ─── AnnualResult Mutations ──────────────────────────────────────────────────

export const upsertAnnualResult = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentClassId: v.id('studentClasses'),
    conductGrade: v.optional(
      v.union(
        v.literal('excellent'),
        v.literal('good'),
        v.literal('average'),
        v.literal('below_average'),
        v.literal('poor'),
      ),
    ),
    remark: v.optional(v.string()),
    isCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { academicYearId, classYearId } =
      await resolveClassYearIdFromStudentClass(ctx, args.studentClassId)

    await assertClassCatechistOrAbove(
      ctx,
      args.requesterId,
      academicYearId,
      classYearId,
    )

    const now = Date.now()
    const existing = await ctx.db
      .query('annualResults')
      .withIndex('by_student_class_id', (q) =>
        q.eq('studentClassId', args.studentClassId),
      )
      .first()

    if (existing && !existing.isDeleted) {
      const { requesterId, ...fields } = args
      await ctx.db.patch('annualResults', existing._id, {
        ...fields,
        recordedBy: args.requesterId,
        recordedAt: now,
      })
      return existing._id
    }

    if (existing && existing.isDeleted) {
      const { requesterId, ...fields } = args
      await ctx.db.patch('annualResults', existing._id, {
        ...fields,
        recordedBy: args.requesterId,
        recordedAt: now,
        isDeleted: false,
      })
      return existing._id
    }

    const { requesterId, ...fields } = args
    const resultId = await ctx.db.insert('annualResults', {
      ...fields,
      recordedBy: args.requesterId,
      recordedAt: now,
      isDeleted: false,
    })
    return resultId
  },
})

export const softDeleteAnnualResult = mutation({
  args: {
    requesterId: v.id('catechists'),
    id: v.id('annualResults'),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db.get('annualResults', args.id)
    if (!result || result.isDeleted) {
      throw new Error(ANNUAL_RESULT_ERRORS.NOT_FOUND)
    }

    const { academicYearId, classYearId } =
      await resolveClassYearIdFromStudentClass(ctx, result.studentClassId)

    await assertClassCatechistOrAbove(
      ctx,
      args.requesterId,
      academicYearId,
      classYearId,
    )

    await ctx.db.patch('annualResults', args.id, { isDeleted: true })
  },
})

// ─── Grid Score APIs ─────────────────────────────────────────────────────────

export const getScoresGrid = query({
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
      return { students: [], scoreColumns: [], scoreEntriesMap: {} }
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

    // Fetch scoreColumns for this classYear
    const columns = await ctx.db
      .query('scoreColumns')
      .withIndex('by_class_year_id_and_semester_id', (q) =>
        q.eq('classYearId', classYear._id),
      )
      .collect()

    const activeColumns = columns
      .filter((c) => !c.isDeleted)
      .sort((a, b) => a.sortOrder - b.sortOrder)

    // Fetch score entries in parallel
    const scoreEntries = (
      await Promise.all(
        activeColumns.map((col) =>
          ctx.db
            .query('scoreEntries')
            .withIndex('by_score_column_id', (q) =>
              q.eq('scoreColumnId', col._id),
            )
            .collect(),
        ),
      )
    ).flat()

    const columnIds = new Set(activeColumns.map((c) => c._id))
    const scoreEntriesMap: Record<
      string,
      {
        _id: Id<'scoreEntries'>
        scoreValue?: number
        scoreLabel?: string
        enteredBy: Id<'catechists'>
        enteredAt: number
        updatedAt?: number
      }
    > = {}

    for (const entry of scoreEntries) {
      if (!entry.isDeleted && columnIds.has(entry.scoreColumnId)) {
        const key = `${entry.studentClassId}_${entry.scoreColumnId}`
        scoreEntriesMap[key] = {
          _id: entry._id,
          scoreValue: entry.scoreValue,
          scoreLabel: entry.scoreLabel,
          enteredBy: entry.enteredBy,
          enteredAt: entry.enteredAt,
          updatedAt: entry.updatedAt,
        }
      }
    }

    return {
      students,
      scoreColumns: activeColumns.map((c) => ({
        _id: c._id,
        semesterId: c.semesterId,
        columnName: c.columnName,
        columnType: c.columnType,
        scaleType: c.scaleType ?? 'scale_10',
        weight: c.weight ?? 1,
        examDate: c.examDate,
        sortOrder: c.sortOrder,
      })),
      scoreEntriesMap,
    }
  },
})

export const createColumnWithScores = mutation({
  args: {
    requesterId: v.id('catechists'),
    classYearId: v.id('classYears'),
    semesterId: v.id('semesters'),
    columnName: v.string(),
    columnType: v.string(),
    scaleType: v.optional(
      v.union(
        v.literal('scale_10'),
        v.literal('pass_fail'),
        v.literal('letter_af'),
      ),
    ),
    weight: v.optional(v.number()),
    examDate: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    scores: v.array(
      v.object({
        studentId: v.id('students'),
        scoreValue: v.optional(v.number()),
        scoreLabel: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const {
      requesterId,
      classYearId,
      semesterId,
      columnName,
      columnType,
      scaleType,
      weight,
      examDate,
      sortOrder,
      scores,
    } = args

    assertValidWeight(weight)

    const classYear = await ctx.db.get('classYears', classYearId)
    if (!classYear || classYear.isDeleted) {
      throw new Error(GRADING_ERRORS.CLASS_YEAR_NOT_FOUND)
    }
    const academicYearId = classYear.academicYearId

    const semester = await ctx.db.get('semesters', semesterId)
    if (!semester || semester.isDeleted) {
      throw new Error(GRADING_ERRORS.SEMESTER_NOT_FOUND)
    }

    // Auth check
    await assertClassCatechistOrAbove(
      ctx,
      requesterId,
      academicYearId,
      classYearId,
    )

    // Insert score column
    const scoreColumnId = await ctx.db.insert('scoreColumns', {
      classYearId,
      semesterId,
      columnName,
      columnType,
      scaleType: scaleType ?? 'scale_10',
      weight: weight ?? 1,
      examDate,
      sortOrder: sortOrder ?? 0,
      isDeleted: false,
    })

    const now = Date.now()
    const seenStudentIds = new Set<string>()

    for (const record of scores) {
      if (seenStudentIds.has(record.studentId)) {
        throw new Error(GRADING_ERRORS.DUPLICATE_STUDENT_IN_SCORES)
      }
      seenStudentIds.add(record.studentId)

      // Resolve studentClassId
      const studentClass = await ctx.db
        .query('studentClasses')
        .withIndex('by_student_id_and_class_year_id', (q) =>
          q.eq('studentId', record.studentId).eq('classYearId', classYearId),
        )
        .unique()

      if (
        !studentClass ||
        studentClass.isDeleted ||
        studentClass.status !== 'active'
      ) {
        throw new Error(GRADING_ERRORS.STUDENT_NOT_ENROLLED)
      }

      await ctx.db.insert('scoreEntries', {
        studentClassId: studentClass._id,
        scoreColumnId,
        scoreValue: record.scoreValue,
        scoreLabel: record.scoreLabel,
        enteredBy: requesterId,
        enteredAt: now,
        isDeleted: false,
      })
    }

    return scoreColumnId
  },
})

// ─── Grading Progress Dashboard Widget ──────────────────────────────────────

type GradingProgressRow = {
  classId: Id<'classes'>
  classYearId: Id<'classYears'>
  className: string
  scoreColumnId: Id<'scoreColumns'>
  columnName: string
  columnType: string
  semesterNumber: number
  enteredCount: number
  studentCount: number
}

type GradingProgressRowInternal = GradingProgressRow & { sortOrder: number }

async function buildClassGradingProgress(
  ctx: QueryCtx,
  classYearId: Id<'classYears'>,
): Promise<Array<GradingProgressRowInternal>> {
  const classYear = await ctx.db.get('classYears', classYearId)
  if (!classYear || classYear.isDeleted) return []

  const classRecord = await ctx.db.get('classes', classYear.classId)
  if (!classRecord || classRecord.isDeleted) return []

  // Active enrollments for this classYear
  const studentClasses = await ctx.db
    .query('studentClasses')
    .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYearId))
    .collect()

  const activeStudentClasses = studentClasses.filter(
    (sc) => !sc.isDeleted && sc.status === 'active',
  )
  const studentCount = activeStudentClasses.length

  // Nothing to grade for a classYear with no active students
  if (studentCount === 0) return []

  const activeStudentClassIds = new Set(
    activeStudentClasses.map((sc) => sc._id),
  )

  // Score columns for this classYear (partial-index query, all semesters)
  const columns = await ctx.db
    .query('scoreColumns')
    .withIndex('by_class_year_id_and_semester_id', (q) =>
      q.eq('classYearId', classYearId),
    )
    .collect()

  const activeColumns = columns.filter((c) => !c.isDeleted)

  const rows = await Promise.all(
    activeColumns.map(async (column) => {
      const entries = await ctx.db
        .query('scoreEntries')
        .withIndex('by_score_column_id', (q) =>
          q.eq('scoreColumnId', column._id),
        )
        .collect()

      const enteredCount = entries.filter(
        (e) =>
          !e.isDeleted &&
          activeStudentClassIds.has(e.studentClassId) &&
          (e.scoreValue !== undefined || e.scoreLabel !== undefined),
      ).length

      // Fully-graded columns are omitted entirely
      if (enteredCount >= studentCount) return null

      const semester = await ctx.db.get('semesters', column.semesterId)

      const row: GradingProgressRowInternal = {
        classId: classRecord._id,
        classYearId,
        className: classRecord.name,
        scoreColumnId: column._id,
        columnName: column.columnName,
        columnType: column.columnType,
        semesterNumber: semester?.semesterNumber ?? 0,
        enteredCount,
        studentCount,
        sortOrder: column.sortOrder,
      }
      return row
    }),
  )

  return rows.filter((r): r is GradingProgressRowInternal => r !== null)
}

export const getMyGradingProgress = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
  },
  handler: async (ctx, args): Promise<Array<GradingProgressRow>> => {
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

    const rows = (
      await Promise.all(
        [...classYearIds].map((classYearId) =>
          buildClassGradingProgress(ctx, classYearId),
        ),
      )
    ).flat()

    rows.sort((a, b) => {
      const classNameCompare = a.className.localeCompare(b.className)
      if (classNameCompare !== 0) return classNameCompare
      if (a.semesterNumber !== b.semesterNumber) {
        return a.semesterNumber - b.semesterNumber
      }
      return a.sortOrder - b.sortOrder
    })

    return rows.map((row) => {
      const { sortOrder, ...rest } = row
      void sortOrder
      return rest
    })
  },
})
