import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RECAPTCHA_SCRIPT_ID, useRecaptcha } from './use-recaptcha'

describe('useRecaptcha', () => {
  beforeEach(() => {
    document.getElementById(RECAPTCHA_SCRIPT_ID)?.remove()
    delete (window as any).grecaptcha
  })

  afterEach(() => {
    document.getElementById(RECAPTCHA_SCRIPT_ID)?.remove()
    delete (window as any).grecaptcha
    vi.restoreAllMocks()
  })

  it('does nothing when siteKey is not configured', async () => {
    const { result } = renderHook(() => useRecaptcha(''))

    expect(result.current.siteKey).toBe('')
    expect(result.current.isLoaded).toBe(false)
    expect(document.getElementById(RECAPTCHA_SCRIPT_ID)).toBeNull()

    const token = await result.current.executeRecaptcha('login')
    expect(token).toBeNull()
  })

  it('injects reCAPTCHA script tag when siteKey is provided', () => {
    renderHook(() => useRecaptcha('test-site-key-123'))

    const script = document.getElementById(
      RECAPTCHA_SCRIPT_ID,
    ) as HTMLScriptElement
    expect(script).not.toBeNull()
    expect(script.src).toContain(
      'https://www.google.com/recaptcha/api.js?render=test-site-key-123',
    )
    expect(script.async).toBe(true)
    expect(script.defer).toBe(true)
  })

  it('does not inject duplicate script if script tag already exists', () => {
    const existing = document.createElement('script')
    existing.id = RECAPTCHA_SCRIPT_ID
    existing.src = 'https://www.google.com/recaptcha/api.js?render=existing'
    document.head.appendChild(existing)

    renderHook(() => useRecaptcha('test-site-key-123'))

    const scripts = document.querySelectorAll(`script#${RECAPTCHA_SCRIPT_ID}`)
    expect(scripts).toHaveLength(1)
  })

  it('sets isLoaded to true when grecaptcha is already available', () => {
    const mockReady = vi.fn((cb: () => void) => cb())
    ;(window as any).grecaptcha = {
      ready: mockReady,
      execute: vi.fn(),
    }

    const { result } = renderHook(() => useRecaptcha('test-site-key'))

    expect(mockReady).toHaveBeenCalled()
    expect(result.current.isLoaded).toBe(true)
  })

  it('handles script load event when grecaptcha ready is called', () => {
    const { result } = renderHook(() => useRecaptcha('test-site-key'))
    const script = document.getElementById(
      RECAPTCHA_SCRIPT_ID,
    ) as HTMLScriptElement

    const mockReady = vi.fn((cb: () => void) => cb())
    ;(window as any).grecaptcha = {
      ready: mockReady,
      execute: vi.fn(),
    }

    act(() => {
      script.dispatchEvent(new Event('load'))
    })

    expect(mockReady).toHaveBeenCalled()
    expect(result.current.isLoaded).toBe(true)
  })

  it('executeRecaptcha returns token from window.grecaptcha.execute', async () => {
    const mockExecute = vi.fn().mockResolvedValue('recaptcha-token-xyz')
    ;(window as any).grecaptcha = {
      ready: (cb: () => void) => cb(),
      execute: mockExecute,
    }

    const { result } = renderHook(() => useRecaptcha('test-site-key'))

    let token: string | null = null
    await act(async () => {
      token = await result.current.executeRecaptcha('login')
    })

    expect(mockExecute).toHaveBeenCalledWith('test-site-key', {
      action: 'login',
    })
    expect(token).toBe('recaptcha-token-xyz')
  })

  it('executeRecaptcha returns null if execute throws an error', async () => {
    const mockExecute = vi.fn().mockRejectedValue(new Error('Network error'))
    ;(window as any).grecaptcha = {
      ready: (cb: () => void) => cb(),
      execute: mockExecute,
    }

    const { result } = renderHook(() => useRecaptcha('test-site-key'))

    let token: string | null = 'init'
    await act(async () => {
      token = await result.current.executeRecaptcha('login')
    })

    expect(token).toBeNull()
  })

  it('removes load event listener on unmount', () => {
    const { unmount } = renderHook(() => useRecaptcha('test-site-key'))
    const script = document.getElementById(
      RECAPTCHA_SCRIPT_ID,
    ) as HTMLScriptElement

    const removeEventListenerSpy = vi.spyOn(script, 'removeEventListener')
    unmount()
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'load',
      expect.any(Function),
    )
  })
})
