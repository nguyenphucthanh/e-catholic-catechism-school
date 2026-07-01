import bcrypt from 'bcryptjs'

const BCRYPT_ROUNDS = 12

export async function sha256Hex(plaintext: string): Promise<string> {
  const encoded = new TextEncoder().encode(plaintext)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(plaintext: string): Promise<string> {
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
