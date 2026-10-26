import { mutation } from './_generated/server'
import { assertValidRequester, requesterValidator } from './lib/authz'

export const generateUploadUrl = mutation({
  args: { requester: requesterValidator },
  handler: async (ctx, { requester }) => {
    await assertValidRequester(ctx, requester)
    return await ctx.storage.generateUploadUrl()
  },
})
