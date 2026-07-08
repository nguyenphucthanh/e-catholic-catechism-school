import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { getPendingQueue, updateQueueStatus } from '../lib/offline-db'
import type { Id } from '../../convex/_generated/dataModel'

export type SyncStatusType = 'synced' | 'pending' | 'syncing' | 'error'

export function useAttendanceSync(requesterId: Id<'catechists'> | undefined) {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [syncStatus, setSyncStatus] = useState<SyncStatusType>('synced')
  const [pendingCount, setPendingCount] = useState<number>(0)

  const recordBatchMutation = useMutation(api.attendance.recordBatch)
  const syncInProgress = useRef<boolean>(false)

  // Function to perform the sync
  const syncNow = useCallback(async () => {
    if (!requesterId) return
    if (syncInProgress.current) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('pending')
      // Update pending count even if offline
      const pending = await getPendingQueue()
      setPendingCount(pending.length)
      return
    }

    try {
      const pendingRecords = await getPendingQueue()
      setPendingCount(pendingRecords.length)

      if (pendingRecords.length === 0) {
        setSyncStatus('synced')
        return
      }

      syncInProgress.current = true
      setSyncStatus('syncing')

      // Map local IndexedDB records to Convex recordBatch input shape
      const recordsToSync = pendingRecords.map((r) => ({
        localId: r.localId,
        sessionId: r.sessionId as Id<'classSessions'>,
        studentClassId: r.studentClassId as Id<'studentClasses'>,
        status: r.status,
        notes: r.notes,
        deviceQueuedAt: r.deviceQueuedAt,
      }))

      // Call the Convex batch mutation
      const results = await recordBatchMutation({
        requesterId,
        records: recordsToSync,
      })

      let hasErrors = false

      // Process the sync results
      for (const res of results) {
        if (res.status === 'synced') {
          await updateQueueStatus(res.localId, 'synced')
        } else if (res.status === 'conflict') {
          await updateQueueStatus(res.localId, 'conflict')
        } else {
          hasErrors = true
          await updateQueueStatus(res.localId, 'error', res.error)
        }
      }

      // Check remaining pending records
      const remainingPending = await getPendingQueue()
      setPendingCount(remainingPending.length)

      if (remainingPending.length === 0) {
        setSyncStatus(hasErrors ? 'error' : 'synced')
      } else {
        setSyncStatus('pending')
      }
    } catch (err) {
      console.error('Failed to sync offline attendance queue with server:', err)
      setSyncStatus('pending')
    } finally {
      syncInProgress.current = false
    }
  }, [requesterId, recordBatchMutation])

  // Monitor online status
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      setIsOnline(true)
      syncNow()
    }

    const handleOffline = () => {
      setIsOnline(false)
      setSyncStatus('pending')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial check on mount
    const checkQueue = async () => {
      const pending = await getPendingQueue()
      setPendingCount(pending.length)
      if (pending.length > 0) {
        setSyncStatus('pending')
        if (navigator.onLine) {
          syncNow()
        }
      }
    }
    checkQueue()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [syncNow])

  // Periodic polling sync (every 5 seconds)
  useEffect(() => {
    if (!requesterId) return

    const intervalId = setInterval(() => {
      syncNow()
    }, 5000)

    return () => clearInterval(intervalId)
  }, [requesterId, syncNow])

  return {
    isOnline,
    syncStatus,
    pendingCount,
    syncNow,
  }
}
