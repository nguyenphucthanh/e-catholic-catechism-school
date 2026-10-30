import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { action, internalMutation, mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { getCatechistLoginId, getStudentLoginId } from './lib/accountPrefix'
import {
  assertAdminRole,
  getAuthedRequester,
  requireCatechistId,
} from './lib/authz'
import { ACCOUNT_ADMIN_ERRORS } from './lib/errors'
import { compareByNameFormat, nameSortKey } from './lib/name'
import { firstActive } from './lib/dbHelpers'
import { searchStudentsByName } from './students'
import { RESET_LOCKOUT_FIELDS } from './lib/accountLockout'
import { createSession, newSessionSecret, revokeSessions } from './lib/sessions'
import {
  catechistIssuedAccount,
  issuePasswords,
  revealPasswords,
  studentIssuedAccount,
} from './lib/credentials'
import type { IssuedAccount, IssuedCredential } from './lib/credentials'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

type AccountStatus = 'hasAccount' | 'noAccount' | 'disabled'

function buildAccountMap<T extends Id<'catechists'> | Id<'students'>>(
  accounts: Array<Doc<'accounts'>>,
  type: 'catechist' | 'student',
): Map<T, Doc<'accounts'>> {
  const filtered = accounts.filter((a) => a.accountType === type)
  const map = new Map<T, Doc<'accounts'>>()
  for (const a of filtered) {
    map.set(a.userRefId as T, a)
  }
  return map
}

// One indexed lookup per row instead of loading every account.
function getAccountFor(
  ctx: QueryCtx,
  accountType: 'catechist' | 'student',
  userRefId: Id<'catechists'> | Id<'students'>,
) {
  return firstActive(
    ctx.db
      .query('accounts')
      .withIndex('by_account_type_and_user_ref_id', (q) =>
        q.eq('accountType', accountType).eq('userRefId', userRefId),
      ),
  )
}

function filterAccountStatus<T extends { account: Doc<'accounts'> | null }>(
  items: Array<T>,
  accountStatus: AccountStatus | undefined,
): Array<T> {
  if (!accountStatus) return items
  return items.filter((r) => {
    if (accountStatus === 'hasAccount')
      return r.account !== null && r.account.isActive
    if (accountStatus === 'noAccount') return r.account === null
    return r.account !== null && !r.account.isActive
  })
}

function paginate<T>(
  items: Array<T>,
  paginationOpts: { cursor?: string | null; numItems: number },
) {
  const cursor = paginationOpts.cursor ?? undefined
  const startIndex = cursor ? Number(cursor) : 0
  const numItems = paginationOpts.numItems
  const page = items.slice(startIndex, startIndex + numItems)
  const isDone = startIndex + numItems >= items.length
  return {
    page,
    isDone,
    continueCursor: isDone ? '' : String(startIndex + numItems),
  }
}

export const listCatechistAccounts = query({
  args: {
    paginationOpts: paginationOptsValidator,
    role: v.optional(v.union(v.literal('admin'), v.literal('user'))),
    accountStatus: v.optional(
      v.union(
        v.literal('hasAccount'),
        v.literal('noAccount'),
        v.literal('disabled'),
      ),
    ),
    activeStatus: v.optional(v.boolean()),
    name: v.optional(v.string()),
    sortBy: v.optional(
      v.union(
        v.literal('memberId'),
        v.literal('fullName'),
        v.literal('role'),
        v.literal('joinedDate'),
        v.literal('_creationTime'),
      ),
    ),
    sortOrder: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx)

    const catechists = await ctx.db
      .query('catechists')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()

    // Few catechists: look up each account by index rather than reading the
    // whole accounts table (which also holds every student account).
    let results = await Promise.all(
      catechists.map(async (c) => ({
        catechist: c,
        account: await getAccountFor(ctx, 'catechist', c._id),
      })),
    )

    if (args.role) {
      results = results.filter((r) => r.catechist.role === args.role)
    }

    if (args.activeStatus !== undefined) {
      results = results.filter(
        (r) => r.catechist.isActive === args.activeStatus,
      )
    }

    results = filterAccountStatus(results, args.accountStatus)

    const nameQuery = args.name?.trim().toLowerCase()
    if (nameQuery) {
      results = results.filter((r) => {
        const fullNameMatch = r.catechist.fullName
          .toLowerCase()
          .includes(nameQuery)
        const saintNameMatch =
          r.catechist.saintName?.toLowerCase().includes(nameQuery) ?? false
        return fullNameMatch || saintNameMatch
      })
    }

    if (args.sortBy) {
      const sortBy = args.sortBy
      const nameFormat =
        sortBy === 'fullName'
          ? (await ctx.db.query('appConfig').first())?.nameFormat
          : undefined
      const direction = args.sortOrder === 'desc' ? -1 : 1
      results.sort((a, b) => {
        if (sortBy === 'fullName') {
          return (
            compareByNameFormat(
              a.catechist.fullName,
              b.catechist.fullName,
              nameFormat,
            ) * direction
          )
        }
        let aValue: unknown
        let bValue: unknown
        if (sortBy === 'memberId') {
          aValue = a.catechist.memberId
          bValue = b.catechist.memberId
        } else if (sortBy === 'role') {
          aValue = a.catechist.role
          bValue = b.catechist.role
        } else if (sortBy === 'joinedDate') {
          aValue = a.catechist.joinedDate
          bValue = b.catechist.joinedDate
        } else {
          aValue = a.catechist._creationTime
          bValue = b.catechist._creationTime
        }
        if (aValue === bValue) return 0
        if (aValue == null) return 1
        if (bValue == null) return -1
        if (aValue < bValue) return -1 * direction
        if (aValue > bValue) return 1 * direction
        return 0
      })
    } else {
      results.sort(
        (a, b) => b.catechist._creationTime - a.catechist._creationTime,
      )
    }

    return paginate(results, args.paginationOpts)
  },
})

