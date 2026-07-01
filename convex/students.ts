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
    return student
  },
})

export const create = mutation({
  args: {
    requesterId: v.id('catechists'),
    fullName: v.string(),
    saintName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()), // ISO: YYYY-MM-DD
    gender: v.optional(
      v.union(v.literal('male'), v.literal('female'), v.literal('other')),
    ),
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
    gender: v.optional(
      v.union(v.literal('male'), v.literal('female'), v.literal('other')),
    ),
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
