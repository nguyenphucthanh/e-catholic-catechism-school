import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  assertAdminRole,
  assertHomeroomCatechistOrAbove,
  assertValidCatechist,
} from './lib/authz'
import {
  ANNUAL_RESULT_ERRORS,
  SCORE_COLUMN_ERRORS,
  SCORE_ENTRY_ERRORS,
  SEMESTER_RESULT_ERRORS,
} from './lib/errors'
import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

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
    columnType: v.union(
      v.literal('short_quiz'),
      v.literal('midterm_test'),
      v.literal('semester_exam'),
    ),
    scaleType: v.optional(
      v.union(
        v.literal('scale_10'),
        v.literal('pass_fail'),
        v.literal('letter_af'),
      ),
    ),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const { requesterId, ...fields } = args
    const columnId = await ctx.db.insert('scoreColumns', {
      ...fields,
      scaleType: fields.scaleType ?? 'scale_10',
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
    columnType: v.optional(
      v.union(
        v.literal('short_quiz'),
        v.literal('midterm_test'),
        v.literal('semester_exam'),
      ),
    ),
    scaleType: v.optional(
      v.union(
        v.literal('scale_10'),
        v.literal('pass_fail'),
        v.literal('letter_af'),
      ),
    ),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const column = await ctx.db.get('scoreColumns', args.id)
    if (!column || column.isDeleted) {
      throw new Error(SCORE_COLUMN_ERRORS.NOT_FOUND)
    }

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
    await assertAdminRole(ctx, args.requesterId)

    const column = await ctx.db.get('scoreColumns', args.id)
    if (!column || column.isDeleted) {
      throw new Error(SCORE_COLUMN_ERRORS.NOT_FOUND)
    }

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
    return history.sort((a, b) => a.changedAt - b.changedAt)
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
  },
  handler: async (ctx, args) => {
    const { academicYearId, classYearId } =
      await resolveAcademicYearIdFromScoreEntry(
        ctx,
        args.scoreColumnId,
        args.studentClassId,
      )

    await assertHomeroomCatechistOrAbove(
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
      const { requesterId, ...fields } = args
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
      })

      return existing._id
    }

    if (existing && existing.isDeleted) {
      const { requesterId, ...fields } = args
      await ctx.db.patch('scoreEntries', existing._id, {
        scoreValue: fields.scoreValue,
        scoreLabel: fields.scoreLabel,
        enteredAt: now,
        updatedAt: undefined,
        isDeleted: false,
      })

      return existing._id
    }

    const { requesterId, ...fields } = args
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

    await assertHomeroomCatechistOrAbove(
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
      .withIndex('by_class_year_id', (q) => q.eq('classYearId', args.classYearId))
      .collect()

    const activeEnrollments = studentClasses.filter((sc) => !sc.isDeleted)
    const results = await Promise.all(
      activeEnrollments.map(async (sc) => {
        const result = await ctx.db
          .query('semesterResults')
          .withIndex('by_student_class_id_and_semester_id', (q) =>
            q
              .eq('studentClassId', sc._id)
              .eq('semesterId', args.semesterId),
          )
          .first()
        return result && !result.isDeleted ? result : null
      }),
    )
    return results.filter((r): r is NonNullable<typeof r> => r !== null)
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

    await assertHomeroomCatechistOrAbove(
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

    await assertHomeroomCatechistOrAbove(
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
      .withIndex('by_class_year_id', (q) => q.eq('classYearId', args.classYearId))
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

    await assertHomeroomCatechistOrAbove(
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

    await assertHomeroomCatechistOrAbove(
      ctx,
      args.requesterId,
      academicYearId,
      classYearId,
    )

    await ctx.db.patch('annualResults', args.id, { isDeleted: true })
  },
})
