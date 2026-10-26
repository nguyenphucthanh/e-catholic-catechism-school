import { describe, expect, it } from 'vitest'
import { compareByNameFormat, formatPersonName } from './name'

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

describe('compareByNameFormat', () => {
  it('firstName_lastName compares the whole name', () => {
    expect(
      compareByNameFormat(
        'Lê Hoàng Cường',
        'Nguyễn Văn An',
        'firstName_lastName',
      ),
    ).toBeLessThan(0)
    expect(
      compareByNameFormat(
        'Trần Thị Bình',
        'Nguyễn Văn An',
        'firstName_lastName',
      ),
    ).toBeGreaterThan(0)
  })

  it('lastName_firstName compares the last word (given name)', () => {
    expect(
      compareByNameFormat(
        'Nguyễn Văn An',
        'Lê Hoàng Cường',
        'lastName_firstName',
      ),
    ).toBeLessThan(0)
    expect(
      compareByNameFormat(
        'Lê Hoàng Cường',
        'Trần Thị Bình',
        'lastName_firstName',
      ),
    ).toBeGreaterThan(0)
  })

  it('returns 0 for identical keys and is case-insensitive', () => {
    expect(compareByNameFormat('Văn An', 'Thị AN', 'lastName_firstName')).toBe(
      0,
    )
    expect(compareByNameFormat('an', 'AN', 'firstName_lastName')).toBe(0)
  })

  it("orders Vietnamese diacritics with the 'vi' locale (Á before B, not after Z)", () => {
    expect(compareByNameFormat('Á', 'B', 'firstName_lastName')).toBeLessThan(0)
    expect(compareByNameFormat('Á', 'Z', 'lastName_firstName')).toBeLessThan(0)
    expect(compareByNameFormat('B', 'Á', 'lastName_firstName')).toBeGreaterThan(
      0,
    )
  })

  it('treats undefined format as lastName_firstName', () => {
    const a = 'Nguyễn Văn An'
    const b = 'Lê Hoàng Cường'
    expect(Math.sign(compareByNameFormat(a, b, undefined))).toBe(
      Math.sign(compareByNameFormat(a, b, 'lastName_firstName')),
    )
    expect(compareByNameFormat(a, b, undefined)).toBeLessThan(0)
  })

  it('handles single-word and empty names without throwing', () => {
    expect(compareByNameFormat('', 'An', 'lastName_firstName')).toBeLessThan(0)
    expect(compareByNameFormat('An', 'An', 'lastName_firstName')).toBe(0)
  })
})
