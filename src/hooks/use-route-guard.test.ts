import { renderHook } from '@testing-library/react'
import { useNavigate } from '@tanstack/react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRouteGuard } from './use-route-guard'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: vi.fn(),
}))

describe('useRouteGuard', () => {
  const navigate = vi.fn()

  beforeEach(() => {
    navigate.mockClear()
    vi.mocked(useNavigate).mockReturnValue(navigate)
  })

  it('is not ready and does not navigate while pending', () => {
    const { result } = renderHook(() =>
      useRouteGuard({ pending: true, allowed: false, redirectTo: '/login' }),
    )

    expect(result.current.ready).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('is ready and does not navigate when allowed', () => {
    const { result } = renderHook(() =>
      useRouteGuard({ pending: false, allowed: true, redirectTo: '/login' }),
    )

    expect(result.current.ready).toBe(true)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('navigates with { to, replace: true } when redirectTo is a string', () => {
    renderHook(() =>
      useRouteGuard({ pending: false, allowed: false, redirectTo: '/login' }),
    )

    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith({ to: '/login', replace: true })
  })

  it('navigates with the spread object plus replace: true when redirectTo is a NavigateOptions object', () => {
    const redirectTo = { to: '/x', params: { id: '1' } } as any
    renderHook(() =>
      useRouteGuard({ pending: false, allowed: false, redirectTo }),
    )

    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith({
      to: '/x',
      params: { id: '1' },
      replace: true,
    })
  })

  it('navigates with the thunk-resolved value plus replace: true when redirectTo is a function', () => {
    const redirectTo = (() => ({ to: '/dashboard' })) as any
    renderHook(() =>
      useRouteGuard({ pending: false, allowed: false, redirectTo }),
    )

    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith({ to: '/dashboard', replace: true })
  })

  it('does not navigate again on rerender with unchanged pending/allowed', () => {
    const { rerender } = renderHook(
      (props: { pending: boolean; allowed: boolean }) =>
        useRouteGuard({ ...props, redirectTo: '/login' }),
      { initialProps: { pending: false, allowed: false } },
    )

    expect(navigate).toHaveBeenCalledTimes(1)

    rerender({ pending: false, allowed: false })
    rerender({ pending: false, allowed: false })

    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('navigates exactly once, only after pending clears to false/false', () => {
    const { rerender } = renderHook(
      (props: { pending: boolean; allowed: boolean }) =>
        useRouteGuard({ ...props, redirectTo: '/login' }),
      { initialProps: { pending: true, allowed: false } },
    )

    expect(navigate).not.toHaveBeenCalled()

    rerender({ pending: false, allowed: false })

    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith({ to: '/login', replace: true })
  })
})
