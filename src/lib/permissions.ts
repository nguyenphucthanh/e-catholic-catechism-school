import type { AuthUser } from './auth'

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'admin'
}

export function isCatechist(user: AuthUser | null): boolean {
  return user?.accountType === 'catechist'
}

export interface EffectivePermissions {
  isAdmin?: boolean
  isBoardMember?: boolean
  branchHeadOf?: Array<string>
  classCatechistOf?: Array<string>
}

/**
 * Checks whether the user has management permissions (Admin, Board Member, or Branch Head)
 */
export function hasManagementPermission(
  user: AuthUser | null,
  permissions?: EffectivePermissions | null,
): boolean {
  if (isAdmin(user)) return true
  if (permissions?.isBoardMember) return true
  if (permissions?.branchHeadOf && permissions.branchHeadOf.length > 0)
    return true
  return false
}
