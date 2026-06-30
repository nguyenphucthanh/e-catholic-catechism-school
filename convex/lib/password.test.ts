import { describe, expect, test } from 'vitest'
import { hashPassword, sha256Hex, verifyPassword } from './password'

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
})
