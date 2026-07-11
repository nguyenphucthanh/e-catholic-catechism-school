/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import schema from '../schema'
import { assertAdminRole } from './authz'
import { nextCounter, reserveCounterBatch } from './counter'

const modules = import.meta.glob('../**/*.ts')

describe('assertAdminRole', () => {
  test('returns catechist doc for an active board member', async () => {
    const t = convexTest(schema, modules)
    const boardId = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0001',
        fullName: 'Board User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const result = await t.run(async (ctx) => {
      return assertAdminRole(ctx, boardId)
    })

    expect(result.role).toBe('admin')
    expect(result.fullName).toBe('Board User')
  })

  test('throws when catechist is not found', async () => {
    const t = convexTest(schema, modules)
    // Insert a dummy record just to get a valid Id shape, then delete it
    const id = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'TEMP',
        fullName: 'Temp',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })
    await t.run(async (ctx) => {
      await ctx.db.delete('catechists', id)
    })

    await expect(
      t.run(async (ctx) => assertAdminRole(ctx, id)),
    ).rejects.toThrow('Catechist profile not found')
  })

  test('throws when catechist is soft-deleted', async () => {
    const t = convexTest(schema, modules)
    const id = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0002',
        fullName: 'Deleted User',
        role: 'admin',
        isActive: true,
        isDeleted: true,
      })
    })

    await expect(
      t.run(async (ctx) => assertAdminRole(ctx, id)),
    ).rejects.toThrow('Account has been deleted')
  })

  test('throws when catechist is inactive', async () => {
    const t = convexTest(schema, modules)
    const id = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0003',
        fullName: 'Inactive User',
        role: 'admin',
        isActive: false,
        isDeleted: false,
      })
    })

    await expect(
      t.run(async (ctx) => assertAdminRole(ctx, id)),
    ).rejects.toThrow('Account is inactive')
  })

  test('throws when catechist has non-board role', async () => {
    const t = convexTest(schema, modules)
    const id = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0004',
        fullName: 'Regular Catechist',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    })

    await expect(
      t.run(async (ctx) => assertAdminRole(ctx, id)),
    ).rejects.toThrow('does not have admin permissions')
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

describe('reserveCounterBatch', () => {
  test('returns an empty array and does not touch the counters table for count=0', async () => {
    const t = convexTest(schema, modules)
    const result = await t.run(async (ctx) =>
      reserveCounterBatch(ctx, 'batch', 0),
    )
    expect(result).toEqual([])
    const counters = await t.run(async (ctx) =>
      ctx.db.query('counters').collect(),
    )
    expect(counters).toHaveLength(0)
  })

  test('reserves a sequential range starting at 1 for a new counter name', async () => {
    const t = convexTest(schema, modules)
    const result = await t.run(async (ctx) =>
      reserveCounterBatch(ctx, 'batch', 5),
    )
    expect(result).toEqual([1, 2, 3, 4, 5])
  })

  test('continues sequentially from an existing counter value (patch branch)', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => reserveCounterBatch(ctx, 'batch', 3))
    const second = await t.run(async (ctx) =>
      reserveCounterBatch(ctx, 'batch', 2),
    )
    expect(second).toEqual([4, 5])
  })

  test('is consistent with nextCounter for the same counter name', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => nextCounter(ctx, 'mixed'))
    const batch = await t.run(async (ctx) =>
      reserveCounterBatch(ctx, 'mixed', 2),
    )
    expect(batch).toEqual([2, 3])
  })
})
