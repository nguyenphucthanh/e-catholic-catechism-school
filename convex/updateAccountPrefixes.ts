import { v } from 'convex/values'
import { internalAction, internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import {
  getCatechistAccountPrefix,
  getStudentAccountPrefix,
} from './lib/accountPrefix'
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
  },
  handler: async (ctx, args) => {
    // Login ID rename only; passwords are left untouched.
    await ctx.db.patch('accounts', args.id, { loginId: args.newLoginId })
  },
})

export const updateAccountLoginIdPrefixes = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    success: boolean
    updatedCount: number
    totalProcessed: number
  }> => {
    const { pendingUpdates, totalProcessed } = await ctx.runMutation(
      internal.updateAccountPrefixes.updateAccountBatch,
      {},
    )

    let updatedCount = 0
    for (const update of pendingUpdates) {
      await ctx.runMutation(internal.updateAccountPrefixes.applyAccountUpdate, {
        id: update.id,
        newLoginId: update.newLoginId,
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
