/// <reference types="vite/client" />

import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { AUTHZ_ERRORS } from './lib/errors'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

function seedCatechist(
  ctx: any,
  memberId: string,
  role: 'admin' | 'user' = 'user',
): Promise<Id<'catechists'>> {
  return ctx.db.insert('catechists', {
    memberId,
    fullName: 'Test Catechist',
    role,
    isActive: true,
    isDeleted: false,
  })
}

describe('appConfig.get', () => {
  test('returns null when no config row exists', async () => {
    const t = convexTest(schema, modules)
    const result = await t.query(api.appConfig.get, {})
    expect(result).toBeNull()
  })

  test('applies liturgical-calendar defaults when fields are unset and no logo', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('appConfig', {
        parishName: 'Giáo xứ Test',
        dioceseName: 'Giáo phận Test',
        nameFormat: 'firstName_lastName',
      })
    })

    const result = await t.query(api.appConfig.get, {})
    expect(result).not.toBeNull()
    expect(result?.parishName).toBe('Giáo xứ Test')
    expect(result?.epiphanyOnSunday).toBe(true)
    expect(result?.corpusChristiOnSunday).toBe(true)
    expect(result?.ascensionOnSunday).toBe(true)
    expect(result?.logoUrl).toBeUndefined()
  })

  test('preserves explicit false values for liturgical-calendar fields', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('appConfig', {
        parishName: 'Giáo xứ Test',
        dioceseName: 'Giáo phận Test',
        nameFormat: 'lastName_firstName',
        epiphanyOnSunday: false,
        corpusChristiOnSunday: false,
        ascensionOnSunday: false,
      })
    })

    const result = await t.query(api.appConfig.get, {})
    expect(result?.epiphanyOnSunday).toBe(false)
    expect(result?.corpusChristiOnSunday).toBe(false)
    expect(result?.ascensionOnSunday).toBe(false)
  })

  test('resolves logoUrl via ctx.storage.getUrl when logoStorageId is present', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(['fake-logo-bytes']))
      await ctx.db.insert('appConfig', {
        parishName: 'Giáo xứ Test',
        dioceseName: 'Giáo phận Test',
        nameFormat: 'firstName_lastName',
        logoStorageId: storageId,
      })
    })

    const result = await t.query(api.appConfig.get, {})
    expect(result?.logoUrl).toBeDefined()
    expect(typeof result?.logoUrl).toBe('string')
  })
})

describe('appConfig.upsert', () => {
  test('rejects non-admin requesters', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run((ctx) => seedCatechist(ctx, 'GLV001', 'user'))

    await expect(
      t.mutation(api.appConfig.upsert, {
        requesterId: userId,
        parishName: 'Giáo xứ Test',
        dioceseName: 'Giáo phận Test',
        nameFormat: 'firstName_lastName',
        epiphanyOnSunday: true,
        corpusChristiOnSunday: true,
        ascensionOnSunday: true,
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.ADMIN_REQUIRED)
  })

  test('inserts a new row when none exists', async () => {
    const t = convexTest(schema, modules)
    const adminId = await t.run((ctx) => seedCatechist(ctx, 'GLV002', 'admin'))

    await t.mutation(api.appConfig.upsert, {
      requesterId: adminId,
      troopName: 'Đoàn Test',
      parishName: 'Giáo xứ Test',
      dioceseName: 'Giáo phận Test',
      nameFormat: 'firstName_lastName',
      epiphanyOnSunday: true,
      corpusChristiOnSunday: false,
      ascensionOnSunday: true,
    })

    const result = await t.query(api.appConfig.get, {})
    expect(result?.parishName).toBe('Giáo xứ Test')
    expect(result?.troopName).toBe('Đoàn Test')
    expect(result?.corpusChristiOnSunday).toBe(false)
  })

  test('patches the existing row instead of inserting a second one', async () => {
    const t = convexTest(schema, modules)
    const adminId = await t.run((ctx) => seedCatechist(ctx, 'GLV003', 'admin'))

    await t.mutation(api.appConfig.upsert, {
      requesterId: adminId,
      parishName: 'Giáo xứ Cũ',
      dioceseName: 'Giáo phận Test',
      nameFormat: 'firstName_lastName',
      epiphanyOnSunday: true,
      corpusChristiOnSunday: true,
      ascensionOnSunday: true,
    })

    await t.mutation(api.appConfig.upsert, {
      requesterId: adminId,
      parishName: 'Giáo xứ Mới',
      dioceseName: 'Giáo phận Test',
      nameFormat: 'lastName_firstName',
      epiphanyOnSunday: false,
      corpusChristiOnSunday: false,
      ascensionOnSunday: false,
    })

    const result = await t.query(api.appConfig.get, {})
    expect(result?.parishName).toBe('Giáo xứ Mới')
    expect(result?.nameFormat).toBe('lastName_firstName')

    const rowCount = await t.run(async (ctx) => {
      const rows = await ctx.db.query('appConfig').collect()
      return rows.length
    })
    expect(rowCount).toBe(1)
  })

  test('clears logoStorageId when passed null', async () => {
    const t = convexTest(schema, modules)
    const adminId = await t.run((ctx) => seedCatechist(ctx, 'GLV004', 'admin'))

    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(['fake-logo-bytes'])),
    )

    await t.mutation(api.appConfig.upsert, {
      requesterId: adminId,
      parishName: 'Giáo xứ Test',
      dioceseName: 'Giáo phận Test',
      nameFormat: 'firstName_lastName',
      logoStorageId: storageId,
      epiphanyOnSunday: true,
      corpusChristiOnSunday: true,
      ascensionOnSunday: true,
    })

    let result = await t.query(api.appConfig.get, {})
    expect(result?.logoUrl).toBeDefined()

    await t.mutation(api.appConfig.upsert, {
      requesterId: adminId,
      parishName: 'Giáo xứ Test',
      dioceseName: 'Giáo phận Test',
      nameFormat: 'firstName_lastName',
      logoStorageId: null,
      epiphanyOnSunday: true,
      corpusChristiOnSunday: true,
      ascensionOnSunday: true,
    })

    result = await t.query(api.appConfig.get, {})
    expect(result?.logoUrl).toBeUndefined()
  })
})
