import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { assertAdminRole } from './lib/authz'

export const get = query({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db.query('appConfig').first()
    if (!config) return null

    const logoUrl = config.logoStorageId
      ? await ctx.storage.getUrl(config.logoStorageId)
      : undefined

    return {
      ...config,
      logoUrl,
      epiphanyOnSunday: config.epiphanyOnSunday ?? true,
      corpusChristiOnSunday: config.corpusChristiOnSunday ?? true,
      ascensionOnSunday: config.ascensionOnSunday ?? true,
    }
  },
})

export const upsert = mutation({
  args: {
    requesterId: v.id('catechists'),
    parishName: v.string(),
    dioceseName: v.string(),
    nameFormat: v.union(
      v.literal('firstName_lastName'),
      v.literal('lastName_firstName'),
    ),
    logoStorageId: v.optional(v.id('_storage')),
    epiphanyOnSunday: v.boolean(),
    corpusChristiOnSunday: v.boolean(),
    ascensionOnSunday: v.boolean(),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx, args.requesterId)

    const existing = await ctx.db.query('appConfig').first()
    const { requesterId, ...fields } = args

    if (existing) {
      await ctx.db.patch('appConfig', existing._id, fields)
    } else {
      await ctx.db.insert('appConfig', fields)
    }
  },
})