export const listStudentAccounts = query({
  args: {
    paginationOpts: paginationOptsValidator,
    accountStatus: v.optional(
      v.union(
        v.literal('hasAccount'),
        v.literal('noAccount'),
        v.literal('disabled'),
      ),
    ),
    activeStatus: v.optional(v.boolean()),
    name: v.optional(v.string()),
    sortBy: v.optional(
      v.union(
        v.literal('studentCode'),
        v.literal('fullName'),
        v.literal('_creationTime'),
      ),
    ),
    sortOrder: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx)

    const nameQuery = args.name?.trim()
    const withAccounts = (students: Array<Doc<'students'>>) =>
      Promise.all(
        students.map(async (student) => ({
          student,
          account: await getAccountFor(ctx, 'student', student._id),
        })),
      )

    // Default path: no account-status filter and no name search. The student
    // index gives the order, so paginate natively and join one account per row.
    if (!args.accountStatus && !nameQuery) {
      const index =
        args.sortBy === 'studentCode'
          ? 'by_student_code'
          : args.sortBy === 'fullName'
            ? 'by_name_sort_key'
            : 'by_creation_time'
      const order =
        args.sortBy === undefined || args.sortOrder === 'desc' ? 'desc' : 'asc'
      const result = await ctx.db
        .query('students')
        .withIndex(index)
        .order(order)
        // Deleted/inactive rows are a small minority; no compound index.
        // eslint-disable-next-line @convex-dev/no-filter-in-query
        .filter((q) =>
          q.and(
            q.eq(q.field('isDeleted'), false),
            args.activeStatus === undefined
              ? true
              : q.eq(q.field('isActive'), args.activeStatus),
          ),
        )
        .paginate(args.paginationOpts)
      return { ...result, page: await withAccounts(result.page) }
    }

    // Name search is bounded by the search index; an account-status filter
    // needs every student (the "no account" case is an anti-join), so that
    // path still reads the whole table and filters in memory.
    let results: Array<{
      student: Doc<'students'>
      account: Doc<'accounts'> | null
    }>
    if (args.accountStatus) {
      const needle = nameQuery?.toLowerCase()
      const students = (
        await ctx.db
          .query('students')
          .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
          .collect()
      ).filter(
        (s) =>
          (args.activeStatus === undefined ||
            s.isActive === args.activeStatus) &&
          (!needle ||
            s.fullName.toLowerCase().includes(needle) ||
            (s.saintName?.toLowerCase().includes(needle) ?? false)),
      )
      const accounts = (
        await ctx.db
          .query('accounts')
          .withIndex('by_account_type_and_user_ref_id', (q) =>
            q.eq('accountType', 'student'),
          )
          .collect()
      ).filter((a) => !a.isDeleted)
      const accountMap = buildAccountMap<Id<'students'>>(accounts, 'student')
      results = filterAccountStatus(
        students.map((s) => ({
          student: s,
          account: accountMap.get(s._id) ?? null,
        })),
        args.accountStatus,
      )
    } else {
      results = await withAccounts(
        await searchStudentsByName(ctx, {
          name: nameQuery!,
          isDeleted: false,
          isActive: args.activeStatus,
        }),
      )
    }

    const nameFormat = (await ctx.db.query('appConfig').first())?.nameFormat
    const direction = args.sortOrder === 'desc' ? -1 : 1
    const sortValue = (s: Doc<'students'>) =>
      args.sortBy === 'studentCode'
        ? s.studentCode
        : args.sortBy === 'fullName'
          ? (s.nameSortKey ?? nameSortKey(s.fullName, nameFormat))
          : s._creationTime
    results.sort((a, b) => {
      const aValue = sortValue(a.student)
      const bValue = sortValue(b.student)
      if (aValue === bValue) return 0
      if (args.sortBy === undefined)
        return b.student._creationTime - a.student._creationTime
      return (aValue < bValue ? -1 : 1) * direction
    })

    return paginate(results, args.paginationOpts)
  },
})

