/// <reference types="vite/client" />

import { describe, expect, test } from 'vitest'
import { EXTRACURRICULAR_ERRORS } from './errors'
import { checkTargetEligibility } from './eligibility'

describe('eligibility rules', () => {
  test('checkTargetEligibility: catechist matches catechist target', () => {
    const result = checkTargetEligibility('catechist', 'catechist')
    expect(result.eligible).toBe(true)
  })

  test('checkTargetEligibility: student matches student target', () => {
    const result = checkTargetEligibility('student', 'student')
    expect(result.eligible).toBe(true)
  })

  test('checkTargetEligibility: both match "all" target', () => {
    const catechistResult = checkTargetEligibility('catechist', 'all')
    const studentResult = checkTargetEligibility('student', 'all')
    expect(catechistResult.eligible).toBe(true)
    expect(studentResult.eligible).toBe(true)
  })

  test('checkTargetEligibility: catechist cannot match student target', () => {
    const result = checkTargetEligibility('catechist', 'student')
    expect(result.eligible).toBe(false)
    expect(result.reason).toBe(EXTRACURRICULAR_ERRORS.TARGET_NOT_ELIGIBLE)
  })

  test('checkTargetEligibility: student cannot match catechist target', () => {
    const result = checkTargetEligibility('student', 'catechist')
    expect(result.eligible).toBe(false)
    expect(result.reason).toBe(EXTRACURRICULAR_ERRORS.TARGET_NOT_ELIGIBLE)
  })

  test('checkTargetEligibility: mixed targets handle all cases', () => {
    const tests = [
      { actor: 'catechist', target: 'catechist', shouldPass: true },
      { actor: 'catechist', target: 'student', shouldPass: false },
      { actor: 'catechist', target: 'all', shouldPass: true },
      { actor: 'student', target: 'catechist', shouldPass: false },
      { actor: 'student', target: 'student', shouldPass: true },
      { actor: 'student', target: 'all', shouldPass: true },
    ]

    tests.forEach(({ actor, target, shouldPass }) => {
      const result = checkTargetEligibility(
        actor as 'catechist' | 'student',
        target,
      )
      expect(result.eligible).toBe(shouldPass)
      if (!shouldPass) {
        expect(result.reason).toBe(EXTRACURRICULAR_ERRORS.TARGET_NOT_ELIGIBLE)
      }
    })
  })
})
