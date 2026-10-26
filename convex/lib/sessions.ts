import { sha256Hex } from './password'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000
export const IMPERSONATION_TTL_MS = 2 * 60 * 60 * 1000
// Convex caps self-signed JWTs at 1 hour; clients re-mint via issueToken.
export const TOKEN_TTL_SECONDS = 60 * 60
// Must match applicationID in convex/auth.config.ts.
export const JWT_AUDIENCE = 'giaoly'

/**
 * Generates a session secret and its hash. Call from an action only:
 * mutation randomness is seeded for deterministic replay, so it is not a
 * safe source for credentials.
 */
export async function newSessionSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const secret = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
    '',
  )
  return { secret, secretHash: await sha256Hex(secret) }
}

export async function createSession(
  ctx: MutationCtx,
  args: {
    accountId: Id<'accounts'>
    secretHash: string
    impersonatorId?: Id<'catechists'>
  },
) {
  const ttl = args.impersonatorId ? IMPERSONATION_TTL_MS : SESSION_TTL_MS
  return await ctx.db.insert('sessions', {
    accountId: args.accountId,
    secretHash: args.secretHash,
    impersonatorId: args.impersonatorId,
    expiresAt: Date.now() + ttl,
  })
}

export async function revokeSessions(
  ctx: MutationCtx,
  accountId: Id<'accounts'>,
  exceptSessionId?: Id<'sessions'> | null,
) {
  const now = Date.now()
  const sessions = await ctx.db
    .query('sessions')
    .withIndex('by_account_id', (q) => q.eq('accountId', accountId))
    .collect()
  for (const s of sessions) {
    if (s._id === exceptSessionId || s.revokedAt || s.expiresAt <= now) continue
    await ctx.db.patch('sessions', s._id, { revokedAt: now })
  }
}

// Isolated so tests can stub it: convex-test has no ctx.auth.signJwt.
export async function signSessionJwt(
  ctx: MutationCtx,
  claims: { sub: string; sid: Id<'sessions'> },
  expiresInSeconds: number,
) {
  return await ctx.auth.signJwt({
    claims: { ...claims, aud: JWT_AUDIENCE },
    expiresInSeconds,
  })
}
