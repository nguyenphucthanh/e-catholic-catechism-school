import { v } from 'convex/values'
import { mutation, query } from '../_generated/server'
import {
  assertCanManageProgram,
  assertValidCatechist,
  assertValidStudent,
  getEffectivePermissions,
  requireActiveAcademicYear,
} from '../lib/authz'
import { EXTRACURRICULAR_ERRORS } from '../lib/errors'
import { getProgramStatus } from '../lib/programStatus'
import { getStudentPrimaryClass } from '../lib/studentClassLookup'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

function buildEventDescription(title: string, detailsJsonStr: string): string {
  try {
    const details = JSON.parse(detailsJsonStr)
    const titleNode = {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: title }],
    }
    if (details && details.type === 'doc' && Array.isArray(details.content)) {
      return JSON.stringify({
        type: 'doc',
        content: [titleNode, ...details.content],
      })
    }
  } catch (e) {
    // Ignore and fallback
  }
  return JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: title }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: detailsJsonStr }],
      },
    ],
  })
}

function resolveCalendarScope(branches: Array<Id<'branches'>>): {
  scope: 'board' | 'branch'
  branchId?: Id<'branches'>
} {
  if (branches.length === 1) {
    return { scope: 'branch', branchId: branches[0] }
  }
  return { scope: 'board' }
}

async function syncCalendarEvent(
  ctx: MutationCtx,
  params: {
    existingCalendarEventId?: Id<'calendarEvents'>
    academicYearId: Id<'academicYears'>
    dateStart: string
    dateEnd: string
    title: string
    details: string
    branches: Array<Id<'branches'>>
    requesterId: Id<'catechists'>
  },
): Promise<Id<'calendarEvents'>> {
  const scopeFields = resolveCalendarScope(params.branches)
  const description = buildEventDescription(params.title, params.details)

  if (params.existingCalendarEventId) {
    await ctx.db.patch('calendarEvents', params.existingCalendarEventId, {
      date: params.dateStart,
      endDate: params.dateEnd,
      description,
      scope: scopeFields.scope,
      branchId: scopeFields.branchId,
      updatedBy: params.requesterId,
      updatedAt: Date.now(),
    })
    return params.existingCalendarEventId
  }

  return await ctx.db.insert('calendarEvents', {
    academicYearId: params.academicYearId,
    date: params.dateStart,
    endDate: params.dateEnd,
    description,
    severity: 'medium',
    scope: scopeFields.scope,
    branchId: scopeFields.branchId,
    createdBy: params.requesterId,
    createdAt: Date.now(),
    isDeleted: false,
  })
}

export const listPrograms = query({
  args: {
    academicYearId: v.id('academicYears'),
    requesterId: v.id('catechists'),
    search: v.optional(v.string()),
    branch: v.optional(v.id('branches')),
    target: v.optional(
      v.union(v.literal('catechist'), v.literal('student'), v.literal('all')),
    ),
    status: v.optional(
      v.union(v.literal('upcoming'), v.literal('active'), v.literal('past')),
    ),
    hasFee: v.optional(v.boolean()),
    sortBy: v.optional(
      v.union(v.literal('title'), v.literal('dateStart'), v.literal('count')),
    ),
    sortOrder: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    // Get all programs for this academic year
    let programs = await ctx.db
      .query('extracurricularPrograms')
      .withIndex('by_academic_year_id', (q) =>
        q.eq('academicYearId', args.academicYearId),
      )
      .collect()

    programs = programs.filter((p) => !p.isDeleted)

    // Filter by search
    if (args.search) {
      const searchLower = args.search.toLowerCase()
      programs = programs.filter((p) =>
        p.title.toLowerCase().includes(searchLower),
      )
    }

    // Filter by branch
    if (args.branch !== undefined) {
      programs = programs.filter((p) => p.branches.includes(args.branch!))
    }

    // Filter by target
    if (args.target) {
      programs = programs.filter(
        (p) => p.target === args.target || p.target === 'all',
      )
    }

    // Filter by status
    if (args.status) {
      const today = new Date().toISOString().split('T')[0]
      programs = programs.filter(
        (p) => getProgramStatus(p.dateStart, p.dateEnd, today) === args.status,
      )
    }

    // Filter by has_fee
    if (args.hasFee !== undefined) {
      programs = programs.filter((p) => p.feeRequired === args.hasFee)
    }

    // Sort
    const sortBy = args.sortBy || 'dateStart'
    const sortOrder = args.sortOrder || 'asc'
    const isAsc = sortOrder === 'asc'

    if (sortBy === 'title') {
      programs.sort((a, b) =>
        isAsc ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title),
      )
    } else if (sortBy === 'dateStart') {
      programs.sort((a, b) =>
        isAsc
          ? a.dateStart.localeCompare(b.dateStart)
          : b.dateStart.localeCompare(a.dateStart),
      )
    }

    // Get enrollment counts
    const results = await Promise.all(
      programs.map(async (p) => {
        const enrollments = await ctx.db
          .query('extracurricularEnrollments')
          .withIndex('by_program_id', (q) => q.eq('programId', p._id))
          .collect()
        const enrollmentCount = enrollments.filter((e) => !e.isDeleted).length

        return {
          ...p,
          enrollmentCount,
        }
      }),
    )

    // Sort by enrollment count if requested
    if (sortBy === 'count') {
      results.sort((a, b) =>
        isAsc
          ? a.enrollmentCount - b.enrollmentCount
          : b.enrollmentCount - a.enrollmentCount,
      )
    }

    return results
  },
})

