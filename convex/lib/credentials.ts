import { generatePassword, hashPassword } from './password'
import { getActiveAcademicYear } from './authz'
import { getStudentPrimaryClass } from './studentClassLookup'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

/** Plaintext credentials returned once to the admin who issued them. */
export type IssuedCredential = {
  accountType: 'catechist' | 'student'
  saintName?: string
  fullName: string
  className?: string // students: primary class in the active academic year
  loginId: string
  password: string
}

/**
 * What an internal mutation reports for each account it wrote. The hash
 * identifies which action-generated plaintext belongs to the row.
 */
export type IssuedAccount = Omit<IssuedCredential, 'password'> & {
  passwordHash: string
}

export type IssuedPassword = { password: string; passwordHash: string }

/** Action-only: see generatePassword. */
export function issuePasswords(count: number): Array<IssuedPassword> {
  return Array.from({ length: count }, () => {
    const password = generatePassword()
    return { password, passwordHash: hashPassword(password) }
  })
}

/** Pairs each written account with its plaintext; unwritten passwords are dropped. */
export function revealPasswords(
  issued: Array<IssuedPassword>,
  accounts: Array<IssuedAccount>,
): Array<IssuedCredential> {
  const byHash = new Map(issued.map((i) => [i.passwordHash, i.password]))
  return accounts.map(({ passwordHash, ...rest }) => {
    const password = byHash.get(passwordHash)
    if (password === undefined) throw new Error('Unknown password hash')
    return { ...rest, password }
  })
}

export function catechistIssuedAccount(
  catechist: Pick<Doc<'catechists'>, 'saintName' | 'fullName'>,
  loginId: string,
  passwordHash: string,
): IssuedAccount {
  return {
    accountType: 'catechist',
    saintName: catechist.saintName,
    fullName: catechist.fullName,
    loginId,
    passwordHash,
  }
}

export async function studentIssuedAccount(
  ctx: MutationCtx,
  student: Pick<Doc<'students'>, '_id' | 'saintName' | 'fullName'>,
  loginId: string,
  passwordHash: string,
): Promise<IssuedAccount> {
  const activeYearId = await getActiveAcademicYear(ctx)
  const primaryClass = activeYearId
    ? await getStudentPrimaryClass(ctx, student._id, activeYearId)
    : null
  return {
    accountType: 'student',
    saintName: student.saintName,
    fullName: student.fullName,
    className: primaryClass?.name,
    loginId,
    passwordHash,
  }
}
