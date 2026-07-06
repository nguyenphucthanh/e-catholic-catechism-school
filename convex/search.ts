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

    return {
      students: students.map((s) => ({
        _id: s._id,
        fullName: s.fullName,
        saintName: s.saintName,
        studentCode: s.studentCode,
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
