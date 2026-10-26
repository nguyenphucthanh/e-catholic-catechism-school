/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from 'vitest'
import { authedConvexTest } from '../test-utils/authedConvexTest'
import { api } from './_generated/api'
import { MAX_FAILED_LOGIN_ATTEMPTS, verifyRecaptcha } from './auth'
import schema from './schema'
import { hashPassword, sha256Hex } from './lib/password'
import { SESSION_TTL_MS } from './lib/sessions'
import { AUTHZ_ERRORS, AUTH_ERRORS } from './lib/errors'
import type { convexTest } from 'convex-test'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

// Seeds a catechist account + live session; `as` is t acting as that session.
async function seedCaller(
  t: ReturnType<typeof convexTest>,
  loginId: string,
  password: string,
  extra: Record<string, unknown> = {},
  sessionExtra: Record<string, unknown> = {},
) {
  const hash = await hashPassword(password)
  const ids = await t.run(async (ctx) => {
    const cId = await ctx.db.insert('catechists', {
      memberId: loginId,
      fullName: `Cat ${loginId}`,
      role: 'user',
      isActive: true,
      isDeleted: false,
    })
    const aId = await ctx.db.insert('accounts', {
      loginId,
      passwordHash: hash,
      accountType: 'catechist',
      userRefId: cId,
      isActive: true,
      createdAt: Date.now(),
      isDeleted: false,
      ...extra,
    })
    const sId = await ctx.db.insert('sessions', {
      accountId: aId,
      secretHash: 'x',
      expiresAt: Date.now() + 60_000,
      ...sessionExtra,
    })
    return { catechistId: cId, accountId: aId, sid: sId }
  })
  const { catechistId, accountId, sid } = ids
  const as = t.withIdentity({ subject: `catechist|${catechistId}`, sid })
  return { catechistId, accountId, sid, as }
}

