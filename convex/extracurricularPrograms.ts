import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  assertValidCatechist,
  assertValidStudent,
  getActiveAcademicYear,
  getEffectivePermissions,
  requireActiveAcademicYear,
} from './lib/authz'
import { EXTRACURRICULAR_ERRORS } from './lib/errors'
import type { Id } from './_generated/dataModel'
// Typing for the database operations

// ─── Queries ──────────────────────────────────────────────────────────────

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
      programs = programs.filter((p) => {
        if (args.status === 'upcoming') return p.dateStart > today
        if (args.status === 'active')
          return p.dateStart <= today && today <= p.dateEnd
        if (args.status === 'past') return p.dateEnd < today
        return false
      })
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
      // Student can see student or all programs - verify branch eligibility
      const studentClasses = await ctx.db
        .query('studentClasses')
        .withIndex('by_student_id_and_is_primary_class', (q) =>
          q.eq('studentId', studentId).eq('isPrimaryClass', true),
        )
        .collect()
      const primaryClass = studentClasses.find((sc) => !sc.isDeleted)
      if (!primaryClass) {
        throw new Error(EXTRACURRICULAR_ERRORS.UNAUTHORIZED)
      }
      const classYear = await ctx.db.get('classYears', primaryClass.classYearId)
      if (!classYear || classYear.isDeleted) {
        throw new Error(EXTRACURRICULAR_ERRORS.UNAUTHORIZED)
      }
      const classRecord = await ctx.db.get('classes', classYear.classId)
      if (!classRecord || classRecord.isDeleted) {
        throw new Error(EXTRACURRICULAR_ERRORS.UNAUTHORIZED)
      }
      const hasEligibleBranch = program.branches.includes(classRecord.branchId)
      if (!hasEligibleBranch && program.branches.length > 0) {
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

export const listEligiblePrograms = query({
  args: {
    studentRequesterId: v.id('students'),
  },
  handler: async (ctx, args) => {
    const student = await assertValidStudent(ctx, args.studentRequesterId)
    const identity = await ctx.auth.getUserIdentity()
    const tokenIdentifier =
      identity?.tokenIdentifier ||
      student.tokenIdentifier ||
      String(student._id)

    const academicYearId = await getActiveAcademicYear(ctx)
    if (!academicYearId) return []

    // Determine student's branch (mirrors enrollProgram's branch eligibility check)
    const primaryClass = await ctx.db
      .query('studentClasses')
      .withIndex('by_student_id_and_is_primary_class', (q) =>
        q.eq('studentId', args.studentRequesterId).eq('isPrimaryClass', true),
      )
      .unique()

    let branchId = null
    if (primaryClass && !primaryClass.isDeleted) {
      const classYear = await ctx.db.get('classYears', primaryClass.classYearId)
      if (classYear && !classYear.isDeleted) {
        const classRecord = await ctx.db.get('classes', classYear.classId)
        if (classRecord && !classRecord.isDeleted) {
          branchId = classRecord.branchId
        }
      }
    }

    const programs = (
      await ctx.db
        .query('extracurricularPrograms')
        .withIndex('by_academic_year_id', (q) =>
          q.eq('academicYearId', academicYearId),
        )
        .collect()
    ).filter(
      (p) =>
        !p.isDeleted &&
        (p.target === 'student' || p.target === 'all') &&
        (p.branches.length === 0 ||
          (branchId !== null && p.branches.includes(branchId))),
    )

    return await Promise.all(
      programs.map(async (p) => {
        const enrollments = await ctx.db
          .query('extracurricularEnrollments')
          .withIndex('by_program_id', (q) => q.eq('programId', p._id))
          .collect()
        const activeEnrollments = enrollments.filter((e) => !e.isDeleted)

        return {
          ...p,
          enrollmentCount: activeEnrollments.length,
          userEnrolled: activeEnrollments.some(
            (e) => e.tokenIdentifier === tokenIdentifier,
          ),
        }
      }),
    )
  },
})

export const getEnrollments = query({
  args: {
    programId: v.id('extracurricularPrograms'),
    requesterId: v.id('catechists'),
  },
  handler: async (ctx, args) => {
    const catechist = await assertValidCatechist(ctx, args.requesterId)

    const program = await ctx.db.get('extracurricularPrograms', args.programId)
    if (!program || program.isDeleted) {
      throw new Error(EXTRACURRICULAR_ERRORS.NOT_FOUND)
    }

    // Check admin, board member, or branch head permission
    if (catechist.role !== 'admin') {
      const perms = await getEffectivePermissions(
        ctx,
        args.requesterId,
        program.academicYearId,
      )
      const isBranchHead = program.branches.some((b) =>
        perms.branchHeadOf.includes(b),
      )
      if (!perms.isBoardMember && !isBranchHead) {
        throw new Error(EXTRACURRICULAR_ERRORS.UNAUTHORIZED)
      }
    }

    // Get enrollments
    const enrollments = await ctx.db
      .query('extracurricularEnrollments')
      .withIndex('by_program_id', (q) => q.eq('programId', args.programId))
      .collect()

    const activeEnrollments = enrollments.filter((e) => !e.isDeleted)

    const result = await Promise.all(
      activeEnrollments.map(async (e) => {
        // 1. Check catechist by tokenIdentifier
        let catechistUser = await ctx.db
          .query('catechists')
          .withIndex('by_token_identifier', (q) =>
            q.eq('tokenIdentifier', e.tokenIdentifier),
          )
          .first()

        if (!catechistUser) {
          try {
            const catechistDoc = await ctx.db.get(
              'catechists',
              e.tokenIdentifier as Id<'catechists'>,
            )
            if (catechistDoc && !catechistDoc.isDeleted) {
              catechistUser = catechistDoc
            }
          } catch {
            // Ignore invalid ID format
          }
        }

        if (catechistUser && !catechistUser.isDeleted) {
          return {
            ...e,
            userType: 'catechist' as const,
            userInfo: {
              saintName: catechistUser.saintName,
              fullName: catechistUser.fullName,
              code: catechistUser.memberId,
              gender: catechistUser.gender,
              profilePhotoStorageId: catechistUser.profilePhotoStorageId,
            },
          }
        }

        // 2. Check student by tokenIdentifier
        let studentUser = await ctx.db
          .query('students')
          .withIndex('by_token_identifier', (q) =>
            q.eq('tokenIdentifier', e.tokenIdentifier),
          )
          .first()

        if (!studentUser) {
          try {
            const studentDoc = await ctx.db.get(
              'students',
              e.tokenIdentifier as Id<'students'>,
            )
            if (studentDoc && !studentDoc.isDeleted) {
              studentUser = studentDoc
            }
          } catch {
            // Ignore invalid ID format
          }
        }

        if (studentUser && !studentUser.isDeleted) {
          let className: string | undefined = undefined
          const primaryClass = await ctx.db
            .query('studentClasses')
            .withIndex('by_student_id_and_is_primary_class', (q) =>
              q.eq('studentId', studentUser._id).eq('isPrimaryClass', true),
            )
            .first()

          if (primaryClass && !primaryClass.isDeleted) {
            const classYear = await ctx.db.get(
              'classYears',
              primaryClass.classYearId,
            )
            if (classYear && !classYear.isDeleted) {
              const classRecord = await ctx.db.get('classes', classYear.classId)
              if (classRecord && !classRecord.isDeleted) {
                className = classRecord.name
              }
            }
          }

          return {
            ...e,
            userType: 'student' as const,
            userInfo: {
              saintName: studentUser.saintName,
              fullName: studentUser.fullName,
              code: studentUser.studentCode,
              gender: studentUser.gender,
              className,
              profilePhotoStorageId: studentUser.profilePhotoStorageId,
            },
          }
        }

        return {
          ...e,
          userType: 'unknown' as const,
          userInfo: {
            fullName: e.tokenIdentifier,
          },
        }
      }),
    )

    return result
  },
})

// ─── Mutations ────────────────────────────────────────────────────────────

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
    dateStart: v.string(),
    dateEnd: v.string(),
    enrollmentExpireDate: v.string(),
    feeRequired: v.boolean(),
    feeAmount: v.optional(v.number()),
    maxCapacity: v.optional(v.number()),
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

    return await ctx.db.insert('extracurricularPrograms', {
      academicYearId,
      title: args.title,
      details: args.details,
      target: args.target,
      branches: args.branches,
      dateStart: args.dateStart,
      dateEnd: args.dateEnd,
      enrollmentExpireDate: args.enrollmentExpireDate,
      feeRequired: args.feeRequired,
      feeAmount: args.feeAmount,
      maxCapacity: args.maxCapacity,
      createdBy: args.requesterId,
      createdAt: Date.now(),
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
    dateStart: v.optional(v.string()),
    dateEnd: v.optional(v.string()),
    enrollmentExpireDate: v.optional(v.string()),
    feeRequired: v.optional(v.boolean()),
    feeAmount: v.optional(v.number()),
    maxCapacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const program = await ctx.db.get('extracurricularPrograms', args.programId)
    if (!program || program.isDeleted) {
      throw new Error(EXTRACURRICULAR_ERRORS.NOT_FOUND)
    }

    // Check permission — admin, board member, or branch head of the program's year
    const perms = await getEffectivePermissions(
      ctx,
      args.requesterId,
      program.academicYearId,
    )
    if (!perms.isAdmin && !perms.isBoardMember) {
      const isBranchHead =
        perms.branchHeadOf.length > 0 &&
        (program.branches.length === 0 ||
          program.branches.some((b) => perms.branchHeadOf.includes(b)))
      if (!isBranchHead) {
        throw new Error(EXTRACURRICULAR_ERRORS.UNAUTHORIZED)
      }
    }

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

    const patch: Record<string, unknown> = {}
    if (args.title !== undefined) patch.title = args.title
    if (args.details !== undefined) patch.details = args.details
    if (args.target !== undefined) patch.target = args.target
    if (args.branches !== undefined) patch.branches = args.branches
    if (args.dateStart !== undefined) patch.dateStart = args.dateStart
    if (args.dateEnd !== undefined) patch.dateEnd = args.dateEnd
    if (args.enrollmentExpireDate !== undefined)
      patch.enrollmentExpireDate = args.enrollmentExpireDate
    if (args.feeRequired !== undefined) patch.feeRequired = args.feeRequired
    if (args.feeAmount !== undefined) patch.feeAmount = args.feeAmount
    if (args.maxCapacity !== undefined) patch.maxCapacity = args.maxCapacity

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

    // Check permission — admin, board member, or branch head of the program's year
    const perms = await getEffectivePermissions(
      ctx,
      args.requesterId,
      program.academicYearId,
    )
    if (!perms.isAdmin && !perms.isBoardMember) {
      const isBranchHead =
        perms.branchHeadOf.length > 0 &&
        (program.branches.length === 0 ||
          program.branches.some((b) => perms.branchHeadOf.includes(b)))
      if (!isBranchHead) {
        throw new Error(EXTRACURRICULAR_ERRORS.UNAUTHORIZED)
      }
    }

    // Soft delete
    await ctx.db.patch('extracurricularPrograms', args.programId, {
      isDeleted: true,
    })
  },
})

