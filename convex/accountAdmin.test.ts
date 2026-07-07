/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { hashPassword } from './lib/password'

const modules = import.meta.glob('./**/*.ts')

describe('accountAdmin backend functions', () => {
  // ─── helpers ──────────────────────────────────────────────────────────────

  async function seedAdminCatechist(t: ReturnType<typeof convexTest>) {
    return t.run(async (ctx) => {
      const id = await ctx.db.insert('catechists', {
        memberId: '1',
        fullName: 'Admin User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
      const hash = await hashPassword('admin123')
      await ctx.db.insert('accounts', {
        loginId: 'CAT-1',
        passwordHash: hash,
        accountType: 'catechist',
        userRefId: id,
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
      return id
    })
  }

  async function seedNonAdminCatechist(t: ReturnType<typeof convexTest>) {
    return t.run(async (ctx) => {
      const id = await ctx.db.insert('catechists', {
        memberId: '2',
        fullName: 'Regular Catechist',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
      const hash = await hashPassword('secret')
      await ctx.db.insert('accounts', {
        loginId: 'CAT-2',
        passwordHash: hash,
        accountType: 'catechist',
        userRefId: id,
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
      return id
    })
  }

  async function seedPlainCatechist(
    t: ReturnType<typeof convexTest>,
    memberId = '3',
  ) {
    return t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId,
        fullName: 'Plain Catechist',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    })
  }

  async function seedPlainStudent(
    t: ReturnType<typeof convexTest>,
    studentCode = '1',
  ) {
    return t.run(async (ctx) => {
      return ctx.db.insert('students', {
        studentCode,
        fullName: 'Test Student',
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
    })
  }

  // ─── listCatechistAccounts ────────────────────────────────────────────────

  describe('listCatechistAccounts', () => {
    test('returns catechists with null account when no account exists', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdminCatechist(t)
      const plainId = await seedPlainCatechist(t, '10')

      const result = await t.query(api.accountAdmin.listCatechistAccounts, {
        requesterId: adminId,
        paginationOpts: { numItems: 100, cursor: null },
      })

      const plain = result.page.find((r) => r.catechist._id === plainId)
      const adminEntry = result.page.find((r) => r.catechist._id === adminId)

      expect(plain?.account).toBeNull()
      expect(adminEntry?.account).not.toBeNull()
      expect(adminEntry?.account?.loginId).toBe('CAT-1')
    })

    test('returns account for catechists that have one', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdminCatechist(t)

      const result = await t.query(api.accountAdmin.listCatechistAccounts, {
        requesterId: adminId,
        paginationOpts: { numItems: 100, cursor: null },
      })

      const adminEntry = result.page.find((r) => r.catechist._id === adminId)
      expect(adminEntry?.account).not.toBeNull()
    })

    test('throws for non-admin requester', async () => {
      const t = convexTest(schema, modules)
      const nonAdminId = await seedNonAdminCatechist(t)

      await expect(
        t.query(api.accountAdmin.listCatechistAccounts, {
          requesterId: nonAdminId,
          paginationOpts: { numItems: 100, cursor: null },
        }),
      ).rejects.toThrow('Unauthorized')
    })
  })

  // ─── listStudentAccounts ──────────────────────────────────────────────────

  describe('listStudentAccounts', () => {
    test('returns students with null account when no account exists', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdminCatechist(t)
      const studentId = await seedPlainStudent(t, '5')

      const result = await t.query(api.accountAdmin.listStudentAccounts, {
        requesterId: adminId,
        paginationOpts: { numItems: 100, cursor: null },
      })

      const entry = result.page.find((r) => r.student._id === studentId)
      expect(entry?.account).toBeNull()
    })

    test('returns students with their linked account', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdminCatechist(t)
      const studentId = await seedPlainStudent(t, '5')

      await t.run(async (ctx) => {
        await ctx.db.insert('accounts', {
          loginId: 'STD-5',
          passwordHash: await hashPassword('STD-5'),
          accountType: 'student',
          userRefId: studentId,
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
      })

      const result = await t.query(api.accountAdmin.listStudentAccounts, {
        requesterId: adminId,
        paginationOpts: { numItems: 100, cursor: null },
      })

      const entry = result.page.find((r) => r.student._id === studentId)
      expect(entry?.account).not.toBeNull()
      expect(entry?.account?.loginId).toBe('STD-5')
    })

    test('throws for non-admin requester', async () => {
      const t = convexTest(schema, modules)
      const nonAdminId = await seedNonAdminCatechist(t)

      await expect(
        t.query(api.accountAdmin.listStudentAccounts, {
          requesterId: nonAdminId,
          paginationOpts: { numItems: 100, cursor: null },
        }),
      ).rejects.toThrow('Unauthorized')
    })
  })

  // ─── grantCatechistAccount ────────────────────────────────────────────────

  describe('grantCatechistAccount', () => {
    test('creates account for catechist without one', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdminCatechist(t)
      const plainId = await seedPlainCatechist(t, '50')

      await t.mutation(api.accountAdmin.grantCatechistAccount, {
        requesterId: adminId,
        catechistId: plainId,
      })

      const account = await t.run(async (ctx) => {
        return ctx.db
          .query('accounts')
          .withIndex('by_login_id', (q) => q.eq('loginId', 'CAT-50'))
          .unique()
      })

      expect(account).not.toBeNull()
      expect(account?.accountType).toBe('catechist')
      expect(account?.userRefId).toBe(plainId)
      expect(account?.isActive).toBe(true)
      expect(account?.isDeleted).toBe(false)
    })

    test('restores soft-deleted account', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdminCatechist(t)
      const plainId = await seedPlainCatechist(t, '60')

      await t.run(async (ctx) => {
        await ctx.db.insert('accounts', {
          loginId: 'CAT-60',
          passwordHash: 'oldhash',
          accountType: 'catechist',
          userRefId: plainId,
          isActive: false,
          createdAt: Date.now(),
          isDeleted: true,
        })
      })

      await t.mutation(api.accountAdmin.grantCatechistAccount, {
        requesterId: adminId,
        catechistId: plainId,
      })

      const account = await t.run(async (ctx) => {
        return ctx.db
          .query('accounts')
          .withIndex('by_login_id', (q) => q.eq('loginId', 'CAT-60'))
          .unique()
      })

      expect(account?.isDeleted).toBe(false)
      expect(account?.isActive).toBe(true)
    })

    test('throws if account already exists', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdminCatechist(t)
      const plainId = await seedPlainCatechist(t, '70')

      await t.mutation(api.accountAdmin.grantCatechistAccount, {
        requesterId: adminId,
        catechistId: plainId,
      })

      await expect(
        t.mutation(api.accountAdmin.grantCatechistAccount, {
          requesterId: adminId,
          catechistId: plainId,
        }),
      ).rejects.toThrow('ACCOUNT_ALREADY_EXISTS')
    })

    test('throws for non-admin requester', async () => {
      const t = convexTest(schema, modules)
      const nonAdminId = await seedNonAdminCatechist(t)
      const plainId = await seedPlainCatechist(t, '80')

      await expect(
        t.mutation(api.accountAdmin.grantCatechistAccount, {
          requesterId: nonAdminId,
          catechistId: plainId,
        }),
      ).rejects.toThrow('Unauthorized')
    })
  })

  // ─── grantStudentAccount ──────────────────────────────────────────────────

  describe('grantStudentAccount', () => {
    test('creates account for student without one', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdminCatechist(t)
      const studentId = await seedPlainStudent(t, '100')

      await t.mutation(api.accountAdmin.grantStudentAccount, {
        requesterId: adminId,
        studentId,
      })

      const account = await t.run(async (ctx) => {
        return ctx.db
          .query('accounts')
          .withIndex('by_login_id', (q) => q.eq('loginId', 'STD-100'))
          .unique()
      })

      expect(account).not.toBeNull()
      expect(account?.accountType).toBe('student')
      expect(account?.userRefId).toBe(studentId)
      expect(account?.isActive).toBe(true)
    })

    test('restores soft-deleted student account', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdminCatechist(t)
      const studentId = await seedPlainStudent(t, '110')

      await t.run(async (ctx) => {
        await ctx.db.insert('accounts', {
          loginId: 'STD-110',
          passwordHash: 'oldhash',
          accountType: 'student',
          userRefId: studentId,
          isActive: false,
          createdAt: Date.now(),
          isDeleted: true,
        })
      })

      await t.mutation(api.accountAdmin.grantStudentAccount, {
        requesterId: adminId,
        studentId,
      })

      const account = await t.run(async (ctx) => {
        return ctx.db
          .query('accounts')
          .withIndex('by_login_id', (q) => q.eq('loginId', 'STD-110'))
          .unique()
      })

      expect(account?.isDeleted).toBe(false)
      expect(account?.isActive).toBe(true)
    })

    test('throws if student account already exists', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdminCatechist(t)
      const studentId = await seedPlainStudent(t, '120')

      await t.mutation(api.accountAdmin.grantStudentAccount, {
        requesterId: adminId,
        studentId,
      })

      await expect(
        t.mutation(api.accountAdmin.grantStudentAccount, {
          requesterId: adminId,
          studentId,
        }),
      ).rejects.toThrow('ACCOUNT_ALREADY_EXISTS')
    })
  })

  // ─── resetPassword ────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    test('resets password to loginId', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdminCatechist(t)
      const plainId = await seedPlainCatechist(t, '200')

      await t.mutation(api.accountAdmin.grantCatechistAccount, {
        requesterId: adminId,
        catechistId: plainId,
      })

      const account = await t.run(async (ctx) => {
        return ctx.db
          .query('accounts')
          .withIndex('by_login_id', (q) => q.eq('loginId', 'CAT-200'))
          .unique()
      })

      await t.mutation(api.accountAdmin.resetPassword, {
        requesterId: adminId,
        accountId: account!._id,
      })

      const loginResult = await t.mutation(api.auth.login, {
        loginId: 'CAT-200',
        password: 'CAT-200',
      })
      expect(loginResult.memberId).toBe('200')
    })

    test('throws for non-admin', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdminCatechist(t)
      const nonAdminId = await seedNonAdminCatechist(t)
      const plainId = await seedPlainCatechist(t, '300')

      await t.mutation(api.accountAdmin.grantCatechistAccount, {
        requesterId: adminId,
        catechistId: plainId,
      })

      const account = await t.run(async (ctx) => {
        return ctx.db
          .query('accounts')
          .withIndex('by_login_id', (q) => q.eq('loginId', 'CAT-300'))
          .unique()
      })

      await expect(
        t.mutation(api.accountAdmin.resetPassword, {
          requesterId: nonAdminId,
          accountId: account!._id,
        }),
      ).rejects.toThrow('Unauthorized')
    })
  })

  // ─── toggleAccountStatus ──────────────────────────────────────────────────

  describe('toggleAccountStatus', () => {
    test('disables an active account', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdminCatechist(t)
      const plainId = await seedPlainCatechist(t, '400')

      await t.mutation(api.accountAdmin.grantCatechistAccount, {
        requesterId: adminId,
        catechistId: plainId,
      })

      const account = await t.run(async (ctx) => {
        return ctx.db
          .query('accounts')
          .withIndex('by_login_id', (q) => q.eq('loginId', 'CAT-400'))
          .unique()
      })

      await t.mutation(api.accountAdmin.toggleAccountStatus, {
        requesterId: adminId,
        accountId: account!._id,
      })

      const updated = await t.run(async (ctx) => {
        return ctx.db.get('accounts', account!._id)
      })
      expect(updated?.isActive).toBe(false)

      await expect(
        t.mutation(api.auth.login, {
          loginId: 'CAT-400',
          password: 'CAT-400',
        }),
      ).rejects.toThrow('Invalid credentials')
    })

    test('enables a disabled account', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdminCatechist(t)
      const plainId = await seedPlainCatechist(t, '500')

      await t.mutation(api.accountAdmin.grantCatechistAccount, {
        requesterId: adminId,
        catechistId: plainId,
      })

      const account = await t.run(async (ctx) => {
        return ctx.db
          .query('accounts')
          .withIndex('by_login_id', (q) => q.eq('loginId', 'CAT-500'))
          .unique()
      })

      await t.mutation(api.accountAdmin.toggleAccountStatus, {
        requesterId: adminId,
        accountId: account!._id,
      })
      await t.mutation(api.accountAdmin.toggleAccountStatus, {
        requesterId: adminId,
        accountId: account!._id,
      })

      const updated = await t.run(async (ctx) => {
        return ctx.db.get('accounts', account!._id)
      })
      expect(updated?.isActive).toBe(true)

      const result = await t.mutation(api.auth.login, {
        loginId: 'CAT-500',
        password: 'CAT-500',
      })
      expect(result.memberId).toBe('500')
    })
  })
})
