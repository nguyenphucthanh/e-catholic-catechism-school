import { mutation } from './_generated/server'
import { assertValidRequester } from './lib/authz'

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await assertValidRequester(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})
