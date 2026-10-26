import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { toRequester, useRequester } from './requester'
import type { AuthUser } from '~/lib/auth'
import { useAuth } from '~/lib/auth'

const base: AuthUser = {
  userDocId: 'doc1',
  loginId: 'login1',
  memberId: '1',
  fullName: 'Test User',
  accountType: 'catechist',
  role: 'user',
  sessionId: 's1',
  sessionSecret: 'secret',
}

const mockAuth = (user: AuthUser | null) =>
  vi.mocked(useAuth).mockReturnValue({
    user,
    login: vi.fn(),
    logout: vi.fn(),
  })

describe('toRequester', () => {
  test('maps a catechist user to a catechist requester', () => {
    expect(toRequester(base)).toEqual({
      accountType: 'catechist',
      requesterId: 'doc1',
    })
  })

  test('maps a student user to a student requester', () => {
    expect(
      toRequester({ ...base, accountType: 'student', userDocId: 'stu1' }),
    ).toEqual({ accountType: 'student', requesterId: 'stu1' })
  })
})

describe('useRequester', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns undefined when there is no user', () => {
    mockAuth(null)
    const { result } = renderHook(() => useRequester())
    expect(result.current).toBeUndefined()
  })

  test('returns catechist requester for a catechist user', () => {
    mockAuth(base)
    const { result } = renderHook(() => useRequester())
    expect(result.current).toEqual({
      accountType: 'catechist',
      requesterId: 'doc1',
    })
  })

  test('returns student requester for a student user', () => {
    mockAuth({ ...base, accountType: 'student', userDocId: 'stu1' })
    const { result } = renderHook(() => useRequester())
    expect(result.current).toEqual({
      accountType: 'student',
      requesterId: 'stu1',
    })
  })
})
