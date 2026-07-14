import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { nextCounter } from './lib/counter'
import { hashPassword } from './lib/password'
import { SETUP_ERRORS } from './lib/errors'

/**
 * hasAdmin — unauthenticated public query.
 * Returns true if any (non-deleted) catechist with role 'admin' exists.
 * Used by the frontend to decide whether to force-redirect to /setup.
 * Must not leak anything beyond the boolean.
 */
export const hasAdmin = query({
  args: {},
  handler: async (ctx) => {
    const existingAdmin = await ctx.db
      .query('catechists')
      .withIndex('by_role_and_is_deleted', (q) =>
        q.eq('role', 'admin').eq('isDeleted', false),
      )
      .take(1)

    return existingAdmin.length > 0
  },
})

/**
 * runSetup — unauthenticated public mutation.
 * Bootstraps the very first admin catechist + account. Intentionally NOT
 * gated by assertAdminRole since no admin exists yet at this point — its
 * only guard is re-checking that no admin already exists, which prevents
 * this mutation from being replayed to create a second admin.
 */
export const runSetup = mutation({
  args: {
    fullName: v.string(),
    saintName: v.optional(v.string()),
    loginId: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { fullName, saintName, loginId, password }) => {
    const existingAdmin = await ctx.db
      .query('catechists')
      .withIndex('by_role_and_is_deleted', (q) =>
        q.eq('role', 'admin').eq('isDeleted', false),
      )
      .take(1)

    if (existingAdmin.length > 0) {
      throw new Error(SETUP_ERRORS.ALREADY_COMPLETED)
    }

    const existingAccount = await ctx.db
      .query('accounts')
      .withIndex('by_login_id', (q) => q.eq('loginId', loginId))
      .unique()

    if (existingAccount) {
      throw new Error(SETUP_ERRORS.LOGIN_ID_IN_USE)
    }

    if (password.length < 8) {
      throw new Error(SETUP_ERRORS.PASSWORD_TOO_SHORT)
    }

    const memberIdNum = await nextCounter(ctx, 'catechist')
    const memberId = memberIdNum.toString()

    const catechistId = await ctx.db.insert('catechists', {
      memberId,
      fullName,
      saintName,
      role: 'admin',
      isActive: true,
      isDeleted: false,
    })

    const passwordHash = hashPassword(password)

    await ctx.db.insert('accounts', {
      loginId,
      passwordHash,
      accountType: 'catechist',
      userRefId: catechistId,
      isActive: true,
      createdAt: Date.now(),
      isDeleted: false,
    })

    return {
      accountType: 'catechist' as const,
      userDocId: catechistId,
      loginId,
      memberId,
      fullName,
      role: 'admin' as const,
    }
  },
})
