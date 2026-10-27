/// <reference types="vite/client" />

import { describe, expect, test } from 'vitest'
import { authedConvexTest } from '../test-utils/authedConvexTest'
import { api } from './_generated/api'
import schema from './schema'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

function seedCatechist(
  ctx: any,
  opts: {
    memberId?: string
    fullName?: string
    saintName?: string
    isActive?: boolean
    isDeleted?: boolean
    photo?: Id<'_storage'>
  } = {},
): Promise<Id<'catechists'>> {
  return ctx.db.insert('catechists', {
    memberId: opts.memberId ?? 'GLV001',
    fullName: opts.fullName ?? 'Admin',
    ...(opts.saintName ? { saintName: opts.saintName } : {}),
    role: 'admin',
    isActive: opts.isActive ?? true,
    isDeleted: opts.isDeleted ?? false,
    ...(opts.photo ? { profilePhotoStorageId: opts.photo } : {}),
  })
}

describe('catechists.listForQrCards', () => {
  test('returns only active, non-deleted catechists with the card fields', async () => {
    const t = authedConvexTest(schema, modules)
    const { requesterId, otherId } = await t.run(async (ctx) => {
      const reqId = await seedCatechist(ctx)
      const othId = await seedCatechist(ctx, {
        memberId: 'GLV002',
        fullName: 'Bình',
        saintName: 'Maria',
      })
      await seedCatechist(ctx, {
        memberId: 'GLV003',
        fullName: 'Inactive',
        isActive: false,
      })
      await seedCatechist(ctx, {
        memberId: 'GLV004',
        fullName: 'Deleted',
        isDeleted: true,
      })
      return { requesterId: reqId, otherId: othId }
    })

    const result = await t.query(api.catechists.listForQrCards, {
      requesterId,
    })

    expect(result.map((r) => r.fullName).sort()).toEqual(['Admin', 'Bình'])
    expect(result.find((r) => r.fullName === 'Bình')).toEqual({
      catechistId: otherId,
      memberId: 'GLV002',
      fullName: 'Bình',
      saintName: 'Maria',
      photoUrl: null,
    })
  })

  test('photoUrl is a string when a photo is stored, otherwise null', async () => {
    const t = authedConvexTest(schema, modules)
    const requesterId = await t.run(async (ctx) => {
      const id = await seedCatechist(ctx)
      const photo = await ctx.storage.store(new Blob(['img']))
      await seedCatechist(ctx, {
        memberId: 'GLV002',
        fullName: 'With Photo',
        photo,
      })
      return id
    })

    const result = await t.query(api.catechists.listForQrCards, {
      requesterId,
    })
    const byName = Object.fromEntries(result.map((r) => [r.fullName, r]))

    expect(typeof byName['With Photo'].photoUrl).toBe('string')
    expect(byName['Admin'].photoUrl).toBeNull()
  })

  test.each([
    [
      'lastName_firstName',
      ['Nguyễn Văn An', 'Trần Thị Bình', 'Lê Hoàng Cường', 'Phạm Văn Dũng'],
    ],
    [
      'firstName_lastName',
      ['Lê Hoàng Cường', 'Nguyễn Văn An', 'Phạm Văn Dũng', 'Trần Thị Bình'],
    ],
  ] as const)(
    'sorts by appConfig.nameFormat %s',
    async (nameFormat, expected) => {
      const t = authedConvexTest(schema, modules)
      const requesterId = await t.run(async (ctx) => {
        const id = await seedCatechist(ctx, { fullName: 'Phạm Văn Dũng' })
        await ctx.db.insert('appConfig', {
          parishName: 'P',
          dioceseName: 'D',
          nameFormat,
        })
        let i = 10
        for (const name of [
          'Trần Thị Bình',
          'Lê Hoàng Cường',
          'Nguyễn Văn An',
        ]) {
          await seedCatechist(ctx, { memberId: `GLV${i++}`, fullName: name })
        }
        return id
      })

      const result = await t.query(api.catechists.listForQrCards, {
        requesterId,
      })

      expect(result.map((r) => r.fullName)).toEqual(expected)
    },
  )

  test('rejects when the requester is an inactive catechist', async () => {
    const t = authedConvexTest(schema, modules)
    const requesterId = await t.run((ctx) =>
      seedCatechist(ctx, { isActive: false }),
    )

    await expect(
      t.query(api.catechists.listForQrCards, { requesterId } as any),
    ).rejects.toThrow('ACCOUNT_INACTIVE')
  })
})
