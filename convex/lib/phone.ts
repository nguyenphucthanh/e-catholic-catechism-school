import { parsePhoneNumber } from 'libphonenumber-js'

/**
 * Parses a phone number (loose local format or already-E.164) and returns
 * the canonical E.164 form. Throws `errorCode` if it doesn't parse to a
 * valid number. `defaultCountry` only applies when `raw` has no leading
 * `+` — see docs/09-design-decisions.md §9.7.
 */
export function normalizeToE164(
  raw: string,
  errorCode: string,
  defaultCountry: 'VN' = 'VN',
): string {
  try {
    const parsed = parsePhoneNumber(raw, defaultCountry)
    if (!parsed.isValid()) throw new Error(errorCode)
    return parsed.format('E.164')
  } catch {
    throw new Error(errorCode)
  }
}