export const getProgramDetail = query({
  args: {
    programId: v.id('extracurricularPrograms'),
    requesterId: v.optional(v.id('catechists')),
    studentRequesterId: v.optional(v.id('students')),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get('extracurricularPrograms', args.programId)
    if (!program || program.isDeleted) {
      throw new Error(EXTRACURRICULAR_ERRORS.NOT_FOUND)
    }

    // Get enrollment count
    const enrollments = await ctx.db
      .query('extracurricularEnrollments')
      .withIndex('by_program_id', (q) => q.eq('programId', args.programId))
      .collect()
    const enrollmentCount = enrollments.filter((e) => !e.isDeleted).length

    // Check user's enrollment status if provided
    let userEnrolled = false
    let userTokenIdentifier: string | null = null

    if (args.requesterId) {
      const catechist = await assertValidCatechist(ctx, args.requesterId)
      const identity = await ctx.auth.getUserIdentity()
      userTokenIdentifier =
        identity?.tokenIdentifier ||
        catechist.tokenIdentifier ||
        String(catechist._id)

      userEnrolled = enrollments.some(
        (e) => !e.isDeleted && e.tokenIdentifier === userTokenIdentifier,
      )

      // Valid catechist can view details of non-deleted program
    } else if (args.studentRequesterId) {
      const studentId = args.studentRequesterId
      const student = await assertValidStudent(ctx, studentId)
      const identity = await ctx.auth.getUserIdentity()
      userTokenIdentifier =
        identity?.tokenIdentifier ||
        student.tokenIdentifier ||
        String(student._id)

      userEnrolled = enrollments.some(
        (e) => !e.isDeleted && e.tokenIdentifier === userTokenIdentifier,
      )

      // Visibility check for student
      if (program.target === 'catechist') {
        throw new Error(EXTRACURRICULAR_ERRORS.UNAUTHORIZED)
      }

      // Branch eligibility check for student
      const classRecord = await getStudentPrimaryClass(
        ctx,
        studentId,
        program.academicYearId,
      )
      if (!classRecord) {
        throw new Error(EXTRACURRICULAR_ERRORS.UNAUTHORIZED)
      }
      if (
        program.branches.length > 0 &&
        !program.branches.includes(classRecord.branchId)
      ) {
        throw new Error(EXTRACURRICULAR_ERRORS.UNAUTHORIZED)
      }
    }

    return {
      ...program,
      enrollmentCount,
      userEnrolled,
      userTokenIdentifier,
    }
  },
})