export const enrollProgram = mutation({
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

    // Check academic year is active
    const academicYear = await ctx.db.get(
      'academicYears',
      program.academicYearId,
    )
    if (!academicYear || !academicYear.isActive) {
      throw new Error(EXTRACURRICULAR_ERRORS.INACTIVE_ACADEMIC_YEAR)
    }

    // Check enrollment date
    const today = new Date().toISOString().split('T')[0]
    if (today > program.enrollmentExpireDate) {
      throw new Error(EXTRACURRICULAR_ERRORS.INVALID_ENROLLMENT_DATE)
    }

    const identity = await ctx.auth.getUserIdentity()

    let catechist = null
    let student = null

    if (args.requesterId) {
      catechist = await assertValidCatechist(ctx, args.requesterId)
    } else if (args.studentRequesterId) {
      student = await assertValidStudent(ctx, args.studentRequesterId)
    } else if (identity) {
      catechist = await ctx.db
        .query('catechists')
        .withIndex('by_token_identifier', (q) =>
          q.eq('tokenIdentifier', identity.tokenIdentifier),
        )
        .unique()

      student = !catechist
        ? await ctx.db
            .query('students')
            .withIndex('by_token_identifier', (q) =>
              q.eq('tokenIdentifier', identity.tokenIdentifier),
            )
            .unique()
        : null
    }

    if (!catechist && !student) {
      throw new Error(EXTRACURRICULAR_ERRORS.IDENTITY_NOT_FOUND)
    }

    const tokenIdentifier =
      identity?.tokenIdentifier ||
      (catechist
        ? catechist.tokenIdentifier || String(catechist._id)
        : student?.tokenIdentifier || String(student?._id))

    // Verify target eligibility (catechist/student/all)
    const actorType = catechist ? 'catechist' : 'student'
    if (program.target !== 'all' && program.target !== actorType) {
      throw new Error(EXTRACURRICULAR_ERRORS.TARGET_NOT_ELIGIBLE)
    }

    // Verify branch eligibility (branch scope applies to students only)
    let hasEligibleBranch = false
    if (catechist) {
      hasEligibleBranch = true
    } else if (student) {
      const primaryClass = await ctx.db
        .query('studentClasses')
        .withIndex('by_student_id_and_is_primary_class', (q) =>
          q.eq('studentId', student._id).eq('isPrimaryClass', true),
        )
        .unique()
      if (primaryClass && !primaryClass.isDeleted) {
        const classYear = await ctx.db.get(
          'classYears',
          primaryClass.classYearId,
        )
        if (classYear && !classYear.isDeleted) {
          const classRecord = await ctx.db.get('classes', classYear.classId)
          if (classRecord && !classRecord.isDeleted) {
            hasEligibleBranch =
              program.branches.length === 0 ||
              program.branches.includes(classRecord.branchId)
          }
        }
      }
    }

    if (!hasEligibleBranch) {
      throw new Error(EXTRACURRICULAR_ERRORS.BRANCH_NOT_ELIGIBLE)
    }

    // Check if already enrolled
    const existing = await ctx.db
      .query('extracurricularEnrollments')
      .withIndex('by_program_id_and_token_identifier', (q) =>
        q
          .eq('programId', args.programId)
          .eq('tokenIdentifier', tokenIdentifier),
      )
      .collect()

    if (existing.some((e) => !e.isDeleted)) {
      throw new Error(EXTRACURRICULAR_ERRORS.ALREADY_ENROLLED)
    }

    // Check capacity
    if (program.maxCapacity !== undefined) {
      const enrollments = await ctx.db
        .query('extracurricularEnrollments')
        .withIndex('by_program_id', (q) => q.eq('programId', args.programId))
        .collect()
      const enrollmentCount = enrollments.filter((e) => !e.isDeleted).length

      if (enrollmentCount >= program.maxCapacity) {
        throw new Error(EXTRACURRICULAR_ERRORS.CAPACITY_EXCEEDED)
      }
    }

    return await ctx.db.insert('extracurricularEnrollments', {
      programId: args.programId,
      tokenIdentifier,
      createdAt: Date.now(),
      isDeleted: false,
    })
  },
})

