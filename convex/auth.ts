import { v } from 'convex/values'
import { action, internalMutation, mutation } from './_generated/server'
import { hashPassword, verifyPassword } from './lib/password'
import { internal } from './_generated/api'
import { AUTH_ERRORS } from './lib/errors'
import {
  ATTEMPT_WINDOW_MS,
  LOCKOUT_DURATION_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  RESET_LOCKOUT_FIELDS,
} from './lib/accountLockout'
import type { Id } from './_generated/dataModel'

export {
  ATTEMPT_WINDOW_MS,
  LOCKOUT_DURATION_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  RESET_LOCKOUT_FIELDS,
}

export const attemptLogin = internalMutation({
  args: {
    loginId: v.string(),
    password: v.string(),
  },
  handler: async (
    ctx,
    { loginId, password },
  ): Promise<
    | { success: true; result: LoginResult }
    | { success: false; error: string }
  > => {
    const account = await ctx.db
      .query('accounts')
      .withIndex('by_login_id', (q) => q.eq('loginId', loginId))
      .unique()

    if (!account || !account.isActive || account.isDeleted) {
      return { success: false, error: AUTH_ERRORS.INVALID_CREDENTIALS }
    }

    const now = Date.now()
    if (account.lockoutUntil && account.lockoutUntil > now) {
      return { success: false, error: AUTH_ERRORS.ACCOUNT_LOCKED }
    }

    const { valid, legacy } = await verifyPassword(
      password,
      account.passwordHash,
    )

    if (!valid) {
      const isWindowExpired =
        !account.lastFailedLoginAt ||
        now - account.lastFailedLoginAt > ATTEMPT_WINDOW_MS
      const attempts = isWindowExpired
        ? 1
        : (account.failedLoginAttempts ?? 0) + 1

      const updates: Record<string, unknown> = {
        failedLoginAttempts: attempts,
        lastFailedLoginAt: now,
      }

      if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        updates.lockoutUntil = now + LOCKOUT_DURATION_MS
      }

      await ctx.db.patch('accounts', account._id, updates)

      if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        return { success: false, error: AUTH_ERRORS.ACCOUNT_LOCKED }
      }
      return { success: false, error: AUTH_ERRORS.INVALID_CREDENTIALS }
    }

    // Reset failed attempts & lockout on successful login
    const updates: Record<string, unknown> = {
      lastLoginAt: now,
      ...RESET_LOCKOUT_FIELDS,
    }
    if (legacy) {
      updates.passwordHash = await hashPassword(password)
    }
    await ctx.db.patch('accounts', account._id, updates)

    const mustChangePassword = account.mustChangePassword ?? false

    if (account.accountType === 'catechist') {
      const catechist = await ctx.db.get(
        'catechists',
        account.userRefId as Id<'catechists'>,
      )
      if (!catechist) throw new Error(AUTH_ERRORS.USER_NOT_FOUND)
      return {
        success: true,
        result: {
          accountType: 'catechist',
          userDocId: account.userRefId,
          loginId: account.loginId,
          memberId: catechist.memberId,
          fullName: catechist.fullName,
          role: catechist.role,
          mustChangePassword,
        },
      }
    } else {
      const student = await ctx.db.get(
        'students',
        account.userRefId as Id<'students'>,
      )
      if (!student) throw new Error(AUTH_ERRORS.USER_NOT_FOUND)
      return {
        success: true,
        result: {
          accountType: 'student',
          userDocId: account.userRefId,
          loginId: account.loginId,
          memberId: student.studentCode,
          fullName: student.fullName,
          role: null,
          mustChangePassword,
        },
      }
    }
  },
})

