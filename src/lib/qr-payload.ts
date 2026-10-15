export type QrPayload =
  | { type: 'catechist'; memberId: string }
  | { type: 'student'; studentCode: string }

// Single source of the catechist QR shape (cards are printed with this).
export function encodeCatechistQr(memberId: string): string {
  return JSON.stringify({ type: 'catechist', memberId })
}

/**
 * Catechist cards carry JSON; student cards are the raw studentCode.
 * Malformed or unknown JSON-looking input yields null.
 */
export function decodeQrPayload(raw: string): QrPayload | null {
  const text = raw.trim()
  if (!text) return null
  if (text.startsWith('{')) {
    try {
      const data: unknown = JSON.parse(text)
      if (
        typeof data === 'object' &&
        data !== null &&
        'type' in data &&
        data.type === 'catechist' &&
        'memberId' in data &&
        typeof data.memberId === 'string' &&
        data.memberId
      ) {
        return { type: 'catechist', memberId: data.memberId }
      }
    } catch {
      // fall through
    }
    return null
  }
  return { type: 'student', studentCode: text }
}
