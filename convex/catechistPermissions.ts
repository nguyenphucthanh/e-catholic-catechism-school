import { v } from 'convex/values'
import { query } from './_generated/server'
import { assertValidCatechist, getEffectivePermissions } from './lib/authz'

export const getPermissions = query({
  args: {
    academicYearId: v.id('academicYears'),
  },
  async handler(ctx, { academicYearId }) {
    await assertValidCatechist(ctx)
    return await getEffectivePermissions(ctx, academicYearId)
  },
})
