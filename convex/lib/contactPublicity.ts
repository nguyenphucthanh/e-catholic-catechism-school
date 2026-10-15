import { v } from 'convex/values'

export const contactPublicityValidator = v.union(
  v.literal('private'),
  v.literal('public'),
)

/** Unset publicity on a stored contact means private. */
export const DEFAULT_CONTACT_PUBLICITY = 'private' as const

/** Soft-deleted contacts are never visible; non-privileged viewers only see public ones. */
export function isContactVisible(
  c: { isDeleted: boolean; publicity?: 'private' | 'public' },
  canViewPrivate: boolean,
): boolean {
  return !c.isDeleted && (canViewPrivate || c.publicity === 'public')
}
