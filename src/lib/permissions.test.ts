import { describe, expect, it } from 'vitest'
import { hasManagementPermission, isAdmin, isCatechist } from './permissions'
import type { AuthUser } from './auth'

describe('permissions utilities', () => {
  describe('isAdmin', () => {
    it('returns true when user role is admin', () => {
      const user = { role: 'admin' } as unknown as AuthUser
      expect(isAdmin(user)).toBe(true)
    })

    it('returns false when user is null or not admin', () => {
      expect(isAdmin(null)).toBe(false)
      expect(isAdmin({ role: 'catechist' } as unknown as AuthUser)).toBe(false)
    })
  })

  describe('isCatechist', () => {
    it('returns true when accountType is catechist', () => {
      const user = { accountType: 'catechist' } as unknown as AuthUser
      expect(isCatechist(user)).toBe(true)
    })

    it('returns false when user is null or accountType is not catechist', () => {
      expect(isCatechist(null)).toBe(false)
      expect(
        isCatechist({ accountType: 'student' } as unknown as AuthUser),
      ).toBe(false)
    })
  })

  describe('hasManagementPermission', () => {
    it('returns true if user is admin', () => {
      const user = { role: 'admin' } as unknown as AuthUser
      expect(hasManagementPermission(user, null)).toBe(true)
    })

    it('returns true if permissions indicates board member', () => {
      const user = { role: 'catechist' } as unknown as AuthUser
      expect(hasManagementPermission(user, { isBoardMember: true })).toBe(true)
    })

    it('returns true if permissions indicates branch head with non-empty array', () => {
      const user = { role: 'catechist' } as unknown as AuthUser
      expect(
        hasManagementPermission(user, { branchHeadOf: ['branch_1'] }),
      ).toBe(true)
    })

    it('returns false if branchHeadOf is empty array or user has no management rights', () => {
      const user = { role: 'catechist' } as unknown as AuthUser
      expect(hasManagementPermission(user, { branchHeadOf: [] })).toBe(false)
      expect(hasManagementPermission(user, null)).toBe(false)
      expect(hasManagementPermission(null, null)).toBe(false)
    })
  })
})
