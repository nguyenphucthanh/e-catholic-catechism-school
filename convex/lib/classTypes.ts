import { v } from 'convex/values'

// Single source of truth for the ClassYear.classType enum — shared by
// schema.ts, classes.ts mutations/queries, and frontend forms.
export const CLASS_TYPES = [
  'primary',
  'apostle',
  'sacrament_review',
  'supplemental_other',
] as const

export type ClassType = (typeof CLASS_TYPES)[number]

export const DEFAULT_CLASS_TYPE: ClassType = 'primary'

export const classTypeValidator = v.union(
  ...CLASS_TYPES.map((ct) => v.literal(ct)),
)
