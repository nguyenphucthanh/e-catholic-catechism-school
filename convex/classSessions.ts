import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  assertBoardMemberOrAdmin,
  assertHomeroomCatechistOrAbove,
  assertValidCatechist,
} from './lib/authz'
import { CLASS_SESSION_ERRORS } from './lib/errors'
import type { Id } from './_generated/dataModel'

// ─── Queries ──────────────────────────────────────────────────────────────

export const list = query({
  args: {
    requesterId: v.id('catechists'),
    classYearId: v.optional(v.id('classYears')),
    sessionType: v.optional(
      v.union(
        v.literal('mass'),
        v.literal('catechism'),
        v.literal('supplemental'),
        v.literal('extracurricular'),
      ),
    ),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    let sessions = await ctx.db
      .query('classSessions')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()

    if (args.classYearId) {
      sessions = sessions.filter((s) => s.classYearId === args.classYearId)
    }

    if (args.sessionType) {
      sessions = sessions.filter((s) => s.sessionType === args.sessionType)
    }

    const { dateFrom, dateTo } = args
    if (dateFrom) {
      sessions = sessions.filter((s) => s.sessionDate >= dateFrom)
    }

    if (dateTo) {
      sessions = sessions.filter((s) => s.sessionDate <= dateTo)
    }

    return sessions
  },
})

export const get = query({
  args: {
    requesterId: v.id('catechists'),
    id: v.id('classSessions'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const session = await ctx.db.get('classSessions', args.id)
    if (!session || session.isDeleted) return null
    return session
  },
})

// ─── Mutations ────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    requesterId: v.id('catechists'),
    classYearId: v.optional(v.id('classYears')),
    semesterId: v.optional(v.id('semesters')),
    sessionDate: v.string(),
    sessionType: v.union(
      v.literal('mass'),
      v.literal('catechism'),
      v.literal('supplemental'),
      v.literal('extracurricular'),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const {
      requesterId,
      classYearId,
      semesterId,
      sessionType,
      sessionDate,
      notes,
    } = args
    let academicYearId: Id<'academicYears'>

    if (sessionType === 'catechism' || sessionType === 'supplemental') {
      if (!classYearId || !semesterId) {
        throw new Error(CLASS_SESSION_ERRORS.INVALID_SCOPE)
      }

      const classYear = await ctx.db.get('classYears', classYearId)
      if (!classYear || classYear.isDeleted) {
        throw new Error(CLASS_SESSION_ERRORS.CLASS_YEAR_NOT_FOUND)
      }
      academicYearId = classYear.academicYearId

      const semester = await ctx.db.get('semesters', semesterId)
      if (!semester || semester.isDeleted) {
        throw new Error(CLASS_SESSION_ERRORS.SEMESTER_NOT_FOUND)
      }
    } else {
      // mass or extracurricular — parish-scoped
      const activeYears = await ctx.db
        .query('academicYears')
        .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
        .collect()
      const activeYear = activeYears.find((y) => y.isActive)

      if (!activeYear) {
        throw new Error(CLASS_SESSION_ERRORS.NO_ACTIVE_YEAR)
      }
      academicYearId = activeYear._id
    }

    // Active year guard
    const academicYear = await ctx.db.get('academicYears', academicYearId)
    if (!academicYear || academicYear.isDeleted) {
      throw new Error('Academic year not found')
    }
    if (!academicYear.isActive) {
      throw new Error(CLASS_SESSION_ERRORS.INACTIVE_ACADEMIC_YEAR)
    }

    // Auth check
    if (classYearId) {
      await assertHomeroomCatechistOrAbove(
        ctx,
        requesterId,
        academicYearId,
        classYearId,
      )
    } else {
      await assertBoardMemberOrAdmin(ctx, requesterId, academicYearId)
    }

    return await ctx.db.insert('classSessions', {
      classYearId,
      semesterId,
      academicYearId:
        sessionType === 'mass' || sessionType === 'extracurricular'
          ? academicYearId
          : undefined,
      sessionDate,
      sessionType,
      isCancelled: false,
      notes,
      isDeleted: false,
    })
  },
})

