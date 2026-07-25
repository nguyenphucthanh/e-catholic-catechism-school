import { describe, expect, it } from 'vitest'
import { formatPersonName } from './name'

describe('formatPersonName', () => {
  it('formats name with both saint name and full name', () => {
    const result = formatPersonName('Giuse', 'Nguyen Van A')
    expect(result).toBe('Giuse Nguyen Van A')
  })

  it('returns only full name when saint name is null', () => {
    const result = formatPersonName(null, 'Nguyen Van A')
    expect(result).toBe('Nguyen Van A')
  })

  it('returns only full name when saint name is undefined', () => {
    const result = formatPersonName(undefined, 'Nguyen Van A')
    expect(result).toBe('Nguyen Van A')
  })

  it('handles empty string saint name as falsy', () => {
    const result = formatPersonName('', 'Tran Thi B')
    expect(result).toBe('Tran Thi B')
  })

  it('preserves saint name with special Vietnamese characters', () => {
    const result = formatPersonName('Thánh Paulô', 'Nguyễn Văn Chương')
    expect(result).toBe('Thánh Paulô Nguyễn Văn Chương')
  })

  it('handles full name with special Vietnamese diacritics', () => {
    const result = formatPersonName('Maria', 'Trần Thị Liễu')
    expect(result).toBe('Maria Trần Thị Liễu')
  })

  it('handles multiple word saint names', () => {
    const result = formatPersonName('Saint Augustine', 'Hoang Minh Duc')
    expect(result).toBe('Saint Augustine Hoang Minh Duc')
  })

  it('handles full name with middle names', () => {
    const result = formatPersonName('Tomas', 'Nguyen Thanh Phuong Van')
    expect(result).toBe('Tomas Nguyen Thanh Phuong Van')
  })
})
