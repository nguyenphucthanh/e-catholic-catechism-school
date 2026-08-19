import { describe, expect, it } from 'vitest'
import { GradingEngine, getLetterGrade } from './gradingEngine'

describe('GradingEngine', () => {
  describe('getLetterGrade', () => {
    it('returns null for null average', () => {
      expect(getLetterGrade(null)).toBeNull()
    })

    it('returns A for >= 9.0', () => {
      expect(getLetterGrade(9.5)).toBe('A')
      expect(getLetterGrade(9.0)).toBe('A')
    })

    it('returns B for >= 8.0', () => {
      expect(getLetterGrade(8.5)).toBe('B')
      expect(getLetterGrade(8.0)).toBe('B')
    })

    it('returns C for >= 6.5', () => {
      expect(getLetterGrade(7.0)).toBe('C')
      expect(getLetterGrade(6.5)).toBe('C')
    })

    it('returns D for >= 5.0', () => {
      expect(getLetterGrade(5.5)).toBe('D')
      expect(getLetterGrade(5.0)).toBe('D')
    })

    it('returns F for < 5.0', () => {
      expect(getLetterGrade(4.9)).toBe('F')
      expect(getLetterGrade(0)).toBe('F')
    })
  })

  describe('computeSemesterGrade', () => {
    it('returns null average when no scale_10 scores are entered', () => {
      const res = GradingEngine.computeSemesterGrade([
        { weight: 1, scaleType: 'scale_10', scoreValue: undefined },
      ])
      expect(res.numericAverage).toBeNull()
      expect(res.letterGrade).toBeNull()
      expect(res.isPassed).toBe(true)
    })

    it('computes weighted average correctly ignoring unentered scores', () => {
      const res = GradingEngine.computeSemesterGrade([
        { weight: 1, scaleType: 'scale_10', scoreValue: 8.0 },
        { weight: 2, scaleType: 'scale_10', scoreValue: 10.0 },
        { weight: 1, scaleType: 'scale_10', scoreValue: undefined },
      ])
      // (8 * 1 + 10 * 2) / 3 = 28 / 3 = 9.33
      expect(res.numericAverage).toBe(9.33)
      expect(res.letterGrade).toBe('A')
      expect(res.isPassed).toBe(true)
    })

    it('fails student if any pass_fail exam is failed', () => {
      const res = GradingEngine.computeSemesterGrade([
        { weight: 1, scaleType: 'scale_10', scoreValue: 9.5 },
        { weight: 1, scaleType: 'pass_fail', scoreValue: 0 }, // Failed
      ])
      expect(res.numericAverage).toBe(9.5)
      expect(res.hasPassedAllPassFail).toBe(false)
      expect(res.isPassed).toBe(false)
    })
  })

  describe('computeAnnualGrade', () => {
    it('returns null when any semester average is missing', () => {
      const res = GradingEngine.computeAnnualGrade([8.5, null])
      expect(res.annualAverage).toBeNull()
      expect(res.isPassed).toBe(false)
    })

    it('computes simple annual average across valid semester averages', () => {
      const res = GradingEngine.computeAnnualGrade([8.0, 9.0])
      expect(res.annualAverage).toBe(8.5)
      expect(res.letterGrade).toBe('B')
      expect(res.isPassed).toBe(true)
    })
  })
})