/**
 * Inserts an account, or restores a soft-deleted one under the same login ID.
 * Returns false when a live account already holds the login ID.
 */
async function writeGrantedAccount(
  ctx: MutationCtx,
  account: {
    loginId: string
    accountType: 'catechist' | 'student'
    userRefId: Id<'catechists'> | Id<'students'>
    passwordHash: string
  },
): Promise<boolean> {
  const rows = await ctx.db
    .query('accounts')
    .withIndex('by_login_id', (q) => q.eq('loginId', account.loginId))
    .collect()
  if (rows.some((r) => !r.isDeleted)) return false

  if (rows.length > 0) {
    await ctx.db.patch('accounts', rows[0]._id, {
      isDeleted: false,
      isActive: true,
      passwordHash: account.passwordHash,
      lastLoginAt: undefined,
      mustChangePassword: true,
      ...RESET_LOCKOUT_FIELDS,
    })
    return true
  }

  await ctx.db.insert('accounts', {
    ...account,
    isActive: true,
    mustChangePassword: true,
    createdAt: Date.now(),
    isDeleted: false,
  })
  return true
}

// Grant/reset flows are action + internal mutation: passwords must come from
// action randomness (mutation randomness is seeded).
export const internalGrantCatechistAccounts = internalMutation({
  args: {
    grants: v.array(
      v.object({ catechistId: v.id('catechists'), passwordHash: v.string() }),
    ),
    // Single grant throws on a missing catechist or existing account; bulk skips.
    strict: v.boolean(),
  },
  handler: async (ctx, args): Promise<Array<IssuedAccount>> => {
    await assertAdminRole(ctx)

    const issued: Array<IssuedAccount> = []
    for (const { catechistId, passwordHash } of args.grants) {
      const catechist = await ctx.db.get('catechists', catechistId)
      if (!catechist || catechist.isDeleted) {
        if (args.strict)
          throw new Error(ACCOUNT_ADMIN_ERRORS.CATECHIST_NOT_FOUND)
        continue
      }

      const loginId = getCatechistLoginId(catechist.memberId)
      const written = await writeGrantedAccount(ctx, {
        loginId,
        accountType: 'catechist',
        userRefId: catechistId,
        passwordHash,
      })
      if (!written) {
        if (args.strict)
          throw new Error(ACCOUNT_ADMIN_ERRORS.ACCOUNT_ALREADY_EXISTS)
        continue
      }
      issued.push(catechistIssuedAccount(catechist, loginId, passwordHash))
    }
    return issued
  },
})

export const internalGrantStudentAccounts = internalMutation({
  args: {
    grants: v.array(
      v.object({ studentId: v.id('students'), passwordHash: v.string() }),
    ),
    strict: v.boolean(),
  },
  handler: async (ctx, args): Promise<Array<IssuedAccount>> => {
    await assertAdminRole(ctx)

    const issued: Array<IssuedAccount> = []
    for (const { studentId, passwordHash } of args.grants) {
      const student = await ctx.db.get('students', studentId)
      if (!student || student.isDeleted) {
        if (args.strict) throw new Error(ACCOUNT_ADMIN_ERRORS.STUDENT_NOT_FOUND)
        continue
      }

      const loginId = getStudentLoginId(student.studentCode)
      const written = await writeGrantedAccount(ctx, {
        loginId,
        accountType: 'student',
        userRefId: studentId,
        passwordHash,
      })
      if (!written) {
        if (args.strict)
          throw new Error(ACCOUNT_ADMIN_ERRORS.ACCOUNT_ALREADY_EXISTS)
        continue
      }
      issued.push(
        await studentIssuedAccount(ctx, student, loginId, passwordHash),
      )
    }
    return issued
  },
})

