/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { api } from './_generated/api'
import { verifyRecaptcha } from './auth'
import schema from './schema'
import { hashPassword } from './lib/password'
import { AUTH_ERRORS } from './lib/errors'

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
    expect(result.mustChangePassword).toBe(false)
  })

  test('login returns mustChangePassword: true when flag is set on account', async () => {
    const t = convexTest(schema, modules)

    const catechistId = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV9999',
        fullName: 'Nguyễn Văn Test',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    })

    const hash = await hashPassword('default123')
    await t.run(async (ctx) => {
      await ctx.db.insert('accounts', {
        loginId: 'GLV9999',
        passwordHash: hash,
        accountType: 'catechist',
        userRefId: catechistId,
        mustChangePassword: true,
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
    })

    const result = await t.mutation(api.auth.login, {
      loginId: 'GLV9999',
      password: 'default123',
    })

    expect(result.mustChangePassword).toBe(true)
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
    ).rejects.toThrow(AUTH_ERRORS.INVALID_CREDENTIALS)
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
    ).rejects.toThrow(AUTH_ERRORS.INVALID_CREDENTIALS)
  })

  test('login throws for a soft-deleted account', async () => {
    const t = convexTest(schema, modules)

    const catechistId = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'GLV_DEL',
        fullName: 'Deleted User',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    })

    const hash = await hashPassword('secret')
    await t.run(async (ctx) => {
      await ctx.db.insert('accounts', {
        loginId: 'GLV_DEL',
        passwordHash: hash,
        accountType: 'catechist',
        userRefId: catechistId,
        isActive: true,
        createdAt: Date.now(),
        isDeleted: true, // soft-deleted
      })
    })

    await expect(
      t.mutation(api.auth.login, {
        loginId: 'GLV_DEL',
        password: 'secret',
      }),
    ).rejects.toThrow(AUTH_ERRORS.INVALID_CREDENTIALS)

    await expect(
      t.action(api.auth.loginWithRecaptcha, {
        loginId: 'GLV_DEL',
        password: 'secret',
      }),
    ).rejects.toThrow(AUTH_ERRORS.INVALID_CREDENTIALS)
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
    ).rejects.toThrow(AUTH_ERRORS.INVALID_CREDENTIALS)
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
        mustChangePassword: true,
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

    const account = await t.run(async (ctx) => {
      return ctx.db
        .query('accounts')
        .withIndex('by_login_id', (q) => q.eq('loginId', 'GLV0003'))
        .unique()
    })
    expect(account?.mustChangePassword).toBe(false)

    // Login with new password should succeed
    const result = await t.mutation(api.auth.login, {
      loginId: 'GLV0003',
      password: 'newPass2',
    })
    expect(result.memberId).toBe('GLV0003')
    expect(result.mustChangePassword).toBe(false)
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
    ).rejects.toThrow(AUTH_ERRORS.CURRENT_PASSWORD_INCORRECT)
  })

  test('changePassword throws for non-existent account', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.mutation(api.auth.changePassword, {
        loginId: 'nonexistent',
        oldPassword: 'any',
        newPassword: 'newone',
      }),
    ).rejects.toThrow(AUTH_ERRORS.INVALID_CREDENTIALS)
  })

  // ─── resetAdminPassword mutation ───────────────────────────────────────────

  describe('resetAdminPassword', () => {
    const originalCode = process.env.BREAK_GLASS_CODE

    afterEach(() => {
      if (originalCode === undefined) {
        delete process.env.BREAK_GLASS_CODE
      } else {
        process.env.BREAK_GLASS_CODE = originalCode
      }
    })

    async function seedAdmin(t: ReturnType<typeof convexTest>) {
      const catechistId = await t.run(async (ctx) => {
        return ctx.db.insert('catechists', {
          memberId: 'ADMIN01',
          fullName: 'Admin Root',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
      })
      const hash = await hashPassword('oldAdminPass')
      await t.run(async (ctx) => {
        await ctx.db.insert('accounts', {
          loginId: 'ADMIN01',
          passwordHash: hash,
          accountType: 'catechist',
          userRefId: catechistId,
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
      })
      return catechistId
    }

    test('throws when BREAK_GLASS_CODE is unset', async () => {
      delete process.env.BREAK_GLASS_CODE
      const t = convexTest(schema, modules)
      await seedAdmin(t)

      await expect(
        t.action(api.auth.resetAdminPassword, {
          loginId: 'ADMIN01',
          code: 'whatever',
          newPassword: 'newAdminPass',
        }),
      ).rejects.toThrow('Recovery failed')
    })

    test('throws and logs failure for wrong code', async () => {
      process.env.BREAK_GLASS_CODE = 'correct-code'
      const t = convexTest(schema, modules)
      await seedAdmin(t)

      await expect(
        t.action(api.auth.resetAdminPassword, {
          loginId: 'ADMIN01',
          code: 'wrong-code',
          newPassword: 'newAdminPass',
        }),
      ).rejects.toThrow('Recovery failed')

      const logs = await t.run(async (ctx) =>
        ctx.db.query('breakGlassRecovery').collect(),
      )
      expect(logs).toHaveLength(1)
      expect(logs[0]).toMatchObject({ loginId: 'ADMIN01', success: false })
    })

    test('throws for a non-existent loginId', async () => {
      process.env.BREAK_GLASS_CODE = 'correct-code'
      const t = convexTest(schema, modules)

      await expect(
        t.action(api.auth.resetAdminPassword, {
          loginId: 'nobody',
          code: 'correct-code',
          newPassword: 'newAdminPass',
        }),
      ).rejects.toThrow('Recovery failed')
    })

    test('throws for a loginId pointing to a non-admin catechist', async () => {
      process.env.BREAK_GLASS_CODE = 'correct-code'
      const t = convexTest(schema, modules)

      const catechistId = await t.run(async (ctx) => {
        return ctx.db.insert('catechists', {
          memberId: 'GLV0010',
          fullName: 'Regular Catechist',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
      })
      await t.run(async (ctx) => {
        await ctx.db.insert('accounts', {
          loginId: 'GLV0010',
          passwordHash: await hashPassword('pass'),
          accountType: 'catechist',
          userRefId: catechistId,
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
      })

      await expect(
        t.action(api.auth.resetAdminPassword, {
          loginId: 'GLV0010',
          code: 'correct-code',
          newPassword: 'newAdminPass',
        }),
      ).rejects.toThrow('Recovery failed')
    })

    test('throws for a loginId pointing to a student account', async () => {
      process.env.BREAK_GLASS_CODE = 'correct-code'
      const t = convexTest(schema, modules)

      const studentId = await t.run(async (ctx) => {
        return ctx.db.insert('students', {
          studentCode: 'HS0010',
          fullName: 'Student One',
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
      })
      await t.run(async (ctx) => {
        await ctx.db.insert('accounts', {
          loginId: 'HS0010',
          passwordHash: await hashPassword('pass'),
          accountType: 'student',
          userRefId: studentId,
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
      })

      await expect(
        t.action(api.auth.resetAdminPassword, {
          loginId: 'HS0010',
          code: 'correct-code',
          newPassword: 'newAdminPass',
        }),
      ).rejects.toThrow('Recovery failed')
    })

    test('throws when a successful redemption already exists', async () => {
      process.env.BREAK_GLASS_CODE = 'correct-code'
      const t = convexTest(schema, modules)
      await seedAdmin(t)
      await t.run(async (ctx) => {
        await ctx.db.insert('breakGlassRecovery', {
          at: Date.now(),
          loginId: 'ADMIN01',
          success: true,
        })
      })

      await expect(
        t.action(api.auth.resetAdminPassword, {
          loginId: 'ADMIN01',
          code: 'correct-code',
          newPassword: 'newAdminPass',
        }),
      ).rejects.toThrow('Recovery failed')

      const logs = await t.run(async (ctx) =>
        ctx.db.query('breakGlassRecovery').collect(),
      )
      expect(logs).toHaveLength(2) // original success row + new failure row
    })

    test('succeeds end-to-end: rotates password hash and logs success', async () => {
      process.env.BREAK_GLASS_CODE = 'correct-code'
      const t = convexTest(schema, modules)
      await seedAdmin(t)

      const accountBefore = await t.run(async (ctx) =>
        ctx.db
          .query('accounts')
          .withIndex('by_login_id', (q) => q.eq('loginId', 'ADMIN01'))
          .unique(),
      )

      await t.action(api.auth.resetAdminPassword, {
        loginId: 'ADMIN01',
        code: 'correct-code',
        newPassword: 'brandNewPass',
      })

      const accountAfter = await t.run(async (ctx) =>
        ctx.db
          .query('accounts')
          .withIndex('by_login_id', (q) => q.eq('loginId', 'ADMIN01'))
          .unique(),
      )
      expect(accountAfter?.passwordHash).not.toBe(accountBefore?.passwordHash)

      // New password actually works via login
      const result = await t.mutation(api.auth.login, {
        loginId: 'ADMIN01',
        password: 'brandNewPass',
      })
      expect(result.memberId).toBe('ADMIN01')

      const logs = await t.run(async (ctx) =>
        ctx.db.query('breakGlassRecovery').collect(),
      )
      expect(logs).toHaveLength(1)
      expect(logs[0]).toMatchObject({ loginId: 'ADMIN01', success: true })
    })
  })

  // ─── loginWithRecaptcha and verifyRecaptcha ─────────────────────────────────

  describe('verifyRecaptcha', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    test('returns true when google returns success with score >= 0.5 and action login', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              score: 0.9,
              action: 'login',
            }),
        }),
      )

      const result = await verifyRecaptcha('valid-token', 'secret-key')
      expect(result).toBe(true)
    })

    test('returns false when score is below 0.5', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              score: 0.3,
              action: 'login',
            }),
        }),
      )

      const result = await verifyRecaptcha('bot-token', 'secret-key')
      expect(result).toBe(false)
    })

    test('returns false when action does not match login', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              score: 0.9,
              action: 'register',
            }),
        }),
      )

      const result = await verifyRecaptcha('token', 'secret-key')
      expect(result).toBe(false)
    })

    test('returns false when success is false', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              success: false,
            }),
        }),
      )

      const result = await verifyRecaptcha('token', 'secret-key')
      expect(result).toBe(false)
    })

    test('returns false when response is not ok or fetch throws', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
        }),
      )

      const result = await verifyRecaptcha('token', 'secret-key')
      expect(result).toBe(false)

      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network error')),
      )
      const errorResult = await verifyRecaptcha('token', 'secret-key')
      expect(errorResult).toBe(false)
    })
  })

  describe('loginWithRecaptcha action', () => {
    const originalEnv = process.env.RECAPTCHA_SECRET_KEY

    afterEach(() => {
      process.env.RECAPTCHA_SECRET_KEY = originalEnv
      vi.restoreAllMocks()
    })

    test('succeeds without token when RECAPTCHA_SECRET_KEY is not set', async () => {
      delete process.env.RECAPTCHA_SECRET_KEY
      const t = convexTest(schema, modules)

      const catechistId = await t.run(async (ctx) => {
        return ctx.db.insert('catechists', {
          memberId: 'GLV_RECAP_1',
          fullName: 'Test User',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
      })

      const hash = await hashPassword('secret123')
      await t.run(async (ctx) => {
        await ctx.db.insert('accounts', {
          loginId: 'GLV_RECAP_1',
          passwordHash: hash,
          accountType: 'catechist',
          userRefId: catechistId,
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
      })

      const result = await t.action(api.auth.loginWithRecaptcha, {
        loginId: 'GLV_RECAP_1',
        password: 'secret123',
      })
      expect(result.memberId).toBe('GLV_RECAP_1')
      expect(result.fullName).toBe('Test User')
    })

    test('throws RECAPTCHA_FAILED when RECAPTCHA_SECRET_KEY is set and token is missing', async () => {
      process.env.RECAPTCHA_SECRET_KEY = 'mock_secret'
      const t = convexTest(schema, modules)

      await expect(
        t.action(api.auth.loginWithRecaptcha, {
          loginId: 'GLV_RECAP_1',
          password: 'secret123',
        }),
      ).rejects.toThrow(AUTH_ERRORS.RECAPTCHA_FAILED)
    })

    test('throws RECAPTCHA_FAILED when RECAPTCHA_SECRET_KEY is set and verification fails', async () => {
      process.env.RECAPTCHA_SECRET_KEY = 'mock_secret'
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              score: 0.1,
              action: 'login',
            }),
        }),
      )

      const t = convexTest(schema, modules)
      await expect(
        t.action(api.auth.loginWithRecaptcha, {
          loginId: 'GLV_RECAP_1',
          password: 'secret123',
          recaptchaToken: 'bot-token',
        }),
      ).rejects.toThrow(AUTH_ERRORS.RECAPTCHA_FAILED)
    })

    test('succeeds when RECAPTCHA_SECRET_KEY is set and verification passes', async () => {
      process.env.RECAPTCHA_SECRET_KEY = 'mock_secret'
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              score: 0.9,
              action: 'login',
            }),
        }),
      )

      const t = convexTest(schema, modules)

      const catechistId = await t.run(async (ctx) => {
        return ctx.db.insert('catechists', {
          memberId: 'GLV_RECAP_2',
          fullName: 'Verified Human',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
      })

      const hash = await hashPassword('humanPass123')
      await t.run(async (ctx) => {
        await ctx.db.insert('accounts', {
          loginId: 'GLV_RECAP_2',
          passwordHash: hash,
          accountType: 'catechist',
          userRefId: catechistId,
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
      })

      const result = await t.action(api.auth.loginWithRecaptcha, {
        loginId: 'GLV_RECAP_2',
        password: 'humanPass123',
        recaptchaToken: 'valid-token',
      })
      expect(result.memberId).toBe('GLV_RECAP_2')
      expect(result.fullName).toBe('Verified Human')
    })

    test('locks account for 15 minutes after 5 consecutive failed login attempts', async () => {
      delete process.env.RECAPTCHA_SECRET_KEY
      const t = convexTest(schema, modules)

      const catechistId = await t.run(async (ctx) => {
        return ctx.db.insert('catechists', {
          memberId: 'GLV_LOCK_1',
          fullName: 'Lockout Test User',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
      })

      const hash = await hashPassword('correctPassword123')
      const accountId = await t.run(async (ctx) => {
        return ctx.db.insert('accounts', {
          loginId: 'GLV_LOCK_1',
          passwordHash: hash,
          accountType: 'catechist',
          userRefId: catechistId,
          isActive: true,
          createdAt: Date.now(),
          isDeleted: false,
        })
      })

      // Attempts 1 to 4 fail with INVALID_CREDENTIALS
      for (let attempt = 1; attempt <= 4; attempt++) {
        await expect(
          t.action(api.auth.loginWithRecaptcha, {
            loginId: 'GLV_LOCK_1',
            password: 'wrongPassword',
          }),
        ).rejects.toThrow(AUTH_ERRORS.INVALID_CREDENTIALS)

        const account = await t.run(async (ctx) =>
          ctx.db.get('accounts', accountId),
        )
        expect(account?.failedLoginAttempts).toBe(attempt)
        expect(account?.lockoutUntil).toBeUndefined()
      }

      // 5th attempt fails and triggers ACCOUNT_LOCKED
      await expect(
        t.action(api.auth.loginWithRecaptcha, {
          loginId: 'GLV_LOCK_1',
          password: 'wrongPassword',
        }),
      ).rejects.toThrow(AUTH_ERRORS.ACCOUNT_LOCKED)

      const lockedAccount = await t.run(async (ctx) =>
        ctx.db.get('accounts', accountId),
      )
      expect(lockedAccount?.failedLoginAttempts).toBe(5)
      expect(lockedAccount?.lockoutUntil).toBeDefined()
      expect(lockedAccount!.lockoutUntil!).toBeGreaterThan(Date.now())

      // 6th attempt with CORRECT password is still blocked because account is locked
      await expect(
        t.action(api.auth.loginWithRecaptcha, {
          loginId: 'GLV_LOCK_1',
          password: 'correctPassword123',
        }),
      ).rejects.toThrow(AUTH_ERRORS.ACCOUNT_LOCKED)

      // Direct login mutation is also blocked while locked
      await expect(
        t.mutation(api.auth.login, {
          loginId: 'GLV_LOCK_1',
          password: 'correctPassword123',
        }),
      ).rejects.toThrow(AUTH_ERRORS.ACCOUNT_LOCKED)
    })

    test('successful login resets failedLoginAttempts and lockout', async () => {
      delete process.env.RECAPTCHA_SECRET_KEY
      const t = convexTest(schema, modules)

      const catechistId = await t.run(async (ctx) => {
        return ctx.db.insert('catechists', {
          memberId: 'GLV_LOCK_RESET',
          fullName: 'Reset Count User',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
      })

      const hash = await hashPassword('correctPassword123')
      const accountId = await t.run(async (ctx) => {
        return ctx.db.insert('accounts', {
          loginId: 'GLV_LOCK_RESET',
          passwordHash: hash,
          accountType: 'catechist',
          userRefId: catechistId,
          isActive: true,
          failedLoginAttempts: 3,
          lastFailedLoginAt: Date.now(),
          createdAt: Date.now(),
          isDeleted: false,
        })
      })

      const result = await t.action(api.auth.loginWithRecaptcha, {
        loginId: 'GLV_LOCK_RESET',
        password: 'correctPassword123',
      })
      expect(result.memberId).toBe('GLV_LOCK_RESET')

      const account = await t.run(async (ctx) =>
        ctx.db.get('accounts', accountId),
      )
      expect(account?.failedLoginAttempts).toBe(0)
      expect(account?.lockoutUntil).toBeUndefined()
      expect(account?.lastFailedLoginAt).toBeUndefined()
    })

    test('sliding window resets failedLoginAttempts if window has expired', async () => {
      delete process.env.RECAPTCHA_SECRET_KEY
      const t = convexTest(schema, modules)

      const catechistId = await t.run(async (ctx) => {
        return ctx.db.insert('catechists', {
          memberId: 'GLV_WINDOW_EXP',
          fullName: 'Window Expired User',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
      })

      const hash = await hashPassword('correctPassword123')
      const accountId = await t.run(async (ctx) => {
        return ctx.db.insert('accounts', {
          loginId: 'GLV_WINDOW_EXP',
          passwordHash: hash,
          accountType: 'catechist',
          userRefId: catechistId,
          isActive: true,
          failedLoginAttempts: 4,
          // Last failure was 20 minutes ago (longer than 15 min window)
          lastFailedLoginAt: Date.now() - 20 * 60 * 1000,
          createdAt: Date.now(),
          isDeleted: false,
        })
      })

      // Another wrong attempt should reset attempts to 1, not trigger lockout (5)
      await expect(
        t.action(api.auth.loginWithRecaptcha, {
          loginId: 'GLV_WINDOW_EXP',
          password: 'wrongPassword',
        }),
      ).rejects.toThrow(AUTH_ERRORS.INVALID_CREDENTIALS)

      const account = await t.run(async (ctx) =>
        ctx.db.get('accounts', accountId),
      )
      expect(account?.failedLoginAttempts).toBe(1)
      expect(account?.lockoutUntil).toBeUndefined()
    })

    test('can login after lockout duration expires', async () => {
      delete process.env.RECAPTCHA_SECRET_KEY
      const t = convexTest(schema, modules)

      const catechistId = await t.run(async (ctx) => {
        return ctx.db.insert('catechists', {
          memberId: 'GLV_LOCK_EXPIRED',
          fullName: 'Expired Lockout User',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
      })

      const hash = await hashPassword('correctPassword123')
      const accountId = await t.run(async (ctx) => {
        return ctx.db.insert('accounts', {
          loginId: 'GLV_LOCK_EXPIRED',
          passwordHash: hash,
          accountType: 'catechist',
          userRefId: catechistId,
          isActive: true,
          failedLoginAttempts: 5,
          // Lockout ended 1 minute ago
          lockoutUntil: Date.now() - 60 * 1000,
          createdAt: Date.now(),
          isDeleted: false,
        })
      })

      const result = await t.action(api.auth.loginWithRecaptcha, {
        loginId: 'GLV_LOCK_EXPIRED',
        password: 'correctPassword123',
      })
      expect(result.memberId).toBe('GLV_LOCK_EXPIRED')

      const account = await t.run(async (ctx) =>
        ctx.db.get('accounts', accountId),
      )
      expect(account?.failedLoginAttempts).toBe(0)
      expect(account?.lockoutUntil).toBeUndefined()
    })
  })
})
