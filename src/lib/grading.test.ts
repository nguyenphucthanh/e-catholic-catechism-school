import { describe, expect, test } from 'vitest'
import { computeAnnualAvg, computeSemesterAvg } from './grading'

describe('computeSemesterAvg', () => {
  test('computes weighted average of scale_10 exams', () => {
    const result = computeSemesterAvg([
      { scaleType: 'scale_10', weight: 1, scoreValue: 8 },
      { scaleType: 'scale_10', weight: 2, scoreValue: 6 },
    ])
    // (8*1 + 6*2) / (1+2) = 20/3
    expect(result).toBeCloseTo(20 / 3)
  })

  test('exactly 2 qualifying entries computes', () => {
    const result = computeSemesterAvg([
      { scaleType: 'scale_10', weight: 1, scoreValue: 5 },
      { scaleType: 'scale_10', weight: 1, scoreValue: 7 },
    ])
    expect(result).toBe(6)
  })

  test('a single qualifying entry still computes using the same formula', () => {
    const result = computeSemesterAvg([
      { scaleType: 'scale_10', weight: 2, scoreValue: 8 },
    ])
    expect(result).toBe(8)
  })

  test('returns null with zero entries', () => {
    expect(computeSemesterAvg([])).toBeNull()
  })

  test('ignores non-scale_10 exams', () => {
    const result = computeSemesterAvg([
      { scaleType: 'scale_10', weight: 1, scoreValue: 8 },
      { scaleType: 'scale_10', weight: 1, scoreValue: 6 },
      { scaleType: 'pass_fail', weight: 1, scoreValue: 10 },
      { scaleType: 'letter_af', weight: 1, scoreValue: 10 },
    ])
    expect(result).toBe(7)
  })

  test('ignores entries missing scoreValue', () => {
    const result = computeSemesterAvg([
      { scaleType: 'scale_10', weight: 1, scoreValue: 8 },
      { scaleType: 'scale_10', weight: 1, scoreValue: 6 },
      { scaleType: 'scale_10', weight: 1 },
    ])
    expect(result).toBe(7)
  })

  test('defaults weight to 1 when omitted', () => {
    const withExplicitWeight = computeSemesterAvg([
      { scaleType: 'scale_10', weight: 1, scoreValue: 8 },
      { scaleType: 'scale_10', weight: 1, scoreValue: 6 },
    ])
    const withOmittedWeight = computeSemesterAvg([
      { scaleType: 'scale_10', scoreValue: 8 },
      { scaleType: 'scale_10', scoreValue: 6 },
    ])
    expect(withOmittedWeight).toBe(withExplicitWeight)
  })
})

describe('computeAnnualAvg', () => {
  test('computes simple mean when all semester averages present', () => {
    expect(computeAnnualAvg([8, 6])).toBe(7)
  })

  test('returns null when any semester average is null', () => {
    expect(computeAnnualAvg([8, null])).toBeNull()
  })

  test('returns null for empty array', () => {
    expect(computeAnnualAvg([])).toBeNull()
  })
})
