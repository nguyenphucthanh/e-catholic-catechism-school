import { mutation } from './_generated/server'
import { assertValidRequester, requireRequester } from './lib/authz'

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await assertValidRequester(ctx, await requireRequester(ctx))
    return await ctx.storage.generateUploadUrl()
  },
})
