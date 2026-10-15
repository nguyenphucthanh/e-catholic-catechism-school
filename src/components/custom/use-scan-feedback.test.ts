import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useScanFeedback } from './use-scan-feedback'
import type { ScanFeedback } from './use-scan-feedback'
import { playBeep } from '~/lib/beep'

vi.mock('~/lib/beep', () => ({ playBeep: vi.fn() }))

const ok: ScanFeedback = { status: 'success', name: 'An' }

describe('useScanFeedback', () => {
  const vibrate = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-10-05T08:00:00'))
    vi.mocked(playBeep).mockClear()
    vibrate.mockClear()
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrate,
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()

    delete (navigator as any).vibrate
  })

  it('sets feedback, beeps and vibrates on success', () => {
    const { result } = renderHook(() => useScanFeedback(() => ok))
    act(() => result.current.onScan('a'))
    expect(result.current.feedback).toEqual(ok)
    expect(playBeep).toHaveBeenCalledWith('success')
    expect(vibrate).toHaveBeenCalledWith(100)
  })

  it.each(['duplicate', 'unknown'] as const)(
    'sets %s feedback without beep or vibrate',
    (status) => {
      const fb = { status, name: 'x' }
      const { result } = renderHook(() => useScanFeedback(() => fb))
      act(() => result.current.onScan('a'))
      expect(result.current.feedback).toEqual(fb)
      expect(playBeep).not.toHaveBeenCalled()
      expect(vibrate).not.toHaveBeenCalled()
    },
  )

  it('does not crash when navigator.vibrate is absent', () => {
    delete (navigator as any).vibrate
    const { result } = renderHook(() => useScanFeedback(() => ok))
    act(() => result.current.onScan('a'))
    expect(playBeep).toHaveBeenCalledWith('success')
    expect(result.current.feedback).toEqual(ok)
  })

  it.each([undefined, null])('ignores a %s resolve result', (value) => {
    const { result } = renderHook(() =>
      useScanFeedback(() => value as unknown as undefined),
    )
    act(() => result.current.onScan('a'))
    expect(result.current.feedback).toBeNull()
    expect(playBeep).not.toHaveBeenCalled()
  })

  it('debounces the same code within 500ms but not other codes', () => {
    const resolve = vi.fn(() => ok)
    const { result } = renderHook(() => useScanFeedback(resolve))
    act(() => result.current.onScan('a'))
    act(() => {
      vi.advanceTimersByTime(499)
      result.current.onScan('a')
    })
    expect(resolve).toHaveBeenCalledTimes(1)
    act(() => result.current.onScan('b'))
    expect(resolve).toHaveBeenCalledTimes(2)
    act(() => {
      vi.advanceTimersByTime(500)
      result.current.onScan('a')
    })
    expect(resolve).toHaveBeenCalledTimes(3)
  })

  it('clears feedback after 2s', () => {
    const { result } = renderHook(() => useScanFeedback(() => ok))
    act(() => result.current.onScan('a'))
    act(() => {
      vi.advanceTimersByTime(1999)
    })
    expect(result.current.feedback).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.feedback).toBeNull()
  })

  it('clearFeedback clears immediately', () => {
    const { result } = renderHook(() => useScanFeedback(() => ok))
    act(() => result.current.onScan('a'))
    act(() => result.current.clearFeedback())
    expect(result.current.feedback).toBeNull()
  })

  it('keeps onScan identity stable while using the latest resolve', () => {
    const first = vi.fn(() => ok)
    const second = vi.fn(() => ({ status: 'duplicate', name: 'B' }) as const)
    const { result, rerender } = renderHook(({ r }) => useScanFeedback(r), {
      initialProps: { r: first },
    })
    const initial = result.current.onScan
    rerender({ r: second })
    expect(result.current.onScan).toBe(initial)
    act(() => result.current.onScan('a'))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith('a')
    expect(result.current.feedback?.status).toBe('duplicate')
  })
})
