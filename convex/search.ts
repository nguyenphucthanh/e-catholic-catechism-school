import { v } from 'convex/values'
import { query } from './_generated/server'
import { assertValidCatechist } from './lib/authz'

const RESULT_LIMIT = 8

// Global header search-combobox: catechist-only, searches students and
// catechists by fullName via search indexes defined in schema.ts.
export const globalSearch = query({
  args: {
    requesterId: v.id('catechists'),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    await assertValidCatechist(ctx, args.requesterId)

    const trimmed = args.query.trim()
    if (!trimmed) {
      return { students: [], catechists: [] }
    }

    const students = await ctx.db
      .query('students')
      .withSearchIndex('search_full_name', (q) =>
        q.search('fullName', trimmed).eq('isDeleted', false),
      )
      .take(RESULT_LIMIT)

    const catechists = await ctx.db
      .query('catechists')
      .withSearchIndex('search_full_name', (q) =>
        q.search('fullName', trimmed).eq('isDeleted', false),
      )
      .take(RESULT_LIMIT)

    const activeYear = (
      await ctx.db
        .query('academicYears')
        .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
        .collect()
    ).find((y) => y.isActive)

    const primaryClassNames = await Promise.all(
      students.map(async (s) => {
        if (!activeYear) return null
        const enrollments = await ctx.db
          .query('studentClasses')
          .withIndex('by_student_id_and_is_primary_class', (q) =>
            q.eq('studentId', s._id).eq('isPrimaryClass', true),
          )
          .collect()
        for (const sc of enrollments) {
          if (sc.isDeleted || sc.status === 'withdrawn') continue
          const classYear = await ctx.db.get('classYears', sc.classYearId)
          if (
            !classYear ||
            classYear.isDeleted ||
            classYear.academicYearId !== activeYear._id
          ) {
            continue
          }
          const classDoc = await ctx.db.get('classes', classYear.classId)
          return classDoc && !classDoc.isDeleted ? classDoc.name : null
        }
        return null
      }),
    )

    return {
      students: students.map((s, i) => ({
        _id: s._id,
        fullName: s.fullName,
        saintName: s.saintName,
        studentCode: s.studentCode,
        dateOfBirth: s.dateOfBirth,
        primaryClassName: primaryClassNames[i],
      })),
      catechists: catechists.map((c) => ({
        _id: c._id,
        fullName: c.fullName,
        saintName: c.saintName,
        memberId: c.memberId,
      })),
    }
  },
})
