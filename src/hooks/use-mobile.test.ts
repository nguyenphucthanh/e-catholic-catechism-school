import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIsMobile } from './use-mobile'

describe('useIsMobile hook', () => {
  const addEventListenerMock = vi.fn()
  const removeEventListenerMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
        dispatchEvent: vi.fn(),
      })),
    })
  })

  test('returns false when window.innerWidth is desktop width (>= 768)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1024,
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  test('returns true when window.innerWidth is mobile width (< 768)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 500,
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  test('adds event listener on mount and removes it on unmount', () => {
    const { unmount } = renderHook(() => useIsMobile())

    expect(addEventListenerMock).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    )

    unmount()
    expect(removeEventListenerMock).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    )
  })
})
