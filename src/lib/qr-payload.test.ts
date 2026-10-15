import { describe, expect, it } from 'vitest'
import { decodeQrPayload, encodeCatechistQr } from './qr-payload'

describe('decodeQrPayload', () => {
  it('decodes catechist JSON', () => {
    expect(
      decodeQrPayload('{"type":"catechist","memberId":"GLV0001"}'),
    ).toEqual({ type: 'catechist', memberId: 'GLV0001' })
  })

  it('treats a raw string as a trimmed student code', () => {
    expect(decodeQrPayload('  42\n')).toEqual({
      type: 'student',
      studentCode: '42',
    })
  })

  it.each(['', '   ', '\n\t'])('returns null for empty input %j', (raw) => {
    expect(decodeQrPayload(raw)).toBeNull()
  })

  it('returns null for malformed JSON starting with {', () => {
    expect(decodeQrPayload('{"type":"catechist"')).toBeNull()
    expect(decodeQrPayload('{not json')).toBeNull()
  })

  it.each([
    ['wrong type', '{"type":"other","memberId":"G1"}'],
    ['student type', '{"type":"student"}'],
    ['missing memberId', '{"type":"catechist"}'],
    ['empty memberId', '{"type":"catechist","memberId":""}'],
    ['numeric memberId', '{"type":"catechist","memberId":5}'],
    ['null memberId', '{"type":"catechist","memberId":null}'],
    ['missing type', '{"memberId":"G1"}'],
  ])('returns null for JSON with %s', (_n, raw) => {
    expect(decodeQrPayload(raw)).toBeNull()
  })

  it('treats a JSON array as a student code and {} as invalid', () => {
    expect(decodeQrPayload('[{"type":"catechist","memberId":"G1"}]')).toEqual({
      type: 'student',
      studentCode: '[{"type":"catechist","memberId":"G1"}]',
    })
    expect(decodeQrPayload('{}')).toBeNull()
  })

  it('round-trips encodeCatechistQr', () => {
    expect(decodeQrPayload(encodeCatechistQr('GLV0001'))).toEqual({
      type: 'catechist',
      memberId: 'GLV0001',
    })
  })
})

describe('encodeCatechistQr', () => {
  it('produces the JSON shape printed on cards', () => {
    expect(encodeCatechistQr('G1')).toBe('{"type":"catechist","memberId":"G1"}')
  })
})
