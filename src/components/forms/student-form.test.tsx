import { describe, expect, it } from 'vitest'
import { defaultStudentFormValues } from './student-form'

describe('student-form default values helper', () => {
  it('returns valid initial default values for student form', () => {
    const defaults = defaultStudentFormValues()

    expect(defaults.fullName).toBe('')
    expect(defaults.isActive).toBe(true)
    expect(defaults.sacraments.baptism.received).toBe(false)
    expect(defaults.guardians).toEqual([])
    expect(defaults.enrollmentEnabled).toBe(false)
  })
})
