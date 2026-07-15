import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

/**
 * Parish-scoped (mass/extracurricular) sessions are one-row-per-date for the
 * whole parish (see docs/09-design-decisions.md §9.12). Looks up an existing
 * non-deleted session for the given type+date via the
 * `by_session_type_and_session_date` index. Callers decide what to do about
 * a cancelled match — this only finds it.
 */
export async function findExistingParishSession(
  ctx: QueryCtx | MutationCtx,
  sessionType: 'mass' | 'extracurricular',
  sessionDate: string,
): Promise<Doc<'classSessions'> | null> {
  const existing = await ctx.db
    .query('classSessions')
    .withIndex('by_session_type_and_session_date', (q) =>
      q.eq('sessionType', sessionType).eq('sessionDate', sessionDate),
    )
    .collect()

  return existing.find((s) => !s.isDeleted) ?? null
}
