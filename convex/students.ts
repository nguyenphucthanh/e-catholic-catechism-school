import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { assertAdminRole, assertValidCatechist } from './lib/authz'
import { nextCounter } from './lib/counter'
import { STUDENT_ERRORS } from './lib/errors'

export const list = query({
  args: {
    requesterId: v.id('catechists'),
    paginationOpts: paginationOptsValidator,
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const dbQuery = ctx.db
      .query('students')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))

    const page = await dbQuery.order('desc').paginate(args.paginationOpts)

    const filtered =
      args.isActive !== undefined
        ? {
            ...page,
            page: page.page.filter((s) => s.isActive === args.isActive),
          }
        : page

    return filtered
  },
})

export const get = query({
  args: { requesterId: v.id('catechists'), id: v.id('students') },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)
    const student = await ctx.db.get('students', args.id)
    if (!student || student.isDeleted) return null

    const address = await ctx.db
      .query('studentAddresses')
      .withIndex('by_student_id', (q) => q.eq('studentId', args.id))
      .unique()

    const links = await ctx.db
      .query('studentGuardians')
      .withIndex('by_student_id', (q) => q.eq('studentId', args.id))
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .collect()

    const guardians = await Promise.all(
      links.map(async (link) => {
        let guardian = await ctx.db.get('guardians', link.guardianId)
        if (guardian?.isDeleted) {
          guardian = null
        }
        const contacts = guardian
          ? (
              await ctx.db
                .query('guardianContacts')
                .withIndex('by_guardian_id', (q) =>
                  q.eq('guardianId', link.guardianId),
                )
                .collect()
            ).filter((c) => !c.isDeleted)
          : []
        return { ...link, guardian, contacts }
      }),
    )

    return {
      ...student,
      address: address?.isDeleted ? null : (address ?? null),
      guardians,
    }
  },
})

export const create = mutation({
  args: {
    requesterId: v.id('catechists'),
    fullName: v.string(),
    saintName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()), // ISO: YYYY-MM-DD
    gender: v.optional(v.union(v.literal('male'), v.literal('female'))),
    previousParish: v.optional(v.string()),
    previousDiocese: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const seq = await nextCounter(ctx, 'student')
    const studentCode = String(seq)

    const { requesterId, ...fields } = args
    return await ctx.db.insert('students', {
      ...fields,
      studentCode,
      isActive: true,
      isDeleted: false,
      createdAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
    fullName: v.optional(v.string()),
    saintName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.union(v.literal('male'), v.literal('female'))),
    previousParish: v.optional(v.string()),
    previousDiocese: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const student = await ctx.db.get('students', args.studentId)
    if (!student || student.isDeleted) {
      throw new Error(STUDENT_ERRORS.NOT_FOUND)
    }

    const { requesterId, studentId, ...fields } = args
    await ctx.db.patch('students', studentId, fields)
  },
})

export const softDelete = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const student = await ctx.db.get('students', args.studentId)
    if (!student || student.isDeleted) {
      throw new Error(STUDENT_ERRORS.NOT_FOUND)
    }

    // Guard: cannot delete student enrolled in active classes
    const enrollments = await ctx.db
      .query('studentClasses')
      .withIndex('by_student_id', (q) => q.eq('studentId', args.studentId))
      .collect()

    if (enrollments.some((e) => !e.isDeleted && e.status === 'active')) {
      throw new Error(STUDENT_ERRORS.IN_USE_BY_ENROLLMENT)
    }

    await ctx.db.patch('students', args.studentId, { isDeleted: true })
  },
})

export const getStudentAddress = query({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
  },
  handler: async (ctx, { requesterId, studentId }) => {
    await assertValidCatechist(ctx, requesterId)
    return await ctx.db
      .query('studentAddresses')
      .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .unique()
  },
})

export const upsertStudentAddress = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
    country: v.string(),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    stateProvince: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    hamlet: v.optional(v.string()),
    subHamlet: v.optional(v.string()),
  },
  handler: async (ctx, { requesterId, studentId, ...fields }) => {
    await assertAdminRole(ctx, requesterId)
    const existing = await ctx.db
      .query('studentAddresses')
      .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
      .unique()
    if (existing !== null) {
      await ctx.db.patch('studentAddresses', existing._id, fields)
    } else {
      await ctx.db.insert('studentAddresses', {
        studentId,
        ...fields,
        isDeleted: false,
      })
    }
  },
})

export const softDeleteStudentAddress = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
  },
  handler: async (ctx, { requesterId, studentId }) => {
    await assertAdminRole(ctx, requesterId)
    const address = await ctx.db
      .query('studentAddresses')
      .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
      .unique()
    if (!address || address.isDeleted) {
      throw new Error(STUDENT_ERRORS.ADDRESS_NOT_FOUND)
    }
    await ctx.db.patch('studentAddresses', address._id, { isDeleted: true })
  },
})

export const getStudentDetail = query({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const student = await ctx.db.get('students', args.studentId)
    if (!student || student.isDeleted) return null

    const address = await ctx.db
      .query('studentAddresses')
      .withIndex('by_student_id', (q) => q.eq('studentId', args.studentId))
      .unique()

    const sacraments = await ctx.db
      .query('studentSacraments')
      .withIndex('by_student_id', (q) => q.eq('studentId', args.studentId))
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .collect()

    const studentClasses = await ctx.db
      .query('studentClasses')
      .withIndex('by_student_id', (q) => q.eq('studentId', args.studentId))
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field('isDeleted'), false))
      .collect()

    const enrollments = await Promise.all(
      studentClasses.map(async (sc) => {
        const classYear = await ctx.db.get('classYears', sc.classYearId)
        if (!classYear || classYear.isDeleted) {
          return null
        }

        const classRecord = await ctx.db.get('classes', classYear.classId)
        if (!classRecord || classRecord.isDeleted) {
          return null
        }

        const academicYear = await ctx.db.get(
          'academicYears',
          classYear.academicYearId,
        )
        if (!academicYear || academicYear.isDeleted) {
          return null
        }

        return {
          ...sc,
          classYear: {
            ...classYear,
            className: classRecord.name,
            academicYearName: academicYear.name,
          },
        }
      }),
    )

    // filter out nulls in case any classYear / class / academicYear was deleted
    const filteredEnrollments = enrollments.filter(
      (e): e is NonNullable<typeof e> => e !== null,
    )

    return {
      ...student,
      address: address?.isDeleted ? null : (address ?? null),
      sacraments,
      enrollments: filteredEnrollments,
    }
  },
})
