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

/**
 * Reserves `count` sequential counter values in a single patch/insert
 * (mirrors convex/csvImport.ts's local `reserveCounters` helper). Use this
 * instead of calling `nextCounter` in a loop when you need many ids at once
 * (e.g. seeding N catechists/students) — one counter write instead of N.
 */
export async function reserveCounterBatch(
  ctx: MutationCtx,
  name: string,
  count: number,
): Promise<Array<number>> {
  if (count === 0) return []
  const counter = await ctx.db
    .query('counters')
    .withIndex('by_name', (q) => q.eq('name', name))
    .unique()
  const start = (counter?.value ?? 0) + 1
  const end = start + count - 1
  if (counter) {
    await ctx.db.patch('counters', counter._id, { value: end })
  } else {
    await ctx.db.insert('counters', { name, value: end })
  }
  return Array.from({ length: count }, (_, i) => start + i)
}
