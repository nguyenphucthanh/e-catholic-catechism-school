/**
 * Utility functions for masking sensitive student details.
 */

/**
 * Masks an address string: shows first 3 characters and replaces the rest with `*`.
 * E.g., "123 Main St" -> "123********"
 */
export function maskAddress(val?: string): string | undefined {
  if (!val) return val
  if (val.length <= 3) return val
  return val.slice(0, 3) + '*'.repeat(val.length - 3)
}

/**
 * Masks phone or zalo numbers: shows last 4 digits/characters and replaces preceding with `*`.
 * E.g., "0901234567" -> "******4567"
 */
export function maskPhoneOrZalo(val?: string): string | undefined {
  if (!val) return val
  if (val.length <= 4) return val
  return '*'.repeat(val.length - 4) + val.slice(-4)
}

/**
 * Masks email or other contact info: shows first 4 characters and replaces the rest with `*`.
 * E.g., "user@example.com" -> "user************"
 */
export function maskEmailOrOther(val?: string): string | undefined {
  if (!val) return val
  if (val.length <= 4) return val
  return val.slice(0, 4) + '*'.repeat(val.length - 4)
}
