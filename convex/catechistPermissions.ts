import { v } from 'convex/values'
import { query } from './_generated/server'
import {
  assertValidCatechist,
  getEffectivePermissions,
  requireCatechistId,
} from './lib/authz'

export const getPermissions = query({
  args: {
    academicYearId: v.id('academicYears'),
  },
  async handler(ctx, { academicYearId }) {
    const requesterId = await requireCatechistId(ctx)
    await assertValidCatechist(ctx, requesterId)
    return await getEffectivePermissions(ctx, requesterId, academicYearId)
  },
})
