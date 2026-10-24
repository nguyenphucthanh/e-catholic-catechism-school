// One-off cleanup: delete _storage blobs no document references.
// Before the replace-cleanup fix, updateProfilePhoto left the previous blob behind.
//
// Dry run (default, deletes nothing):
//   npx convex run cleanupOrphanedStorage:run '{}'
// Real run (repeat with the returned cursor until isDone is true):
//   npx convex run cleanupOrphanedStorage:run '{"dryRun": false}'
//   npx convex run cleanupOrphanedStorage:run '{"dryRun": false, "cursor": "<continueCursor>"}'
import { v } from 'convex/values'
import { internalMutation } from './_generated/server'

const DEFAULT_GRACE_MS = 60 * 60 * 1000

export const run = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
    numItems: v.optional(v.number()),
    // Skip recent blobs: an upload may not be attached to its record yet.
    graceMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true
    const cutoff = Date.now() - (args.graceMs ?? DEFAULT_GRACE_MS)

    // Every table with a `v.id('_storage')` field must be listed here.
    const referenced = new Set<string>()
    for (const s of await ctx.db.query('students').collect()) {
      if (s.profilePhotoStorageId) referenced.add(s.profilePhotoStorageId)
    }
    for (const c of await ctx.db.query('catechists').collect()) {
      if (c.profilePhotoStorageId) referenced.add(c.profilePhotoStorageId)
    }
    for (const a of await ctx.db.query('appConfig').collect()) {
      if (a.logoStorageId) referenced.add(a.logoStorageId)
    }

    const page = await ctx.db.system.query('_storage').paginate({
      numItems: args.numItems ?? 200,
      cursor: args.cursor ?? null,
    })

    let orphaned = 0
    let bytes = 0
    for (const file of page.page) {
      if (referenced.has(file._id) || file._creationTime > cutoff) continue
      orphaned++
      bytes += file.size
      if (!dryRun) await ctx.storage.delete(file._id)
    }

    return {
      dryRun,
      scanned: page.page.length,
      orphaned,
      bytes,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    }
  },
})
