import { describe, expect, test } from 'vitest'
import { formatPersonName, sortByNameFormat } from './name'

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
    expect(formatPersonName('Maria', 'Nguyen Van A')).toBe('Maria Nguyen Van A')
  })

  test('handles empty fullName gracefully', () => {
    expect(formatPersonName('Peter', '')).toBe('Peter ')
  })
})

describe('sortByNameFormat', () => {
  const id = (s: string) => s

  test('firstName_lastName sorts by the whole name', () => {
    const items = ['Trần Thị An', 'Nguyễn Văn Bình', 'Lê Văn Cường']
    expect(sortByNameFormat(items, id, 'firstName_lastName')).toEqual([
      'Lê Văn Cường',
      'Nguyễn Văn Bình',
      'Trần Thị An',
    ])
  })

  test('lastName_firstName sorts by the last word (given name)', () => {
    const items = ['Nguyễn Văn Bình', 'Trần Thị An']
    expect(sortByNameFormat(items, id, 'lastName_firstName')).toEqual([
      'Trần Thị An',
      'Nguyễn Văn Bình',
    ])
  })

  test('undefined format behaves like lastName_firstName', () => {
    const items = ['Nguyễn Văn Bình', 'Trần Thị An', 'Lê Văn Cường']
    expect(sortByNameFormat(items, id, undefined)).toEqual(
      sortByNameFormat(items, id, 'lastName_firstName'),
    )
    expect(sortByNameFormat(items, id, undefined)[0]).toBe('Trần Thị An')
  })

  test('is case-insensitive', () => {
    expect(
      sortByNameFormat(['b lê', 'A Nguyễn'], id, 'firstName_lastName'),
    ).toEqual(['A Nguyễn', 'b lê'])
    expect(sortByNameFormat(['X bình', 'Y AN'], id, undefined)).toEqual([
      'Y AN',
      'X bình',
    ])
  })

  test('sorts Vietnamese diacritics sensibly', () => {
    const items = ['Ê', 'E', 'Đ', 'D', 'A', 'Á']
    expect(sortByNameFormat(items, id, 'firstName_lastName')).toEqual([
      'A',
      'Á',
      'D',
      'Đ',
      'E',
      'Ê',
    ])
  })

  test('does not mutate the input array', () => {
    const items = ['Trần Thị An', 'Nguyễn Văn Bình']
    const copy = [...items]
    const result = sortByNameFormat(items, id, undefined)
    expect(items).toEqual(copy)
    expect(result).not.toBe(items)
  })

  test('returns an empty array for empty input', () => {
    expect(sortByNameFormat([], id, undefined)).toEqual([])
  })

  test('reads names from objects via getFullName', () => {
    const items = [
      { student: { fullName: 'Nguyễn Văn Bình' } },
      { student: { fullName: 'Trần Thị An' } },
    ]
    const result = sortByNameFormat(items, (i) => i.student.fullName, undefined)
    expect(result.map((i) => i.student.fullName)).toEqual([
      'Trần Thị An',
      'Nguyễn Văn Bình',
    ])
  })
})
