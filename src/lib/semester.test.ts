import { describe, expect, test } from 'vitest'
import { pickSemesterForDate } from './semester'

const s = (n: number, startDate?: string) => ({
  _id: `s${n}`,
  semesterNumber: n,
  startDate,
})

describe('pickSemesterForDate', () => {
  const sems = [s(1), s(2, '2025-01-10'), s(3, '2025-04-01')]

  test('returns semester 1 before semester 2 starts', () => {
    expect(pickSemesterForDate(sems, '2025-01-09')?._id).toBe('s1')
  })

  test('switches on the boundary day itself', () => {
    expect(pickSemesterForDate(sems, '2025-01-10')?._id).toBe('s2')
    expect(pickSemesterForDate(sems, '2025-03-31')?._id).toBe('s2')
  })

  test('returns the last semester after its start date', () => {
    expect(pickSemesterForDate(sems, '2025-12-31')?._id).toBe('s3')
  })

  test('falls back to semester 1 for legacy rows without startDate', () => {
    expect(pickSemesterForDate([s(1), s(2)], '2030-01-01')?._id).toBe('s1')
  })

  test('handles unsorted input', () => {
    expect(
      pickSemesterForDate(
        [s(3, '2025-04-01'), s(1), s(2, '2025-01-10')],
        '2025-02-01',
      )?._id,
    ).toBe('s2')
  })

  test('returns undefined for an empty list', () => {
    expect(pickSemesterForDate([], '2025-01-01')).toBeUndefined()
  })

  test('does not mutate the input array', () => {
    const input = [s(2, '2025-01-10'), s(1)]
    pickSemesterForDate(input, '2025-02-01')
    expect(input.map((x) => x._id)).toEqual(['s2', 's1'])
  })
})
