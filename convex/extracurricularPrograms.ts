import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  assertValidCatechist,
  assertValidStudent,
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

export const searchEligibleCandidates = query({
  args: {
    programId: v.id('extracurricularPrograms'),
    requesterId: v.id('catechists'),
    type: v.union(v.literal('catechist'), v.literal('student')),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const searchTrim = args.search ? args.search.trim() : ''
    if (searchTrim.length < 2) {
      return []
    }
    const searchLower = searchTrim.toLowerCase()

    const program = await ctx.db.get('extracurricularPrograms', args.programId)
    if (!program || program.isDeleted) {
      throw new Error(EXTRACURRICULAR_ERRORS.NOT_FOUND)
    }

    if (program.target !== 'all' && program.target !== args.type) {
      return []
    }

    const perms = await getEffectivePermissions(
      ctx,
      args.requesterId,
      program.academicYearId,
    )

    // Get active enrollments to flag isAlreadyEnrolled
    const enrollments = await ctx.db
      .query('extracurricularEnrollments')
      .withIndex('by_program_id', (q) => q.eq('programId', args.programId))
      .collect()
    const activeEnrollments = enrollments.filter((e) => !e.isDeleted)
    const enrolledTokenIds = new Set(
      activeEnrollments.map((e) => e.tokenIdentifier),
    )

    if (args.type === 'catechist') {
      // Branch Head / Board / Admin permission required to search catechists
      if (
        !perms.isAdmin &&
        !perms.isBoardMember &&
        perms.branchHeadOf.length === 0
      ) {
        return []
      }

      let eligibleCatechistIds: Set<Id<'catechists'>> | null = null

      if (!perms.isAdmin && !perms.isBoardMember) {
        // Branch Head scoping
        const branchIds = perms.branchHeadOf
        const eligibleIds = new Set<Id<'catechists'>>()

        // 1. Branch assignments
        const branchAssignments = await ctx.db
          .query('branchAssignments')
          .withIndex('by_academic_year_id', (q) =>
            q.eq('academicYearId', program.academicYearId),
          )
          .collect()
        for (const ba of branchAssignments) {
          if (!ba.isDeleted && branchIds.includes(ba.branchId)) {
            eligibleIds.add(ba.catechistId)
          }
        }

        // 2. Class catechists in led branches
        const classYearsInYear = await ctx.db
          .query('classYears')
          .withIndex('by_academic_year_id', (q) =>
            q.eq('academicYearId', program.academicYearId),
          )
          .collect()

        for (const cy of classYearsInYear) {
          if (cy.isDeleted) continue
          const classRecord = await ctx.db.get('classes', cy.classId)
          if (!classRecord || classRecord.isDeleted) continue

          if (branchIds.includes(classRecord.branchId)) {
            const classCatechists = await ctx.db
              .query('classCatechists')
              .withIndex('by_class_year_id', (q) => q.eq('classYearId', cy._id))
              .collect()
            for (const cc of classCatechists) {
              if (!cc.isDeleted) eligibleIds.add(cc.catechistId)
            }
          }
        }

        eligibleCatechistIds = eligibleIds
      }

      // Fetch active catechists
      const allCatechists = await ctx.db
        .query('catechists')
        .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
        .collect()

      const results = []
      for (const c of allCatechists) {
        if (!c.isActive) continue
        if (eligibleCatechistIds && !eligibleCatechistIds.has(c._id)) continue

        const formattedName =
          `${c.saintName ? c.saintName + ' ' : ''}${c.fullName}`.toLowerCase()
        const codeStr = String(c.memberId).toLowerCase()

        if (
          formattedName.includes(searchLower) ||
          c.fullName.toLowerCase().includes(searchLower) ||
          (c.saintName && c.saintName.toLowerCase().includes(searchLower)) ||
          codeStr.includes(searchLower)
        ) {
          const tokenIdentifier = c.tokenIdentifier || String(c._id)
          results.push({
            id: c._id,
            userType: 'catechist' as const,
            saintName: c.saintName,
            fullName: c.fullName,
            code: String(c.memberId),
            className: undefined as string | undefined,
            tokenIdentifier,
            isAlreadyEnrolled: enrolledTokenIds.has(tokenIdentifier),
          })
        }
      }
      return results
    } else {
      // type === 'student'
      const hasPermission =
        perms.isAdmin ||
        perms.isBoardMember ||
        perms.branchHeadOf.length > 0 ||
        perms.classCatechistOf.length > 0

      if (!hasPermission) {
        return []
      }

      // 1. Get all classYears in academicYearId
      const classYears = await ctx.db
        .query('classYears')
        .withIndex('by_academic_year_id', (q) =>
          q.eq('academicYearId', program.academicYearId),
        )
        .collect()

      // Filter eligible classYears based on program.branches & user permissions
      const eligibleClassYearMap = new Map<Id<'classYears'>, string>()

      for (const cy of classYears) {
        if (cy.isDeleted) continue
        const classRecord = await ctx.db.get('classes', cy.classId)
        if (!classRecord || classRecord.isDeleted) continue

        // Check program.branches restriction
        if (
          program.branches.length > 0 &&
          !program.branches.includes(classRecord.branchId)
        ) {
          continue
        }

        // Check user permission for this class
        let isEligibleForUser = false
        if (perms.isAdmin || perms.isBoardMember) {
          isEligibleForUser = true
        } else {
          if (perms.branchHeadOf.includes(classRecord.branchId)) {
            isEligibleForUser = true
          }
          if (perms.classCatechistOf.includes(cy._id)) {
            isEligibleForUser = true
          }
        }

        if (isEligibleForUser) {
          eligibleClassYearMap.set(cy._id, classRecord.name)
        }
      }

      if (eligibleClassYearMap.size === 0) {
        return []
      }

      // Fetch student classes for eligible classYears
      const candidateStudentIds = new Set<Id<'students'>>()
      const studentClassMap = new Map<Id<'students'>, string>()

      for (const [classYearId, className] of eligibleClassYearMap.entries()) {
        const studentClasses = await ctx.db
          .query('studentClasses')
          .withIndex('by_class_year_id', (q) =>
            q.eq('classYearId', classYearId),
          )
          .collect()

        for (const sc of studentClasses) {
          if (!sc.isDeleted && sc.isPrimaryClass) {
            candidateStudentIds.add(sc.studentId)
            studentClassMap.set(sc.studentId, className)
          }
        }
      }

      const results = []
      for (const studentId of candidateStudentIds) {
        const student = await ctx.db.get('students', studentId)
        if (!student || student.isDeleted || !student.isActive) continue

        const formattedName =
          `${student.saintName ? student.saintName + ' ' : ''}${student.fullName}`.toLowerCase()
        const codeStr = String(student.studentCode).toLowerCase()

        if (
          formattedName.includes(searchLower) ||
          student.fullName.toLowerCase().includes(searchLower) ||
          (student.saintName &&
            student.saintName.toLowerCase().includes(searchLower)) ||
          codeStr.includes(searchLower)
        ) {
          const tokenIdentifier = student.tokenIdentifier || String(student._id)
          results.push({
            id: student._id,
            userType: 'student' as const,
            saintName: student.saintName,
            fullName: student.fullName,
            code: String(student.studentCode),
            className: studentClassMap.get(student._id),
            tokenIdentifier,
            isAlreadyEnrolled: enrolledTokenIds.has(tokenIdentifier),
          })
        }
      }

      return results
    }
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

export const enrollParticipant = mutation({
  args: {
    programId: v.id('extracurricularPrograms'),
    requesterId: v.id('catechists'),
    targetType: v.union(v.literal('catechist'), v.literal('student')),
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const program = await ctx.db.get('extracurricularPrograms', args.programId)
    if (!program || program.isDeleted) {
      throw new Error(EXTRACURRICULAR_ERRORS.NOT_FOUND)
    }

    const academicYear = await ctx.db.get(
      'academicYears',
      program.academicYearId,
    )
    if (!academicYear || !academicYear.isActive) {
      throw new Error(EXTRACURRICULAR_ERRORS.INACTIVE_ACADEMIC_YEAR)
    }

    const today = new Date().toISOString().split('T')[0]
    if (today > program.enrollmentExpireDate) {
      throw new Error(EXTRACURRICULAR_ERRORS.INVALID_ENROLLMENT_DATE)
    }

    if (program.target !== 'all' && program.target !== args.targetType) {
      throw new Error(EXTRACURRICULAR_ERRORS.TARGET_NOT_ELIGIBLE)
    }

    const perms = await getEffectivePermissions(
      ctx,
      args.requesterId,
      program.academicYearId,
    )

    let tokenIdentifier = ''

    if (args.targetType === 'catechist') {
      const catechistId = args.targetId as Id<'catechists'>
      const catechist = await ctx.db.get('catechists', catechistId)
      if (!catechist || catechist.isDeleted || !catechist.isActive) {
        throw new Error(EXTRACURRICULAR_ERRORS.IDENTITY_NOT_FOUND)
      }
      tokenIdentifier = catechist.tokenIdentifier || String(catechist._id)

      if (!perms.isAdmin && !perms.isBoardMember) {
        let isAuthorized = false
        if (perms.branchHeadOf.length > 0) {
          const branchAssignments = await ctx.db
            .query('branchAssignments')
            .withIndex('by_catechist_id', (q) =>
              q.eq('catechistId', catechistId),
            )
            .collect()

          if (
            branchAssignments.some(
              (ba) =>
                !ba.isDeleted &&
                ba.academicYearId === program.academicYearId &&
                perms.branchHeadOf.includes(ba.branchId),
            )
          ) {
            isAuthorized = true
          }

          if (!isAuthorized) {
            const classAssignments = await ctx.db
              .query('classCatechists')
              .withIndex('by_catechist_id', (q) =>
                q.eq('catechistId', catechistId),
              )
              .collect()

            for (const ca of classAssignments) {
              if (ca.isDeleted || ca.academicYearId !== program.academicYearId)
                continue
              const cy = await ctx.db.get('classYears', ca.classYearId)
              if (!cy || cy.isDeleted) continue
              const cRec = await ctx.db.get('classes', cy.classId)
              if (
                cRec &&
                !cRec.isDeleted &&
                perms.branchHeadOf.includes(cRec.branchId)
              ) {
                isAuthorized = true
                break
              }
            }
          }
        }

        if (!isAuthorized) {
          throw new Error(EXTRACURRICULAR_ERRORS.UNAUTHORIZED)
        }
      }
    } else {
      // targetType === 'student'
      const studentId = args.targetId as Id<'students'>
      const student = await ctx.db.get('students', studentId)
      if (!student || student.isDeleted || !student.isActive) {
        throw new Error(EXTRACURRICULAR_ERRORS.IDENTITY_NOT_FOUND)
      }
      tokenIdentifier = student.tokenIdentifier || String(student._id)

      const primaryClass = await ctx.db
        .query('studentClasses')
        .withIndex('by_student_id_and_is_primary_class', (q) =>
          q.eq('studentId', studentId).eq('isPrimaryClass', true),
        )
        .first()

      if (!primaryClass || primaryClass.isDeleted) {
        throw new Error(EXTRACURRICULAR_ERRORS.BRANCH_NOT_ELIGIBLE)
      }

      const classYear = await ctx.db.get('classYears', primaryClass.classYearId)
      if (
        !classYear ||
        classYear.isDeleted ||
        classYear.academicYearId !== program.academicYearId
      ) {
        throw new Error(EXTRACURRICULAR_ERRORS.BRANCH_NOT_ELIGIBLE)
      }

      const classRecord = await ctx.db.get('classes', classYear.classId)
      if (!classRecord || classRecord.isDeleted) {
        throw new Error(EXTRACURRICULAR_ERRORS.BRANCH_NOT_ELIGIBLE)
      }

      if (
        program.branches.length > 0 &&
        !program.branches.includes(classRecord.branchId)
      ) {
        throw new Error(EXTRACURRICULAR_ERRORS.BRANCH_NOT_ELIGIBLE)
      }

      if (!perms.isAdmin && !perms.isBoardMember) {
        let isAuthorized = false
        if (perms.branchHeadOf.includes(classRecord.branchId)) {
          isAuthorized = true
        }
        if (perms.classCatechistOf.includes(classYear._id)) {
          isAuthorized = true
        }

        if (!isAuthorized) {
          throw new Error(EXTRACURRICULAR_ERRORS.UNAUTHORIZED)
        }
      }
    }

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
