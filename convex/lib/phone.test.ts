import { describe, expect, test } from 'vitest'
import { normalizeToE164 } from './phone'

describe('normalizeToE164', () => {
  test('returns E.164 unchanged when already valid', () => {
    expect(normalizeToE164('+84901234567', 'ERR')).toBe('+84901234567')
  })

  test('normalizes a loose VN local-format number to E.164', () => {
    expect(normalizeToE164('0901234567', 'ERR')).toBe('+84901234567')
  })

  test('throws the caller-supplied error code for an unparsable string', () => {
    expect(() => normalizeToE164('not-a-phone-number', 'ERR')).toThrow('ERR')
  })

  test('throws for a syntactically plausible but invalid number', () => {
    expect(() => normalizeToE164('+1234567890', 'ERR')).toThrow('ERR')
  })

  test('throws for a too-short number', () => {
    expect(() => normalizeToE164('+84123', 'ERR')).toThrow('ERR')
  })
})
