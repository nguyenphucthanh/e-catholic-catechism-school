/// <reference types="vite/client" />
import { describe, expect, test } from 'vitest'
import { authedConvexTest } from '../test-utils/authedConvexTest'
import { api } from './_generated/api'
import schema from './schema'
import { verifyPassword } from './lib/password'
import { ACCOUNT_ADMIN_ERRORS, AUTHZ_ERRORS } from './lib/errors'
import type { AuthedConvexTest } from '../test-utils/authedConvexTest'

const modules = import.meta.glob('./**/*.ts')
const PASSWORD_RE = /^[2-9a-hjkmnp-z]{10}$/

async function seedAdmin(t: AuthedConvexTest) {
  return t.run((ctx) =>
    ctx.db.insert('catechists', {
      memberId: '1',
      fullName: 'Admin',
      role: 'admin',
      isActive: true,
      isDeleted: false,
    }),
  )
}

async function seedUserCatechist(t: AuthedConvexTest) {
  return t.run((ctx) =>
    ctx.db.insert('catechists', {
      memberId: '2',
      fullName: 'User',
      role: 'user',
      isActive: true,
      isDeleted: false,
    }),
  )
}

const seedCatechist = (
  t: AuthedConvexTest,
  memberId: string,
  deleted = false,
) =>
  t.run((ctx) =>
    ctx.db.insert('catechists', {
      memberId,
      fullName: `Cat ${memberId}`,
      saintName: 'Anna',
      role: 'user',
      isActive: true,
      isDeleted: deleted,
    }),
  )

const seedStudent = (t: AuthedConvexTest, code: string, deleted = false) =>
  t.run((ctx) =>
    ctx.db.insert('students', {
      studentCode: code,
      fullName: `Stu ${code}`,
      isActive: true,
      createdAt: 0,
      isDeleted: deleted,
    }),
  )

const accountByLogin = (t: AuthedConvexTest, loginId: string) =>
  t.run((ctx) =>
    ctx.db
      .query('accounts')
      .withIndex('by_login_id', (q) => q.eq('loginId', loginId))
      .unique(),
  )

async function expectHashMatches(
  t: AuthedConvexTest,
  loginId: string,
  password: string,
) {
  expect(password).toMatch(PASSWORD_RE)
  expect(password).not.toBe(loginId)
  const acc = await accountByLogin(t, loginId)
  expect(acc?.mustChangePassword).toBe(true)
  expect(await verifyPassword(password, acc!.passwordHash)).toEqual({
    valid: true,
    legacy: false,
  })
}

