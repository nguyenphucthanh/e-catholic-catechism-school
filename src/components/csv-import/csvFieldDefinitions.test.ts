import { describe, expect, it } from 'vitest'
import {
  CATECHIST_FIELDS,
  GUARDIAN_CONTACT_SLOT_COUNT,
  GUARDIAN_SLOT_COUNT,
  STUDENT_FIELDS,
  coerceContactByType,
  validateContactByType,
} from './csvFieldDefinitions'
import type { ContactType, FieldDef } from './csvFieldDefinitions'

function findField(fields: Array<FieldDef>, key: string): FieldDef {
  const field = fields.find((f) => f.key === key)
  if (!field) throw new Error(`Field ${key} not found`)
  return field
}

describe('csvFieldDefinitions', () => {
  describe('fullName (required string field)', () => {
    const field = findField(STUDENT_FIELDS, 'fullName')

    it('coerces a trimmed non-empty value', () => {
      expect(field.coerce('  Nguyen Van A  ', 'YYYY-MM-DD')).toBe(
        'Nguyen Van A',
      )
    })

    it('coerces empty string to null', () => {
      expect(field.coerce('', 'YYYY-MM-DD')).toBeNull()
      expect(field.coerce('   ', 'YYYY-MM-DD')).toBeNull()
    })

    it('flags required error when coerced value is null', () => {
      expect(field.validate(null, '')).toBe('csvImport.errors.required')
    })

    it('passes validation when coerced value is present', () => {
      expect(field.validate('Nguyen Van A', 'Nguyen Van A')).toBeNull()
    })

    it('exists as a required field on both STUDENT_FIELDS and CATECHIST_FIELDS', () => {
      expect(field.required).toBe(true)
      const catechistField = findField(CATECHIST_FIELDS, 'fullName')
      expect(catechistField.required).toBe(true)
    })
  })

  describe('optional string field (saintName)', () => {
    const field = findField(STUDENT_FIELDS, 'saintName')

    it('coerces empty to null with no error', () => {
      expect(field.coerce('', 'YYYY-MM-DD')).toBeNull()
      expect(field.validate(null, '')).toBeNull()
    })

    it('coerces non-empty passthrough with no error', () => {
      const coerced = field.coerce('Maria', 'YYYY-MM-DD')
      expect(coerced).toBe('Maria')
      expect(field.validate(coerced, 'Maria')).toBeNull()
    })
  })

  describe('date fields (dateOfBirth)', () => {
    const field = findField(STUDENT_FIELDS, 'dateOfBirth')

    it('parses YYYY-MM-DD format', () => {
      expect(field.coerce('2010-05-20', 'yyyy-MM-dd')).toBe('2010-05-20')
    })

    it('parses DD/MM/YYYY format', () => {
      expect(field.coerce('20/05/2010', 'dd/MM/yyyy')).toBe('2010-05-20')
    })

    it('parses MM/DD/YYYY format', () => {
      expect(field.coerce('05/20/2010', 'MM/dd/yyyy')).toBe('2010-05-20')
    })

    it('parses DD-MM-YYYY format', () => {
      expect(field.coerce('20-05-2010', 'dd-MM-yyyy')).toBe('2010-05-20')
    })

    it('returns null for an invalid date string', () => {
      expect(field.coerce('not-a-date', 'yyyy-MM-dd')).toBeNull()
    })

    it('returns null for empty input with no validation error (skip, not partial)', () => {
      expect(field.coerce('', 'yyyy-MM-dd')).toBeNull()
      expect(field.validate(null, '')).toBeNull()
    })

    it('flags a format error when raw input is non-empty but coercion failed', () => {
      const coerced = field.coerce('not-a-date', 'yyyy-MM-dd')
      expect(field.validate(coerced, 'not-a-date')).toBe(
        'csvImport.errors.invalidDate',
      )
    })

    it('does not flag an error for successfully coerced dates', () => {
      const coerced = field.coerce('2010-05-20', 'yyyy-MM-dd')
      expect(field.validate(coerced, '2010-05-20')).toBeNull()
    })
  })

  describe('joinedDate (catechist-only date field)', () => {
    const field = findField(CATECHIST_FIELDS, 'joinedDate')

    it('parses a valid date to yyyy-MM-dd', () => {
      expect(field.coerce('01/09/2020', 'dd/MM/yyyy')).toBe('2020-09-01')
    })

    it('returns null and flags invalidDate for bad input', () => {
      const coerced = field.coerce('garbage', 'dd/MM/yyyy')
      expect(coerced).toBeNull()
      expect(field.validate(coerced, 'garbage')).toBe(
        'csvImport.errors.invalidDate',
      )
    })
  })

  describe('gender normalization', () => {
    const field = findField(STUDENT_FIELDS, 'gender')

    it.each([
      ['nam', 'male'],
      ['Nam', 'male'],
      ['NAM', 'male'],
      ['male', 'male'],
      ['Male', 'male'],
      ['m', 'male'],
      ['M', 'male'],
      ['nữ', 'female'],
      ['Nữ', 'female'],
      ['nu', 'female'],
      ['female', 'female'],
      ['f', 'female'],
      ['F', 'female'],
    ])('normalizes %s -> %s', (raw, expected) => {
      expect(field.coerce(raw, 'yyyy-MM-dd')).toBe(expected)
    })

    it('returns null for unrecognized gender values', () => {
      expect(field.coerce('other', 'yyyy-MM-dd')).toBeNull()
      expect(field.coerce('xyz', 'yyyy-MM-dd')).toBeNull()
    })

    it('returns null for empty input with no validation error', () => {
      expect(field.coerce('', 'yyyy-MM-dd')).toBeNull()
      expect(field.validate(null, '')).toBeNull()
    })

    it('flags invalidGender error for unrecognized non-empty input', () => {
      const coerced = field.coerce('other', 'yyyy-MM-dd')
      expect(field.validate(coerced, 'other')).toBe(
        'csvImport.errors.invalidGender',
      )
    })

    it('does not flag an error for successfully normalized gender', () => {
      const coerced = field.coerce('nam', 'yyyy-MM-dd')
      expect(field.validate(coerced, 'nam')).toBeNull()
    })
  })

  describe('phone (E.164) validation', () => {
    const field = findField(CATECHIST_FIELDS, 'phone')

    it('accepts a valid E.164 phone number', () => {
      expect(field.coerce('+84912345678', 'yyyy-MM-dd')).toBe('+84912345678')
    })

    it('strips spaces and dashes before validating', () => {
      expect(field.coerce('+84 912-345-678', 'yyyy-MM-dd')).toBe('+84912345678')
    })

    it('returns null for a phone number missing the leading +', () => {
      expect(field.coerce('84912345678', 'yyyy-MM-dd')).toBeNull()
    })

    it('returns null for a phone number starting with +0', () => {
      expect(field.coerce('+0912345678', 'yyyy-MM-dd')).toBeNull()
    })

    it('returns null for a too-short phone number', () => {
      expect(field.coerce('+841', 'yyyy-MM-dd')).toBeNull()
    })

    it('returns null for non-numeric garbage', () => {
      expect(field.coerce('not-a-phone', 'yyyy-MM-dd')).toBeNull()
    })

    it('flags invalidPhone error only when raw was non-empty', () => {
      const badCoerced = field.coerce('not-a-phone', 'yyyy-MM-dd')
      expect(field.validate(badCoerced, 'not-a-phone')).toBe(
        'csvImport.errors.invalidPhone',
      )

      const emptyCoerced = field.coerce('', 'yyyy-MM-dd')
      expect(field.validate(emptyCoerced, '')).toBeNull()
    })

    it('does not flag an error for a valid phone', () => {
      const coerced = field.coerce('+84912345678', 'yyyy-MM-dd')
      expect(field.validate(coerced, '+84912345678')).toBeNull()
    })
  })

  describe('phone field on catechist contact group', () => {
    const field = findField(CATECHIST_FIELDS, 'phone')

    it('validates E.164 the same way as guardian_phone', () => {
      expect(field.coerce('+84912345678', 'yyyy-MM-dd')).toBe('+84912345678')
      expect(field.coerce('12345', 'yyyy-MM-dd')).toBeNull()
    })
  })

  describe('gender field on CATECHIST_FIELDS', () => {
    const field = findField(CATECHIST_FIELDS, 'gender')

    it('normalizes the same way as the student gender field', () => {
      expect(field.coerce('nam', 'yyyy-MM-dd')).toBe('male')
      expect(field.coerce('nữ', 'yyyy-MM-dd')).toBe('female')
      expect(field.coerce('other', 'yyyy-MM-dd')).toBeNull()
    })
  })

  describe('email field on CATECHIST_FIELDS', () => {
    const field = findField(CATECHIST_FIELDS, 'email')

    it('validates the same way as guardian_email', () => {
      expect(field.coerce('catechist@example.com', 'yyyy-MM-dd')).toBe(
        'catechist@example.com',
      )
      expect(field.coerce('bad-email', 'yyyy-MM-dd')).toBeNull()
    })
  })

  describe('email validation', () => {
    const field = findField(CATECHIST_FIELDS, 'email')

    it('accepts a well-formed email address', () => {
      expect(field.coerce('parent@example.com', 'yyyy-MM-dd')).toBe(
        'parent@example.com',
      )
    })

    it('returns null for an email missing "@"', () => {
      expect(field.coerce('parent-example.com', 'yyyy-MM-dd')).toBeNull()
    })

    it('returns null for an email missing a domain', () => {
      expect(field.coerce('parent@', 'yyyy-MM-dd')).toBeNull()
    })

    it('returns null for an email missing a TLD dot', () => {
      expect(field.coerce('parent@example', 'yyyy-MM-dd')).toBeNull()
    })

    it('flags invalidEmail only when raw is non-empty', () => {
      const badCoerced = field.coerce('bad-email', 'yyyy-MM-dd')
      expect(field.validate(badCoerced, 'bad-email')).toBe(
        'csvImport.errors.invalidEmail',
      )

      const emptyCoerced = field.coerce('', 'yyyy-MM-dd')
      expect(field.validate(emptyCoerced, '')).toBeNull()
    })

    it('does not flag an error for a valid email', () => {
      const coerced = field.coerce('parent@example.com', 'yyyy-MM-dd')
      expect(field.validate(coerced, 'parent@example.com')).toBeNull()
    })
  })

  describe('boolean coercion (isActive)', () => {
    const field = findField(STUDENT_FIELDS, 'isActive')

    it.each(['true', 'yes', '1', 'có', 'co', 'TRUE', 'Yes'])(
      'coerces truthy variant %s to "true"',
      (raw) => {
        expect(field.coerce(raw, 'yyyy-MM-dd')).toBe('true')
      },
    )

    it.each(['false', 'no', '0', 'không', 'khong', 'FALSE', 'No'])(
      'coerces falsy variant %s to "false"',
      (raw) => {
        expect(field.coerce(raw, 'yyyy-MM-dd')).toBe('false')
      },
    )

    it('returns null for unrecognized boolean-like values', () => {
      expect(field.coerce('maybe', 'yyyy-MM-dd')).toBeNull()
      expect(field.coerce('2', 'yyyy-MM-dd')).toBeNull()
    })

    it('never flags a validation error (optional, defaults elsewhere)', () => {
      expect(field.validate(null, 'maybe')).toBeNull()
      expect(field.validate('true', 'yes')).toBeNull()
      expect(field.validate(null, '')).toBeNull()
    })
  })

  describe('STUDENT_FIELDS / CATECHIST_FIELDS shape', () => {
    it('each field has the expected FieldDef shape', () => {
      for (const field of [...STUDENT_FIELDS, ...CATECHIST_FIELDS]) {
        expect(typeof field.key).toBe('string')
        expect(typeof field.labelKey).toBe('string')
        expect(typeof field.required).toBe('boolean')
        expect(['core', 'guardian', 'contact']).toContain(field.group)
        expect(typeof field.coerce).toBe('function')
        expect(typeof field.validate).toBe('function')
      }
    })

    it('STUDENT_FIELDS has exactly one required field: fullName', () => {
      const required = STUDENT_FIELDS.filter((f) => f.required)
      expect(required).toHaveLength(1)
      expect(required[0].key).toBe('fullName')
    })

    it('CATECHIST_FIELDS has exactly one required field: fullName', () => {
      const required = CATECHIST_FIELDS.filter((f) => f.required)
      expect(required).toHaveLength(1)
      expect(required[0].key).toBe('fullName')
    })
  })

  describe('STUDENT_FIELDS guardian slots', () => {
    it('generates 12 guardian keys across 3 slots (name, saint_name, 2 contacts each)', () => {
      const guardianKeys = STUDENT_FIELDS.filter((f) =>
        f.key.startsWith('guardian'),
      ).map((f) => f.key)

      expect(GUARDIAN_SLOT_COUNT).toBe(3)
      expect(GUARDIAN_CONTACT_SLOT_COUNT).toBe(2)
      expect(guardianKeys).toEqual([
        'guardian1_name',
        'guardian1_saint_name',
        'guardian1_contact_1',
        'guardian1_contact_2',
        'guardian2_name',
        'guardian2_saint_name',
        'guardian2_contact_1',
        'guardian2_contact_2',
        'guardian3_name',
        'guardian3_saint_name',
        'guardian3_contact_1',
        'guardian3_contact_2',
      ])
    })

    it('every guardian field is optional and belongs to the "guardian" group', () => {
      const guardianFields = STUDENT_FIELDS.filter((f) =>
        f.key.startsWith('guardian'),
      )
      expect(guardianFields.length).toBe(12)
      for (const f of guardianFields) {
        expect(f.required).toBe(false)
        expect(f.group).toBe('guardian')
      }
    })
  })

  describe('coerceContactByType', () => {
    it.each<[ContactType]>([['phone']])(
      'type "%s" resolves to phone coercion (E.164)',
      (type) => {
        const coerce = coerceContactByType(type)
        expect(coerce('+84912345678')).toBe('+84912345678')
        expect(coerce('not-a-phone')).toBeNull()
      },
    )

    it.each<[ContactType]>([['email']])(
      'type "%s" resolves to email coercion',
      (type) => {
        const coerce = coerceContactByType(type)
        expect(coerce('parent@example.com')).toBe('parent@example.com')
        expect(coerce('bad-email')).toBeNull()
      },
    )

    it.each<[ContactType]>([['zalo'], ['other']])(
      'type "%s" resolves to permissive free-text coercion',
      (type) => {
        const coerce = coerceContactByType(type)
        expect(coerce('  anything goes 123  ')).toBe('anything goes 123')
        expect(coerce('')).toBeNull()
      },
    )
  })

  describe('validateContactByType', () => {
    it('type "phone" flags invalidPhone only when raw is non-empty and coercion failed', () => {
      const validate = validateContactByType('phone')
      expect(validate(null, 'not-a-phone')).toBe(
        'csvImport.errors.invalidPhone',
      )
      expect(validate('+84912345678', '+84912345678')).toBeNull()
      expect(validate(null, '')).toBeNull()
    })

    it('type "email" flags invalidEmail only when raw is non-empty and coercion failed', () => {
      const validate = validateContactByType('email')
      expect(validate(null, 'bad-email')).toBe('csvImport.errors.invalidEmail')
      expect(validate('parent@example.com', 'parent@example.com')).toBeNull()
      expect(validate(null, '')).toBeNull()
    })

    it.each<[ContactType]>([['zalo'], ['other']])(
      'type "%s" never flags a validation error (free text)',
      (type) => {
        const validate = validateContactByType(type)
        expect(validate(null, 'anything')).toBeNull()
        expect(validate('anything', 'anything')).toBeNull()
        expect(validate(null, '')).toBeNull()
      },
    )
  })
})
