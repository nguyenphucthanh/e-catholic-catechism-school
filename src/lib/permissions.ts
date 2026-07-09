import type { AuthUser } from './auth'

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'admin'
}

export function isCatechist(user: AuthUser | null): boolean {
  return user?.accountType === 'catechist'
}