describe('single grant / reset actions return the issued credential', () => {
  test('grantCatechistAccount', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await seedAdmin(t)
    const catId = await seedCatechist(t, '10')
    const { credential } = await t.action(
      api.accountAdmin.grantCatechistAccount,
      { requesterId: adminId, catechistId: catId },
    )
    expect(credential).toMatchObject({
      accountType: 'catechist',
      saintName: 'Anna',
      fullName: 'Cat 10',
      loginId: 'CAT-10',
    })
    expect(credential).not.toHaveProperty('passwordHash')
    await expectHashMatches(t, 'CAT-10', credential.password)
  })

  test('grantCatechistAccount restoring a soft-deleted account issues a new password', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await seedAdmin(t)
    const catId = await seedCatechist(t, '11')
    await t.run((ctx) =>
      ctx.db.insert('accounts', {
        loginId: 'CAT-11',
        passwordHash: 'old',
        accountType: 'catechist',
        userRefId: catId,
        isActive: false,
        createdAt: 0,
        isDeleted: true,
      }),
    )
    const { credential } = await t.action(
      api.accountAdmin.grantCatechistAccount,
      { requesterId: adminId, catechistId: catId },
    )
    expect((await accountByLogin(t, 'CAT-11'))?.isDeleted).toBe(false)
    await expectHashMatches(t, 'CAT-11', credential.password)
  })

  test('grantCatechistAccount throws for a missing catechist and writes nothing', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await seedAdmin(t)
    const catId = await seedCatechist(t, '12', true)
    await expect(
      t.action(api.accountAdmin.grantCatechistAccount, {
        requesterId: adminId,
        catechistId: catId,
      }),
    ).rejects.toThrow(ACCOUNT_ADMIN_ERRORS.CATECHIST_NOT_FOUND)
  })

  test('grantStudentAccount carries the primary class of the active year', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await seedAdmin(t)
    const studentId = await seedStudent(t, '20')
    await t.run(async (ctx) => {
      const branchId = await ctx.db.insert('branches', {
        name: 'B',
        sortOrder: 1,
        isDeleted: false,
      })
      const yearId = await ctx.db.insert('academicYears', {
        name: '2025',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: true,
        isDeleted: false,
      })
      const classId = await ctx.db.insert('classes', {
        branchId,
        name: 'Ấu Nhi 1',
        isDeleted: false,
      })
      const classYearId = await ctx.db.insert('classYears', {
        classId,
        academicYearId: yearId,
        isDeleted: false,
      })
      await ctx.db.insert('studentClasses', {
        studentId,
        classYearId,
        isPrimaryClass: true,
        enrolledDate: '2025-01-01',
        status: 'active',
        isDeleted: false,
      })
    })
    const { credential } = await t.action(
      api.accountAdmin.grantStudentAccount,
      {
        requesterId: adminId,
        studentId,
      },
    )
    expect(credential).toMatchObject({
      accountType: 'student',
      fullName: 'Stu 20',
      className: 'Ấu Nhi 1',
      loginId: 'STD-20',
    })
    await expectHashMatches(t, 'STD-20', credential.password)
  })

  test('grantStudentAccount has no className without an active year', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await seedAdmin(t)
    const studentId = await seedStudent(t, '21')
    const { credential } = await t.action(
      api.accountAdmin.grantStudentAccount,
      {
        requesterId: adminId,
        studentId,
      },
    )
    expect(credential.className).toBeUndefined()
  })

  test('grantStudentAccount throws for a deleted student', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await seedAdmin(t)
    const studentId = await seedStudent(t, '22', true)
    await expect(
      t.action(api.accountAdmin.grantStudentAccount, {
        requesterId: adminId,
        studentId,
      }),
    ).rejects.toThrow(ACCOUNT_ADMIN_ERRORS.STUDENT_NOT_FOUND)
  })

  test('resetPassword changes the hash, revokes sessions and returns the new password', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await seedAdmin(t)
    const catId = await seedCatechist(t, '30')
    const granted = await t.action(api.accountAdmin.grantCatechistAccount, {
      requesterId: adminId,
      catechistId: catId,
    })
    const before = await accountByLogin(t, 'CAT-30')
    const sessionId = await t.run((ctx) =>
      ctx.db.insert('sessions', {
        accountId: before!._id,
        secretHash: 'h',
        expiresAt: Number.MAX_SAFE_INTEGER,
      }),
    )

    const { credential } = await t.action(api.accountAdmin.resetPassword, {
      requesterId: adminId,
      accountId: before!._id,
    })

    expect(credential.password).not.toBe(granted.credential.password)
    expect(credential).toMatchObject({ loginId: 'CAT-30', fullName: 'Cat 30' })
    const after = await accountByLogin(t, 'CAT-30')
    expect(after?.passwordHash).not.toBe(before?.passwordHash)
    await expectHashMatches(t, 'CAT-30', credential.password)
    const session = await t.run((ctx) => ctx.db.get('sessions', sessionId))
    expect(session?.revokedAt).toBeTypeOf('number')
  })

  test('resetPassword on a student account returns a student credential', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await seedAdmin(t)
    const studentId = await seedStudent(t, '31')
    await t.action(api.accountAdmin.grantStudentAccount, {
      requesterId: adminId,
      studentId,
    })
    const acc = await accountByLogin(t, 'STD-31')
    const { credential } = await t.action(api.accountAdmin.resetPassword, {
      requesterId: adminId,
      accountId: acc!._id,
    })
    expect(credential.accountType).toBe('student')
    expect(credential.fullName).toBe('Stu 31')
    await expectHashMatches(t, 'STD-31', credential.password)
  })

  test('resetPassword throws for a missing account', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await seedAdmin(t)
    const catId = await seedCatechist(t, '32')
    const accountId = await t.run(async (ctx) => {
      const id = await ctx.db.insert('accounts', {
        loginId: 'CAT-32',
        passwordHash: 'x',
        accountType: 'catechist',
        userRefId: catId,
        isActive: true,
        createdAt: 0,
        isDeleted: true,
      })
      return id
    })
    await expect(
      t.action(api.accountAdmin.resetPassword, {
        requesterId: adminId,
        accountId,
      }),
    ).rejects.toThrow(ACCOUNT_ADMIN_ERRORS.ACCOUNT_NOT_FOUND)
  })

  test('non-admin is rejected and no account is written', async () => {
    const t = authedConvexTest(schema, modules)
    const userId = await seedUserCatechist(t)
    const catId = await seedCatechist(t, '40')
    await expect(
      t.action(api.accountAdmin.grantCatechistAccount, {
        requesterId: userId,
        catechistId: catId,
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.ADMIN_REQUIRED)
    expect(await accountByLogin(t, 'CAT-40')).toBeNull()
  })
})

