/// <reference types="vite/client" />
import { describe, expect, test, vi } from 'vitest'
import { authedConvexTest } from '../test-utils/authedConvexTest'
import { internal } from './_generated/api'
import schema from './schema'
import { SESSION_RETENTION_MS } from './sessionCleanup'
import type { AuthedConvexTest } from '../test-utils/authedConvexTest'

const modules = import.meta.glob('./**/*.ts')
const DAY = 24 * 60 * 60 * 1000

async function seedSessions(t: AuthedConvexTest, expiresAts: Array<number>) {
  return t.run(async (ctx) => {
    const catechistId = await ctx.db.insert('catechists', {
      memberId: 'C1',
      fullName: 'C One',
      role: 'user',
      isActive: true,
      isDeleted: false,
    })
    const accountId = await ctx.db.insert('accounts', {
      loginId: 'C1',
      passwordHash: 'x',
      accountType: 'catechist',
      userRefId: catechistId,
      isActive: true,
      createdAt: Date.now(),
      isDeleted: false,
    })
    for (const expiresAt of expiresAts) {
      await ctx.db.insert('sessions', { accountId, secretHash: 'x', expiresAt })
    }
  })
}

const remaining = (t: AuthedConvexTest) =>
  t.run(async (ctx) => (await ctx.db.query('sessions').collect()).length)

describe('purgeExpiredSessions', () => {
  test('deletes sessions expired beyond retention, keeps the rest', async () => {
    const t = authedConvexTest(schema, modules)
    const now = Date.now()
    await seedSessions(t, [
      now - SESSION_RETENTION_MS - DAY, // purge
      now - SESSION_RETENTION_MS - 1000, // purge
      now - DAY, // expired recently: keep
      now + DAY, // live: keep
    ])

    await t.mutation(internal.sessionCleanup.purgeExpiredSessions, {})

    expect(await remaining(t)).toBe(2)
  })

  test('is a no-op when nothing is stale', async () => {
    const t = authedConvexTest(schema, modules)
    await seedSessions(t, [Date.now() + DAY])
    await t.mutation(internal.sessionCleanup.purgeExpiredSessions, {})
    expect(await remaining(t)).toBe(1)
  })

  test('reschedules itself when a full batch was deleted', async () => {
    vi.useFakeTimers()
    try {
      const t = authedConvexTest(schema, modules)
      const old = Date.now() - SESSION_RETENTION_MS - DAY
      await seedSessions(t, [old, old, old])

      await t.mutation(internal.sessionCleanup.purgeExpiredSessions, {
        batchSize: 2,
      })
      expect(await remaining(t)).toBe(1)

      await t.finishAllScheduledFunctions(vi.runAllTimers)
      expect(await remaining(t)).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
