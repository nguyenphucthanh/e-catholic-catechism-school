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
