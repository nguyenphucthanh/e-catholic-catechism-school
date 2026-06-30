// Stable error codes shared between Convex mutations and the frontend, so
// catch blocks can match on a fixed code instead of an English substring
// that could drift from the thrown message.
export const ACADEMIC_YEAR_ERRORS = {
  DUPLICATE_NAME: 'ACADEMIC_YEAR_DUPLICATE_NAME',
  CANNOT_DELETE_ACTIVE: 'ACADEMIC_YEAR_CANNOT_DELETE_ACTIVE',
  INVALID_SEMESTER_COUNT: 'ACADEMIC_YEAR_INVALID_SEMESTER_COUNT',
} as const

export const BRANCH_ERRORS = {
  DUPLICATE_NAME: 'BRANCH_DUPLICATE_NAME',
  NOT_FOUND: 'BRANCH_NOT_FOUND',
  IN_USE_BY_CLASS: 'BRANCH_IN_USE_BY_CLASS',
} as const
