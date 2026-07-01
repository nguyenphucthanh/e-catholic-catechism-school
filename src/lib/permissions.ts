import type { AuthUser } from './auth'

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'admin'
}

export function canManageAcademicYear(user: AuthUser | null): boolean {
  return isAdmin(user)
}