describe('auth backend functions', () => {
  // ─── login mutation ───────────────────────────────────────────────────────

  test('login succeeds for an active catechist account', async () => {
    const t = authedConvexTest(schema, modules)

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

    const result = await t.action(api.auth.loginWithRecaptcha, {
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
    const t = authedConvexTest(schema, modules)

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

    const result = await t.action(api.auth.loginWithRecaptcha, {
      loginId: 'GLV9999',
      password: 'default123',
    })

    expect(result.mustChangePassword).toBe(true)
  })

  test('login succeeds for a student account and returns student fields', async () => {
    const t = authedConvexTest(schema, modules)

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

    const result = await t.action(api.auth.loginWithRecaptcha, {
      loginId: 'HS0001',
      password: 'pass456',
    })

    expect(result.accountType).toBe('student')
    expect(result.memberId).toBe('HS0001')
    expect(result.fullName).toBe('Trần Thị B')
    expect(result.role).toBeNull()
  })

  test('login throws for a non-existent account', async () => {
    const t = authedConvexTest(schema, modules)

    await expect(
      t.action(api.auth.loginWithRecaptcha, {
        loginId: 'nobody',
        password: 'anything',
      }),
    ).rejects.toThrow(AUTH_ERRORS.INVALID_CREDENTIALS)
  })

  test('login throws for an inactive account', async () => {
    const t = authedConvexTest(schema, modules)

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
      t.action(api.auth.loginWithRecaptcha, {
        loginId: 'GLV0099',
        password: 'secret',
      }),
    ).rejects.toThrow(AUTH_ERRORS.INVALID_CREDENTIALS)
  })

  test('login throws for a soft-deleted account', async () => {
    const t = authedConvexTest(schema, modules)

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
      t.action(api.auth.loginWithRecaptcha, {
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
    const t = authedConvexTest(schema, modules)

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
      t.action(api.auth.loginWithRecaptcha, {
        loginId: 'GLV0002',
        password: 'wrongPassword',
      }),
    ).rejects.toThrow(AUTH_ERRORS.INVALID_CREDENTIALS)
  })

  // ─── changePassword mutation ───────────────────────────────────────────────

  test('changePassword succeeds with correct current password', async () => {
    const t = authedConvexTest(schema, modules)
    const { as } = await seedCaller(t, 'GLV0003', 'oldPass1', {
      mustChangePassword: true,
    })

    await as.action(api.auth.changePassword, {
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
    const result = await t.action(api.auth.loginWithRecaptcha, {
      loginId: 'GLV0003',
      password: 'newPass2',
    })
    expect(result.memberId).toBe('GLV0003')
    expect(result.mustChangePassword).toBe(false)
  })

  test('changePassword throws for wrong old password', async () => {
    const t = authedConvexTest(schema, modules)
    const { as } = await seedCaller(t, 'GLV0004', 'myPassword')

    await expect(
      as.action(api.auth.changePassword, {
        oldPassword: 'wrongOldPassword',
        newPassword: 'newPassword',
      }),
    ).rejects.toThrow(AUTH_ERRORS.CURRENT_PASSWORD_INCORRECT)
  })

  test('changePassword rejects unauthenticated caller (no identity)', async () => {
    const t = authedConvexTest(schema, modules)
    await seedCaller(t, 'GLV0005', 'myPassword')

    await expect(
      t.action(api.auth.changePassword, {
        oldPassword: 'myPassword',
        newPassword: 'newone',
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.UNAUTHENTICATED)
  })

  test('changePassword rejects a revoked session', async () => {
    const t = authedConvexTest(schema, modules)
    const { as } = await seedCaller(
      t,
      'GLV0006',
      'myPassword',
      {},
      { revokedAt: Date.now() },
    )

    await expect(
      as.action(api.auth.changePassword, {
        oldPassword: 'myPassword',
        newPassword: 'newone',
      }),
    ).rejects.toThrow(AUTHZ_ERRORS.UNAUTHENTICATED)
  })

  test('changePassword by an impersonated session changes the TARGET account password', async () => {
    const t = authedConvexTest(schema, modules)
    const adminId = await t.run((ctx) =>
      ctx.db.insert('catechists', {
        memberId: 'ADM',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      }),
    )
    // current behavior: impersonatorId is ignored, the session's account is changed
    const { as } = await seedCaller(
      t,
      'GLV0007',
      'targetPass1',
      {},
      { impersonatorId: adminId },
    )

    await as.action(api.auth.changePassword, {
      oldPassword: 'targetPass1',
      newPassword: 'changedPass2',
    })

    const result = await t.action(api.auth.loginWithRecaptcha, {
      loginId: 'GLV0007',
      password: 'changedPass2',
    })
    expect(result.memberId).toBe('GLV0007')
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
      const t = authedConvexTest(schema, modules)
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
      const t = authedConvexTest(schema, modules)
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
      const t = authedConvexTest(schema, modules)

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
      const t = authedConvexTest(schema, modules)

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
      const t = authedConvexTest(schema, modules)

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
      const t = authedConvexTest(schema, modules)
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
      const t = authedConvexTest(schema, modules)
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
      const result = await t.action(api.auth.loginWithRecaptcha, {
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
      const t = authedConvexTest(schema, modules)

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
      const t = authedConvexTest(schema, modules)

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

      const t = authedConvexTest(schema, modules)
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

      const t = authedConvexTest(schema, modules)

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
      const t = authedConvexTest(schema, modules)

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
        t.action(api.auth.loginWithRecaptcha, {
          loginId: 'GLV_LOCK_1',
          password: 'correctPassword123',
        }),
      ).rejects.toThrow(AUTH_ERRORS.ACCOUNT_LOCKED)
    })

    test('successful login resets failedLoginAttempts and lockout', async () => {
      delete process.env.RECAPTCHA_SECRET_KEY
      const t = authedConvexTest(schema, modules)

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
      const t = authedConvexTest(schema, modules)

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
      const t = authedConvexTest(schema, modules)

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

describe('changePassword lockout', () => {
  const seed = async (extra: Record<string, unknown> = {}) => {
    const t = authedConvexTest(schema, modules)
    const { accountId, as } = await seedCaller(t, 'GLV_CP', 'rightPass1', {
      mustChangePassword: true,
      ...extra,
    })
    return { t, accountId, as }
  }
  const call = (
    as: Awaited<ReturnType<typeof seed>>['as'],
    oldPassword: string,
  ) =>
    as.action(api.auth.changePassword, {
      oldPassword,
      newPassword: 'brandNew123',
    })

  test('locks account after max wrong attempts and persists the failures', async () => {
    const { t, accountId, as } = await seed()
    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS - 1; i++) {
      await expect(call(as, 'wrong')).rejects.toThrow(
        AUTH_ERRORS.CURRENT_PASSWORD_INCORRECT,
      )
    }
    await expect(call(as, 'wrong')).rejects.toThrow(AUTH_ERRORS.ACCOUNT_LOCKED)

    // Correct old password is rejected while locked
    await expect(call(as, 'rightPass1')).rejects.toThrow(
      AUTH_ERRORS.ACCOUNT_LOCKED,
    )

    const account = await t.run((ctx) => ctx.db.get('accounts', accountId))
    expect(account?.failedLoginAttempts).toBe(MAX_FAILED_LOGIN_ATTEMPTS)
    expect(account?.lockoutUntil).toBeGreaterThan(Date.now())
    expect(account?.mustChangePassword).toBe(true)
  })

  test('success resets failed attempts and clears mustChangePassword', async () => {
    const { t, accountId, as } = await seed({
      failedLoginAttempts: 2,
      lastFailedLoginAt: Date.now(),
    })
    await call(as, 'rightPass1')
    const account = await t.run((ctx) => ctx.db.get('accounts', accountId))
    expect(account?.failedLoginAttempts).toBe(0)
    expect(account?.mustChangePassword).toBe(false)
    expect(account?.lockoutUntil).toBeUndefined()
  })
})

// ─── sessions ────────────────────────────────────────────────────────────────

describe('auth sessions', () => {
  type T = ReturnType<typeof convexTest>
  const HEX64 = /^[0-9a-f]{64}$/

  async function seedAccount(
    t: T,
    n: string,
    over: {
      isActive?: boolean
      isDeleted?: boolean
      role?: 'admin' | 'user'
    } = {},
  ) {
    const catechistId = await t.run((ctx) =>
      ctx.db.insert('catechists', {
        memberId: n,
        fullName: `Cat ${n}`,
        role: over.role ?? 'user',
        isActive: true,
        isDeleted: false,
      }),
    )
    const accountId = await t.run(async (ctx) =>
      ctx.db.insert('accounts', {
        loginId: `S-${n}`,
        passwordHash: await hashPassword('pw12345'),
        accountType: 'catechist',
        userRefId: catechistId,
        isActive: over.isActive ?? true,
        createdAt: Date.now(),
        isDeleted: over.isDeleted ?? false,
      }),
    )
    return { catechistId, accountId, loginId: `S-${n}` }
  }

  async function seedSession(
    t: T,
    accountId: any,
    secret = 'a'.repeat(64),
    over: { expiresAt?: number; revokedAt?: number } = {},
  ) {
    const secretHash = await sha256Hex(secret)
    return t.run((ctx) =>
      ctx.db.insert('sessions', {
        accountId,
        secretHash,
        expiresAt: over.expiresAt ?? Date.now() + 60_000,
        revokedAt: over.revokedAt,
      }),
    )
  }

  const getSession = (t: T, id: Id<'sessions'>) =>
    t.run((ctx) => ctx.db.get('sessions', id))
  const allSessions = (t: T) =>
    t.run((ctx) => ctx.db.query('sessions').collect())

  describe('loginWithRecaptcha session creation', () => {
    const original = process.env.RECAPTCHA_SECRET_KEY
    afterEach(() => {
      if (original === undefined) delete process.env.RECAPTCHA_SECRET_KEY
      else process.env.RECAPTCHA_SECRET_KEY = original
    })

    test('creates a session whose stored hash matches the returned secret', async () => {
      delete process.env.RECAPTCHA_SECRET_KEY
      const t = authedConvexTest(schema, modules)
      const { accountId, loginId } = await seedAccount(t, '1')

      const before = Date.now()
      const res = await t.action(api.auth.loginWithRecaptcha, {
        loginId,
        password: 'pw12345',
      })

      expect(res.sessionSecret).toMatch(HEX64)
      const session = await getSession(t, res.sessionId)
      expect(session?.accountId).toBe(accountId)
      expect(session?.secretHash).toBe(await sha256Hex(res.sessionSecret))
      expect(session?.impersonatorId).toBeUndefined()
      expect(session?.revokedAt).toBeUndefined()
      expect(session!.expiresAt).toBeGreaterThanOrEqual(before + SESSION_TTL_MS)
      expect(session!.expiresAt).toBeLessThanOrEqual(
        Date.now() + SESSION_TTL_MS,
      )
    })

    test('failed login creates no session', async () => {
      delete process.env.RECAPTCHA_SECRET_KEY
      const t = authedConvexTest(schema, modules)
      const { loginId } = await seedAccount(t, '2')

      await expect(
        t.action(api.auth.loginWithRecaptcha, { loginId, password: 'wrong' }),
      ).rejects.toThrow(AUTH_ERRORS.INVALID_CREDENTIALS)
      await expect(
        t.action(api.auth.loginWithRecaptcha, {
          loginId: 'nobody',
          password: 'x',
        }),
      ).rejects.toThrow(AUTH_ERRORS.INVALID_CREDENTIALS)

      expect(await allSessions(t)).toHaveLength(0)
    })
  })

  describe('issueToken rejections', () => {
    const secret = 'b'.repeat(64)

    test('rejects a wrong secret', async () => {
      const t = authedConvexTest(schema, modules)
      const { accountId } = await seedAccount(t, '10')
      const sid = await seedSession(t, accountId, secret)
      await expect(
        t.mutation(api.auth.issueToken, {
          sessionId: sid,
          secret: 'c'.repeat(64),
        }),
      ).rejects.toThrow(AUTH_ERRORS.SESSION_INVALID)
    })

    test('rejects a revoked session', async () => {
      const t = authedConvexTest(schema, modules)
      const { accountId } = await seedAccount(t, '11')
      const sid = await seedSession(t, accountId, secret, {
        revokedAt: Date.now(),
      })
      await expect(
        t.mutation(api.auth.issueToken, { sessionId: sid, secret }),
      ).rejects.toThrow(AUTH_ERRORS.SESSION_INVALID)
    })

    test('rejects an expired session', async () => {
      const t = authedConvexTest(schema, modules)
      const { accountId } = await seedAccount(t, '12')
      const sid = await seedSession(t, accountId, secret, {
        expiresAt: Date.now() - 1,
      })
      await expect(
        t.mutation(api.auth.issueToken, { sessionId: sid, secret }),
      ).rejects.toThrow(AUTH_ERRORS.SESSION_INVALID)
    })

    test('rejects when the account is inactive', async () => {
      const t = authedConvexTest(schema, modules)
      const { accountId } = await seedAccount(t, '13', { isActive: false })
      const sid = await seedSession(t, accountId, secret)
      await expect(
        t.mutation(api.auth.issueToken, { sessionId: sid, secret }),
      ).rejects.toThrow(AUTH_ERRORS.SESSION_INVALID)
    })

    test('rejects when the account is deleted', async () => {
      const t = authedConvexTest(schema, modules)
      const { accountId } = await seedAccount(t, '14', { isDeleted: true })
      const sid = await seedSession(t, accountId, secret)
      await expect(
        t.mutation(api.auth.issueToken, { sessionId: sid, secret }),
      ).rejects.toThrow(AUTH_ERRORS.SESSION_INVALID)
    })
  })

  describe('logout', () => {
    const secret = 'd'.repeat(64)

    test('wrong secret is rejected and the session stays active', async () => {
      const t = authedConvexTest(schema, modules)
      const { accountId } = await seedAccount(t, '20')
      const sid = await seedSession(t, accountId, secret)

      await expect(
        t.mutation(api.auth.logout, { sessionId: sid, secret: 'e'.repeat(64) }),
      ).rejects.toThrow(AUTH_ERRORS.SESSION_INVALID)
      expect((await getSession(t, sid))?.revokedAt).toBeUndefined()
    })

    test('correct secret revokes; issueToken is then rejected', async () => {
      const t = authedConvexTest(schema, modules)
      const { accountId } = await seedAccount(t, '21')
      const sid = await seedSession(t, accountId, secret)

      await t.mutation(api.auth.logout, { sessionId: sid, secret })
      expect(typeof (await getSession(t, sid))?.revokedAt).toBe('number')

      await expect(
        t.mutation(api.auth.issueToken, { sessionId: sid, secret }),
      ).rejects.toThrow(AUTH_ERRORS.SESSION_INVALID)
      // logging out twice is also rejected
      await expect(
        t.mutation(api.auth.logout, { sessionId: sid, secret }),
      ).rejects.toThrow(AUTH_ERRORS.SESSION_INVALID)
    })
  })

  describe('changePassword session revocation', () => {
    test('without identity throws UNAUTHENTICATED and revokes nothing', async () => {
      const t = authedConvexTest(schema, modules)
      const a = await seedAccount(t, '30')
      const s1 = await seedSession(t, a.accountId)

      await expect(
        t.action(api.auth.changePassword, {
          oldPassword: 'pw12345',
          newPassword: 'newpw456',
        }),
      ).rejects.toThrow(AUTHZ_ERRORS.UNAUTHENTICATED)
      expect((await getSession(t, s1))?.revokedAt).toBeUndefined()
    })

    test('with identity keeps caller session, revokes the account others only', async () => {
      const t = authedConvexTest(schema, modules)
      const a = await seedAccount(t, '32')
      const other = await seedAccount(t, '33')
      const current = await seedSession(t, a.accountId)
      const stale = await seedSession(t, a.accountId)
      const so = await seedSession(t, other.accountId)

      await t
        .withIdentity({ subject: `catechist|${a.catechistId}`, sid: current })
        .action(api.auth.changePassword, {
          oldPassword: 'pw12345',
          newPassword: 'newpw456',
        })

      expect((await getSession(t, current))?.revokedAt).toBeUndefined()
      expect((await getSession(t, stale))?.revokedAt).toBeTypeOf('number')
      expect((await getSession(t, so))?.revokedAt).toBeUndefined()
    })

    test('wrong old password revokes nothing', async () => {
      const t = authedConvexTest(schema, modules)
      const a = await seedAccount(t, '34')
      const current = await seedSession(t, a.accountId)
      const s = await seedSession(t, a.accountId)

      await expect(
        t
          .withIdentity({ subject: `catechist|${a.catechistId}`, sid: current })
          .action(api.auth.changePassword, {
            oldPassword: 'nope',
            newPassword: 'newpw456',
          }),
      ).rejects.toThrow(AUTH_ERRORS.CURRENT_PASSWORD_INCORRECT)
      expect((await getSession(t, current))?.revokedAt).toBeUndefined()
      expect((await getSession(t, s))?.revokedAt).toBeUndefined()
    })
  })

  describe('break-glass reset session revocation', () => {
    const originalCode = process.env.BREAK_GLASS_CODE
    afterEach(() => {
      if (originalCode === undefined) delete process.env.BREAK_GLASS_CODE
      else process.env.BREAK_GLASS_CODE = originalCode
    })

    test('success revokes the admin sessions', async () => {
      process.env.BREAK_GLASS_CODE = 'correct-code'
      const t = authedConvexTest(schema, modules)
      const admin = await seedAccount(t, '40', { role: 'admin' })
      const other = await seedAccount(t, '41')
      const s = await seedSession(t, admin.accountId)
      const so = await seedSession(t, other.accountId)

      await t.action(api.auth.resetAdminPassword, {
        loginId: admin.loginId,
        code: 'correct-code',
        newPassword: 'brandnew1',
      })

      expect((await getSession(t, s))?.revokedAt).toBeTypeOf('number')
      expect((await getSession(t, so))?.revokedAt).toBeUndefined()
    })

    test('failure (wrong code) revokes nothing', async () => {
      process.env.BREAK_GLASS_CODE = 'correct-code'
      const t = authedConvexTest(schema, modules)
      const admin = await seedAccount(t, '42', { role: 'admin' })
      const s = await seedSession(t, admin.accountId)

      await expect(
        t.action(api.auth.resetAdminPassword, {
          loginId: admin.loginId,
          code: 'wrong',
          newPassword: 'brandnew1',
        }),
      ).rejects.toThrow('Recovery failed')
      expect((await getSession(t, s))?.revokedAt).toBeUndefined()
    })
  })
})
