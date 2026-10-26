/// <reference types="vite/client" />
import { describe, expect, test } from 'vitest'
import { authedConvexTest } from '../test-utils/authedConvexTest'
import { api } from './_generated/api'
import { AUTHZ_ERRORS } from './lib/errors'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

describe('storage.generateUploadUrl', () => {
  const seed = async () => {
    const t = authedConvexTest(schema, modules)
    const ids = await t.run(async (ctx) => ({
      catechistId: await ctx.db.insert('catechists', {
        memberId: 'ST_C',
        fullName: 'C',
        role: 'user',
        isActive: true,
        isDeleted: false,
      }),
      studentId: await ctx.db.insert('students', {
        studentCode: '701',
        fullName: 'S',
        isActive: true,
        isDeleted: false,
        createdAt: Date.now(),
      }),
    }))
    return { t, ...ids }
  }

  test('returns a URL for a valid catechist', async () => {
    const { t, catechistId } = await seed()
    const url = await t.mutation(api.storage.generateUploadUrl, {
      requester: { accountType: 'catechist', requesterId: catechistId },
    })
    expect(url).toEqual(expect.any(String))
  })

  test('returns a URL for a valid student', async () => {
    const { t, studentId } = await seed()
    const url = await t.mutation(api.storage.generateUploadUrl, {
      requester: { accountType: 'student', requesterId: studentId },
    })
    expect(url).toEqual(expect.any(String))
  })

  test('throws for a deleted catechist', async () => {
    const { t, catechistId } = await seed()
    await t.run((ctx) =>
      ctx.db.patch('catechists', catechistId, { isDeleted: true }),
    )
    await expect(
      t.mutation(api.storage.generateUploadUrl, {
        requester: { accountType: 'catechist', requesterId: catechistId },
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.ACCOUNT_DELETED)
  })
})