export const internalResetPasswords = internalMutation({
  args: {
    resets: v.array(
      v.object({ accountId: v.id('accounts'), passwordHash: v.string() }),
    ),
    strict: v.boolean(),
  },
  handler: async (ctx, args): Promise<Array<IssuedAccount>> => {
    await assertAdminRole(ctx)

    const issued: Array<IssuedAccount> = []
    for (const { accountId, passwordHash } of args.resets) {
      const account = await ctx.db.get('accounts', accountId)
      if (!account || account.isDeleted) {
        if (args.strict) throw new Error(ACCOUNT_ADMIN_ERRORS.ACCOUNT_NOT_FOUND)
        continue
      }

      await ctx.db.patch('accounts', accountId, {
        passwordHash,
        mustChangePassword: true,
        ...RESET_LOCKOUT_FIELDS,
      })
      await revokeSessions(ctx, accountId)

      if (account.accountType === 'catechist') {
        const catechist = await ctx.db.get(
          'catechists',
          account.userRefId as Id<'catechists'>,
        )
        issued.push(
          catechistIssuedAccount(
            catechist ?? { fullName: account.loginId },
            account.loginId,
            passwordHash,
          ),
        )
      } else {
        const student = await ctx.db.get(
          'students',
          account.userRefId as Id<'students'>,
        )
        issued.push(
          student
            ? await studentIssuedAccount(
                ctx,
                student,
                account.loginId,
                passwordHash,
              )
            : {
                accountType: 'student',
                fullName: account.loginId,
                loginId: account.loginId,
                passwordHash,
              },
        )
      }
    }
    return issued
  },
})

export const grantCatechistAccount = action({
  args: {
    catechistId: v.id('catechists'),
  },
  handler: async (ctx, args): Promise<{ credential: IssuedCredential }> => {
    const issued = issuePasswords(1)
    const accounts: Array<IssuedAccount> = await ctx.runMutation(
      internal.accountAdmin.internalGrantCatechistAccounts,
      {
        grants: [
          {
            catechistId: args.catechistId,
            passwordHash: issued[0].passwordHash,
          },
        ],
        strict: true,
      },
    )
    return { credential: revealPasswords(issued, accounts)[0] }
  },
})

export const grantStudentAccount = action({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, args): Promise<{ credential: IssuedCredential }> => {
    const issued = issuePasswords(1)
    const accounts: Array<IssuedAccount> = await ctx.runMutation(
      internal.accountAdmin.internalGrantStudentAccounts,
      {
        grants: [
          { studentId: args.studentId, passwordHash: issued[0].passwordHash },
        ],
        strict: true,
      },
    )
    return { credential: revealPasswords(issued, accounts)[0] }
  },
})

export const resetPassword = action({
  args: {
    accountId: v.id('accounts'),
  },
  handler: async (ctx, args): Promise<{ credential: IssuedCredential }> => {
    const issued = issuePasswords(1)
    const accounts: Array<IssuedAccount> = await ctx.runMutation(
      internal.accountAdmin.internalResetPasswords,
      {
        resets: [
          { accountId: args.accountId, passwordHash: issued[0].passwordHash },
        ],
        strict: true,
      },
    )
    return { credential: revealPasswords(issued, accounts)[0] }
  },
})

export const toggleAccountStatus = mutation({
  args: {
    accountId: v.id('accounts'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx)

    const account = await ctx.db.get('accounts', args.accountId)
    if (!account || account.isDeleted) {
      throw new Error(ACCOUNT_ADMIN_ERRORS.ACCOUNT_NOT_FOUND)
    }

    await ctx.db.patch('accounts', args.accountId, {
      isActive: !account.isActive,
    })
  },
})

export const bulkGrantCatechistAccounts = action({
  args: {
    catechistIds: v.array(v.id('catechists')),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ credentials: Array<IssuedCredential> }> => {
    const issued = issuePasswords(args.catechistIds.length)
    const accounts: Array<IssuedAccount> = await ctx.runMutation(
      internal.accountAdmin.internalGrantCatechistAccounts,
      {
        grants: args.catechistIds.map((catechistId, i) => ({
          catechistId,
          passwordHash: issued[i].passwordHash,
        })),
        strict: false,
      },
    )
    return { credentials: revealPasswords(issued, accounts) }
  },
})

