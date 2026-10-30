import { describe, expect, it } from 'vitest'
import { compareByNameFormat, formatPersonName, nameSortKey } from './name'

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

describe('nameSortKey', () => {
  const sorted = (
    names: Array<string>,
    format: 'firstName_lastName' | 'lastName_firstName',
  ) =>
    [...names].sort((a, b) => {
      const ka = nameSortKey(a, format)
      const kb = nameSortKey(b, format)
      return ka < kb ? -1 : ka > kb ? 1 : 0
    })

  it('orders Vietnamese letters like the vi collation (ă, â, đ stay in place)', () => {
    expect(
      sorted(
        ['Đức', 'Zung', 'Âu', 'An', 'Ân', 'Ăn', 'Bình'],
        'firstName_lastName',
      ),
    ).toEqual(
      ['An', 'Ăn', 'Âu', 'Ân', 'Bình', 'Đức', 'Zung'].sort((a, b) =>
        a.localeCompare(b, 'vi'),
      ),
    )
  })

  it('ignores case and tone marks', () => {
    expect(nameSortKey('ÁNH', 'firstName_lastName')).toBe(
      nameSortKey('anh', 'firstName_lastName'),
    )
  })

  it('lastName_firstName sorts by the last word, then the whole name', () => {
    expect(
      sorted(
        ['Trần Thị Bình', 'Nguyễn Văn An', 'Lê Hoàng Cường', 'Phạm Văn An'],
        'lastName_firstName',
      ),
    ).toEqual([
      'Nguyễn Văn An',
      'Phạm Văn An',
      'Trần Thị Bình',
      'Lê Hoàng Cường',
    ])
  })

  it('firstName_lastName sorts by the whole name', () => {
    expect(
      sorted(
        ['Trần Thị Bình', 'Nguyễn Văn An', 'Lê Hoàng Cường'],
        'firstName_lastName',
      ),
    ).toEqual(['Lê Hoàng Cường', 'Nguyễn Văn An', 'Trần Thị Bình'])
  })

  it('defaults to given-name order when the format is unset', () => {
    expect(nameSortKey('Nguyễn Văn An', undefined)).toBe(
      nameSortKey('Nguyễn Văn An', 'lastName_firstName'),
    )
  })

  it('copes with a single-word name and extra whitespace', () => {
    expect(nameSortKey('  An ', 'lastName_firstName')).toBe(
      nameSortKey('An', 'lastName_firstName'),
    )
  })
})
