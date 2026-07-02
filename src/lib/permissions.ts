import type { AuthUser } from './auth'
import type { Id } from '../../convex/_generated/dataModel'

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'admin'
}

export function canManageAcademicYear(user: AuthUser | null): boolean {
  return isAdmin(user)
}

export function isBoardMember(
  user: AuthUser | null,
  _academicYearId?: Id<'academicYears'>,
): boolean {
  return isAdmin(user)
}
