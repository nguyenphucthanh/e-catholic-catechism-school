import { describe, test, expect } from 'vitest'
import { formatPersonName } from './name'

describe('formatPersonName', () => {
  test('returns fullName when saintName is empty', () => {
    expect(formatPersonName('', 'Nguyen Van A')).toBe('Nguyen Van A')
  })

  test('returns fullName when saintName is null', () => {
    expect(formatPersonName(null, 'Nguyen Van A')).toBe('Nguyen Van A')
  })

  test('returns fullName when saintName is undefined', () => {
    expect(formatPersonName(undefined, 'Nguyen Van A')).toBe('Nguyen Van A')
  })

  test('prepends saintName to fullName when saintName exists', () => {
    expect(formatPersonName('Maria', 'Nguyen Van A')).toBe(
      'Maria Nguyen Van A',
    )
  })

  test('handles empty fullName gracefully', () => {
    expect(formatPersonName('Peter', '')).toBe('Peter ')
  })
})
