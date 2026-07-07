import { format, isValid, parse } from 'date-fns'

export type FieldDef = {
  key: string
  labelKey: string
  required: boolean
  group: 'core' | 'guardian' | 'contact'
  coerce: (raw: string, dateFormat: string) => string | null
  validate: (coerced: string | null, raw: string) => string | null
}

export type ContactType = 'phone' | 'email' | 'zalo' | 'other'

export const GUARDIAN_SLOT_COUNT = 3
export const GUARDIAN_CONTACT_SLOT_COUNT = 2

export const GUARDIAN_NAME_FIELD_RE = /^guardian(\d)_name$/
export const GUARDIAN_CONTACT_FIELD_RE = /^guardian(\d)_contact_(\d)$/

export function coerceContactByType(
  type: ContactType,
): (raw: string) => string | null {
  if (type === 'phone') return coercePhone
  if (type === 'email') return coerceEmail
  return coerceString
}

export function validateContactByType(
  type: ContactType,
): (coerced: string | null, raw: string) => string | null {
  if (type === 'phone') {
    return optionalWithFormatValidate('csvImport.errors.invalidPhone')
  }
  if (type === 'email') {
    return optionalWithFormatValidate('csvImport.errors.invalidEmail')
  }
  return optionalValidate
}

const E164_REGEX = /^\+[1-9]\d{6,14}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const GENDER_MAP: Record<string, 'male' | 'female'> = {
  nam: 'male',
  male: 'male',
  m: 'male',
  nữ: 'female',
  nu: 'female',
  female: 'female',
  f: 'female',
}

const BOOLEAN_TRUE = new Set(['true', 'yes', '1', 'có', 'co'])
const BOOLEAN_FALSE = new Set(['false', 'no', '0', 'không', 'khong'])

function coerceString(raw: string): string | null {
  const trimmed = raw.trim()
  return trimmed === '' ? null : trimmed
}

function coerceDate(raw: string, dateFormat: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const parsed = parse(trimmed, dateFormat, new Date())
  if (!isValid(parsed)) return null
  return format(parsed, 'yyyy-MM-dd')
}

function coerceGender(raw: string): string | null {
  const normalized = raw.trim().toLowerCase()
  return GENDER_MAP[normalized] ?? null
}

function coercePhone(raw: string): string | null {
  const stripped = raw.replace(/[\s-]/g, '')
  return E164_REGEX.test(stripped) ? stripped : null
}

function coerceEmail(raw: string): string | null {
  const trimmed = raw.trim()
  return EMAIL_REGEX.test(trimmed) ? trimmed : null
}

function coerceBoolean(raw: string): string | null {
  const normalized = raw.trim().toLowerCase()
  if (BOOLEAN_TRUE.has(normalized)) return 'true'
  if (BOOLEAN_FALSE.has(normalized)) return 'false'
  return null
}

function requiredValidate(coerced: string | null): string | null {
  return coerced === null ? 'csvImport.errors.required' : null
}

function optionalValidate(): string | null {
  return null
}

function optionalWithFormatValidate(errorKey: string) {
  return (coerced: string | null, raw: string): string | null => {
    if (coerced === null && raw.trim() !== '') return errorKey
    return null
  }
}