describe('bulk grant / reset actions return credentials only for written rows', () => {
  test('bulkGrantCatechistAccounts skips deleted, existing live accounts, and restores deleted accounts', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await seedAdmin(t)
    const fresh = await seedCatechist(t, '50')
    const deletedCat = await seedCatechist(t, '51', true)
    const existing = await seedCatechist(t, '52')
    const restored = await seedCatechist(t, '53')
    await t.run(async (ctx) => {
      await ctx.db.insert('accounts', {
        loginId: 'CAT-52',
        passwordHash: 'keep',
        accountType: 'catechist',
        userRefId: existing,
        isActive: true,
        createdAt: 0,
        isDeleted: false,
      })
      await ctx.db.insert('accounts', {
        loginId: 'CAT-53',
        passwordHash: 'old',
        accountType: 'catechist',
        userRefId: restored,
        isActive: false,
        createdAt: 0,
        isDeleted: true,
      })
    })

    const { credentials } = await t.action(
      api.accountAdmin.bulkGrantCatechistAccounts,
      {
        requesterId: adminId,
        catechistIds: [fresh, deletedCat, existing, restored],
      },
    )

    expect(credentials.map((c: { loginId: string }) => c.loginId)).toEqual([
      'CAT-50',
      'CAT-53',
    ])
    for (const c of credentials) {
      await expectHashMatches(t, c.loginId, c.password)
    }
    expect((await accountByLogin(t, 'CAT-52'))?.passwordHash).toBe('keep')
    expect(await accountByLogin(t, 'CAT-51')).toBeNull()
  })

  test('bulkGrantStudentAccounts skips deleted and existing students', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await seedAdmin(t)
    const fresh = await seedStudent(t, '60')
    const deleted = await seedStudent(t, '61', true)
    const existing = await seedStudent(t, '62')
    await t.run((ctx) =>
      ctx.db.insert('accounts', {
        loginId: 'STD-62',
        passwordHash: 'keep',
        accountType: 'student',
        userRefId: existing,
        isActive: true,
        createdAt: 0,
        isDeleted: false,
      }),
    )
    const { credentials } = await t.action(
      api.accountAdmin.bulkGrantStudentAccounts,
      { requesterId: adminId, studentIds: [fresh, deleted, existing] },
    )
    expect(credentials).toHaveLength(1)
    expect(credentials[0]).toMatchObject({
      accountType: 'student',
      loginId: 'STD-60',
    })
    await expectHashMatches(t, 'STD-60', credentials[0].password)
    expect((await accountByLogin(t, 'STD-62'))?.passwordHash).toBe('keep')
  })

  test('bulkResetPasswords skips deleted accounts, resets others and revokes their sessions', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await seedAdmin(t)
    const c1 = await seedCatechist(t, '70')
    const c2 = await seedCatechist(t, '71')
    const s1 = await seedStudent(t, '72')
    const ids = await t.run(async (ctx) => {
      const mk = (
        loginId: string,
        type: 'catechist' | 'student',
        ref: any,
        isDeleted = false,
      ) =>
        ctx.db.insert('accounts', {
          loginId,
          passwordHash: 'old',
          accountType: type,
          userRefId: ref,
          isActive: true,
          createdAt: 0,
          isDeleted,
        })
      return {
        a1: await mk('CAT-70', 'catechist', c1),
        a2: await mk('CAT-71', 'catechist', c2, true),
        a3: await mk('STD-72', 'student', s1),
      }
    })
    const sessionId = await t.run((ctx) =>
      ctx.db.insert('sessions', {
        accountId: ids.a1,
        secretHash: 'h',
        expiresAt: Number.MAX_SAFE_INTEGER,
      }),
    )

    const { credentials } = await t.action(
      api.accountAdmin.bulkResetPasswords,
      {
        requesterId: adminId,
        accountIds: [ids.a1, ids.a2, ids.a3],
      },
    )

    expect(credentials.map((c: { loginId: string }) => c.loginId)).toEqual([
      'CAT-70',
      'STD-72',
    ])
    for (const c of credentials)
      await expectHashMatches(t, c.loginId, c.password)
    expect((await accountByLogin(t, 'CAT-71'))?.passwordHash).toBe('old')
    expect(
      (await t.run((ctx) => ctx.db.get('sessions', sessionId)))?.revokedAt,
    ).toBeTypeOf('number')
  })

  test('bulkResetPasswords with a duplicated account id yields one working credential', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await seedAdmin(t)
    const catId = await seedCatechist(t, '75')
    const accountId = await t.run((ctx) =>
      ctx.db.insert('accounts', {
        loginId: 'CAT-75',
        passwordHash: 'old',
        accountType: 'catechist',
        userRefId: catId,
        isActive: true,
        createdAt: 0,
        isDeleted: false,
      }),
    )
    const { credentials } = await t.action(
      api.accountAdmin.bulkResetPasswords,
      {
        requesterId: adminId,
        accountIds: [accountId, accountId],
      },
    )
    expect(credentials).toHaveLength(1)
    await expectHashMatches(t, 'CAT-75', credentials[0].password)
  })

  test('bulk actions return empty credentials for empty input', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await seedAdmin(t)
    const res = await t.action(api.accountAdmin.bulkResetPasswords, {
      requesterId: adminId,
      accountIds: [],
    })
    expect(res).toEqual({ credentials: [] })
  })

  test('non-admin is rejected by every bulk action', async () => {
    const t = authedConvexTest(schema, modules)
    const userId = await seedUserCatechist(t)
    await expect(
      t.action(api.accountAdmin.bulkGrantStudentAccounts, {
        requesterId: userId,
        studentIds: [],
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.ADMIN_REQUIRED)
    await expect(
      t.action(api.accountAdmin.bulkGrantCatechistAccounts, {
        requesterId: userId,
        catechistIds: [],
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.ADMIN_REQUIRED)
    await expect(
      t.action(api.accountAdmin.bulkResetPasswords, {
        requesterId: userId,
        accountIds: [],
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.ADMIN_REQUIRED)
  })
})

describe('create / transform actions return the issued credential', () => {
  test('catechists.createWithDetails', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await seedAdmin(t)
    const { catechistId, credential } = await t.action(
      api.catechists.createWithDetails,
      {
        requesterId: adminId,
        fullName: 'New One',
        saintName: 'Paul',
        role: 'user',
      },
    )
    expect(credential).toMatchObject({
      accountType: 'catechist',
      fullName: 'New One',
      saintName: 'Paul',
    })
    const acc = await t.run((ctx) =>
      ctx.db
        .query('accounts')
        .withIndex('by_login_id', (q) => q.eq('loginId', credential.loginId))
        .unique(),
    )
    expect(acc?.userRefId).toBe(catechistId)
    await expectHashMatches(t, credential.loginId, credential.password)
  })

  test('catechists.createWithDetails rejects non-admin', async () => {
    const t = authedConvexTest(schema, modules)
    const userId = await seedUserCatechist(t)
    await expect(
      t.action(api.catechists.createWithDetails, {
        requesterId: userId,
        fullName: 'X',
        role: 'user',
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.ADMIN_REQUIRED)
  })

  test('students.createStudentWithProfile', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await seedAdmin(t)
    const { studentId, credential } = await t.action(
      api.students.createStudentWithProfile,
      {
        requesterId: adminId,
        student: { fullName: 'New Kid', saintName: 'Mary' },
        guardians: [],
      },
    )
    expect(credential).toMatchObject({
      accountType: 'student',
      fullName: 'New Kid',
      saintName: 'Mary',
    })
    const acc = await t.run((ctx) =>
      ctx.db
        .query('accounts')
        .withIndex('by_login_id', (q) => q.eq('loginId', credential.loginId))
        .unique(),
    )
    expect(acc?.userRefId).toBe(studentId)
    await expectHashMatches(t, credential.loginId, credential.password)
  })

  test('students.createStudentWithProfile rejects an unauthenticated caller and writes nothing', async () => {
    const t = authedConvexTest(schema, modules)
    await expect(
      t.action(api.students.createStudentWithProfile, {
        student: { fullName: 'X' },
        guardians: [],
      }),
    ).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query('students').collect())).toEqual([])
  })

  test('catechists.transformStudentsToCatechists returns credentials without initialPassword', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await seedAdmin(t)
    const s1 = await seedStudent(t, '80')
    const s2 = await seedStudent(t, '81')
    const gone = await seedStudent(t, '82', true)

    const res = await t.action(api.catechists.transformStudentsToCatechists, {
      requesterId: adminId,
      studentIds: [s1, gone, s2],
    })

    expect(res.count).toBe(2)
    expect(res.items).toHaveLength(2)
    for (const item of res.items)
      expect(item).not.toHaveProperty('initialPassword')
    expect(res).not.toHaveProperty('accounts')
    expect(res.credentials).toHaveLength(2)
    expect(
      res.credentials.map((c: { loginId: string }) => c.loginId).sort(),
    ).toEqual(res.items.map((i: { loginId: string }) => i.loginId).sort())
    for (const c of res.credentials) {
      expect(c.accountType).toBe('catechist')
      await expectHashMatches(t, c.loginId, c.password)
    }
  })

  test('transformStudentsToCatechists with no ids returns empty credentials', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await seedAdmin(t)
    const res = await t.action(api.catechists.transformStudentsToCatechists, {
      requesterId: adminId,
      studentIds: [],
    })
    expect(res).toEqual({ count: 0, items: [], credentials: [] })
  })
})
