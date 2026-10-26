/// <reference types="vite/client" />
import { describe, expect, test } from 'vitest'
import { authedConvexTest } from '../../test-utils/authedConvexTest'
import schema from '../schema'
import { sha256Hex } from './password'
import {
  IMPERSONATION_TTL_MS,
  SESSION_TTL_MS,
  createSession,
  newSessionSecret,
  revokeSessions,
} from './sessions'
import type { convexTest } from 'convex-test'
import type { Id } from '../_generated/dataModel'

const modules = import.meta.glob('../**/*.ts')

describe('newSessionSecret', () => {
  test('returns 64-hex secret with matching hash, distinct per call', async () => {
    const a = await newSessionSecret()
    const b = await newSessionSecret()
    expect(a.secret).toMatch(/^[0-9a-f]{64}$/)
    expect(a.secretHash).toBe(await sha256Hex(a.secret))
    expect(a.secret).not.toBe(b.secret)
    expect(a.secretHash).not.toBe(b.secretHash)
  })
})

async function seedAccount(t: ReturnType<typeof convexTest>, n = '1') {
  return t.run(async (ctx) => {
    const catechistId = await ctx.db.insert('catechists', {
      memberId: n,
      fullName: 'C',
      role: 'user',
      isActive: true,
      isDeleted: false,
    })
    return ctx.db.insert('accounts', {
      loginId: `L-${n}`,
      passwordHash: 'x',
      accountType: 'catechist',
      userRefId: catechistId,
      isActive: true,
      createdAt: Date.now(),
      isDeleted: false,
    })
  })
}

describe('createSession', () => {
  test('uses SESSION_TTL_MS normally and IMPERSONATION_TTL_MS when impersonated', async () => {
    const t = authedConvexTest(schema, modules)
    const accountId = await seedAccount(t)
    const { normal, imp, impId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert('catechists', {
        memberId: '9',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
      const before = Date.now()
      const n = await createSession(ctx, { accountId, secretHash: 'h1' })
      const i = await createSession(ctx, {
        accountId,
        secretHash: 'h2',
        impersonatorId: adminId,
      })
      return {
        normal: { ...(await ctx.db.get('sessions', n))!, before },
        imp: { ...(await ctx.db.get('sessions', i))!, before },
        impId: adminId,
      }
    })
    expect(normal.expiresAt - normal.before).toBeGreaterThanOrEqual(
      SESSION_TTL_MS,
    )
    expect(normal.expiresAt - normal.before).toBeLessThan(SESSION_TTL_MS + 5000)
    expect(normal.impersonatorId).toBeUndefined()
    expect(imp.impersonatorId).toBe(impId)
    expect(imp.expiresAt - imp.before).toBeGreaterThanOrEqual(
      IMPERSONATION_TTL_MS,
    )
    expect(imp.expiresAt - imp.before).toBeLessThan(IMPERSONATION_TTL_MS + 5000)
  })
})

describe('revokeSessions', () => {
  test('skips revoked, expired, and excepted sessions; revokes the rest', async () => {
    const t = authedConvexTest(schema, modules)
    const accountId = await seedAccount(t)
    const otherAccount = await seedAccount(t, '2')
    const future = Date.now() + 60_000

    const ids = await t.run(async (ctx) => {
      const mk = (over: object, acc = accountId) =>
        ctx.db.insert('sessions', {
          accountId: acc,
          secretHash: 'h',
          expiresAt: future,
          ...over,
        })
      return {
        active: await mk({}),
        kept: await mk({}),
        revoked: await mk({ revokedAt: 12345 }),
        expired: await mk({ expiresAt: Date.now() - 1000 }),
        other: await mk({}, otherAccount),
      }
    })

    await t.run((ctx) => revokeSessions(ctx, accountId, ids.kept))

    const get = (id: Id<'sessions'>) =>
      t.run((ctx) => ctx.db.get('sessions', id))
    expect((await get(ids.active))?.revokedAt).toBeTypeOf('number')
    expect((await get(ids.kept))?.revokedAt).toBeUndefined()
    expect((await get(ids.revoked))?.revokedAt).toBe(12345)
    expect((await get(ids.expired))?.revokedAt).toBeUndefined()
    expect((await get(ids.other))?.revokedAt).toBeUndefined()
  })

  test('null exception revokes all active sessions', async () => {
    const t = authedConvexTest(schema, modules)
    const accountId = await seedAccount(t)
    const sid = await t.run((ctx) =>
      ctx.db.insert('sessions', {
        accountId,
        secretHash: 'h',
        expiresAt: Date.now() + 60_000,
      }),
    )
    await t.run((ctx) => revokeSessions(ctx, accountId, null))
    expect(
      (await t.run((ctx) => ctx.db.get('sessions', sid)))?.revokedAt,
    ).toBeTypeOf('number')
  })
})
