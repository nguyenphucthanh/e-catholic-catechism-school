import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { assertAdminRole, assertValidRequester } from './lib/authz'
import {
  getCatechistAccountPrefix,
  getStudentAccountPrefix,
} from './lib/accountPrefix'
import {
  assertValidAttendancePointConfig,
  attendancePointConfigValidator,
} from './lib/attendance'

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
      attendancePointConfig: config.attendancePointConfig ?? {
        mode: 'rate' as const,
      },
      catechistTitles: config.catechistTitles ?? [],
    }
  },
})

// Prefixes are env-configured and meant to stay non-obvious, so they are not
// part of the public `get`; any valid logged-in account may read them (QR cards).
export const getAccountPrefixes = query({
  args: {},
  handler: async (ctx) => {
    await assertValidRequester(ctx)
    return {
      student: getStudentAccountPrefix(),
      catechist: getCatechistAccountPrefix(),
    }
  },
})

export const upsert = mutation({
  args: {
    troopName: v.optional(v.string()),
    parishName: v.string(),
    dioceseName: v.string(),
    nameFormat: v.union(
      v.literal('firstName_lastName'),
      v.literal('lastName_firstName'),
    ),
    logoStorageId: v.optional(v.union(v.id('_storage'), v.null())),
    epiphanyOnSunday: v.boolean(),
    corpusChristiOnSunday: v.boolean(),
    ascensionOnSunday: v.boolean(),
    attendancePointConfig: v.optional(attendancePointConfigValidator),
    catechistTitles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx)
    assertValidAttendancePointConfig(args.attendancePointConfig)

    const existing = await ctx.db.query('appConfig').first()
    const { logoStorageId, catechistTitles, ...fields } = args
    const patch = {
      ...fields,
      catechistTitles: catechistTitles
        ? Array.from(
            new Set(catechistTitles.map((t) => t.trim()).filter(Boolean)),
          )
        : undefined,
      logoStorageId: logoStorageId ?? undefined,
    }

    if (existing) {
      await ctx.db.patch('appConfig', existing._id, patch)
    } else {
      await ctx.db.insert('appConfig', patch)
    }
  },
})
