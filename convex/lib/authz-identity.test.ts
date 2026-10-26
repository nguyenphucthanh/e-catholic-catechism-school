/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from '../_generated/api'
import schema from '../schema'
import { ACCOUNT_ADMIN_ERRORS, AUTHZ_ERRORS } from './errors'
import {
  assertAdminRole,
  assertEditGuardianPermission,
  checkEditStudentPermission,
  checkStudentSensitiveInfoPermission,
} from './authz'
import type { Id } from '../_generated/dataModel'

const modules = import.meta.glob('../**/*.ts')
const paginationOpts = { numItems: 10, cursor: null }

type T = ReturnType<typeof makeT>
function makeT() {
  return convexTest(schema, modules)
}

let counter = 0
async function seedUser(
  t: T,
  kind: 'catechist' | 'student',
  opts: { role?: 'admin' | 'user'; impersonatorId?: Id<'catechists'> } = {},
) {
  const n = ++counter
  return t.run(async (ctx) => {
    const userId =
      kind === 'catechist'
        ? await ctx.db.insert('catechists', {
            memberId: `M${n}`,
            fullName: `Catechist ${n}`,
            role: opts.role ?? 'user',
            isActive: true,
            isDeleted: false,
          })
        : await ctx.db.insert('students', {
            studentCode: `S${n}`,
            fullName: `Student ${n}`,
            isActive: true,
            createdAt: 0,
            isDeleted: false,
          })
    const accountId = await ctx.db.insert('accounts', {
      accountType: kind,
      userRefId: userId,
      loginId: `${kind === 'catechist' ? 'gl' : 'hs'}${n}`,
      passwordHash: 'x',
      isActive: true,
      isDeleted: false,
      createdAt: 0,
    })
    const sessionId = await ctx.db.insert('sessions', {
      accountId,
      secretHash: 'h',
      expiresAt: Number.MAX_SAFE_INTEGER,
      impersonatorId: opts.impersonatorId,
    })
    return {
      userId,
      accountId,
      sessionId,
      identity: { subject: `${kind}|${userId}`, sid: sessionId },
    }
  })
}

const catechistSeed = (t: T, role: 'admin' | 'user' = 'user') =>
  seedUser(t, 'catechist', { role })

async function expectUnauthenticatedQuery(
  t: ReturnType<T['withIdentity']> | T,
  requesterId: Id<'catechists'>,
) {
  await expect(
    t.query(api.catechists.listAllActive, { requesterId }),
  ).rejects.toThrow(AUTHZ_ERRORS.UNAUTHENTICATED)
}