export const STUDENT_FIELDS: Array<FieldDef> = [
  {
    key: 'fullName',
    labelKey: 'csvImport.fields.fullName',
    required: true,
    group: 'core',
    coerce: coerceString,
    validate: requiredValidate,
  },
  {
    key: 'saintName',
    labelKey: 'csvImport.fields.saintName',
    required: false,
    group: 'core',
    coerce: coerceString,
    validate: optionalValidate,
  },
  {
    key: 'dateOfBirth',
    labelKey: 'csvImport.fields.dateOfBirth',
    required: false,
    group: 'core',
    coerce: coerceDate,
    validate: optionalWithFormatValidate('csvImport.errors.invalidDate'),
  },
  {
    key: 'gender',
    labelKey: 'csvImport.fields.gender',
    required: false,
    group: 'core',
    coerce: (raw) => coerceGender(raw),
    validate: optionalWithFormatValidate('csvImport.errors.invalidGender'),
  },
  {
    key: 'previousParish',
    labelKey: 'csvImport.fields.previousParish',
    required: false,
    group: 'core',
    coerce: coerceString,
    validate: optionalValidate,
  },
  {
    key: 'previousDiocese',
    labelKey: 'csvImport.fields.previousDiocese',
    required: false,
    group: 'core',
    coerce: coerceString,
    validate: optionalValidate,
  },
  {
    key: 'isActive',
    labelKey: 'csvImport.fields.isActive',
    required: false,
    group: 'core',
    coerce: (raw) => coerceBoolean(raw),
    validate: optionalValidate,
  },
  ...Array.from({ length: GUARDIAN_SLOT_COUNT }, (_, i) => {
    const slot = i + 1
    const fields: Array<FieldDef> = [
      {
        key: `guardian${slot}_name`,
        labelKey: 'csvImport.fields.guardianName',
        required: false,
        group: 'guardian',
        coerce: coerceString,
        validate: optionalValidate,
      },
      {
        key: `guardian${slot}_saint_name`,
        labelKey: 'csvImport.fields.guardianSaintName',
        required: false,
        group: 'guardian',
        coerce: coerceString,
        validate: optionalValidate,
      },
    ]
    for (let c = 1; c <= GUARDIAN_CONTACT_SLOT_COUNT; c++) {
      fields.push({
        key: `guardian${slot}_contact_${c}`,
        labelKey: 'csvImport.fields.guardianContact',
        required: false,
        group: 'guardian',
        // Actual coerce/validate depends on the contact type the user picks
        // in the mapping step (phone/email/zalo/other) — useImportParser
        // resolves the real coerce/validate via coerceContactByType at
        // parse time. This default is the fallback ("other"/free text).
        coerce: coerceString,
        validate: optionalValidate,
      })
    }
    return fields
  }).flat(),
]

export const CATECHIST_FIELDS: Array<FieldDef> = [
  {
    key: 'fullName',
    labelKey: 'csvImport.fields.fullName',
    required: true,
    group: 'core',
    coerce: coerceString,
    validate: requiredValidate,
  },
  {
    key: 'saintName',
    labelKey: 'csvImport.fields.saintName',
    required: false,
    group: 'core',
    coerce: coerceString,
    validate: optionalValidate,
  },
  {
    key: 'dateOfBirth',
    labelKey: 'csvImport.fields.dateOfBirth',
    required: false,
    group: 'core',
    coerce: coerceDate,
    validate: optionalWithFormatValidate('csvImport.errors.invalidDate'),
  },
  {
    key: 'gender',
    labelKey: 'csvImport.fields.gender',
    required: false,
    group: 'core',
    coerce: (raw) => coerceGender(raw),
    validate: optionalWithFormatValidate('csvImport.errors.invalidGender'),
  },
  {
    key: 'joinedDate',
    labelKey: 'csvImport.fields.joinedDate',
    required: false,
    group: 'core',
    coerce: coerceDate,
    validate: optionalWithFormatValidate('csvImport.errors.invalidDate'),
  },
  {
    key: 'title',
    labelKey: 'csvImport.fields.title',
    required: false,
    group: 'core',
    coerce: coerceString,
    validate: optionalValidate,
  },
  {
    key: 'community',
    labelKey: 'csvImport.fields.community',
    required: false,
    group: 'core',
    coerce: coerceString,
    validate: optionalValidate,
  },
  {
    key: 'level',
    labelKey: 'csvImport.fields.level',
    required: false,
    group: 'core',
    coerce: coerceString,
    validate: optionalValidate,
  },
  {
    key: 'notes',
    labelKey: 'csvImport.fields.notes',
    required: false,
    group: 'core',
    coerce: coerceString,
    validate: optionalValidate,
  },
  {
    key: 'phone',
    labelKey: 'csvImport.fields.phone',
    required: false,
    group: 'contact',
    coerce: (raw) => coercePhone(raw),
    validate: optionalWithFormatValidate('csvImport.errors.invalidPhone'),
  },
  {
    key: 'email',
    labelKey: 'csvImport.fields.email',
    required: false,
    group: 'contact',
    coerce: (raw) => coerceEmail(raw),
    validate: optionalWithFormatValidate('csvImport.errors.invalidEmail'),
  },
]
