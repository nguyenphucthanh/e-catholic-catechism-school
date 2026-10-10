/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import type { Id } from './_generated/dataModel'

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
        requesterId: studentId as unknown as Id<'catechists'>,
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

  test('returns the student primary class name for the active academic year only', async () => {
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
      const mkYear = (name: string, isActive: boolean) =>
        ctx.db.insert('academicYears', {
          name,
          startDate: '2025-09-01',
          endDate: '2026-06-01',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive,
          isDeleted: false,
        })
      const activeYearId = await mkYear('2025-2026', true)
      const oldYearId = await mkYear('2024-2025', false)
      const branchId = await ctx.db.insert('branches', {
        name: 'Ấu Nhi',
        sortOrder: 1,
        isDeleted: false,
      })
      const mkClassYear = async (name: string, yearId: typeof activeYearId) => {
        const classId = await ctx.db.insert('classes', {
          branchId,
          name,
          isDeleted: false,
        })
        return ctx.db.insert('classYears', {
          classId,
          academicYearId: yearId,
          isDeleted: false,
        })
      }
      const currentCy = await mkClassYear('Ấu Nhi 2', activeYearId)
      const oldCy = await mkClassYear('Ấu Nhi 1', oldYearId)
      const supplementalCy = await mkClassYear('Phụ', activeYearId)

      const mkStudent = (code: string, name: string) =>
        ctx.db.insert('students', {
          studentCode: code,
          fullName: name,
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
      const enroll = (
        studentId: Awaited<ReturnType<typeof mkStudent>>,
        classYearId: typeof currentCy,
        isPrimaryClass: boolean,
      ) =>
        ctx.db.insert('studentClasses', {
          studentId,
          classYearId,
          isPrimaryClass,
          enrolledDate: '2025-09-01',
          status: 'active',
          isDeleted: false,
        })

      const withClass = await mkStudent('HS1', 'Lop Co')
      await enroll(withClass, oldCy, true)
      await enroll(withClass, supplementalCy, false)
      await enroll(withClass, currentCy, true)

      const onlyOld = await mkStudent('HS2', 'Lop Cu')
      await enroll(onlyOld, oldCy, true)

      await mkStudent('HS3', 'Lop Khong')
    })

    const result = await t.query(api.search.globalSearch, {
      requesterId: catechistId,
      query: 'Lop',
    })
    const byCode = Object.fromEntries(
      result.students.map((s) => [s.studentCode, s.primaryClassName]),
    )
    expect(byCode).toEqual({ HS1: 'Ấu Nhi 2', HS2: null, HS3: null })
  })
})
