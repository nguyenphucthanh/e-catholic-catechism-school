// Lives outside convex/ so it is never bundled into a deployment.
import { convexTest } from 'convex-test'
import type schema from '../convex/schema'
import type { Id } from '../convex/_generated/dataModel'

type Modules = Record<string, () => Promise<any>>

function requesterIdFromArgs(args: unknown): string | undefined {
  const a = args as
    | {
        requesterId?: string
        studentRequesterId?: string
        requester?: { requesterId?: string }
      }
    | undefined
  return a?.requesterId ?? a?.studentRequesterId ?? a?.requester?.requesterId
}

/**
 * convexTest whose query/mutation/action calls are authenticated as the
 * requester named in the call's args (requesterId / studentRequesterId /
 * requester.requesterId), the way the real client sends a session JWT.
 * Creates an account (if the user has none) and a live session on demand.
 * Use plain convexTest to test unauthenticated or mismatched callers.
 */
export function authedConvexTest(s: typeof schema, modules: Modules) {
  const t = convexTest(s, modules)

  const identityFor = (userId: string) =>
    t.run(async (ctx) => {
      const accountType = ctx.db.normalizeId('catechists', userId)
        ? ('catechist' as const)
        : ('student' as const)
      const accounts = await ctx.db.query('accounts').collect()
      const accountId =
        accounts.find((a) => a.userRefId === userId)?._id ??
        (await ctx.db.insert('accounts', {
          loginId: `__test__${userId}`,
          passwordHash: 'test',
          accountType,
          userRefId: userId as Id<'catechists'> | Id<'students'>,
          isActive: true,
          createdAt: 0,
          isDeleted: false,
        }))
      // Re-check each call: the code under test may revoke sessions.
      const sessions = await ctx.db
        .query('sessions')
        .withIndex('by_account_id', (q) => q.eq('accountId', accountId))
        .collect()
      const sid =
        sessions.find((x) => x.secretHash === 'test' && !x.revokedAt)?._id ??
        (await ctx.db.insert('sessions', {
          accountId,
          secretHash: 'test',
          expiresAt: Number.MAX_SAFE_INTEGER,
        }))
      return { subject: `${accountType}|${userId}`, sid }
    })

  const as = async (args: unknown) => {
    const userId = requesterIdFromArgs(args)
    return userId ? t.withIdentity(await identityFor(userId)) : t
  }

  return {
    ...t,
    /** Accessor authenticated as userId, e.g. for t.as(id).run(ctx => helper(ctx, id)). */
    as: async (userId: string) => t.withIdentity(await identityFor(userId)),
    query: (async (fn: any, args?: any) =>
      (await as(args)).query(fn, args)) as typeof t.query,
    mutation: (async (fn: any, args?: any) =>
      (await as(args)).mutation(fn, args)) as typeof t.mutation,
    action: (async (fn: any, args?: any) =>
      (await as(args)).action(fn, args)) as typeof t.action,
  }
}
