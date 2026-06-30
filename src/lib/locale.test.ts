import { describe, expect, test } from 'vitest'
import { DEFAULT_LANGUAGE, formatDate } from './locale'

describe('formatDate', () => {
  test('accepts a Date object and returns a locale-formatted string', () => {
    const date = new Date('2026-06-30T00:00:00Z')

    const result = formatDate(date)

    expect(result).toBe(date.toLocaleDateString(DEFAULT_LANGUAGE))
  })

  test('accepts a date string and returns the same result as the equivalent Date', () => {
    const dateString = '2026-06-30'

    const result = formatDate(dateString)

    expect(result).toBe(
      new Date(dateString).toLocaleDateString(DEFAULT_LANGUAGE),
    )
  })

  test('respects passed-in Intl.DateTimeFormatOptions', () => {
    const date = new Date('2026-06-30T00:00:00Z')
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }

    const withOptions = formatDate(date, options)
    const withoutOptions = formatDate(date)

    expect(withOptions).toBe(date.toLocaleDateString(DEFAULT_LANGUAGE, options))
    expect(withOptions).not.toBe(withoutOptions)
  })

  test('uses DEFAULT_LANGUAGE for locale formatting', () => {
    const date = new Date('2026-06-30T00:00:00Z')
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }

    const result = formatDate(date, options)

    expect(result).toBe(date.toLocaleDateString('vi', options))
  })
})