export const login = mutation({
  args: {
    loginId: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { loginId, password }) => {
    const account = await ctx.db
      .query('accounts')
      .withIndex('by_login_id', (q) => q.eq('loginId', loginId))
      .unique()

    if (!account || !account.isActive || account.isDeleted) {
      throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS)
    }

    const now = Date.now()
    if (account.lockoutUntil && account.lockoutUntil > now) {
      throw new Error(AUTH_ERRORS.ACCOUNT_LOCKED)
    }

    const { valid, legacy } = await verifyPassword(
      password,
      account.passwordHash,
    )
    if (!valid) {
      throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS)
    }

    // Upgrade legacy SHA-256 hash to bcrypt on first successful login
    const updates: Record<string, unknown> = {
      lastLoginAt: now,
      failedLoginAttempts: 0,
      lockoutUntil: undefined,
      lastFailedLoginAt: undefined,
    }
    if (legacy) {
      updates.passwordHash = await hashPassword(password)
    }
    await ctx.db.patch('accounts', account._id, updates)

    const mustChangePassword = account.mustChangePassword ?? false

    if (account.accountType === 'catechist') {
      const catechist = await ctx.db.get(
        'catechists',
        account.userRefId as Id<'catechists'>,
      )
      if (!catechist) throw new Error(AUTH_ERRORS.USER_NOT_FOUND)
      return {
        accountType: 'catechist' as const,
        userDocId: account.userRefId,
        loginId: account.loginId,
        memberId: catechist.memberId,
        fullName: catechist.fullName,
        role: catechist.role,
        mustChangePassword,
      }
    } else {
      const student = await ctx.db.get(
        'students',
        account.userRefId as Id<'students'>,
      )
      if (!student) throw new Error(AUTH_ERRORS.USER_NOT_FOUND)
      return {
        accountType: 'student' as const,
        userDocId: account.userRefId,
        loginId: account.loginId,
        memberId: student.studentCode,
        fullName: student.fullName,
        role: null,
        mustChangePassword,
      }
    }
  },
})

export type LoginResult = {
  accountType: 'catechist' | 'student'
  userDocId: Id<'catechists'> | Id<'students'>
  loginId: string
  memberId: string
  fullName: string
  role: 'admin' | 'user' | null
  mustChangePassword: boolean
}

export async function verifyRecaptcha(
  token: string,
  secretKey: string,
): Promise<boolean> {
  try {
    const params = new URLSearchParams()
    params.append('secret', secretKey)
    params.append('response', token)

    const response = await fetch(
      'https://www.google.com/recaptcha/api/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    )

    if (!response.ok) {
      return false
    }

    const data = (await response.json()) as {
      success: boolean
      score?: number
      action?: string
    }

    return Boolean(
      data.success &&
      typeof data.score === 'number' &&
      data.score >= 0.5 &&
      data.action === 'login',
    )
  } catch {
    return false
  }
}

export const loginWithRecaptcha = action({
  args: {
    loginId: v.string(),
    password: v.string(),
    recaptchaToken: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { loginId, password, recaptchaToken },
  ): Promise<LoginResult> => {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY
    if (secretKey) {
      if (!recaptchaToken) {
        throw new Error(AUTH_ERRORS.RECAPTCHA_FAILED)
      }
      const isHuman = await verifyRecaptcha(recaptchaToken, secretKey)
      if (!isHuman) {
        throw new Error(AUTH_ERRORS.RECAPTCHA_FAILED)
      }
    }

    const outcome:
      | { success: true; result: LoginResult }
      | { success: false; error: string } = await ctx.runMutation(
      internal.auth.attemptLogin,
      {
        loginId,
        password,
      },
    )

    if (!outcome.success) {
      throw new Error(outcome.error)
    }

    return outcome.result
  },
})

export const changePassword = mutation({
  args: {
    loginId: v.string(),
    oldPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { loginId, oldPassword, newPassword }) => {
    const account = await ctx.db
      .query('accounts')
      .withIndex('by_login_id', (q) => q.eq('loginId', loginId))
      .unique()

    if (!account || !account.isActive) {
      throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS)
    }

    const { valid } = await verifyPassword(oldPassword, account.passwordHash)
    if (!valid) {
      throw new Error(AUTH_ERRORS.CURRENT_PASSWORD_INCORRECT)
    }

    const newHash = await hashPassword(newPassword)
    await ctx.db.patch('accounts', account._id, {
      passwordHash: newHash,
      mustChangePassword: false,
    })
  },
})

