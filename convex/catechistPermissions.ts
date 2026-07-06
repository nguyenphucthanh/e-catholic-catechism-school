import { v } from 'convex/values'
import { query } from './_generated/server'
import { getEffectivePermissions } from './lib/authz'

export const getPermissions = query({
  args: {
    requesterId: v.id('catechists'),
    academicYearId: v.id('academicYears'),
  },
  async handler(ctx, { requesterId, academicYearId }) {
    return await getEffectivePermissions(ctx, requesterId, academicYearId)
  },
})
