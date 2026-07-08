export const DEFAULT_TIMEZONE =
  import.meta.env.VITE_DEFAULT_TIMEZONE ?? 'Asia/Ho_Chi_Minh'
export const DEFAULT_LOCALE = import.meta.env.VITE_DEFAULT_LOCALE ?? 'vi-VN'
export const DEFAULT_COUNTRY = DEFAULT_LOCALE.split('-')[1]

export function formatDate(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(DEFAULT_LOCALE, options)
}

export function formatDateTime(
  timestamp: number | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof timestamp === 'number' ? new Date(timestamp) : timestamp
  return d.toLocaleString(DEFAULT_LOCALE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...options,
  })
}
