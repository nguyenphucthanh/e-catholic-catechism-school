import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

type SacramentFields = Partial<
  Pick<
    Doc<'studentSacraments'>,
    'receivedDate' | 'receivedPlace' | 'feastName' | 'sponsorName' | 'notes'
  >
>

/**
 * Looks up the (studentId, sacramentType) record via the
 * `by_student_id_and_sacrament_type` index and patches it, or inserts a new
 * one if none exists. Patches always reset `isDeleted: false` — editing a
 * sacrament's fields reactivates a soft-deleted record, matching the
 * codebase's general soft-delete pattern. Callers are responsible for their
 * own permission checks before calling this.
 */
export async function upsertSacramentRecord(
  ctx: MutationCtx,
  {
    studentId,
    sacramentType,
    fields,
  }: {
    studentId: Id<'students'>
    sacramentType: Doc<'studentSacraments'>['sacramentType']
    fields: SacramentFields
  },
): Promise<Id<'studentSacraments'>> {
  const existing = await ctx.db
    .query('studentSacraments')
    .withIndex('by_student_id_and_sacrament_type', (q) =>
      q.eq('studentId', studentId).eq('sacramentType', sacramentType),
    )
    .unique()

  if (existing) {
    await ctx.db.patch('studentSacraments', existing._id, {
      ...fields,
      isDeleted: false,
    })
    return existing._id
  }

  return await ctx.db.insert('studentSacraments', {
    studentId,
    sacramentType,
    ...fields,
    isDeleted: false,
  })
}
