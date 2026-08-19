import { describe, expect, test } from 'vitest'
import {
  getCatechistAccountPrefix,
  getCatechistLoginId,
  getStudentAccountPrefix,
  getStudentLoginId,
} from './accountPrefix'

describe('accountPrefix lib', () => {
  const origCatechistPrefix = process.env.CATECHIST_ACCOUNT_PREFIX
  const origStudentPrefix = process.env.STUDENT_ACCOUNT_PREFIX

  test('defaults to CAT and STD when env vars are not set', () => {
    delete process.env.CATECHIST_ACCOUNT_PREFIX
    delete process.env.STUDENT_ACCOUNT_PREFIX

    expect(getCatechistAccountPrefix()).toBe('CAT')
    expect(getStudentAccountPrefix()).toBe('STD')
    expect(getCatechistLoginId('123')).toBe('CAT-123')
    expect(getStudentLoginId('456')).toBe('STD-456')
  })

  test('uses CATECHIST_ACCOUNT_PREFIX and STUDENT_ACCOUNT_PREFIX when set', () => {
    process.env.CATECHIST_ACCOUNT_PREFIX = 'GLV'
    process.env.STUDENT_ACCOUNT_PREFIX = 'TN'

    expect(getCatechistAccountPrefix()).toBe('GLV')
    expect(getStudentAccountPrefix()).toBe('TN')
    expect(getCatechistLoginId('123')).toBe('GLV-123')
    expect(getStudentLoginId('456')).toBe('TN-456')

    // Restore env
    if (origCatechistPrefix === undefined) {
      delete process.env.CATECHIST_ACCOUNT_PREFIX
    } else {
      process.env.CATECHIST_ACCOUNT_PREFIX = origCatechistPrefix
    }

    if (origStudentPrefix === undefined) {
      delete process.env.STUDENT_ACCOUNT_PREFIX
    } else {
      process.env.STUDENT_ACCOUNT_PREFIX = origStudentPrefix
    }
  })
})
