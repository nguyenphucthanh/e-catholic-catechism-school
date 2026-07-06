/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

describe('search.globalSearch', () => {
  test('rejects a student requesterId (catechist-only)', async () => {
    const t = convexTest(schema, modules)

    const studentId = await t.run(async (ctx) => {
      return await ctx.db.insert('students', {
        studentCode: 'HS001',
        fullName: 'Nguyen Van A',
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
    })

    await expect(
      t.query(api.search.globalSearch, {
        // @ts-expect-error intentionally passing a student id to a catechist-only arg
        requesterId: studentId,
        query: 'Nguyen',
      }),
    ).rejects.toThrow()
  })

  test('returns empty arrays for empty/whitespace query without hitting search index', async () => {
    const t = convexTest(schema, modules)

    const catechistId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV001',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const emptyResult = await t.query(api.search.globalSearch, {
      requesterId: catechistId,
      query: '',
    })
    expect(emptyResult).toEqual({ students: [], catechists: [] })

    const whitespaceResult = await t.query(api.search.globalSearch, {
      requesterId: catechistId,
      query: '   ',
    })
    expect(whitespaceResult).toEqual({ students: [], catechists: [] })
  })

  test('returns matching students and catechists by fullName', async () => {
    const t = convexTest(schema, modules)

    const catechistId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV001',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    await t.run(async (ctx) => {
      await ctx.db.insert('catechists', {
        memberId: 'GLV002',
        fullName: 'Nguyen Van Thanh',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
      await ctx.db.insert('students', {
        studentCode: 'HS001',
        fullName: 'Nguyen Van Binh',
        saintName: 'Maria',
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
      // Unrelated name, should not match.
      await ctx.db.insert('students', {
        studentCode: 'HS002',
        fullName: 'Tran Thi Cuc',
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
    })

    const result = await t.query(api.search.globalSearch, {
      requesterId: catechistId,
      query: 'Nguyen',
    })

    expect(result.students).toHaveLength(1)
    expect(result.students[0]).toMatchObject({
      fullName: 'Nguyen Van Binh',
      saintName: 'Maria',
      studentCode: 'HS001',
    })

    expect(result.catechists).toHaveLength(1)
    expect(result.catechists[0]).toMatchObject({
      fullName: 'Nguyen Van Thanh',
      memberId: 'GLV002',
    })
  })

  test('excludes soft-deleted students and catechists', async () => {
    const t = convexTest(schema, modules)

    const catechistId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV001',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    await t.run(async (ctx) => {
      await ctx.db.insert('catechists', {
        memberId: 'GLV003',
        fullName: 'Nguyen Deleted Catechist',
        role: 'user',
        isActive: true,
        isDeleted: true,
      })
      await ctx.db.insert('students', {
        studentCode: 'HS003',
        fullName: 'Nguyen Deleted Student',
        isActive: true,
        createdAt: Date.now(),
        isDeleted: true,
      })
    })

    const result = await t.query(api.search.globalSearch, {
      requesterId: catechistId,
      query: 'Nguyen',
    })

    expect(result.students).toHaveLength(0)
    expect(result.catechists).toHaveLength(0)
  })
})
