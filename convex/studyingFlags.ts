import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import { getActiveAcademicYear } from './lib/authz'
import { syncHasActiveClass } from './lib/enrollment'

const BATCH_SIZE = 100

// Recomputes students.hasActiveClass in batches, rescheduling itself until
// done. academicYears.setActive runs it because the flag is relative to the
// active year. Also the one-off backfill for existing deployments:
//   npx convex run studyingFlags:backfillHasActiveClass
export const backfillHasActiveClass = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const activeYearId = await getActiveAcademicYear(ctx)
    const page = await ctx.db
      .query('students')
      .paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE })

    for (const student of page.page) {
      await syncHasActiveClass(ctx, student._id, activeYearId)
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.studyingFlags.backfillHasActiveClass,
        { cursor: page.continueCursor },
      )
    }
    return { processed: page.page.length, isDone: page.isDone }
  },
})
