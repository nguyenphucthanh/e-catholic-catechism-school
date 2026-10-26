/// <reference types="vite/client" />
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { authedConvexTest } from '../test-utils/authedConvexTest'
import { api } from './_generated/api'
import schema from './schema'
import { sha256Hex } from './lib/password'
import { TOKEN_TTL_SECONDS, signSessionJwt } from './lib/sessions'
import type * as SessionsModule from './lib/sessions'

// convex-test has no ctx.auth.signJwt, so stub the signing seam.
vi.mock('./lib/sessions', async (orig) => ({
  ...(await orig<typeof SessionsModule>()),
  signSessionJwt: vi.fn(() => Promise.resolve('signed.jwt.token')),
}))

const modules = import.meta.glob('./**/*.ts')

describe('issueToken success path', () => {
  const secret = 'f'.repeat(64)
  beforeEach(() => vi.mocked(signSessionJwt).mockClear())

  async function seed(expiresInMs: number) {
    const t = authedConvexTest(schema, modules)
    const catechistId = await t.run((ctx) =>
      ctx.db.insert('catechists', {
        memberId: '1',
        fullName: 'C',
        role: 'user',
        isActive: true,
        isDeleted: false,
      }),
    )
    const accountId = await t.run((ctx) =>
      ctx.db.insert('accounts', {
        loginId: 'S-1',
        passwordHash: 'x',
        accountType: 'catechist',
        userRefId: catechistId,
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      }),
    )
    const secretHash = await sha256Hex(secret)
    const sessionId = await t.run((ctx) =>
      ctx.db.insert('sessions', {
        accountId,
        secretHash,
        expiresAt: Date.now() + expiresInMs,
      }),
    )
    return { t, catechistId, sessionId }
  }

  test('signs sub/sid claims with TTL capped at 1 hour', async () => {
    const { t, catechistId, sessionId } = await seed(14 * 24 * 3600 * 1000)

    const token = await t.mutation(api.auth.issueToken, { sessionId, secret })

    expect(token).toBe('signed.jwt.token')
    expect(signSessionJwt).toHaveBeenCalledTimes(1)
    const [, claims, ttl] = vi.mocked(signSessionJwt).mock.calls[0]
    expect(claims).toEqual({ sub: `catechist|${catechistId}`, sid: sessionId })
    expect(ttl).toBe(TOKEN_TTL_SECONDS)
  })

  test('clamps TTL to remaining session time when it expires sooner', async () => {
    const { t, sessionId } = await seed(90_000)

    await t.mutation(api.auth.issueToken, { sessionId, secret })

    const ttl = vi.mocked(signSessionJwt).mock.calls[0][2]
    expect(ttl).toBeLessThanOrEqual(90)
    expect(ttl).toBeGreaterThan(80)
  })

  test('TTL is at least 1 second', async () => {
    const { t, sessionId } = await seed(500)

    await t.mutation(api.auth.issueToken, { sessionId, secret })

    expect(vi.mocked(signSessionJwt).mock.calls[0][2]).toBe(1)
  })
})
