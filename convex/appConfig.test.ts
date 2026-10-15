/// <reference types="vite/client" />

import { convexTest } from 'convex-test'
import { afterEach, describe, expect, test } from 'vitest'
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

  test('defaults catechistTitles to [] when unset', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('appConfig', {
        parishName: 'Giáo xứ Test',
        dioceseName: 'Giáo phận Test',
        nameFormat: 'firstName_lastName',
      })
    })

    const result = await t.query(api.appConfig.get, {})
    expect(result?.catechistTitles).toEqual([])
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

  test('upserts and retrieves attendancePointConfig', async () => {
    const t = convexTest(schema, modules)
    const adminId = await t.run((ctx) => seedCatechist(ctx, 'GLV005', 'admin'))

    // Initially defaults to rate mode
    await t.mutation(api.appConfig.upsert, {
      requesterId: adminId,
      parishName: 'Giáo xứ Test',
      dioceseName: 'Giáo phận Test',
      nameFormat: 'firstName_lastName',
      epiphanyOnSunday: true,
      corpusChristiOnSunday: true,
      ascensionOnSunday: true,
    })
    let config = await t.query(api.appConfig.get, {})
    expect(config?.attendancePointConfig).toEqual({ mode: 'rate' })

    // Update with type mode
    await t.mutation(api.appConfig.upsert, {
      requesterId: adminId,
      parishName: 'Giáo xứ Test',
      dioceseName: 'Giáo phận Test',
      nameFormat: 'firstName_lastName',
      epiphanyOnSunday: true,
      corpusChristiOnSunday: true,
      ascensionOnSunday: true,
      attendancePointConfig: {
        mode: 'type',
        present: 10,
        late: 9,
        excused: 0,
        absentUnset: -0.5,
      },
    })
    config = await t.query(api.appConfig.get, {})
    expect(config?.attendancePointConfig).toEqual({
      mode: 'type',
      present: 10,
      late: 9,
      excused: 0,
      absentUnset: -0.5,
    })
  })

  test.each([11, -10.5, NaN, Infinity])(
    'rejects out-of-range attendance point %s',
    async (bad) => {
      const t = convexTest(schema, modules)
      const adminId = await t.run((ctx) =>
        seedCatechist(ctx, 'GLV006', 'admin'),
      )
      await expect(
        t.mutation(api.appConfig.upsert, {
          requesterId: adminId,
          parishName: 'Giáo xứ Test',
          dioceseName: 'Giáo phận Test',
          nameFormat: 'firstName_lastName',
          epiphanyOnSunday: true,
          corpusChristiOnSunday: true,
          ascensionOnSunday: true,
          attendancePointConfig: {
            mode: 'type',
            present: bad,
            late: 9,
            excused: 0,
            absentUnset: 0,
          },
        }),
      ).rejects.toThrow('ATTENDANCE_INVALID_POINT_CONFIG')
    },
  )

  test('saves catechistTitles trimmed, without empties or duplicates', async () => {
    const t = convexTest(schema, modules)
    const adminId = await t.run((ctx) => seedCatechist(ctx, 'GLV003', 'admin'))
    const base = {
      requesterId: adminId,
      parishName: 'Giáo xứ Test',
      dioceseName: 'Giáo phận Test',
      nameFormat: 'firstName_lastName' as const,
      epiphanyOnSunday: true,
      corpusChristiOnSunday: true,
      ascensionOnSunday: true,
    }

    await t.mutation(api.appConfig.upsert, {
      ...base,
      catechistTitles: ['Trợ tá', 'Phụ tá'],
    })
    expect((await t.query(api.appConfig.get, {}))?.catechistTitles).toEqual([
      'Trợ tá',
      'Phụ tá',
    ])

    await t.mutation(api.appConfig.upsert, {
      ...base,
      catechistTitles: ['  Trợ tá ', '', '   ', 'Trợ tá', 'Phụ tá'],
    })
    expect((await t.query(api.appConfig.get, {}))?.catechistTitles).toEqual([
      'Trợ tá',
      'Phụ tá',
    ])
  })
})

describe('appConfig.getAccountPrefixes', () => {
  const origCat = process.env.CATECHIST_ACCOUNT_PREFIX
  const origStd = process.env.STUDENT_ACCOUNT_PREFIX
  const restore = (k: string, v: string | undefined) => {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  afterEach(() => {
    restore('CATECHIST_ACCOUNT_PREFIX', origCat)
    restore('STUDENT_ACCOUNT_PREFIX', origStd)
  })

  const seedStudent = (ctx: any, extra: object = {}) =>
    ctx.db.insert('students', {
      studentCode: '1',
      createdAt: 0,
      fullName: 'Test Student',
      isActive: true,
      isDeleted: false,
      ...extra,
    })

  test('returns defaults for a valid catechist', async () => {
    delete process.env.CATECHIST_ACCOUNT_PREFIX
    delete process.env.STUDENT_ACCOUNT_PREFIX
    const t = convexTest(schema, modules)
    const id = await t.run((ctx) => seedCatechist(ctx, 'C1'))
    const res = await t.query(api.appConfig.getAccountPrefixes, {
      requester: { accountType: 'catechist', requesterId: id },
    })
    expect(res).toEqual({ student: 'STD', catechist: 'CAT' })
  })

  test('honors env overrides for a valid student', async () => {
    process.env.CATECHIST_ACCOUNT_PREFIX = 'GLV'
    process.env.STUDENT_ACCOUNT_PREFIX = 'TN'
    const t = convexTest(schema, modules)
    const id = await t.run((ctx) => seedStudent(ctx))
    const res = await t.query(api.appConfig.getAccountPrefixes, {
      requester: { accountType: 'student', requesterId: id },
    })
    expect(res).toEqual({ student: 'TN', catechist: 'GLV' })
  })

  test('rejects an inactive catechist', async () => {
    const t = convexTest(schema, modules)
    const id = await t.run((ctx) =>
      ctx.db.insert('catechists', {
        memberId: 'C2',
        fullName: 'X',
        role: 'user',
        isActive: false,
        isDeleted: false,
      }),
    )
    await expect(
      t.query(api.appConfig.getAccountPrefixes, {
        requester: { accountType: 'catechist', requesterId: id },
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.ACCOUNT_INACTIVE)
  })

  test('rejects a deleted student', async () => {
    const t = convexTest(schema, modules)
    const id = await t.run((ctx) => seedStudent(ctx, { isDeleted: true }))
    await expect(
      t.query(api.appConfig.getAccountPrefixes, {
        requester: { accountType: 'student', requesterId: id },
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.ACCOUNT_DELETED)
  })
})
