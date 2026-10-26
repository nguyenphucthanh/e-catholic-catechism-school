import bcrypt from 'bcryptjs'

const BCRYPT_ROUNDS = 12

export async function sha256Hex(plaintext: string): Promise<string> {
  const encoded = new TextEncoder().encode(plaintext)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function hashPassword(plaintext: string): string {
  return bcrypt.hashSync(plaintext, BCRYPT_ROUNDS)
}

/**
 * Verifies password against a stored hash.
 * Supports bcrypt hashes and legacy SHA-256 hashes (64-char hex).
 * Returns { valid, legacy } — legacy=true means the hash should be upgraded.
 */
export async function verifyPassword(
  plaintext: string,
  storedHash: string,
): Promise<{ valid: boolean; legacy: boolean }> {
  if (storedHash.startsWith('$2')) {
    const valid = bcrypt.compareSync(plaintext, storedHash)
    return { valid, legacy: false }
  }
  // Legacy SHA-256 path
  const sha256 = await sha256Hex(plaintext)
  const valid = sha256 === storedHash
  return { valid, legacy: true }
}

// No lookalikes (0 o 1 l i) — passwords get read aloud / copied by hand.
const PASSWORD_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
const PASSWORD_LENGTH = 10

/**
 * Random password for newly issued credentials. Call only from actions:
 * mutation randomness is seeded for deterministic replay.
 */
export function generatePassword(): string {
  // Rejection sampling: drop bytes >= the largest multiple of the alphabet
  // size so every character is equally likely.
  const limit = 256 - (256 % PASSWORD_ALPHABET.length)
  let result = ''
  while (result.length < PASSWORD_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(16))) {
      if (byte >= limit) continue
      result += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]
      if (result.length === PASSWORD_LENGTH) break
    }
  }
  return result
}
