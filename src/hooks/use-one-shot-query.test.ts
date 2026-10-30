import { describe, expect, test, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useConvex } from 'convex/react'
import { makeFunctionReference } from 'convex/server'
import { toast } from 'sonner'
import { useOneShotQuery } from './use-one-shot-query'

const ref = makeFunctionReference<'query'>('x:y') as any

function mockQuery(impl: () => Promise<unknown>) {
  const query = vi.fn(impl)
  vi.mocked(useConvex).mockReturnValue({ query } as any)
  return query
}

describe('useOneShotQuery', () => {
  test('fetches once and exposes data', async () => {
    const query = mockQuery(() => Promise.resolve('result'))

    const { result } = renderHook(() => useOneShotQuery(ref, { a: 1 }))

    await waitFor(() => expect(result.current.data).toBe('result'))
    expect(query).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledWith(ref, { a: 1 })
  })

  test('does not fetch when args is skip', () => {
    const query = mockQuery(() => Promise.resolve('x'))

    const { result } = renderHook(() => useOneShotQuery(ref, 'skip'))

    expect(query).not.toHaveBeenCalled()
    expect(result.current.data).toBeUndefined()
  })

  test('refresh refetches', async () => {
    const query = mockQuery(() => Promise.resolve('x'))
    const { result } = renderHook(() => useOneShotQuery(ref, { a: 1 }))
    await waitFor(() => expect(result.current.data).toBe('x'))

    act(() => result.current.refresh())

    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
  })

  test('does not refetch when args are re-created with equal content', async () => {
    const query = mockQuery(() => Promise.resolve('x'))
    const { result, rerender } = renderHook(() =>
      useOneShotQuery(ref, { a: 1 }),
    )
    await waitFor(() => expect(result.current.data).toBe('x'))

    rerender()

    expect(query).toHaveBeenCalledTimes(1)
  })

  test('toasts on failure and keeps data undefined', async () => {
    mockQuery(() => Promise.reject(new Error('boom')))
    const { result } = renderHook(() => useOneShotQuery(ref, { a: 1 }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(result.current.data).toBeUndefined()
  })

  test('ignores results and errors that arrive after unmount', async () => {
    let resolve!: (v: unknown) => void
    mockQuery(() => new Promise((r) => (resolve = r)))
    const { result, unmount } = renderHook(() => useOneShotQuery(ref, { a: 1 }))
    unmount()
    resolve('late')
    await Promise.resolve()
    expect(result.current.data).toBeUndefined()

    let reject!: (e: unknown) => void
    mockQuery(() => new Promise((_, r) => (reject = r)))
    vi.mocked(toast.error).mockClear()
    const second = renderHook(() => useOneShotQuery(ref, { a: 2 }))
    second.unmount()
    reject(new Error('late'))
    await Promise.resolve()
    await Promise.resolve()
    expect(toast.error).not.toHaveBeenCalled()
  })
})
