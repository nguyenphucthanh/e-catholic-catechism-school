/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { hashPassword } from './lib/password'

const modules = import.meta.glob('./**/*.ts')

describe('setup backend functions', () => {
  // ─── hasAdmin query ─────────────────────────────────────────────────────

  test('hasAdmin returns false on empty database', async () => {
    const t = convexTest(schema, modules)

    const result = await t.query(api.setup.hasAdmin, {})

    expect(result).toBe(false)
  })

  test('hasAdmin returns false when only non-admin catechists exist', async () => {
    const t = convexTest(schema, modules)

    await t.run(async (ctx) => {
      await ctx.db.insert('catechists', {
        memberId: 'GLV0001',
        fullName: 'Regular User',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    })

    const result = await t.query(api.setup.hasAdmin, {})

    expect(result).toBe(false)
  })

  test('hasAdmin returns true once an admin catechist exists', async () => {
    const t = convexTest(schema, modules)

    await t.run(async (ctx) => {
      await ctx.db.insert('catechists', {
        memberId: 'GLV0002',
        fullName: 'Admin User',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const result = await t.query(api.setup.hasAdmin, {})

    expect(result).toBe(true)
  })

  test('hasAdmin returns false when the only admin is soft-deleted', async () => {
    const t = convexTest(schema, modules)

    await t.run(async (ctx) => {
      await ctx.db.insert('catechists', {
        memberId: 'GLV0003',
        fullName: 'Deleted Admin',
        role: 'admin',
        isActive: true,
        isDeleted: true,
      })
    })

    const result = await t.query(api.setup.hasAdmin, {})

    expect(result).toBe(false)
  })

  // ─── runSetup mutation ──────────────────────────────────────────────────

  test('runSetup creates the first admin catechist and account, returning login shape', async () => {
    const t = convexTest(schema, modules)

    const result = await t.mutation(api.setup.runSetup, {
      fullName: 'Nguyễn Văn Quản Trị',
      saintName: 'Phêrô',
      loginId: 'admin',
      password: 'supersecret',
    })

    expect(result.accountType).toBe('catechist')
    expect(result.loginId).toBe('admin')
    expect(result.fullName).toBe('Nguyễn Văn Quản Trị')
    expect(result.role).toBe('admin')
    expect(typeof result.memberId).toBe('string')
    expect(result.userDocId).toBeDefined()

    await t.run(async (ctx) => {
      const catechist = await ctx.db.get('catechists', result.userDocId)
      expect(catechist).not.toBeNull()
      expect(catechist?.role).toBe('admin')
      expect(catechist?.fullName).toBe('Nguyễn Văn Quản Trị')
      expect(catechist?.saintName).toBe('Phêrô')
      expect(catechist?.isDeleted).toBe(false)

      const account = await ctx.db
        .query('accounts')
        .withIndex('by_login_id', (q) => q.eq('loginId', 'admin'))
        .unique()
      expect(account).not.toBeNull()
      expect(account?.accountType).toBe('catechist')
      expect(account?.userRefId).toBe(result.userDocId)
      expect(account?.isActive).toBe(true)
    })

    // The new account should be able to log in immediately with the password.
    const loginResult = await t.mutation(api.auth.login, {
      loginId: 'admin',
      password: 'supersecret',
    })
    expect(loginResult.role).toBe('admin')
  })

  test('runSetup rejects when an admin already exists', async () => {
    const t = convexTest(schema, modules)

    await t.run(async (ctx) => {
      await ctx.db.insert('catechists', {
        memberId: 'GLV0004',
        fullName: 'Existing Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    await expect(
      t.mutation(api.setup.runSetup, {
        fullName: 'Someone Else',
        loginId: 'someoneelse',
        password: 'longenough',
      }),
    ).rejects.toThrow('Setup already completed')
  })

  test('runSetup rejects a duplicate loginId', async () => {
    const t = convexTest(schema, modules)

    const catechistId = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0005',
        fullName: 'Non Admin',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    })

    const hash = hashPassword('whatever1')
    await t.run(async (ctx) => {
      await ctx.db.insert('accounts', {
        loginId: 'taken',
        passwordHash: hash,
        accountType: 'catechist',
        userRefId: catechistId,
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
    })

    await expect(
      t.mutation(api.setup.runSetup, {
        fullName: 'New Admin',
        loginId: 'taken',
        password: 'longenough',
      }),
    ).rejects.toThrow('Login ID already in use')
  })

  test('runSetup rejects a password shorter than 8 characters', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.mutation(api.setup.runSetup, {
        fullName: 'New Admin',
        loginId: 'admin',
        password: 'short',
      }),
    ).rejects.toThrow('Password must be at least 8 characters')
  })
})