describe('server-side identity enforcement', () => {
  describe('no identity', () => {
    test('query throws UNAUTHENTICATED', async () => {
      const t = makeT()
      const a = await catechistSeed(t, 'admin')
      await expectUnauthenticatedQuery(t, a.userId as Id<'catechists'>)
      await expect(
        t.query(api.catechists.list, {
          requesterId: a.userId as Id<'catechists'>,
          paginationOpts,
        }),
      ).rejects.toThrow(AUTHZ_ERRORS.UNAUTHENTICATED)
    })

    test('mutation throws UNAUTHENTICATED', async () => {
      const t = makeT()
      const a = await catechistSeed(t)
      await expect(
        t.mutation(api.storage.generateUploadUrl, {
          requester: {
            accountType: 'catechist',
            requesterId: a.userId as Id<'catechists'>,
          },
        }),
      ).rejects.toThrow(AUTHZ_ERRORS.UNAUTHENTICATED)
    })

    test('action throws UNAUTHENTICATED and creates no session', async () => {
      const t = makeT()
      const admin = await catechistSeed(t, 'admin')
      const target = await catechistSeed(t)
      await expect(
        t.action(api.accountAdmin.loginAsCatechist, {
          requesterId: admin.userId as Id<'catechists'>,
          targetCatechistId: target.userId as Id<'catechists'>,
        }),
      ).rejects.toThrow(AUTHZ_ERRORS.UNAUTHENTICATED)
      const sessions = await t.run((ctx) => ctx.db.query('sessions').collect())
      expect(sessions).toHaveLength(2)
    })
  })

  describe('malformed or missing session', () => {
    test('identity without sid', async () => {
      const t = makeT()
      const a = await catechistSeed(t)
      await expectUnauthenticatedQuery(
        t.withIdentity({ subject: a.identity.subject }),
        a.userId as Id<'catechists'>,
      )
    })

    test('sid that is not a sessions id', async () => {
      const t = makeT()
      const a = await catechistSeed(t)
      await expectUnauthenticatedQuery(
        t.withIdentity({ subject: a.identity.subject, sid: 'garbage' }),
        a.userId as Id<'catechists'>,
      )
    })

    test('sid of a session deleted from the db', async () => {
      const t = makeT()
      const a = await catechistSeed(t)
      await t.run((ctx) => ctx.db.delete('sessions', a.sessionId))
      await expectUnauthenticatedQuery(
        t.withIdentity(a.identity),
        a.userId as Id<'catechists'>,
      )
    })

    test('revoked session', async () => {
      const t = makeT()
      const a = await catechistSeed(t)
      await t.run((ctx) =>
        ctx.db.patch('sessions', a.sessionId, { revokedAt: 1 }),
      )
      await expectUnauthenticatedQuery(
        t.withIdentity(a.identity),
        a.userId as Id<'catechists'>,
      )
    })
  })

  describe('account state', () => {
    test('inactive account', async () => {
      const t = makeT()
      const a = await catechistSeed(t)
      await t.run((ctx) =>
        ctx.db.patch('accounts', a.accountId, { isActive: false }),
      )
      await expectUnauthenticatedQuery(
        t.withIdentity(a.identity),
        a.userId as Id<'catechists'>,
      )
    })

    test('soft-deleted account', async () => {
      const t = makeT()
      const a = await catechistSeed(t)
      await t.run((ctx) =>
        ctx.db.patch('accounts', a.accountId, { isDeleted: true }),
      )
      await expectUnauthenticatedQuery(
        t.withIdentity(a.identity),
        a.userId as Id<'catechists'>,
      )
    })

    test('subject of user B with the session of user A', async () => {
      const t = makeT()
      const a = await catechistSeed(t)
      const b = await catechistSeed(t)
      await expectUnauthenticatedQuery(
        t.withIdentity({ subject: b.identity.subject, sid: a.identity.sid }),
        b.userId as Id<'catechists'>,
      )
    })
  })

  describe('requester id must match the verified identity', () => {
    test('non-admin A passing admin B is UNAUTHORIZED', async () => {
      const t = makeT()
      const a = await catechistSeed(t)
      const admin = await catechistSeed(t, 'admin')
      await expect(
        t.withIdentity(a.identity).query(api.catechists.listAllActive, {
          requesterId: admin.userId as Id<'catechists'>,
        }),
      ).rejects.toThrow(AUTHZ_ERRORS.UNAUTHORIZED)
    })

    test('loginAsCatechist as A claiming admin B creates no session or log', async () => {
      const t = makeT()
      const a = await catechistSeed(t)
      const admin = await catechistSeed(t, 'admin')
      const target = await catechistSeed(t)
      await expect(
        t.withIdentity(a.identity).action(api.accountAdmin.loginAsCatechist, {
          requesterId: admin.userId as Id<'catechists'>,
          targetCatechistId: target.userId as Id<'catechists'>,
        }),
      ).rejects.toThrow(AUTHZ_ERRORS.UNAUTHORIZED)
      const { sessions, logs } = await t.run(async (ctx) => ({
        sessions: await ctx.db.query('sessions').collect(),
        logs: await ctx.db.query('impersonationLogs').collect(),
      }))
      expect(sessions).toHaveLength(3)
      expect(logs).toHaveLength(0)
    })

    test('student S passing a catechist id is UNAUTHORIZED', async () => {
      const t = makeT()
      const s = await seedUser(t, 'student')
      const c = await catechistSeed(t)
      await expect(
        t.withIdentity(s.identity).query(api.catechists.listAllActive, {
          requesterId: c.userId as Id<'catechists'>,
        }),
      ).rejects.toThrow(AUTHZ_ERRORS.UNAUTHORIZED)
    })

    test('catechist passing a student id to a student endpoint is UNAUTHORIZED', async () => {
      const t = makeT()
      const s = await seedUser(t, 'student')
      const c = await catechistSeed(t)
      await expect(
        t.withIdentity(c.identity).query(api.students.getMyProfile, {
          requesterId: s.userId as Id<'students'>,
        }),
      ).rejects.toThrow(AUTHZ_ERRORS.UNAUTHORIZED)
    })

    test('requester-union endpoint with mismatched requester is UNAUTHORIZED', async () => {
      const t = makeT()
      const s = await seedUser(t, 'student')
      const c = await catechistSeed(t)
      const asStudent = t.withIdentity(s.identity)
      await expect(
        asStudent.mutation(api.storage.generateUploadUrl, {
          requester: {
            accountType: 'catechist',
            requesterId: c.userId as Id<'catechists'>,
          },
        }),
      ).rejects.toThrow(AUTHZ_ERRORS.UNAUTHORIZED)
      await expect(
        asStudent.mutation(api.storage.generateUploadUrl, {
          requester: {
            accountType: 'student',
            requesterId: s.userId as Id<'students'>,
          },
        }),
      ).resolves.toEqual(expect.any(String))
    })
  })

  describe('permission helpers reject a mismatched requester', () => {
    test('throw UNAUTHORIZED instead of returning false', async () => {
      const t = makeT()
      const a = await catechistSeed(t)
      const admin = await catechistSeed(t, 'admin')
      const s = await seedUser(t, 'student')
      const adminId = admin.userId as Id<'catechists'>
      const studentId = s.userId as Id<'students'>
      const guardianId = await t.run((ctx) =>
        ctx.db.insert('guardians', { fullName: 'G', isDeleted: false }),
      )
      const asA = t.withIdentity(a.identity)

      await expect(
        asA.run((ctx) => assertAdminRole(ctx, adminId)),
      ).rejects.toThrow(AUTHZ_ERRORS.UNAUTHORIZED)
      await expect(
        asA.run((ctx) => checkEditStudentPermission(ctx, adminId, studentId)),
      ).rejects.toThrow(AUTHZ_ERRORS.UNAUTHORIZED)
      await expect(
        asA.run((ctx) =>
          checkStudentSensitiveInfoPermission(ctx, adminId, studentId),
        ),
      ).rejects.toThrow(AUTHZ_ERRORS.UNAUTHORIZED)
      await expect(
        asA.run((ctx) =>
          assertEditGuardianPermission(ctx, adminId, guardianId),
        ),
      ).rejects.toThrow(AUTHZ_ERRORS.UNAUTHORIZED)
    })
  })

  describe('happy path', () => {
    test('matching identity succeeds', async () => {
      const t = makeT()
      const a = await catechistSeed(t)
      const result = await t
        .withIdentity(a.identity)
        .query(api.catechists.listAllActive, {
          requesterId: a.userId as Id<'catechists'>,
        })
      expect(result.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('nested impersonation', () => {
    test('impersonated admin cannot start another impersonation', async () => {
      const t = makeT()
      const original = await catechistSeed(t, 'admin')
      const admin = await seedUser(t, 'catechist', {
        role: 'admin',
        impersonatorId: original.userId as Id<'catechists'>,
      })
      const target = await catechistSeed(t)
      const before = await t.run(
        async (ctx) => (await ctx.db.query('sessions').collect()).length,
      )
      await expect(
        t
          .withIdentity(admin.identity)
          .action(api.accountAdmin.loginAsCatechist, {
            requesterId: admin.userId as Id<'catechists'>,
            targetCatechistId: target.userId as Id<'catechists'>,
          }),
      ).rejects.toThrow(ACCOUNT_ADMIN_ERRORS.NESTED_IMPERSONATION)
      const { after, logs } = await t.run(async (ctx) => ({
        after: (await ctx.db.query('sessions').collect()).length,
        logs: (await ctx.db.query('impersonationLogs').collect()).length,
      }))
      expect(after).toBe(before)
      expect(logs).toBe(0)
    })
  })

  describe('getProgramDetail', () => {
    test('throws UNAUTHENTICATED with neither requesterId nor studentRequesterId', async () => {
      const t = makeT()
      const c = await catechistSeed(t, 'admin')
      const programId = await t.run(async (ctx) => {
        const academicYearId = await ctx.db.insert('academicYears', {
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-05-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
          isDeleted: false,
        })
        return ctx.db.insert('extracurricularPrograms', {
          academicYearId,
          title: 'Camp',
          details: '{}',
          target: 'all',
          branches: [],
          dateStart: '2099-01-01',
          dateEnd: '2099-02-01',
          enrollmentExpireDate: '2099-01-15',
          feeRequired: false,
          createdBy: c.userId as Id<'catechists'>,
          createdAt: 0,
          isDeleted: false,
        })
      })
      await expect(
        t
          .withIdentity(c.identity)
          .query(api.extracurricularPrograms.getProgramDetail, { programId }),
      ).rejects.toThrow(AUTHZ_ERRORS.UNAUTHENTICATED)
    })
  })
})
