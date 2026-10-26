// Lives outside convex/ so it is never bundled into a deployment.
import { convexTest } from 'convex-test'
import type schema from '../convex/schema'
import type { Id } from '../convex/_generated/dataModel'
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from 'convex/server'

type Modules = Record<string, () => Promise<any>>

/** Test-only args naming who is calling; stripped before the call. */
type AsRequester = {
  requesterId?: string
  studentRequesterId?: string
  requester?: { accountType?: string; requesterId?: string }
}

function splitRequester(args: unknown): [string | undefined, unknown] {
  if (!args || typeof args !== 'object') return [undefined, args]
  const { requesterId, studentRequesterId, requester, ...rest } =
    args as AsRequester
  return [requesterId ?? studentRequesterId ?? requester?.requesterId, rest]
}

type Call<T extends 'query' | 'mutation' | 'action'> = <
  TFn extends FunctionReference<T, any>,
>(
  fn: TFn,
  args?: FunctionArgs<TFn> & AsRequester,
) => Promise<FunctionReturnType<TFn>>

/**
 * convexTest whose query/mutation/action calls are authenticated as the
 * requester named in the call's args (requesterId / studentRequesterId /
 * requester.requesterId), the way the real client sends a session JWT.
 * Those keys are removed before the call: functions derive the caller from
 * the session, so no public function accepts them.
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

  const call =
    (kind: 'query' | 'mutation' | 'action') =>
    async (fn: any, args?: unknown) => {
      const [userId, rest] = splitRequester(args)
      const accessor = userId ? t.withIdentity(await identityFor(userId)) : t
      return (accessor[kind] as any)(fn, rest)
    }

  return {
    ...t,
    /** Accessor authenticated as userId, e.g. for t.as(id).run(ctx => assertAdminRole(ctx)). */
    as: async (userId: string) => t.withIdentity(await identityFor(userId)),
    query: call('query') as Call<'query'>,
    mutation: call('mutation') as Call<'mutation'>,
    action: call('action') as Call<'action'>,
  }
}

export type AuthedConvexTest = ReturnType<typeof authedConvexTest>
