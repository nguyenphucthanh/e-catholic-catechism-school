import * as React from 'react'
import { playBeep } from '~/lib/beep'

export type ScanFeedback = {
  status: 'success' | 'duplicate' | 'unknown'
  name: string
}

const SCAN_DEBOUNCE_MS = 500
const FEEDBACK_MS = 2000

/**
 * Shared QR scan plumbing: per-code debounce, beep + vibrate on success and a
 * feedback pill state that clears itself. `resolve` applies the page's own
 * attendance change and returns the feedback to show (or nothing to ignore).
 * The returned `onScan` is stable (QRScanner restarts the camera when it changes).
 */
export function useScanFeedback(
  resolve: (code: string) => ScanFeedback | undefined,
) {
  const [feedback, setFeedback] = React.useState<ScanFeedback | null>(null)
  const lastScanned = React.useRef<Record<string, number>>({})
  const resolveRef = React.useRef(resolve)
  resolveRef.current = resolve

  const onScan = React.useCallback((code: string) => {
    const now = Date.now()
    if (now - (lastScanned.current[code] ?? 0) < SCAN_DEBOUNCE_MS) return
    lastScanned.current[code] = now

    const result = resolveRef.current(code)
    if (!result) return
    setFeedback(result)
    if (result.status !== 'success') return
    playBeep('success')
    // Not available on iOS Safari
    if ('vibrate' in navigator) navigator.vibrate(100)
  }, [])

  React.useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [feedback])

  const clearFeedback = React.useCallback(() => setFeedback(null), [])

  return { feedback, clearFeedback, onScan }
}