export const createProgram = mutation({
  args: {
    requesterId: v.id('catechists'),
    title: v.string(),
    details: v.string(),
    target: v.union(
      v.literal('catechist'),
      v.literal('student'),
      v.literal('all'),
    ),
    branches: v.array(v.id('branches')),
    inChargeCatechists: v.optional(v.array(v.id('catechists'))),
    dateStart: v.string(),
    dateEnd: v.string(),
    enrollmentExpireDate: v.string(),
    feeRequired: v.boolean(),
    feeAmount: v.optional(v.number()),
    maxCapacity: v.optional(v.number()),
    links: v.optional(
      v.array(
        v.object({
          type: v.union(v.literal('social'), v.literal('im')),
          label: v.string(),
          url: v.string(),
          forEnrolledOnly: v.boolean(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    // Get active academic year
    const academicYearId = await requireActiveAcademicYear(
      ctx,
      EXTRACURRICULAR_ERRORS.INACTIVE_ACADEMIC_YEAR,
    )

    // Check permission — admin, board member, or branch head of the active year
    const perms = await getEffectivePermissions(
      ctx,
      args.requesterId,
      academicYearId,
    )
    if (!perms.isAdmin && !perms.isBoardMember) {
      const isBranchHead =
        perms.branchHeadOf.length > 0 &&
        (args.branches.length === 0 ||
          args.branches.some((b) => perms.branchHeadOf.includes(b)))
      if (!isBranchHead) {
        throw new Error(EXTRACURRICULAR_ERRORS.UNAUTHORIZED)
      }
    }

    // Validate dates
    if (args.dateStart > args.dateEnd) {
      throw new Error(EXTRACURRICULAR_ERRORS.INVALID_DATE_RANGE)
    }
    if (args.enrollmentExpireDate > args.dateEnd) {
      throw new Error(EXTRACURRICULAR_ERRORS.INVALID_ENROLLMENT_DATE)
    }

    const calendarEventId = await syncCalendarEvent(ctx, {
      academicYearId,
      dateStart: args.dateStart,
      dateEnd: args.dateEnd,
      title: args.title,
      details: args.details,
      branches: args.branches,
      requesterId: args.requesterId,
    })

    return await ctx.db.insert('extracurricularPrograms', {
      academicYearId,
      title: args.title,
      details: args.details,
      target: args.target,
      branches: args.branches,
      inChargeCatechists: args.inChargeCatechists ?? [],
      dateStart: args.dateStart,
      dateEnd: args.dateEnd,
      enrollmentExpireDate: args.enrollmentExpireDate,
      feeRequired: args.feeRequired,
      feeAmount: args.feeAmount,
      maxCapacity: args.maxCapacity,
      links: args.links,
      createdBy: args.requesterId,
      createdAt: Date.now(),
      calendarEventId,
      isDeleted: false,
    })
  },
})

export const updateProgram = mutation({
  args: {
    programId: v.id('extracurricularPrograms'),
    requesterId: v.id('catechists'),
    title: v.optional(v.string()),
    details: v.optional(v.string()),
    target: v.optional(
      v.union(v.literal('catechist'), v.literal('student'), v.literal('all')),
    ),
    branches: v.optional(v.array(v.id('branches'))),
    inChargeCatechists: v.optional(v.array(v.id('catechists'))),
    dateStart: v.optional(v.string()),
    dateEnd: v.optional(v.string()),
    enrollmentExpireDate: v.optional(v.string()),
    feeRequired: v.optional(v.boolean()),
    feeAmount: v.optional(v.number()),
    maxCapacity: v.optional(v.number()),
    links: v.optional(
      v.array(
        v.object({
          type: v.union(v.literal('social'), v.literal('im')),
          label: v.string(),
          url: v.string(),
          forEnrolledOnly: v.boolean(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const program = await ctx.db.get('extracurricularPrograms', args.programId)
    if (!program || program.isDeleted) {
      throw new Error(EXTRACURRICULAR_ERRORS.NOT_FOUND)
    }

    await assertCanManageProgram(ctx, program, args.requesterId)

    // Check active academic year
    const academicYear = await ctx.db.get(
      'academicYears',
      program.academicYearId,
    )
    if (!academicYear || !academicYear.isActive) {
      throw new Error(EXTRACURRICULAR_ERRORS.INACTIVE_ACADEMIC_YEAR)
    }

    // Validate date constraints if updating dates
    const dateStart = args.dateStart || program.dateStart
    const dateEnd = args.dateEnd || program.dateEnd
    const enrollmentExpireDate =
      args.enrollmentExpireDate || program.enrollmentExpireDate

    if (args.dateStart) {
      const today = new Date().toISOString().split('T')[0]
      if (args.dateStart < today) {
        throw new Error(EXTRACURRICULAR_ERRORS.PAST_START_DATE)
      }
    }

    if (dateStart > dateEnd) {
      throw new Error(EXTRACURRICULAR_ERRORS.INVALID_DATE_RANGE)
    }
    if (enrollmentExpireDate > dateEnd) {
      throw new Error(EXTRACURRICULAR_ERRORS.INVALID_ENROLLMENT_DATE)
    }

    // Check capacity constraint
    if (args.maxCapacity !== undefined) {
      const enrollments = await ctx.db
        .query('extracurricularEnrollments')
        .withIndex('by_program_id', (q) => q.eq('programId', args.programId))
        .collect()
      const enrollmentCount = enrollments.filter((e) => !e.isDeleted).length

      if (args.maxCapacity < enrollmentCount) {
        throw new Error(EXTRACURRICULAR_ERRORS.CAPACITY_BELOW_ENROLLED)
      }
    }

    const title = args.title !== undefined ? args.title : program.title
    const details = args.details !== undefined ? args.details : program.details
    const branches =
      args.branches !== undefined ? args.branches : program.branches

    const calendarEventId = await syncCalendarEvent(ctx, {
      existingCalendarEventId: program.calendarEventId,
      academicYearId: program.academicYearId,
      dateStart,
      dateEnd,
      title,
      details,
      branches,
      requesterId: args.requesterId,
    })

    const patch: Record<string, unknown> = {}
    if (args.title !== undefined) patch.title = args.title
    if (args.details !== undefined) patch.details = args.details
    if (args.target !== undefined) patch.target = args.target
    if (args.branches !== undefined) patch.branches = args.branches
    if (args.inChargeCatechists !== undefined)
      patch.inChargeCatechists = args.inChargeCatechists
    if (args.dateStart !== undefined) patch.dateStart = args.dateStart
    if (args.dateEnd !== undefined) patch.dateEnd = args.dateEnd
    if (args.enrollmentExpireDate !== undefined)
      patch.enrollmentExpireDate = args.enrollmentExpireDate
    if (args.feeRequired !== undefined) patch.feeRequired = args.feeRequired
    if (args.feeAmount !== undefined) patch.feeAmount = args.feeAmount
    if (args.maxCapacity !== undefined) patch.maxCapacity = args.maxCapacity
    if (args.links !== undefined) patch.links = args.links
    patch.calendarEventId = calendarEventId

    await ctx.db.patch('extracurricularPrograms', args.programId, patch)
  },
})

export const deleteProgram = mutation({
  args: {
    programId: v.id('extracurricularPrograms'),
    requesterId: v.id('catechists'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const program = await ctx.db.get('extracurricularPrograms', args.programId)
    if (!program || program.isDeleted) {
      throw new Error(EXTRACURRICULAR_ERRORS.NOT_FOUND)
    }

    await assertCanManageProgram(ctx, program, args.requesterId)

    // Check active academic year
    const academicYear = await ctx.db.get(
      'academicYears',
      program.academicYearId,
    )
    if (!academicYear || !academicYear.isActive) {
      throw new Error(EXTRACURRICULAR_ERRORS.INACTIVE_ACADEMIC_YEAR)
    }

    // Soft delete
    await ctx.db.patch('extracurricularPrograms', args.programId, {
      isDeleted: true,
    })

    if (program.calendarEventId) {
      await ctx.db.patch('calendarEvents', program.calendarEventId, {
        isDeleted: true,
        updatedBy: args.requesterId,
        updatedAt: Date.now(),
      })
    }
  },
})
