export const DEFAULT_COUNTRY = import.meta.env.VITE_DEFAULT_COUNTRY ?? 'VN'
export const DEFAULT_TIMEZONE =
  import.meta.env.VITE_DEFAULT_TIMEZONE ?? 'Asia/Ho_Chi_Minh'
export const DEFAULT_LANGUAGE = import.meta.env.VITE_DEFAULT_LANGUAGE ?? 'vi'

export function formatDate(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(DEFAULT_LANGUAGE, options)
}
