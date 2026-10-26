/// <reference types="vite/client" />
import { describe, expect, test } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../schema'
import { verifyPassword } from './password'
import {
  catechistIssuedAccount,
  issuePasswords,
  revealPasswords,
  studentIssuedAccount,
} from './credentials'

const modules = import.meta.glob('../**/*.ts')

describe('issuePasswords', () => {
  test('returns count passwords, each hash verifying its plaintext', async () => {
    const issued = issuePasswords(3)
    expect(issued).toHaveLength(3)
    expect(new Set(issued.map((i) => i.password)).size).toBe(3)
    for (const { password, passwordHash } of issued) {
      expect(password).toHaveLength(10)
      expect(await verifyPassword(password, passwordHash)).toEqual({
        valid: true,
        legacy: false,
      })
    }
  })

  test('returns an empty list for zero', () => {
    expect(issuePasswords(0)).toEqual([])
  })
})

describe('revealPasswords', () => {
  const issued = [
    { password: 'aaaaaaaaaa', passwordHash: 'h1' },
    { password: 'bbbbbbbbbb', passwordHash: 'h2' },
  ]
  const account = (passwordHash: string, loginId: string) => ({
    accountType: 'catechist' as const,
    fullName: 'N',
    loginId,
    passwordHash,
  })

  test('pairs written accounts with their plaintext and drops the hash', () => {
    expect(revealPasswords(issued, [account('h2', 'CAT-2')])).toEqual([
      {
        accountType: 'catechist',
        fullName: 'N',
        loginId: 'CAT-2',
        password: 'bbbbbbbbbb',
      },
    ])
  })

  test('throws on an unknown hash', () => {
    expect(() => revealPasswords(issued, [account('nope', 'CAT-9')])).toThrow(
      'Unknown password hash',
    )
  })
})

describe('catechistIssuedAccount', () => {
  test('maps catechist names and login', () => {
    expect(
      catechistIssuedAccount(
        { saintName: 'Anna', fullName: 'B' },
        'CAT-1',
        'h',
      ),
    ).toEqual({
      accountType: 'catechist',
      saintName: 'Anna',
      fullName: 'B',
      loginId: 'CAT-1',
      passwordHash: 'h',
    })
  })
})

describe('studentIssuedAccount', () => {
  async function seed(t: ReturnType<typeof convexTest>) {
    return t.run(async (ctx) => {
      const studentId = await ctx.db.insert('students', {
        studentCode: '1',
        fullName: 'Stu',
        saintName: 'Peter',
        isActive: true,
        createdAt: 0,
        isDeleted: false,
      })
      await ctx.db.insert('branches', {
        name: 'B',
        sortOrder: 1,
        isDeleted: false,
      })
      const mkYear = (name: string, isActive: boolean) =>
        ctx.db.insert('academicYears', {
          name,
          startDate: '2025-01-01',
          endDate: '2025-12-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive,
          isDeleted: false,
        })
      const activeYear = await mkYear('2025', true)
      const oldYear = await mkYear('2024', false)
      return { studentId, activeYear, oldYear }
    })
  }

  const run = (t: ReturnType<typeof convexTest>, studentId: any) =>
    t.run(async (ctx) => {
      const student = (await ctx.db.get('students', studentId))!
      return studentIssuedAccount(ctx, student, 'STD-1', 'h')
    })

  test('omits className when there is no active academic year', async () => {
    const t = convexTest(schema, modules)
    const { studentId } = await t.run(async (ctx) => ({
      studentId: await ctx.db.insert('students', {
        studentCode: '1',
        fullName: 'Stu',
        isActive: true,
        createdAt: 0,
        isDeleted: false,
      }),
    }))
    expect(await run(t, studentId)).toEqual({
      accountType: 'student',
      saintName: undefined,
      fullName: 'Stu',
      className: undefined,
      loginId: 'STD-1',
      passwordHash: 'h',
    })
  })

  test('uses the primary class of the active year, ignoring other years and non-primary classes', async () => {
    const t = convexTest(schema, modules)
    const seeded = await seed(t)
    await t.run(async (ctx) => {
      const branchId = (await ctx.db.query('branches').first())!._id
      const mk = async (name: string, yearId: any) => {
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
      const enroll = (classYearId: any, isPrimaryClass: boolean) =>
        ctx.db.insert('studentClasses', {
          studentId: seeded.studentId,
          classYearId,
          isPrimaryClass,
          enrolledDate: '2025-01-01',
          status: 'active',
          isDeleted: false,
        })
      await enroll(await mk('Old Class', seeded.oldYear), true)
      await enroll(await mk('Elective', seeded.activeYear), false)
      await enroll(await mk('Primary Class', seeded.activeYear), true)
    })
    const res = await run(t, seeded.studentId)
    expect(res.className).toBe('Primary Class')
    expect(res.saintName).toBe('Peter')
    expect(res.accountType).toBe('student')
  })

  test('omits className when the student has no class in the active year', async () => {
    const t = convexTest(schema, modules)
    const seeded = await seed(t)
    expect((await run(t, seeded.studentId)).className).toBeUndefined()
  })
})