const RECOVERY_FAILED_MESSAGE = 'Recovery failed'

// ponytail: constant-time compare via padding, not node:crypto (must run in default runtime)
function constantTimeEqual(a: string, b: string): boolean {
  const maxLength = Math.max(a.length, b.length)
  const paddedA = a.padEnd(maxLength, '\0')
  const paddedB = b.padEnd(maxLength, '\0')
  let mismatch = a.length === b.length ? 0 : 1
  for (let i = 0; i < maxLength; i++) {
    mismatch |= paddedA.charCodeAt(i) ^ paddedB.charCodeAt(i)
  }
  return mismatch === 0
}

// Convex mutations are single transactions: throwing rolls back every write
// made earlier in the same call, including an audit-log insert. To log a
// failed attempt AND report failure to the caller, the attempt (writes) and
// the throw must live in separate transactions — hence action + internalMutation
// instead of a single mutation.
export const attemptBreakGlassReset = internalMutation({
  args: {
    loginId: v.string(),
    code: v.string(),
    newPassword: v.string(),
    breakGlassCode: v.string(),
  },
  handler: async (ctx, { loginId, code, newPassword, breakGlassCode }) => {
    const logFailure = () =>
      ctx.db.insert('breakGlassRecovery', {
        at: Date.now(),
        loginId,
        success: false,
      })

    const alreadyUsed = await ctx.db
      .query('breakGlassRecovery')
      .withIndex('by_success', (q) => q.eq('success', true))
      .first()
    if (alreadyUsed) {
      await logFailure()
      return { success: false }
    }

    if (!constantTimeEqual(code, breakGlassCode)) {
      await logFailure()
      return { success: false }
    }

    const account = await ctx.db
      .query('accounts')
      .withIndex('by_login_id', (q) => q.eq('loginId', loginId))
      .unique()

    if (!account || !account.isActive || account.accountType !== 'catechist') {
      await logFailure()
      return { success: false }
    }

    const catechist = await ctx.db.get(
      'catechists',
      account.userRefId as Id<'catechists'>,
    )
    if (!catechist || catechist.role !== 'admin') {
      await logFailure()
      return { success: false }
    }

    const newHash = await hashPassword(newPassword)
    await ctx.db.patch('accounts', account._id, { passwordHash: newHash })
    await ctx.db.insert('breakGlassRecovery', {
      at: Date.now(),
      loginId,
      success: true,
    })
    return { success: true }
  },
})

/**
 * Break-glass admin password recovery — last-resort tool invoked from the
 * Convex dashboard/CLI by a developer/ops person, never from the app UI.
 * Guarded by BREAK_GLASS_CODE (env var) and a one-time-use gate: once a
 * success row exists in breakGlassRecovery, all further attempts are
 * rejected until a human deletes that row (and rotates BREAK_GLASS_CODE).
 * All rejections throw an identical generic message to avoid leaking why
 * an attempt failed or whether a given loginId exists.
 */
export const resetAdminPassword = action({
  args: {
    loginId: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { loginId, code, newPassword }) => {
    const breakGlassCode = process.env.BREAK_GLASS_CODE
    if (!breakGlassCode) {
      throw new Error(RECOVERY_FAILED_MESSAGE)
    }

    const result: { success: boolean } = await ctx.runMutation(
      internal.auth.attemptBreakGlassReset,
      { loginId, code, newPassword, breakGlassCode },
    )

    if (!result.success) {
      throw new Error(RECOVERY_FAILED_MESSAGE)
    }
    return null
  },
})