export const unenrollProgram = mutation({
  args: {
    programId: v.id('extracurricularPrograms'),
    requesterId: v.optional(v.id('catechists')),
    studentRequesterId: v.optional(v.id('students')),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()

    let catechist = null
    let student = null

    if (args.requesterId) {
      catechist = await assertValidCatechist(ctx, args.requesterId)
    } else if (args.studentRequesterId) {
      student = await assertValidStudent(ctx, args.studentRequesterId)
    } else if (identity) {
      catechist = await ctx.db
        .query('catechists')
        .withIndex('by_token_identifier', (q) =>
          q.eq('tokenIdentifier', identity.tokenIdentifier),
        )
        .unique()

      student = !catechist
        ? await ctx.db
            .query('students')
            .withIndex('by_token_identifier', (q) =>
              q.eq('tokenIdentifier', identity.tokenIdentifier),
            )
            .unique()
        : null
    }

    if (!catechist && !student) {
      throw new Error(EXTRACURRICULAR_ERRORS.UNAUTHORIZED)
    }

    const tokenIdentifier =
      identity?.tokenIdentifier ||
      (catechist
        ? catechist.tokenIdentifier || String(catechist._id)
        : student?.tokenIdentifier || String(student?._id))

    const enrollments = await ctx.db
      .query('extracurricularEnrollments')
      .withIndex('by_program_id_and_token_identifier', (q) =>
        q
          .eq('programId', args.programId)
          .eq('tokenIdentifier', tokenIdentifier),
      )
      .collect()

    const enrollment = enrollments.find((e) => !e.isDeleted)
    if (!enrollment) {
      throw new Error(EXTRACURRICULAR_ERRORS.NOT_ENROLLED)
    }

    // Soft delete enrollment
    await ctx.db.patch('extracurricularEnrollments', enrollment._id, {
      isDeleted: true,
    })
  },
})
