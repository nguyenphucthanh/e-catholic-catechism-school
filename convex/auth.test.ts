/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { hashPassword } from './lib/password'

const modules = import.meta.glob('./**/*.ts')

describe('auth backend functions', () => {
  // ─── login mutation ───────────────────────────────────────────────────────

  test('login succeeds for an active catechist account', async () => {
    const t = convexTest(schema, modules)

    const catechistId = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0001',
        fullName: 'Nguyễn Văn A',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    })

    const hash = await hashPassword('secret123')
    await t.run(async (ctx) => {
      await ctx.db.insert('accounts', {
        loginId: 'GLV0001',
        passwordHash: hash,
        accountType: 'catechist',
        userRefId: catechistId,
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
    })

    const result = await t.mutation(api.auth.login, {
      loginId: 'GLV0001',
      password: 'secret123',
    })

    expect(result.accountType).toBe('catechist')
    expect(result.memberId).toBe('GLV0001')
    expect(result.fullName).toBe('Nguyễn Văn A')
    expect(result.role).toBe('user')
  })

  test('login succeeds for a student account and returns student fields', async () => {
    const t = convexTest(schema, modules)

    const studentId = await t.run(async (ctx) => {
      return ctx.db.insert('students', {
        studentCode: 'HS0001',
        fullName: 'Trần Thị B',
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
    })

    const hash = await hashPassword('pass456')
    await t.run(async (ctx) => {
      await ctx.db.insert('accounts', {
        loginId: 'HS0001',
        passwordHash: hash,
        accountType: 'student',
        userRefId: studentId,
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
    })

    const result = await t.mutation(api.auth.login, {
      loginId: 'HS0001',
      password: 'pass456',
    })

    expect(result.accountType).toBe('student')
    expect(result.memberId).toBe('HS0001')
    expect(result.fullName).toBe('Trần Thị B')
    expect(result.role).toBeNull()
  })

  test('login throws for a non-existent account', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.mutation(api.auth.login, {
        loginId: 'nobody',
        password: 'anything',
      }),
    ).rejects.toThrow('Invalid credentials')
  })

  test('login throws for an inactive account', async () => {
    const t = convexTest(schema, modules)

    const catechistId = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0099',
        fullName: 'Inactive User',
        role: 'user',
        isActive: false,
        isDeleted: false,
      })
    })

    const hash = await hashPassword('secret')
    await t.run(async (ctx) => {
      await ctx.db.insert('accounts', {
        loginId: 'GLV0099',
        passwordHash: hash,
        accountType: 'catechist',
        userRefId: catechistId,
        isActive: false, // inactive
        createdAt: Date.now(),
        isDeleted: false,
      })
    })

    await expect(
      t.mutation(api.auth.login, {
        loginId: 'GLV0099',
        password: 'secret',
      }),
    ).rejects.toThrow('Invalid credentials')
  })

  test('login throws for wrong password', async () => {
    const t = convexTest(schema, modules)

    const catechistId = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0002',
        fullName: 'Nguyễn Văn B',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const hash = await hashPassword('correctPassword')
    await t.run(async (ctx) => {
      await ctx.db.insert('accounts', {
        loginId: 'GLV0002',
        passwordHash: hash,
        accountType: 'catechist',
        userRefId: catechistId,
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
    })

    await expect(
      t.mutation(api.auth.login, {
        loginId: 'GLV0002',
        password: 'wrongPassword',
      }),
    ).rejects.toThrow('Invalid credentials')
  })

  // ─── changePassword mutation ───────────────────────────────────────────────

  test('changePassword succeeds with correct current password', async () => {
    const t = convexTest(schema, modules)

    const catechistId = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0003',
        fullName: 'Nguyễn Văn C',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    })

    const hash = await hashPassword('oldPass1')
    await t.run(async (ctx) => {
      await ctx.db.insert('accounts', {
        loginId: 'GLV0003',
        passwordHash: hash,
        accountType: 'catechist',
        userRefId: catechistId,
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
    })

    // changePassword should not throw
    await t.mutation(api.auth.changePassword, {
      loginId: 'GLV0003',
      oldPassword: 'oldPass1',
      newPassword: 'newPass2',
    })

    // Login with new password should succeed
    const result = await t.mutation(api.auth.login, {
      loginId: 'GLV0003',
      password: 'newPass2',
    })
    expect(result.memberId).toBe('GLV0003')
  })

  test('changePassword throws for wrong old password', async () => {
    const t = convexTest(schema, modules)

    const catechistId = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV0004',
        fullName: 'Nguyễn Văn D',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    })

    const hash = await hashPassword('myPassword')
    await t.run(async (ctx) => {
      await ctx.db.insert('accounts', {
        loginId: 'GLV0004',
        passwordHash: hash,
        accountType: 'catechist',
        userRefId: catechistId,
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
    })

    await expect(
      t.mutation(api.auth.changePassword, {
        loginId: 'GLV0004',
        oldPassword: 'wrongOldPassword',
        newPassword: 'newPassword',
      }),
    ).rejects.toThrow('Current password is incorrect')
  })

  test('changePassword throws for non-existent account', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.mutation(api.auth.changePassword, {
        loginId: 'nonexistent',
        oldPassword: 'any',
        newPassword: 'newone',
      }),
    ).rejects.toThrow('Invalid credentials')
  })
})