export const bulkGrantStudentAccounts = action({
  args: {
    studentIds: v.array(v.id('students')),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ credentials: Array<IssuedCredential> }> => {
    const issued = issuePasswords(args.studentIds.length)
    const accounts: Array<IssuedAccount> = await ctx.runMutation(
      internal.accountAdmin.internalGrantStudentAccounts,
      {
        grants: args.studentIds.map((studentId, i) => ({
          studentId,
          passwordHash: issued[i].passwordHash,
        })),
        strict: false,
      },
    )
    return { credentials: revealPasswords(issued, accounts) }
  },
})

// Action + internal mutation: the session secret must come from action randomness.
export const startImpersonation = internalMutation({
  args: {
    targetCatechistId: v.id('catechists'),
    secretHash: v.string(),
  },
  handler: async (ctx, args) => {
    const requesterId = await requireCatechistId(ctx)
    await assertAdminRole(ctx)
    // No chaining: an impersonated admin cannot start another impersonation.
    if ((await getAuthedRequester(ctx)).session.impersonatorId) {
      throw new Error(ACCOUNT_ADMIN_ERRORS.NESTED_IMPERSONATION)
    }

    if (args.targetCatechistId === requesterId) {
      throw new Error(ACCOUNT_ADMIN_ERRORS.CANNOT_LOGIN_AS_SELF)
    }

    const target = await ctx.db.get('catechists', args.targetCatechistId)
    if (!target || target.isDeleted) {
      throw new Error(ACCOUNT_ADMIN_ERRORS.CATECHIST_NOT_FOUND)
    }

    const account = await ctx.db
      .query('accounts')
      .withIndex('by_login_id', (q) =>
        q.eq('loginId', getCatechistLoginId(target.memberId)),
      )
      .unique()
    if (!account || account.isDeleted || !account.isActive) {
      throw new Error(ACCOUNT_ADMIN_ERRORS.ACCOUNT_NOT_ACTIVE)
    }

    await ctx.db.insert('impersonationLogs', {
      adminId: requesterId,
      targetCatechistId: args.targetCatechistId,
      at: Date.now(),
    })

    const sessionId = await createSession(ctx, {
      accountId: account._id,
      secretHash: args.secretHash,
      impersonatorId: requesterId,
    })

    return {
      accountType: 'catechist' as const,
      userDocId: target._id,
      loginId: account.loginId,
      memberId: target.memberId,
      fullName: target.fullName,
      role: target.role,
      sessionId,
    }
  },
})

export const loginAsCatechist = action({
  args: {
    targetCatechistId: v.id('catechists'),
  },
  handler: async (
    ctx,
    args,
  ): Promise<ImpersonationResult & { sessionSecret: string }> => {
    const { secret, secretHash } = await newSessionSecret()
    const result: ImpersonationResult = await ctx.runMutation(
      internal.accountAdmin.startImpersonation,
      { ...args, secretHash },
    )
    return { ...result, sessionSecret: secret }
  },
})

type ImpersonationResult = {
  accountType: 'catechist'
  userDocId: Id<'catechists'>
  loginId: string
  memberId: string
  fullName: string
  role: 'admin' | 'user'
  sessionId: Id<'sessions'>
}

export const bulkResetPasswords = action({
  args: {
    accountIds: v.array(v.id('accounts')),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ credentials: Array<IssuedCredential> }> => {
    // Dedupe: a repeated id would be reset twice, invalidating the first password.
    const accountIds = [...new Set(args.accountIds)]
    const issued = issuePasswords(accountIds.length)
    const accounts: Array<IssuedAccount> = await ctx.runMutation(
      internal.accountAdmin.internalResetPasswords,
      {
        resets: accountIds.map((accountId, i) => ({
          accountId,
          passwordHash: issued[i].passwordHash,
        })),
        strict: false,
      },
    )
    return { credentials: revealPasswords(issued, accounts) }
  },
})

export const unlockAccount = mutation({
  args: {
    accountId: v.id('accounts'),
  },
  handler: async (ctx, args) => {
    await assertAdminRole(ctx)

    const account = await ctx.db.get('accounts', args.accountId)
    if (!account || account.isDeleted) {
      throw new Error(ACCOUNT_ADMIN_ERRORS.ACCOUNT_NOT_FOUND)
    }

    await ctx.db.patch('accounts', args.accountId, {
      ...RESET_LOCKOUT_FIELDS,
    })
  },
})
