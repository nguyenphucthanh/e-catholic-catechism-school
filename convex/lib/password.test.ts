import { describe, expect, test, vi } from 'vitest'
import {
  generatePassword,
  hashPassword,
  sha256Hex,
  verifyPassword,
} from './password'

describe('password utils', () => {
  test('sha256Hex generates correct SHA-256 hash in hex format', async () => {
    const hash = await sha256Hex('password123')
    expect(hash).toBe(
      'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f',
    )
  })

  test('hashPassword hashes the password using bcrypt', async () => {
    const hash = await hashPassword('my-secure-password')
    expect(hash).toContain('$2')
  })

  test('verifyPassword verifies bcrypt password', async () => {
    const password = 'my-secure-password'
    const hash = await hashPassword(password)

    const verifySuccess = await verifyPassword(password, hash)
    expect(verifySuccess).toEqual({ valid: true, legacy: false })

    const verifyFailure = await verifyPassword('wrong-password', hash)
    expect(verifyFailure).toEqual({ valid: false, legacy: false })
  })

  test('verifyPassword verifies legacy SHA-256 password and flags as legacy', async () => {
    const password = 'legacy-password'
    const legacyHash = await sha256Hex(password)

    const verifySuccess = await verifyPassword(password, legacyHash)
    expect(verifySuccess).toEqual({ valid: true, legacy: true })

    const verifyFailure = await verifyPassword('wrong-password', legacyHash)
    expect(verifyFailure).toEqual({ valid: false, legacy: true })
  })

  describe('generatePassword', () => {
    const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'

    test('returns 10 characters from the lookalike-free alphabet', () => {
      for (let i = 0; i < 200; i++) {
        const pw = generatePassword()
        expect(pw).toHaveLength(10)
        for (const ch of pw) expect(ALPHABET).toContain(ch)
        expect(pw).not.toMatch(/[01oli]/)
      }
    })

    test('produces unique values', () => {
      const set = new Set(Array.from({ length: 500 }, generatePassword))
      expect(set.size).toBe(500)
    })

    test('rejects biased bytes (>= 248) instead of wrapping them', () => {
      // 256 - (256 % 31) = 248: bytes 248..255 must be skipped.
      const spy = vi.spyOn(crypto, 'getRandomValues')
      spy
        .mockImplementationOnce((arr: any) => {
          arr.fill(255)
          return arr
        })
        .mockImplementationOnce((arr: any) => {
          arr.fill(0)
          return arr
        })
      try {
        expect(generatePassword()).toBe('2222222222')
        expect(spy).toHaveBeenCalledTimes(2)
      } finally {
        spy.mockRestore()
      }
    })
  })
})
