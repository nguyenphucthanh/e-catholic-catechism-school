import { v } from 'convex/values'
import { internalMutation, mutation } from './_generated/server'
import { internal } from './_generated/api'
import { assertAdminRole } from './lib/authz'
import { nameSortKey } from './lib/name'
import type { MutationCtx } from './_generated/server'

const BATCH_SIZE = 200

async function reindexBatch(ctx: MutationCtx, cursor: string | null) {
  const nameFormat = (await ctx.db.query('appConfig').first())?.nameFormat
  const page = await ctx.db
    .query('students')
    .paginate({ cursor, numItems: BATCH_SIZE })

  for (const student of page.page) {
    const key = nameSortKey(student.fullName, nameFormat)
    if (student.nameSortKey !== key) {
      await ctx.db.patch('students', student._id, { nameSortKey: key })
    }
  }
  return {
    processed: page.page.length,
    isDone: page.isDone,
    continueCursor: page.continueCursor,
  }
}

// Recomputes students.nameSortKey in batches, rescheduling itself until done.
// appConfig.upsert runs it whenever nameFormat changes.
export const reindexStudents = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const result = await reindexBatch(ctx, args.cursor ?? null)
    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.nameSortKeys.reindexStudents, {
        cursor: result.continueCursor,
      })
    }
    return { processed: result.processed, isDone: result.isDone }
  },
})

// One batch, driven by the admin config page: the client repeats the call with
// `continueCursor` until `isDone`, so it can show progress and completion.
export const reindexStudentsBatch = mutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx)
    return reindexBatch(ctx, args.cursor ?? null)
  },
})
