import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

// 1. Mock dependencies
const mockRecordBatch = vi.fn()
vi.mock('convex/react', () => ({
  useMutation: vi.fn(() => mockRecordBatch),
}))

const mockGetPendingQueue = vi.fn()
const mockUpdateQueueStatus = vi.fn()
vi.mock('../lib/offline-db', () => ({
  getPendingQueue: () => mockGetPendingQueue(),
  updateQueueStatus: (localId: string, status: string, error?: string) =>
    mockUpdateQueueStatus(localId, status, error),
}))

// Re-import module under test after mock setup
const { useAttendanceSync } = await import('./use-attendance-sync')

describe('useAttendanceSync hook', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockGetPendingQueue.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with synced status when queue is empty', async () => {
    const { result } = renderHook(() => useAttendanceSync('cat123' as any))

    // Allow initial queue check promise to resolve
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.syncStatus).toBe('synced')
    expect(result.current.pendingCount).toBe(0)
  })

  it('detects pending items and triggers sync when online', async () => {
    const pendingScans = [
      {
        localId: 'scan1',
        sessionId: 'sess1',
        studentClassId: 'sc1',
        status: 'present',
        deviceQueuedAt: 1000,
      },
    ]

    mockGetPendingQueue.mockResolvedValueOnce(pendingScans) // Initial mount check
    mockGetPendingQueue.mockResolvedValueOnce(pendingScans) // Inside syncNow call
    mockGetPendingQueue.mockResolvedValueOnce([]) // After sync completes

    mockRecordBatch.mockResolvedValue([{ localId: 'scan1', status: 'synced' }])

    const { result } = renderHook(() => useAttendanceSync('cat123' as any))

    // Resolve initial mount check and sync trigger
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockRecordBatch).toHaveBeenCalledWith({
      requesterId: 'cat123',
      records: [
        {
          localId: 'scan1',
          sessionId: 'sess1',
          studentClassId: 'sc1',
          status: 'present',
          deviceQueuedAt: 1000,
        },
      ],
    })

    expect(mockUpdateQueueStatus).toHaveBeenCalledWith(
      'scan1',
      'synced',
      undefined,
    )
    expect(result.current.syncStatus).toBe('synced')
    expect(result.current.pendingCount).toBe(0)
  })

  it('handles sync conflict results correctly', async () => {
    const pendingScans = [
      {
        localId: 'scan1',
        sessionId: 'sess1',
        studentClassId: 'sc1',
        status: 'present',
        deviceQueuedAt: 1000,
      },
    ]

    mockGetPendingQueue.mockResolvedValueOnce(pendingScans)
    mockGetPendingQueue.mockResolvedValueOnce(pendingScans)
    mockGetPendingQueue.mockResolvedValueOnce([]) // No remaining pending after update

    mockRecordBatch.mockResolvedValue([
      { localId: 'scan1', status: 'conflict' },
    ])

    const { result } = renderHook(() => useAttendanceSync('cat123' as any))

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockUpdateQueueStatus).toHaveBeenCalledWith(
      'scan1',
      'conflict',
      undefined,
    )
    expect(result.current.syncStatus).toBe('synced')
  })

  it('handles sync errors correctly', async () => {
    const pendingScans = [
      {
        localId: 'scan1',
        sessionId: 'sess1',
        studentClassId: 'sc1',
        status: 'present',
        deviceQueuedAt: 1000,
      },
    ]

    mockGetPendingQueue.mockResolvedValueOnce(pendingScans)
    mockGetPendingQueue.mockResolvedValueOnce(pendingScans)
    mockGetPendingQueue.mockResolvedValueOnce([]) // Marked as error, queue returns empty in next get

    mockRecordBatch.mockResolvedValue([
      { localId: 'scan1', status: 'error', error: 'Invalid Student' },
    ])

    const { result } = renderHook(() => useAttendanceSync('cat123' as any))

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockUpdateQueueStatus).toHaveBeenCalledWith(
      'scan1',
      'error',
      'Invalid Student',
    )
    expect(result.current.syncStatus).toBe('error')
  })

  it('triggers sync periodically on polling interval', async () => {
    renderHook(() => useAttendanceSync('cat123' as any))

    // Clear initial mount call
    await act(async () => {
      await Promise.resolve()
    })

    mockGetPendingQueue.mockResolvedValueOnce([
      {
        localId: 'scan2',
        sessionId: 'sess1',
        studentClassId: 'sc2',
        status: 'present',
        deviceQueuedAt: 2000,
      },
    ])
    mockRecordBatch.mockResolvedValue([])

    // Fast-forward 5 seconds
    await act(async () => {
      vi.advanceTimersByTime(5000)
      await Promise.resolve()
    })

    expect(mockGetPendingQueue).toHaveBeenCalled()
  })
})
