import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

export async function assertBoardRole(
  ctx: QueryCtx | MutationCtx,
  requesterId: Id<'catechists'>,
) {
  const catechist = await ctx.db.get('catechists', requesterId)
  if (!catechist) {
    throw new Error('Unauthorized: Catechist profile not found')
  }
  if (catechist.isDeleted) {
    throw new Error('Unauthorized: Account has been deleted')
  }
  if (!catechist.isActive) {
    throw new Error('Unauthorized: Account is inactive')
  }
  if (catechist.role !== 'board') {
    throw new Error('Unauthorized: Requester does not have board permissions')
  }
  return catechist
}
