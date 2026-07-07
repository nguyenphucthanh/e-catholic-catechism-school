import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useImportParser } from './useImportParser'
import { STUDENT_FIELDS } from './csvFieldDefinitions'
import type { ImportConfig } from './useImportParser'

const baseConfig: ImportConfig = {
  target: 'students',
  delimiter: ',',
  dateFormat: 'yyyy-MM-dd',
}

describe('useImportParser', () => {
  it('returns [] when rawText is empty', () => {
    const { result } = renderHook(() =>
      useImportParser('', baseConfig, {}, STUDENT_FIELDS, []),
    )
    expect(result.current).toEqual([])
  })

  it('returns [] when rawText has only a header row (fewer than 2 lines)', () => {
    const { result } = renderHook(() =>
      useImportParser(
        'fullName,dateOfBirth',
        baseConfig,
        { fullName: 'fullName' },
        STUDENT_FIELDS,
        [],
      ),
    )
    expect(result.current).toEqual([])
  })

  it('parses a fully valid CSV with all rows status "ok"', () => {
    const rawText = [
      'fullName,dateOfBirth,gender',
      'Nguyen Van A,2010-05-20,nam',
      'Tran Thi B,2011-01-15,nữ',
    ].join('\n')

    const columnMapping = {
      fullName: 'fullName',
      dateOfBirth: 'dateOfBirth',
      gender: 'gender',
    }

    const { result } = renderHook(() =>
      useImportParser(rawText, baseConfig, columnMapping, STUDENT_FIELDS, []),
    )

    expect(result.current).toHaveLength(2)
    expect(result.current[0].status).toBe('ok')
    expect(result.current[0].coerced).toEqual({
      fullName: 'Nguyen Van A',
      dateOfBirth: '2010-05-20',
      gender: 'male',
    })
    expect(result.current[0].issues).toEqual([])
    expect(result.current[1].status).toBe('ok')
    expect(result.current[1].coerced.gender).toBe('female')
  })

  it('marks a row as "error" when a required field (fullName) is missing', () => {
    const rawText = ['fullName,gender', ',nam'].join('\n')
    const columnMapping = { fullName: 'fullName', gender: 'gender' }

    const { result } = renderHook(() =>
      useImportParser(rawText, baseConfig, columnMapping, STUDENT_FIELDS, []),
    )

    expect(result.current).toHaveLength(1)
    expect(result.current[0].status).toBe('error')
    expect(result.current[0].issues).toContainEqual({
      field: 'fullName',
      messageKey: 'csvImport.errors.required',
      blocking: true,
    })
  })

  it('marks a row as "partial" when an optional field has bad data (invalid phone)', () => {
    const rawText = [
      'fullName,guardian1_contact_1',
      'Nguyen Van A,not-a-phone',
    ].join('\n')
    const columnMapping = {
      fullName: 'fullName',
      guardian1_contact_1: 'guardian1_contact_1',
    }

    const { result } = renderHook(() =>
      useImportParser(rawText, baseConfig, columnMapping, STUDENT_FIELDS, [], {
        guardian1_contact_1: 'phone',
      }),
    )

    expect(result.current).toHaveLength(1)
    expect(result.current[0].status).toBe('partial')
    expect(result.current[0].issues).toContainEqual({
      field: 'guardian1_contact_1',
      messageKey: 'csvImport.errors.invalidPhone',
      blocking: false,
    })
  })

  it('ignores CSV columns that are not mapped to a field', () => {
    const rawText = [
      'fullName,unmappedColumn',
      'Nguyen Van A,some junk value',
    ].join('\n')
    const columnMapping = { fullName: 'fullName', unmappedColumn: null }

    const { result } = renderHook(() =>
      useImportParser(rawText, baseConfig, columnMapping, STUDENT_FIELDS, []),
    )

    expect(result.current).toHaveLength(1)
    expect(result.current[0].status).toBe('ok')
    expect(result.current[0].coerced).toEqual({ fullName: 'Nguyen Van A' })
  })

  it('ignores mapping to a field key that does not exist in fieldDefs', () => {
    const rawText = ['fullName,mystery', 'Nguyen Van A,value'].join('\n')
    const columnMapping = { fullName: 'fullName', mystery: 'not_a_real_key' }

    const { result } = renderHook(() =>
      useImportParser(rawText, baseConfig, columnMapping, STUDENT_FIELDS, []),
    )

    expect(result.current[0].status).toBe('ok')
    expect(result.current[0].coerced).toEqual({ fullName: 'Nguyen Van A' })
  })

  it('sets duplicateWarning when fullName case-insensitively matches duplicateNames', () => {
    const rawText = ['fullName', 'nguyen van a'].join('\n')
    const columnMapping = { fullName: 'fullName' }

    const { result } = renderHook(() =>
      useImportParser(rawText, baseConfig, columnMapping, STUDENT_FIELDS, [
        'Nguyen Van A',
      ]),
    )

    expect(result.current[0].duplicateWarning).toBe('nguyen van a')
  })

  it('does not set duplicateWarning when there is no match', () => {
    const rawText = ['fullName', 'Someone Else'].join('\n')
    const columnMapping = { fullName: 'fullName' }

    const { result } = renderHook(() =>
      useImportParser(rawText, baseConfig, columnMapping, STUDENT_FIELDS, [
        'Nguyen Van A',
      ]),
    )

    expect(result.current[0].duplicateWarning).toBeUndefined()
  })

  it('duplicateWarning does not change row status', () => {
    const rawText = [
      'fullName,guardian1_contact_1',
      'Nguyen Van A,bad-phone',
    ].join('\n')
    const columnMapping = {
      fullName: 'fullName',
      guardian1_contact_1: 'guardian1_contact_1',
    }

    const { result } = renderHook(() =>
      useImportParser(
        rawText,
        baseConfig,
        columnMapping,
        STUDENT_FIELDS,
        ['Nguyen Van A'],
        { guardian1_contact_1: 'phone' },
      ),
    )

    expect(result.current[0].status).toBe('partial')
    expect(result.current[0].duplicateWarning).toBe('Nguyen Van A')
  })

  describe('delimiters', () => {
    const columnMapping = { fullName: 'fullName', gender: 'gender' }

    it('parses comma-delimited rows', () => {
      const rawText = ['fullName,gender', 'A,nam'].join('\n')
      const { result } = renderHook(() =>
        useImportParser(
          rawText,
          { ...baseConfig, delimiter: ',' },
          columnMapping,
          STUDENT_FIELDS,
          [],
        ),
      )
      expect(result.current[0].coerced).toEqual({
        fullName: 'A',
        gender: 'male',
      })
    })

    it('parses semicolon-delimited rows', () => {
      const rawText = ['fullName;gender', 'A;nam'].join('\n')
      const { result } = renderHook(() =>
        useImportParser(
          rawText,
          { ...baseConfig, delimiter: ';' },
          columnMapping,
          STUDENT_FIELDS,
          [],
        ),
      )
      expect(result.current[0].coerced).toEqual({
        fullName: 'A',
        gender: 'male',
      })
    })

    it('parses tab-delimited rows', () => {
      const rawText = ['fullName\tgender', 'A\tnam'].join('\n')
      const { result } = renderHook(() =>
        useImportParser(
          rawText,
          { ...baseConfig, delimiter: '\t' },
          columnMapping,
          STUDENT_FIELDS,
          [],
        ),
      )
      expect(result.current[0].coerced).toEqual({
        fullName: 'A',
        gender: 'male',
      })
    })

    it('parses pipe-delimited rows', () => {
      const rawText = ['fullName|gender', 'A|nam'].join('\n')
      const { result } = renderHook(() =>
        useImportParser(
          rawText,
          { ...baseConfig, delimiter: '|' },
          columnMapping,
          STUDENT_FIELDS,
          [],
        ),
      )
      expect(result.current[0].coerced).toEqual({
        fullName: 'A',
        gender: 'male',
      })
    })
  })

  it('treats a missing trailing cell (ragged row) as an empty string, not undefined', () => {
    const rawText = ['fullName,saintName', 'Nguyen Van A'].join('\n')
    const columnMapping = { fullName: 'fullName', saintName: 'saintName' }

    const { result } = renderHook(() =>
      useImportParser(rawText, baseConfig, columnMapping, STUDENT_FIELDS, []),
    )

    expect(result.current[0].status).toBe('ok')
    expect(result.current[0].coerced).toEqual({
      fullName: 'Nguyen Van A',
      saintName: null,
    })
  })

  it('assigns sequential rowIndex values starting at 0', () => {
    const rawText = ['fullName', 'A', 'B', 'C'].join('\n')
    const columnMapping = { fullName: 'fullName' }

    const { result } = renderHook(() =>
      useImportParser(rawText, baseConfig, columnMapping, STUDENT_FIELDS, []),
    )

    expect(result.current.map((r) => r.rowIndex)).toEqual([0, 1, 2])
  })

  describe('contactTypeByField (guardian contact slots)', () => {
    const columnMapping = {
      fullName: 'fullName',
      contact: 'guardian1_contact_1',
    }

    it('validates as a phone number when contactTypeByField says "phone": invalid format flags invalidPhone', () => {
      const rawText = ['fullName,contact', 'Alice,not-a-phone'].join('\n')

      const { result } = renderHook(() =>
        useImportParser(
          rawText,
          baseConfig,
          columnMapping,
          STUDENT_FIELDS,
          [],
          { guardian1_contact_1: 'phone' },
        ),
      )

      expect(result.current[0].status).toBe('partial')
      expect(result.current[0].coerced.guardian1_contact_1).toBeNull()
      expect(result.current[0].issues).toContainEqual({
        field: 'guardian1_contact_1',
        messageKey: 'csvImport.errors.invalidPhone',
        blocking: false,
      })
    })

    it('validates as a phone number when contactTypeByField says "phone": valid E.164 passes with no issue', () => {
      const rawText = ['fullName,contact', 'Alice,+84987654321'].join('\n')

      const { result } = renderHook(() =>
        useImportParser(
          rawText,
          baseConfig,
          columnMapping,
          STUDENT_FIELDS,
          [],
          { guardian1_contact_1: 'phone' },
        ),
      )

      expect(result.current[0].status).toBe('ok')
      expect(result.current[0].coerced.guardian1_contact_1).toBe('+84987654321')
      expect(result.current[0].issues).toEqual([])
    })

    it('validates as an email when contactTypeByField says "email": invalid format flags invalidEmail', () => {
      const rawText = ['fullName,contact', 'Alice,not-an-email'].join('\n')

      const { result } = renderHook(() =>
        useImportParser(
          rawText,
          baseConfig,
          columnMapping,
          STUDENT_FIELDS,
          [],
          { guardian1_contact_1: 'email' },
        ),
      )

      expect(result.current[0].status).toBe('partial')
      expect(result.current[0].issues).toContainEqual({
        field: 'guardian1_contact_1',
        messageKey: 'csvImport.errors.invalidEmail',
        blocking: false,
      })
    })

    it('validates as an email when contactTypeByField says "email": valid email passes with no issue', () => {
      const rawText = ['fullName,contact', 'Alice,parent@example.com'].join(
        '\n',
      )

      const { result } = renderHook(() =>
        useImportParser(
          rawText,
          baseConfig,
          columnMapping,
          STUDENT_FIELDS,
          [],
          { guardian1_contact_1: 'email' },
        ),
      )

      expect(result.current[0].status).toBe('ok')
      expect(result.current[0].coerced.guardian1_contact_1).toBe(
        'parent@example.com',
      )
      expect(result.current[0].issues).toEqual([])
    })

    it('defaults to permissive free-text ("other") behavior when contactTypeByField has no entry for the field', () => {
      const rawText = ['fullName,contact', 'Alice,not-a-phone-or-email'].join(
        '\n',
      )

      const { result } = renderHook(() =>
        useImportParser(rawText, baseConfig, columnMapping, STUDENT_FIELDS, []),
      )

      expect(result.current[0].status).toBe('ok')
      expect(result.current[0].coerced.guardian1_contact_1).toBe(
        'not-a-phone-or-email',
      )
      expect(result.current[0].issues).toEqual([])
    })
  })
})
