import type { MutationCtx } from '../_generated/server'

export async function nextCounter(
  ctx: MutationCtx,
  name: string,
): Promise<number> {
  const counter = await ctx.db
    .query('counters')
    .withIndex('by_name', (q) => q.eq('name', name))
    .unique()

  const next = (counter?.value ?? 0) + 1

  if (counter) {
    await ctx.db.patch('counters', counter._id, { value: next })
  } else {
    await ctx.db.insert('counters', { name, value: next })
  }

  return next
}
