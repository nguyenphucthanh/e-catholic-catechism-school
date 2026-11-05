import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { internal } from './_generated/api'

// Expired sessions are kept this long before purge, so recent sign-outs and
// expiries stay inspectable.
export const SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const PURGE_BATCH_SIZE = 500

// Hard delete is deliberate: sessions are internal credentials, not a
// user-facing entity, and revoked/expired rows have no historical value.
export const purgeExpiredSessions = internalMutation({
  args: { batchSize: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { batchSize = PURGE_BATCH_SIZE }) => {
    const cutoff = Date.now() - SESSION_RETENTION_MS
    const stale = await ctx.db
      .query('sessions')
      .withIndex('by_expires_at', (q) => q.lt('expiresAt', cutoff))
      .take(batchSize)
    for (const session of stale) {
      await ctx.db.delete('sessions', session._id)
    }
    if (stale.length === batchSize) {
      await ctx.scheduler.runAfter(
        0,
        internal.sessionCleanup.purgeExpiredSessions,
        { batchSize },
      )
    }
    return null
  },
})
