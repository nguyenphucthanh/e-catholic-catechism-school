import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useQuery } from 'convex/react'
import { useManagementPermission } from './use-management-permission'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'

vi.mock('~/lib/auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: vi.fn(),
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))

describe('useManagementPermission', () => {
  it('returns default permission values for null user', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as any)
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: null,
    } as any)
    vi.mocked(useQuery).mockReturnValue(undefined)

    const { result } = renderHook(() => useManagementPermission())

    expect(result.current.canManage).toBe(false)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.permissions).toBeUndefined()
  })

  it('queries permissions and evaluates management permission for catechist user', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { accountType: 'catechist', userDocId: 'cat_1' },
    } as any)
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: 'year_1',
    } as any)
    vi.mocked(useQuery).mockReturnValue({ isBoardMember: true })

    const { result } = renderHook(() => useManagementPermission())

    expect(result.current.canManage).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.permissions).toEqual({ isBoardMember: true })
  })

  it('sets isLoading true when catechist user query is pending (undefined)', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { accountType: 'catechist', userDocId: 'cat_1' },
    } as any)
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: 'year_1',
    } as any)
    vi.mocked(useQuery).mockReturnValue(undefined)

    const { result } = renderHook(() => useManagementPermission())

    expect(result.current.isLoading).toBe(true)
  })
})
