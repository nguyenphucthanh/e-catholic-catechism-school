/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { authedConvexTest } from '../test-utils/authedConvexTest'
import { api, internal } from './_generated/api'
import schema from './schema'
import { AUTHZ_ERRORS } from './lib/errors'
import { nameSortKey } from './lib/name'

const modules = import.meta.glob('./**/*.ts')

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('nameSortKeys.reindexStudents', () => {
  test('backfills missing keys using appConfig.nameFormat and fixes stale ones', async () => {
    const t = authedConvexTest(schema, modules)
    const ids = await t.run(async (ctx) => {
      await ctx.db.insert('appConfig', {
        parishName: 'P',
        dioceseName: 'D',
        nameFormat: 'lastName_firstName',
      })
      const base = { isActive: true, createdAt: 1, isDeleted: false }
      return {
        missing: await ctx.db.insert('students', {
          ...base,
          studentCode: '1',
          fullName: 'Nguyễn Văn An',
        }),
        stale: await ctx.db.insert('students', {
          ...base,
          studentCode: '2',
          fullName: 'Trần Thị Bình',
          nameSortKey: 'old',
        }),
      }
    })

    const result = await t.mutation(internal.nameSortKeys.reindexStudents, {})
    expect(result).toEqual({ processed: 2, isDone: true })

    await t.run(async (ctx) => {
      expect((await ctx.db.get('students', ids.missing))!.nameSortKey).toBe(
        nameSortKey('Nguyễn Văn An', 'lastName_firstName'),
      )
      expect((await ctx.db.get('students', ids.stale))!.nameSortKey).toBe(
        nameSortKey('Trần Thị Bình', 'lastName_firstName'),
      )
    })
  })

  test('changing nameFormat via appConfig.upsert reindexes students', async () => {
    const t = authedConvexTest(schema, modules)
    const { adminId, studentId } = await t.run(async (ctx) => {
      await ctx.db.insert('appConfig', {
        parishName: 'P',
        dioceseName: 'D',
        nameFormat: 'lastName_firstName',
      })
      return {
        adminId: await ctx.db.insert('catechists', {
          memberId: 'GLV001',
          fullName: 'Admin',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        }),
        studentId: await ctx.db.insert('students', {
          studentCode: '1',
          fullName: 'Nguyễn Văn An',
          nameSortKey: nameSortKey('Nguyễn Văn An', 'lastName_firstName'),
          isActive: true,
          createdAt: 1,
          isDeleted: false,
        }),
      }
    })

    await t.mutation(api.appConfig.upsert, {
      requesterId: adminId,
      parishName: 'P',
      dioceseName: 'D',
      nameFormat: 'firstName_lastName',
      epiphanyOnSunday: true,
      corpusChristiOnSunday: true,
      ascensionOnSunday: true,
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    await t.run(async (ctx) => {
      expect((await ctx.db.get('students', studentId))!.nameSortKey).toBe(
        nameSortKey('Nguyễn Văn An', 'firstName_lastName'),
      )
    })
  })
})

describe('nameSortKeys.reindexStudentsBatch', () => {
  async function seed(studentCount: number, role: 'admin' | 'user') {
    const t = authedConvexTest(schema, modules)
    const requesterId = await t.run(async (ctx) => {
      await ctx.db.insert('appConfig', {
        parishName: 'P',
        dioceseName: 'D',
        nameFormat: 'lastName_firstName',
      })
      for (let i = 0; i < studentCount; i++) {
        await ctx.db.insert('students', {
          studentCode: String(i),
          fullName: `Nguyễn Văn ${i}`,
          isActive: true,
          createdAt: i,
          isDeleted: false,
        })
      }
      return ctx.db.insert('catechists', {
        memberId: 'GLV001',
        fullName: 'Admin',
        role,
        isActive: true,
        isDeleted: false,
      })
    })
    return { t, requesterId }
  }

  test('rejects non-admins', async () => {
    const { t, requesterId } = await seed(1, 'user')
    await expect(
      t.mutation(api.nameSortKeys.reindexStudentsBatch, { requesterId }),
    ).rejects.toThrow(AUTHZ_ERRORS.ADMIN_REQUIRED)
  })

  test('walks all students across batches via continueCursor', async () => {
    const { t, requesterId } = await seed(205, 'admin')

    let cursor: string | null = null
    let processed = 0
    let calls = 0
    for (;;) {
      const res: {
        processed: number
        isDone: boolean
        continueCursor: string
      } = await t.mutation(api.nameSortKeys.reindexStudentsBatch, {
        requesterId,
        cursor,
      })
      processed += res.processed
      calls++
      if (res.isDone) break
      cursor = res.continueCursor
    }

    expect(processed).toBe(205)
    expect(calls).toBe(2)
    await t.run(async (ctx) => {
      const all = await ctx.db.query('students').collect()
      expect(all.every((s) => s.nameSortKey !== undefined)).toBe(true)
    })
  })
})
