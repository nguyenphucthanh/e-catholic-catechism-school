/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import schema from '../schema'
import { assertBoardRole } from './authz'
import { nextCounter } from './counter'

const modules = import.meta.glob('../**/*.ts')

describe('assertBoardRole', () => {
  test('returns catechist doc for an active board member', async () => {
    const t = convexTest(schema, modules)
    const boardId = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0001',
        fullName: 'Board User',
        role: 'board',
        isActive: true,
        isDeleted: false,
      })
    })

    const result = await t.run(async (ctx) => {
      return assertBoardRole(ctx, boardId)
    })

    expect(result.role).toBe('board')
    expect(result.fullName).toBe('Board User')
  })

  test('throws when catechist is not found', async () => {
    const t = convexTest(schema, modules)
    // Insert a dummy record just to get a valid Id shape, then delete it
    const id = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'TEMP',
        fullName: 'Temp',
        role: 'board',
        isActive: true,
        isDeleted: false,
      })
    })
    await t.run(async (ctx) => {
      await ctx.db.delete('catechists', id)
    })

    await expect(
      t.run(async (ctx) => assertBoardRole(ctx, id)),
    ).rejects.toThrow('Catechist profile not found')
  })

  test('throws when catechist is soft-deleted', async () => {
    const t = convexTest(schema, modules)
    const id = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0002',
        fullName: 'Deleted User',
        role: 'board',
        isActive: true,
        isDeleted: true,
      })
    })

    await expect(
      t.run(async (ctx) => assertBoardRole(ctx, id)),
    ).rejects.toThrow('Account has been deleted')
  })

  test('throws when catechist is inactive', async () => {
    const t = convexTest(schema, modules)
    const id = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0003',
        fullName: 'Inactive User',
        role: 'board',
        isActive: false,
        isDeleted: false,
      })
    })

    await expect(
      t.run(async (ctx) => assertBoardRole(ctx, id)),
    ).rejects.toThrow('Account is inactive')
  })

  test('throws when catechist has non-board role', async () => {
    const t = convexTest(schema, modules)
    const id = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0004',
        fullName: 'Regular Catechist',
        role: 'catechist',
        isActive: true,
        isDeleted: false,
      })
    })

    await expect(
      t.run(async (ctx) => assertBoardRole(ctx, id)),
    ).rejects.toThrow('does not have board permissions')
  })
})

describe('nextCounter', () => {
  test('starts at 1 for a new counter name', async () => {
    const t = convexTest(schema, modules)
    const val = await t.run(async (ctx) => {
      return nextCounter(ctx, 'test-counter')
    })
    expect(val).toBe(1)
  })

  test('increments an existing counter', async () => {
    const t = convexTest(schema, modules)

    await t.run(async (ctx) => {
      await nextCounter(ctx, 'my-seq')
    })
    const second = await t.run(async (ctx) => {
      return nextCounter(ctx, 'my-seq')
    })
    expect(second).toBe(2)
  })

  test('independent counters do not affect each other', async () => {
    const t = convexTest(schema, modules)

    await t.run(async (ctx) => {
      await nextCounter(ctx, 'alpha')
      await nextCounter(ctx, 'alpha')
    })

    const beta = await t.run(async (ctx) => {
      return nextCounter(ctx, 'beta')
    })
    expect(beta).toBe(1)
  })
})
