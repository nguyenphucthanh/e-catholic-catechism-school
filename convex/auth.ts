import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { hashPassword, verifyPassword } from './lib/password'
import type { Id } from './_generated/dataModel'

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

    if (!account || !account.isActive) {
      throw new Error('Invalid credentials')
    }

    const { valid, legacy } = await verifyPassword(
      password,
      account.passwordHash,
    )
    if (!valid) {
      throw new Error('Invalid credentials')
    }

    // Upgrade legacy SHA-256 hash to bcrypt on first successful login
    const updates: Record<string, unknown> = { lastLoginAt: Date.now() }
    if (legacy) {
      updates.passwordHash = await hashPassword(password)
    }
    await ctx.db.patch('accounts', account._id, updates)

    if (account.accountType === 'catechist') {
      const catechist = await ctx.db.get(
        'catechists',
        account.userRefId as Id<'catechists'>,
      )
      if (!catechist) throw new Error('User not found')
      return {
        accountType: 'catechist' as const,
        userDocId: account.userRefId,
        loginId: account.loginId,
        memberId: catechist.memberId,
        fullName: catechist.fullName,
        role: catechist.role,
      }
    } else {
      const student = await ctx.db.get(
        'students',
        account.userRefId as Id<'students'>,
      )
      if (!student) throw new Error('User not found')
      return {
        accountType: 'student' as const,
        userDocId: account.userRefId,
        loginId: account.loginId,
        memberId: student.studentCode,
        fullName: student.fullName,
        role: null,
      }
    }
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
      throw new Error('Invalid credentials')
    }

    const { valid } = await verifyPassword(oldPassword, account.passwordHash)
    if (!valid) {
      throw new Error('Current password is incorrect')
    }

    const newHash = await hashPassword(newPassword)
    await ctx.db.patch('accounts', account._id, { passwordHash: newHash })
  },
})
