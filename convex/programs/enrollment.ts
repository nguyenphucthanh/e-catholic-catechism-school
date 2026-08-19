import { v } from 'convex/values'
import { mutation, query } from '../_generated/server'
import {
  assertCanManageProgram,
  assertValidCatechist,
  assertValidStudent,
  checkProgramEligibility,
} from '../lib/authz'
import { EXTRACURRICULAR_ERRORS } from '../lib/errors'
import { getStudentPrimaryClass } from '../lib/studentClassLookup'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

async function resolveActor(
  ctx: MutationCtx,
  args: {
    requesterId?: Id<'catechists'>
    studentRequesterId?: Id<'students'>
  },
): Promise<{
  catechist: Doc<'catechists'> | null
  student: Doc<'students'> | null
  tokenIdentifier: string
}> {
  const identity = await ctx.auth.getUserIdentity()

  let catechist: Doc<'catechists'> | null = null
  let student: Doc<'students'> | null = null

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

  const tokenIdentifier =
    identity?.tokenIdentifier ||
    (catechist
      ? catechist.tokenIdentifier || String(catechist._id)
      : student?.tokenIdentifier || String(student?._id))

  return { catechist, student, tokenIdentifier }
}

export const listEligiblePrograms = query({
  args: {
    studentRequesterId: v.id('students'),
  },
  handler: async (ctx, args) => {
    const student = await assertValidStudent(ctx, args.studentRequesterId)

    // Get active academic year
    const academicYear = await ctx.db
      .query('academicYears')
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('isActive'), true))
      .first()

    if (!academicYear) return []

    // ponytail: list view uses lenient filtering (branch check skipped if no class)
    // enrollProgram mutation uses strict checking via checkProgramEligibility
    // Get student's primary class for this academic year
    const classRecord = await getStudentPrimaryClass(
      ctx,
      args.studentRequesterId,
      academicYear._id,
    )

    // Get all programs for active academic year
    let programs = await ctx.db
      .query('extracurricularPrograms')
      .withIndex('by_academic_year_id', (q) =>
        q.eq('academicYearId', academicYear._id),
      )
      .collect()

    programs = programs.filter((p) => !p.isDeleted)

    // Filter by target (student or all)
    programs = programs.filter(
      (p) => p.target === 'student' || p.target === 'all',
    )

    // Filter by branch eligibility (if student has a class)
    if (classRecord) {
      programs = programs.filter(
        (p) =>
          p.branches.length === 0 || p.branches.includes(classRecord.branchId),
      )
    }

    // Check enrollment status for each program
    const results = await Promise.all(
      programs.map(async (p) => {
        const enrollments = await ctx.db
          .query('extracurricularEnrollments')
          .withIndex('by_program_id', (q) => q.eq('programId', p._id))
          .collect()

        const enrollmentCount = enrollments.filter((e) => !e.isDeleted).length

        const identity = await ctx.auth.getUserIdentity()
        const tokenIdentifier =
          identity?.tokenIdentifier ||
          student.tokenIdentifier ||
          String(student._id)

        const userEnrolled = enrollments.some(
          (e) => !e.isDeleted && e.tokenIdentifier === tokenIdentifier,
        )

        return {
          ...p,
          enrollmentCount,
          userEnrolled,
        }
      }),
    )

    return results
  },
})

export const getEnrollments = query({
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
          const primaryClass = await getStudentPrimaryClass(
            ctx,
            studentUser._id,
            program.academicYearId,
          )
          const className = primaryClass?.name

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

    // Check enrollment date
    const today = new Date().toISOString().split('T')[0]
    if (today > program.enrollmentExpireDate) {
      throw new Error(EXTRACURRICULAR_ERRORS.INVALID_ENROLLMENT_DATE)
    }

    const { catechist, student, tokenIdentifier } = await resolveActor(
      ctx,
      args,
    )

    if (!catechist && !student) {
      throw new Error(EXTRACURRICULAR_ERRORS.IDENTITY_NOT_FOUND)
    }

    // Check program eligibility (target + branch + academic year)
    const eligibility = await checkProgramEligibility(
      ctx,
      { catechist, student },
      program,
    )
    if (!eligibility.eligible) {
      throw new Error(eligibility.reason || EXTRACURRICULAR_ERRORS.UNAUTHORIZED)
    }

    // Check if already enrolled or soft-deleted
    const existingList = await ctx.db
      .query('extracurricularEnrollments')
      .withIndex('by_program_id_and_token_identifier', (q) =>
        q
          .eq('programId', args.programId)
          .eq('tokenIdentifier', tokenIdentifier),
      )
      .collect()

    const activeExisting = existingList.find((e) => !e.isDeleted)
    if (activeExisting) {
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

    // Reactivate soft-deleted enrollment if present, else insert new
    const softDeleted = existingList.find((e) => e.isDeleted)
    if (softDeleted) {
      await ctx.db.patch('extracurricularEnrollments', softDeleted._id, {
        isDeleted: false,
      })
      return softDeleted._id
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
    const { catechist, student, tokenIdentifier } = await resolveActor(
      ctx,
      args,
    )

    if (!catechist && !student) {
      throw new Error(EXTRACURRICULAR_ERRORS.UNAUTHORIZED)
    }

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

export const updateEnrollmentPaymentStatus = mutation({
  args: {
    enrollmentId: v.id('extracurricularEnrollments'),
    requesterId: v.id('catechists'),
    isPaid: v.boolean(),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const enrollment = await ctx.db.get(
      'extracurricularEnrollments',
      args.enrollmentId,
    )
    if (!enrollment || enrollment.isDeleted) {
      throw new Error('Enrollment not found')
    }
    const program = await ctx.db.get(
      'extracurricularPrograms',
      enrollment.programId,
    )
    if (!program || program.isDeleted) {
      throw new Error(EXTRACURRICULAR_ERRORS.NOT_FOUND)
    }

    await assertCanManageProgram(ctx, program, args.requesterId)

    await ctx.db.patch('extracurricularEnrollments', args.enrollmentId, {
      isPaid: args.isPaid,
    })
  },
})

export const checkProgramEligibilityForStudent = query({
  args: {
    studentRequesterId: v.id('students'),
    programId: v.id('extracurricularPrograms'),
  },
  handler: async (ctx, args) => {
    const student = await assertValidStudent(ctx, args.studentRequesterId)
    const program = await ctx.db.get('extracurricularPrograms', args.programId)
    if (!program || program.isDeleted) {
      throw new Error(EXTRACURRICULAR_ERRORS.NOT_FOUND)
    }

    return await checkProgramEligibility(
      ctx,
      { catechist: null, student },
      program,
    )
  },
})
