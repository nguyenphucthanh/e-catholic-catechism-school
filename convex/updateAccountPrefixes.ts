import { v } from 'convex/values'
import { action, internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import {
  getCatechistAccountPrefix,
  getStudentAccountPrefix,
} from './lib/accountPrefix'
import { hashPassword } from './lib/password'
import type { Doc } from './_generated/dataModel'

export const updateAccountBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const catechistPrefix = getCatechistAccountPrefix()
    const studentPrefix = getStudentAccountPrefix()

    const accounts = await ctx.db.query('accounts').collect()
    const pendingUpdates: Array<{
      id: Doc<'accounts'>['_id']
      newLoginId: string
    }> = []

    for (const account of accounts) {
      const { accountType, loginId } = account
      const expectedPrefix =
        accountType === 'catechist' ? catechistPrefix : studentPrefix

      if (!loginId.startsWith(expectedPrefix)) {
        const parts = loginId.split('-')
        const rawIdentifier =
          parts.length > 1 ? parts.slice(1).join('-') : loginId
        const newLoginId = `${expectedPrefix}-${rawIdentifier}`
        pendingUpdates.push({ id: account._id, newLoginId })
      }
    }

    return {
      pendingUpdates,
      totalProcessed: accounts.length,
    }
  },
})

export const applyAccountUpdate = internalMutation({
  args: {
    id: v.id('accounts'),
    newLoginId: v.string(),
    newPasswordHash: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch('accounts', args.id, {
      loginId: args.newLoginId,
      passwordHash: args.newPasswordHash,
    })
  },
})

export const updateAccountLoginIdPrefixes = action({
  args: {},
  handler: async (ctx) => {
    const { pendingUpdates, totalProcessed } = (await ctx.runMutation(
      internal.updateAccountPrefixes.updateAccountBatch,
      {},
    )) as {
      pendingUpdates: Array<{ id: Doc<'accounts'>['_id']; newLoginId: string }>
      totalProcessed: number
    }

    let updatedCount = 0
    for (const update of pendingUpdates) {
      const newPasswordHash = hashPassword(update.newLoginId)
      await ctx.runMutation(internal.updateAccountPrefixes.applyAccountUpdate, {
        id: update.id,
        newLoginId: update.newLoginId,
        newPasswordHash,
      })
      updatedCount++
    }

    return {
      success: true,
      updatedCount,
      totalProcessed,
    }
  },
})