export const update = mutation({
  args: {
    requesterId: v.id('catechists'),
    sessionId: v.id('classSessions'),
    sessionDate: v.optional(v.string()),
    sessionType: v.optional(
      v.union(
        v.literal('mass'),
        v.literal('catechism'),
        v.literal('supplemental'),
        v.literal('extracurricular'),
      ),
    ),
    isCancelled: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { requesterId, sessionId, ...fields } = args

    const session = await ctx.db.get('classSessions', sessionId)
    if (!session || session.isDeleted) {
      throw new Error(CLASS_SESSION_ERRORS.NOT_FOUND)
    }

    // Resolve academicYearId from session itself
    let academicYearId: Id<'academicYears'>
    if (session.classYearId) {
      const classYear = await ctx.db.get('classYears', session.classYearId)
      if (!classYear || classYear.isDeleted) {
        throw new Error(CLASS_SESSION_ERRORS.CLASS_YEAR_NOT_FOUND)
      }
      academicYearId = classYear.academicYearId
    } else if (session.academicYearId) {
      academicYearId = session.academicYearId
    } else {
      throw new Error('Session has no academic year reference')
    }

    // Active year guard
    const academicYear = await ctx.db.get('academicYears', academicYearId)
    if (!academicYear || academicYear.isDeleted) {
      throw new Error('Academic year not found')
    }
    if (!academicYear.isActive) {
      throw new Error(CLASS_SESSION_ERRORS.INACTIVE_ACADEMIC_YEAR)
    }

    // Auth check
    if (session.classYearId) {
      await assertHomeroomCatechistOrAbove(
        ctx,
        requesterId,
        academicYearId,
        session.classYearId,
      )
    } else {
      await assertBoardMemberOrAdmin(ctx, requesterId, academicYearId)
    }

    const patch: Record<string, unknown> = {}
    if (fields.sessionDate !== undefined) patch.sessionDate = fields.sessionDate
    if (fields.sessionType !== undefined) patch.sessionType = fields.sessionType
    if (fields.isCancelled !== undefined) patch.isCancelled = fields.isCancelled
    if (fields.notes !== undefined) patch.notes = fields.notes

    await ctx.db.patch('classSessions', sessionId, patch)
  },
})

export const softDelete = mutation({
  args: {
    requesterId: v.id('catechists'),
    sessionId: v.id('classSessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get('classSessions', args.sessionId)
    if (!session || session.isDeleted) {
      throw new Error(CLASS_SESSION_ERRORS.NOT_FOUND)
    }

    let academicYearId: Id<'academicYears'>
    if (session.classYearId) {
      const classYear = await ctx.db.get('classYears', session.classYearId)
      if (!classYear || classYear.isDeleted) {
        throw new Error(CLASS_SESSION_ERRORS.CLASS_YEAR_NOT_FOUND)
      }
      academicYearId = classYear.academicYearId
    } else if (session.academicYearId) {
      academicYearId = session.academicYearId
    } else {
      throw new Error('Session has no academic year reference')
    }

    const academicYear = await ctx.db.get('academicYears', academicYearId)
    if (!academicYear || academicYear.isDeleted) {
      throw new Error('Academic year not found')
    }
    if (!academicYear.isActive) {
      throw new Error(CLASS_SESSION_ERRORS.INACTIVE_ACADEMIC_YEAR)
    }

    if (session.classYearId) {
      await assertHomeroomCatechistOrAbove(
        ctx,
        args.requesterId,
        academicYearId,
        session.classYearId,
      )
    } else {
      await assertBoardMemberOrAdmin(ctx, args.requesterId, academicYearId)
    }

    await ctx.db.patch('classSessions', args.sessionId, {
      isDeleted: true,
    })
  },
})
