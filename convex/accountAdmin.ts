import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { hashPassword } from './lib/password'
import { assertAdminRole } from './lib/authz'
import type { Doc, Id } from './_generated/dataModel'

export const listCatechistAccounts = query({
  args: {
    requesterId: v.id('catechists'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const catechists = await ctx.db
      .query('catechists')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()

    const accounts = await ctx.db
      .query('accounts')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()

    const catechistAccounts = accounts.filter(
      (a) => a.accountType === 'catechist',
    )
    const accountMap = new Map<Id<'catechists'>, Doc<'accounts'>>()
    for (const a of catechistAccounts) {
      accountMap.set(a.userRefId as Id<'catechists'>, a)
    }

    return catechists.map((c) => ({
      catechist: c,
      account: accountMap.get(c._id) ?? null,
    }))
  },
})

export const listStudentAccounts = query({
  args: {
    requesterId: v.id('catechists'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const students = await ctx.db
      .query('students')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()

    const accounts = await ctx.db
      .query('accounts')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()

    const studentAccounts = accounts.filter((a) => a.accountType === 'student')
    const accountMap = new Map<Id<'students'>, Doc<'accounts'>>()
    for (const a of studentAccounts) {
      accountMap.set(a.userRefId as Id<'students'>, a)
    }

    return students.map((s) => ({
      student: s,
      account: accountMap.get(s._id) ?? null,
    }))
  },
})

export const grantCatechistAccount = mutation({
  args: {
    requesterId: v.id('catechists'),
    catechistId: v.id('catechists'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const catechist = await ctx.db.get('catechists', args.catechistId)
    if (!catechist || catechist.isDeleted) {
      throw new Error('CATECHIST_NOT_FOUND')
    }

    const loginId = `CAT-${catechist.memberId}`
    const existing = await ctx.db
      .query('accounts')
      .withIndex('by_login_id', (q) => q.eq('loginId', loginId))
      .first()

    if (existing) {
      if (existing.isDeleted) {
        await ctx.db.patch("accounts", existing._id, {
          isDeleted: false,
          isActive: true,
          passwordHash: hashPassword(loginId),
          lastLoginAt: undefined,
        })
        return
      }
      throw new Error('ACCOUNT_ALREADY_EXISTS')
    }

    await ctx.db.insert('accounts', {
      loginId,
      passwordHash: hashPassword(loginId),
      accountType: 'catechist',
      userRefId: args.catechistId,
      isActive: true,
      createdAt: Date.now(),
      isDeleted: false,
    })
  },
})

export const grantStudentAccount = mutation({
  args: {
    requesterId: v.id('catechists'),
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const student = await ctx.db.get('students', args.studentId)
    if (!student || student.isDeleted) {
      throw new Error('STUDENT_NOT_FOUND')
    }

    const loginId = `STD-${student.studentCode}`
    const existingById = await ctx.db
      .query('accounts')
      .withIndex('by_login_id', (q) => q.eq('loginId', loginId))
      .first()

    if (existingById) {
      if (existingById.isDeleted) {
        await ctx.db.patch("accounts", existingById._id, {
          isDeleted: false,
          isActive: true,
          passwordHash: hashPassword(loginId),
          lastLoginAt: undefined,
        })
        return
      }
      throw new Error('ACCOUNT_ALREADY_EXISTS')
    }

    await ctx.db.insert('accounts', {
      loginId,
      passwordHash: hashPassword(loginId),
      accountType: 'student',
      userRefId: args.studentId,
      isActive: true,
      createdAt: Date.now(),
      isDeleted: false,
    })
  },
})

export const resetPassword = mutation({
  args: {
    requesterId: v.id('catechists'),
    accountId: v.id('accounts'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const account = await ctx.db.get('accounts', args.accountId)
    if (!account || account.isDeleted) {
      throw new Error('ACCOUNT_NOT_FOUND')
    }

    await ctx.db.patch("accounts", args.accountId, {
      passwordHash: hashPassword(account.loginId),
    })
  },
})

export const toggleAccountStatus = mutation({
  args: {
    requesterId: v.id('catechists'),
    accountId: v.id('accounts'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const account = await ctx.db.get('accounts', args.accountId)
    if (!account || account.isDeleted) {
      throw new Error('ACCOUNT_NOT_FOUND')
    }

    await ctx.db.patch("accounts", args.accountId, {
      isActive: !account.isActive,
    })
  },
})
