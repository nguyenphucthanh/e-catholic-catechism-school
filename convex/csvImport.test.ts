/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test, vi } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import * as passwordLib from './lib/password'
import { AUTHZ_ERRORS } from './lib/errors'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

async function seedAdmin(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('catechists', {
      memberId: 'GLV001',
      fullName: 'Admin',
      role: 'admin',
      isActive: true,
      isDeleted: false,
    })
  })
}

async function seedNonAdmin(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('catechists', {
      memberId: 'GLV002',
      fullName: 'Regular User',
      role: 'user',
      isActive: true,
      isDeleted: false,
    })
  })
}

describe('csvImport backend functions', () => {
  describe('authorization', () => {
    test('bulkImportStudents throws Unauthorized for non-admin requester', async () => {
      const t = convexTest(schema, modules)
      const nonAdminId = await seedNonAdmin(t)

      await expect(
        t.mutation(internal.csvImport.internalBulkImportStudentsBatch, {
          requesterId: nonAdminId,
          records: [
            { fullName: 'Student 1', studentCode: '1', passwordHash: 'hash1' },
          ],
        }),
      ).rejects.toThrow(AUTHZ_ERRORS.ADMIN_REQUIRED)
    })

    test('bulkImportCatechists throws Unauthorized for non-admin requester', async () => {
      const t = convexTest(schema, modules)
      const nonAdminId = await seedNonAdmin(t)

      await expect(
        t.mutation(internal.csvImport.internalBulkImportCatechistsBatch, {
          requesterId: nonAdminId,
          records: [
            { fullName: 'Catechist 1', memberId: '1', passwordHash: 'hash1' },
          ],
        }),
      ).rejects.toThrow(AUTHZ_ERRORS.ADMIN_REQUIRED)
    })

    test('internalReserveCounters throws Unauthorized for non-admin requester', async () => {
      const t = convexTest(schema, modules)
      const nonAdminId = await seedNonAdmin(t)

      await expect(
        t.mutation(internal.csvImport.internalReserveCounters, {
          requesterId: nonAdminId,
          name: 'student',
          count: 1,
        }),
      ).rejects.toThrow(AUTHZ_ERRORS.ADMIN_REQUIRED)
    })

    test('checkDuplicates throws Unauthorized for non-admin requester', async () => {
      const t = convexTest(schema, modules)
      const nonAdminId = await seedNonAdmin(t)

      await expect(
        t.query(api.csvImport.checkDuplicates, {
          requesterId: nonAdminId,
          target: 'students',
          names: ['Student 1'],
        }),
      ).rejects.toThrow(AUTHZ_ERRORS.ADMIN_REQUIRED)
    })
  })

  describe('bulkImportStudents', () => {
    test('creates student, account, guardian, guardianContacts, and studentGuardians link', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      const results = await t.mutation(
        internal.csvImport.internalBulkImportStudentsBatch,
        {
          requesterId: adminId,
          records: [
            {
              fullName: 'Nguyen Van A',
              saintName: 'Peter',
              dateOfBirth: '2010-01-01',
              gender: 'male',
              studentCode: '1',
              passwordHash: 'hashed-password-1',
              guardians: [
                {
                  fullName: 'Nguyen Van B',
                  saintName: 'Paul',
                  relationship: 'father',
                  contacts: [
                    { type: 'phone', value: '+84901234567' },
                    { type: 'email', value: 'guardian@example.com' },
                  ],
                },
              ],
            },
          ],
        },
      )

      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('ok')
      const studentId =
        results[0].status === 'ok'
          ? (results[0].id as Id<'students'>)
          : (undefined as never)

      await t.run(async (ctx) => {
        const student = await ctx.db.get('students', studentId)
        expect(student).not.toBeNull()
        expect(student?.fullName).toBe('Nguyen Van A')
        expect(student?.isActive).toBe(true)
        expect(student?.isDeleted).toBe(false)

        const account = await ctx.db
          .query('accounts')
          .withIndex('by_login_id', (q) => q.eq('loginId', 'STD-1'))
          .unique()
        expect(account).not.toBeNull()
        expect(account?.accountType).toBe('student')
        expect(account?.userRefId).toBe(studentId)

        const links = await ctx.db
          .query('studentGuardians')
          .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
          .collect()
        expect(links).toHaveLength(1)
        expect(links[0].relationship).toBe('father')
        expect(links[0].contactPriority).toBe(1)

        const guardian = await ctx.db.get('guardians', links[0].guardianId)
        expect(guardian).not.toBeNull()
        expect(guardian?.fullName).toBe('Nguyen Van B')

        const contacts = await ctx.db
          .query('guardianContacts')
          .withIndex('by_guardian_id', (q) =>
            q.eq('guardianId', links[0].guardianId),
          )
          .collect()
        expect(contacts).toHaveLength(2)
        const phoneContact = contacts.find((c) => c.contactType === 'phone')
        const emailContact = contacts.find((c) => c.contactType === 'email')
        expect(phoneContact?.isPrimary).toBe(true)
        expect(phoneContact?.value).toBe('+84901234567')
        expect(emailContact?.isPrimary).toBe(false)
        expect(emailContact?.value).toBe('guardian@example.com')
      })
    })

    test('creates a student without a guardian block', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      const results = await t.mutation(
        internal.csvImport.internalBulkImportStudentsBatch,
        {
          requesterId: adminId,
          records: [
            {
              fullName: 'Solo Student',
              studentCode: '1',
              passwordHash: 'hashed-password-1',
            },
          ],
        },
      )

      expect(results).toEqual([
        { index: 0, status: 'ok', id: expect.anything() },
      ])
    })

    test('guardian email-only contact is marked primary', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      const results = await t.mutation(
        internal.csvImport.internalBulkImportStudentsBatch,
        {
          requesterId: adminId,
          records: [
            {
              fullName: 'Student Email Only',
              studentCode: '1',
              passwordHash: 'hashed-password-1',
              guardians: [
                {
                  fullName: 'Guardian Email Only',
                  relationship: 'mother',
                  contacts: [{ type: 'email', value: 'onlyemail@example.com' }],
                },
              ],
            },
          ],
        },
      )

      expect(results[0].status).toBe('ok')
      const studentId =
        results[0].status === 'ok'
          ? (results[0].id as Id<'students'>)
          : (undefined as never)

      await t.run(async (ctx) => {
        const links = await ctx.db
          .query('studentGuardians')
          .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
          .collect()
        const contacts = await ctx.db
          .query('guardianContacts')
          .withIndex('by_guardian_id', (q) =>
            q.eq('guardianId', links[0].guardianId),
          )
          .collect()
        expect(contacts).toHaveLength(1)
        expect(contacts[0].contactType).toBe('email')
        expect(contacts[0].isPrimary).toBe(true)
      })
    })

    test('guardian phone-only contact is marked primary and no email contact is created', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      const results = await t.mutation(
        internal.csvImport.internalBulkImportStudentsBatch,
        {
          requesterId: adminId,
          records: [
            {
              fullName: 'Student Phone Only',
              studentCode: '1',
              passwordHash: 'hashed-password-1',
              guardians: [
                {
                  fullName: 'Guardian Phone Only',
                  relationship: 'father',
                  contacts: [{ type: 'phone', value: '+84901111111' }],
                },
              ],
            },
          ],
        },
      )

      expect(results[0].status).toBe('ok')
      const studentId =
        results[0].status === 'ok'
          ? (results[0].id as Id<'students'>)
          : (undefined as never)

      await t.run(async (ctx) => {
        const links = await ctx.db
          .query('studentGuardians')
          .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
          .collect()
        const contacts = await ctx.db
          .query('guardianContacts')
          .withIndex('by_guardian_id', (q) =>
            q.eq('guardianId', links[0].guardianId),
          )
          .collect()
        expect(contacts).toHaveLength(1)
        expect(contacts[0].contactType).toBe('phone')
        expect(contacts[0].isPrimary).toBe(true)
      })
    })

    test('supports up to 3 guardians per student with correct contactPriority ordering', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      const results = await t.mutation(
        internal.csvImport.internalBulkImportStudentsBatch,
        {
          requesterId: adminId,
          records: [
            {
              fullName: 'Multi Guardian Student',
              studentCode: '1',
              passwordHash: 'hashed-password-1',
              guardians: [
                {
                  fullName: 'Father Guardian',
                  relationship: 'father',
                  contacts: [{ type: 'phone', value: '+84900000001' }],
                },
                {
                  fullName: 'Mother Guardian',
                  relationship: 'mother',
                  contacts: [{ type: 'phone', value: '+84900000002' }],
                },
                {
                  fullName: 'Other Guardian',
                  relationship: 'guardian',
                  contacts: [{ type: 'phone', value: '+84900000003' }],
                },
              ],
            },
          ],
        },
      )

      expect(results[0].status).toBe('ok')
      const studentId =
        results[0].status === 'ok'
          ? (results[0].id as Id<'students'>)
          : (undefined as never)

      await t.run(async (ctx) => {
        const links = await ctx.db
          .query('studentGuardians')
          .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
          .collect()
        expect(links).toHaveLength(3)
        const sorted = [...links].sort(
          (a, b) => a.contactPriority - b.contactPriority,
        )
        expect(sorted.map((l) => l.contactPriority)).toEqual([1, 2, 3])
        expect(sorted.map((l) => l.relationship)).toEqual([
          'father',
          'mother',
          'guardian',
        ])

        const guardianNames = await Promise.all(
          sorted.map(async (l) => {
            const g = await ctx.db.get('guardians', l.guardianId)
            return g?.fullName
          }),
        )
        expect(guardianNames).toEqual([
          'Father Guardian',
          'Mother Guardian',
          'Other Guardian',
        ])
      })
    })

    test('dedups guardian by phone across sibling records in the same batch', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      const results = await t.mutation(
        internal.csvImport.internalBulkImportStudentsBatch,
        {
          requesterId: adminId,
          records: [
            {
              fullName: 'Sibling One',
              studentCode: '1',
              passwordHash: 'hashed-password-1',
              guardians: [
                {
                  fullName: 'Shared Father',
                  relationship: 'father',
                  contacts: [{ type: 'phone', value: '+84911111111' }],
                },
              ],
            },
            {
              fullName: 'Sibling Two',
              studentCode: '2',
              passwordHash: 'hashed-password-2',
              guardians: [
                {
                  fullName: 'Shared Father',
                  relationship: 'father',
                  contacts: [{ type: 'phone', value: '+84911111111' }],
                },
              ],
            },
          ],
        },
      )

      expect(results[0].status).toBe('ok')
      expect(results[1].status).toBe('ok')
      const studentId1 =
        results[0].status === 'ok'
          ? (results[0].id as Id<'students'>)
          : (undefined as never)
      const studentId2 =
        results[1].status === 'ok'
          ? (results[1].id as Id<'students'>)
          : (undefined as never)

      await t.run(async (ctx) => {
        const links1 = await ctx.db
          .query('studentGuardians')
          .withIndex('by_student_id', (q) => q.eq('studentId', studentId1))
          .collect()
        const links2 = await ctx.db
          .query('studentGuardians')
          .withIndex('by_student_id', (q) => q.eq('studentId', studentId2))
          .collect()
        expect(links1).toHaveLength(1)
        expect(links2).toHaveLength(1)
        expect(links1[0].guardianId).toBe(links2[0].guardianId)

        const allGuardians = await ctx.db.query('guardians').collect()
        expect(allGuardians).toHaveLength(1)

        const allContacts = await ctx.db.query('guardianContacts').collect()
        expect(allContacts).toHaveLength(1)
      })
    })

    test('dedups guardian by phone against an existing guardian already in the DB', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      const existingGuardianId = await t.run(async (ctx) => {
        const guardianId = await ctx.db.insert('guardians', {
          fullName: 'Pre-existing Guardian',
          isDeleted: false,
        })
        await ctx.db.insert('guardianContacts', {
          guardianId,
          contactType: 'phone',
          value: '+84922222222',
          isPrimary: true,
          isDeleted: false,
        })
        return guardianId
      })

      const results = await t.mutation(
        internal.csvImport.internalBulkImportStudentsBatch,
        {
          requesterId: adminId,
          records: [
            {
              fullName: 'New Student',
              studentCode: '1',
              passwordHash: 'hashed-password-1',
              guardians: [
                {
                  fullName: 'Duplicate Name Entry',
                  relationship: 'mother',
                  contacts: [{ type: 'phone', value: '+84922222222' }],
                },
              ],
            },
          ],
        },
      )

      expect(results[0].status).toBe('ok')
      const studentId =
        results[0].status === 'ok'
          ? (results[0].id as Id<'students'>)
          : (undefined as never)

      await t.run(async (ctx) => {
        const links = await ctx.db
          .query('studentGuardians')
          .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
          .collect()
        expect(links).toHaveLength(1)
        expect(links[0].guardianId).toBe(existingGuardianId)

        const allGuardians = await ctx.db.query('guardians').collect()
        expect(allGuardians).toHaveLength(1)

        const allContacts = await ctx.db
          .query('guardianContacts')
          .withIndex('by_guardian_id', (q) =>
            q.eq('guardianId', existingGuardianId),
          )
          .collect()
        expect(allContacts).toHaveLength(1)
      })
    })

    test('inserts zalo and other contact types correctly', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      const results = await t.mutation(
        internal.csvImport.internalBulkImportStudentsBatch,
        {
          requesterId: adminId,
          records: [
            {
              fullName: 'Zalo Student',
              studentCode: '1',
              passwordHash: 'hashed-password-1',
              guardians: [
                {
                  fullName: 'Zalo Guardian',
                  relationship: 'father',
                  contacts: [
                    { type: 'zalo', value: 'zalo-handle-123' },
                    { type: 'other', value: 'some-other-contact' },
                  ],
                },
              ],
            },
          ],
        },
      )

      expect(results[0].status).toBe('ok')
      const studentId =
        results[0].status === 'ok'
          ? (results[0].id as Id<'students'>)
          : (undefined as never)

      await t.run(async (ctx) => {
        const links = await ctx.db
          .query('studentGuardians')
          .withIndex('by_student_id', (q) => q.eq('studentId', studentId))
          .collect()
        const contacts = await ctx.db
          .query('guardianContacts')
          .withIndex('by_guardian_id', (q) =>
            q.eq('guardianId', links[0].guardianId),
          )
          .collect()
        expect(contacts).toHaveLength(2)
        const zalo = contacts.find((c) => c.contactType === 'zalo')
        const other = contacts.find((c) => c.contactType === 'other')
        expect(zalo?.value).toBe('zalo-handle-123')
        expect(zalo?.isPrimary).toBe(true)
        expect(other?.value).toBe('some-other-contact')
        expect(other?.isPrimary).toBe(false)
      })
    })

    test('one bad record fails while the other succeeds in the same batch', async () => {
      // hashPassword is no longer called inside this mutation (it now runs
      // in the bulkImportStudents action before the batch mutation is
      // invoked), so per-record isolation is instead exercised here via a
      // genuine per-record insert failure. `ctx.db.insert` reads `Date.now()`
      // internally for `_creationTime`, and this mutation also reads
      // `Date.now()` explicitly for `createdAt` on the `students` and
      // `accounts` inserts. With no guardian block, each record performs
      // exactly 4 `Date.now()` reads (2 explicit + 2 internal), so failing
      // the 5th call fails the first insert of the second record while
      // leaving the first record's inserts untouched.
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      let callCount = 0
      const spy = vi.spyOn(Date, 'now').mockImplementation(() => {
        callCount += 1
        if (callCount === 5) {
          throw new Error('Simulated insert failure')
        }
        return 1700000000000 + callCount
      })

      try {
        const results = await t.mutation(
          internal.csvImport.internalBulkImportStudentsBatch,
          {
            requesterId: adminId,
            records: [
              {
                fullName: 'Good Student',
                studentCode: '1',
                passwordHash: 'hashed-password-1',
              },
              {
                fullName: 'Bad Student',
                studentCode: '2',
                passwordHash: 'hashed-password-2',
              },
            ],
          },
        )

        expect(results).toHaveLength(2)
        expect(results[0].status).toBe('ok')
        expect(results[1].status).toBe('error')
        if (results[1].status === 'error') {
          expect(results[1].error).toContain('Simulated insert failure')
        }
      } finally {
        spy.mockRestore()
      }
    })

    test('inserts studentClasses enrollment if classYearId is provided', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      const { classYearId } = await t.run(async (ctx) => {
        const branchId = await ctx.db.insert('branches', {
          name: 'Ấu Nhi',
          sortOrder: 1,
          isDeleted: false,
        })
        const academicYearId = await ctx.db.insert('academicYears', {
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-05-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
          isDeleted: false,
        })
        const classId = await ctx.db.insert('classes', {
          branchId,
          name: 'Ấu Nhi 1',
          isDeleted: false,
        })
        const insertedClassYearId = await ctx.db.insert('classYears', {
          classId,
          academicYearId,
          isDeleted: false,
        })
        return { classYearId: insertedClassYearId }
      })

      const results = await t.mutation(
        internal.csvImport.internalBulkImportStudentsBatch,
        {
          requesterId: adminId,
          classYearId,
          records: [
            {
              fullName: 'Enrolled Student',
              studentCode: '101',
              passwordHash: 'hashed-password-101',
            },
          ],
        },
      )

      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('ok')
      const studentId =
        results[0].status === 'ok'
          ? (results[0].id as Id<'students'>)
          : (undefined as never)

      await t.run(async (ctx) => {
        const enrollments = await ctx.db
          .query('studentClasses')
          .withIndex('by_student_id_and_class_year_id', (q) =>
            q.eq('studentId', studentId).eq('classYearId', classYearId),
          )
          .collect()
        expect(enrollments).toHaveLength(1)
        expect(enrollments[0].isPrimaryClass).toBe(true)
        expect(enrollments[0].status).toBe('active')
      })
    })
  })

  describe('bulkImportStudents action', () => {
    test('reserves counters, hashes passwords, and creates students end-to-end', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      const results = await t.action(api.csvImport.bulkImportStudents, {
        requesterId: adminId,
        records: [
          { fullName: 'Action Student A' },
          { fullName: 'Action Student B' },
        ],
      })

      expect(results).toHaveLength(2)
      expect(results[0].status).toBe('ok')
      expect(results[1].status).toBe('ok')

      await t.run(async (ctx) => {
        const accounts = await ctx.db.query('accounts').collect()
        const loginIds = accounts
          .map((a) => a.loginId)
          .filter((id) => id.startsWith('STD-'))
          .sort()
        expect(loginIds).toEqual(['STD-1', 'STD-2'])
      })
    })

    test('aborts the whole batch if hashPassword throws for one record', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      const realHashPassword = passwordLib.hashPassword
      let callCount = 0
      const spy = vi
        .spyOn(passwordLib, 'hashPassword')
        .mockImplementation((plaintext: string) => {
          callCount += 1
          if (callCount === 2) {
            throw new Error('Simulated hash failure')
          }
          return realHashPassword(plaintext)
        })

      try {
        await expect(
          t.action(api.csvImport.bulkImportStudents, {
            requesterId: adminId,
            records: [
              { fullName: 'Good Student' },
              { fullName: 'Bad Student' },
            ],
          }),
        ).rejects.toThrow('Simulated hash failure')

        await t.run(async (ctx) => {
          const students = await ctx.db.query('students').collect()
          expect(students).toHaveLength(0)
        })
      } finally {
        spy.mockRestore()
      }
    })
  })

  describe('bulkImportCatechists', () => {
    test('creates catechist, account, and contacts', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      const results = await t.mutation(
        internal.csvImport.internalBulkImportCatechistsBatch,
        {
          requesterId: adminId,
          records: [
            {
              fullName: 'Tran Van C',
              title: 'Thầy',
              community: 'Community A',
              phone: '+84987654321',
              email: 'catechist@example.com',
              memberId: '1',
              passwordHash: 'hashed-password-1',
            },
          ],
        },
      )

      expect(results[0].status).toBe('ok')
      const catechistId =
        results[0].status === 'ok'
          ? (results[0].id as Id<'catechists'>)
          : (undefined as never)

      await t.run(async (ctx) => {
        const catechist = await ctx.db.get('catechists', catechistId)
        expect(catechist).not.toBeNull()
        expect(catechist?.fullName).toBe('Tran Van C')
        expect(catechist?.role).toBe('user')
        expect(catechist?.isActive).toBe(true)

        const account = await ctx.db
          .query('accounts')
          .withIndex('by_login_id', (q) => q.eq('loginId', 'CAT-1'))
          .unique()
        expect(account).not.toBeNull()
        expect(account?.accountType).toBe('catechist')

        const contacts = await ctx.db
          .query('catechistContacts')
          .withIndex('by_catechist_id', (q) => q.eq('catechistId', catechistId))
          .collect()
        expect(contacts).toHaveLength(2)
        const phoneContact = contacts.find((c) => c.contactType === 'phone')
        const emailContact = contacts.find((c) => c.contactType === 'email')
        expect(phoneContact?.isPrimary).toBe(true)
        expect(emailContact?.isPrimary).toBe(false)
      })
    })

    test('creates a catechist without any contacts', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      const results = await t.mutation(
        internal.csvImport.internalBulkImportCatechistsBatch,
        {
          requesterId: adminId,
          records: [
            {
              fullName: 'No Contact Catechist',
              memberId: '1',
              passwordHash: 'hashed-password-1',
            },
          ],
        },
      )

      expect(results[0].status).toBe('ok')
    })

    test('one bad record fails while the other succeeds in the same batch', async () => {
      // See the equivalent students-batch test above for why this is now
      // simulated via `Date.now()` instead of `hashPassword`. With no
      // contacts, each catechist record performs exactly 3 `Date.now()`
      // reads (1 internal for the `catechists` insert, then 1 explicit + 1
      // internal for the `accounts` insert), so failing the 4th call fails
      // the second record's `catechists` insert while leaving the first
      // record's inserts untouched.
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      let callCount = 0
      const spy = vi.spyOn(Date, 'now').mockImplementation(() => {
        callCount += 1
        if (callCount === 4) {
          throw new Error('Simulated insert failure')
        }
        return 1700000000000 + callCount
      })

      try {
        const results = await t.mutation(
          internal.csvImport.internalBulkImportCatechistsBatch,
          {
            requesterId: adminId,
            records: [
              {
                fullName: 'Good Catechist',
                memberId: '1',
                passwordHash: 'hashed-password-1',
              },
              {
                fullName: 'Bad Catechist',
                memberId: '2',
                passwordHash: 'hashed-password-2',
              },
            ],
          },
        )

        expect(results).toHaveLength(2)
        expect(results[0].status).toBe('ok')
        expect(results[1].status).toBe('error')
        if (results[1].status === 'error') {
          expect(results[1].error).toContain('Simulated insert failure')
        }
      } finally {
        spy.mockRestore()
      }
    })
  })

  describe('bulkImportCatechists action', () => {
    test('reserves counters, hashes passwords, and creates catechists end-to-end', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      const results = await t.action(api.csvImport.bulkImportCatechists, {
        requesterId: adminId,
        records: [
          { fullName: 'Action Catechist A' },
          { fullName: 'Action Catechist B' },
        ],
      })

      expect(results).toHaveLength(2)
      expect(results[0].status).toBe('ok')
      expect(results[1].status).toBe('ok')

      await t.run(async (ctx) => {
        const accounts = await ctx.db.query('accounts').collect()
        const loginIds = accounts
          .map((a) => a.loginId)
          .filter((id) => id.startsWith('CAT-'))
          .sort()
        expect(loginIds).toEqual(['CAT-1', 'CAT-2'])
      })
    })

    test('aborts the whole batch if hashPassword throws for one record', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      const realHashPassword = passwordLib.hashPassword
      let callCount = 0
      const spy = vi
        .spyOn(passwordLib, 'hashPassword')
        .mockImplementation((plaintext: string) => {
          callCount += 1
          if (callCount === 2) {
            throw new Error('Simulated hash failure')
          }
          return realHashPassword(plaintext)
        })

      try {
        await expect(
          t.action(api.csvImport.bulkImportCatechists, {
            requesterId: adminId,
            records: [
              { fullName: 'Good Catechist' },
              { fullName: 'Bad Catechist' },
            ],
          }),
        ).rejects.toThrow('Simulated hash failure')

        await t.run(async (ctx) => {
          const catechists = await ctx.db
            .query('catechists')
            .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
            .collect()
          expect(catechists).toHaveLength(1) // only the seeded admin
        })
      } finally {
        spy.mockRestore()
      }
    })
  })

  describe('internalReserveCounters', () => {
    test('creates the counter starting at 1 on first use', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      const seqs = await t.mutation(
        internal.csvImport.internalReserveCounters,
        {
          requesterId: adminId,
          name: 'student',
          count: 3,
        },
      )

      expect(seqs).toEqual([1, 2, 3])

      await t.run(async (ctx) => {
        const counter = await ctx.db
          .query('counters')
          .withIndex('by_name', (q) => q.eq('name', 'student'))
          .unique()
        expect(counter?.value).toBe(3)
      })
    })

    test('increments sequentially across multiple reservations', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      const first = await t.mutation(
        internal.csvImport.internalReserveCounters,
        {
          requesterId: adminId,
          name: 'catechist',
          count: 2,
        },
      )
      const second = await t.mutation(
        internal.csvImport.internalReserveCounters,
        {
          requesterId: adminId,
          name: 'catechist',
          count: 3,
        },
      )

      expect(first).toEqual([1, 2])
      expect(second).toEqual([3, 4, 5])
    })

    test('keeps separate sequences per counter name', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      const students = await t.mutation(
        internal.csvImport.internalReserveCounters,
        { requesterId: adminId, name: 'student', count: 2 },
      )
      const catechists = await t.mutation(
        internal.csvImport.internalReserveCounters,
        { requesterId: adminId, name: 'catechist', count: 2 },
      )

      expect(students).toEqual([1, 2])
      expect(catechists).toEqual([1, 2])
    })

    test('returns an empty array and does not create a counter when count is 0', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      const seqs = await t.mutation(
        internal.csvImport.internalReserveCounters,
        {
          requesterId: adminId,
          name: 'student',
          count: 0,
        },
      )

      expect(seqs).toEqual([])

      await t.run(async (ctx) => {
        const counter = await ctx.db
          .query('counters')
          .withIndex('by_name', (q) => q.eq('name', 'student'))
          .unique()
        expect(counter).toBeNull()
      })
    })
  })

  describe('checkDuplicates', () => {
    test('returns only matching names, case-insensitively', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      await t.mutation(internal.csvImport.internalBulkImportStudentsBatch, {
        requesterId: adminId,
        records: [
          {
            fullName: 'Nguyen Van A',
            studentCode: '1',
            passwordHash: 'hashed-password-1',
          },
          {
            fullName: 'Tran Thi B',
            studentCode: '2',
            passwordHash: 'hashed-password-2',
          },
        ],
      })

      const matches = await t.query(api.csvImport.checkDuplicates, {
        requesterId: adminId,
        target: 'students',
        names: ['nguyen van a', 'Non Existent Name'],
      })

      expect(matches).toHaveLength(1)
      expect(matches[0].fullName).toBe('Nguyen Van A')
    })

    test('returns matches for catechists target', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      await t.mutation(internal.csvImport.internalBulkImportCatechistsBatch, {
        requesterId: adminId,
        records: [
          {
            fullName: 'Le Van D',
            memberId: '1',
            passwordHash: 'hashed-password-1',
          },
        ],
      })

      const matches = await t.query(api.csvImport.checkDuplicates, {
        requesterId: adminId,
        target: 'catechists',
        names: ['LE VAN D'],
      })

      expect(matches).toHaveLength(1)
      expect(matches[0].fullName).toBe('Le Van D')
    })

    test('returns empty array when no names match', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      const matches = await t.query(api.csvImport.checkDuplicates, {
        requesterId: adminId,
        target: 'students',
        names: ['Nobody Here'],
      })

      expect(matches).toHaveLength(0)
    })
  })
})
