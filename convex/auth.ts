import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { sha256Hex } from './lib/password'
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

    const passwordHash = await sha256Hex(password)
    if (passwordHash !== account.passwordHash) {
      throw new Error('Invalid credentials')
    }

    await ctx.db.patch('accounts', account._id, { lastLoginAt: Date.now() })

    if (account.accountType === 'catechist') {
      const catechist = await ctx.db.get(
        'catechists',
        account.userRefId as Id<'catechists'>,
      )
      if (!catechist) throw new Error('User not found')
      return {
        accountType: 'catechist' as const,
        userDocId: account.userRefId,
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
      throw new Error('Account not found')
    }

    const oldHash = await sha256Hex(oldPassword)
    if (oldHash !== account.passwordHash) {
      throw new Error('Current password is incorrect')
    }

    const newHash = await sha256Hex(newPassword)
    await ctx.db.patch("accounts", account._id, { passwordHash: newHash })
  },
})
