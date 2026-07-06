/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test, vi } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import * as passwordLib from './lib/password'
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
          records: [{ fullName: 'Student 1' }],
        }),
      ).rejects.toThrow('Unauthorized')
    })

    test('bulkImportCatechists throws Unauthorized for non-admin requester', async () => {
      const t = convexTest(schema, modules)
      const nonAdminId = await seedNonAdmin(t)

      await expect(
        t.mutation(internal.csvImport.internalBulkImportCatechistsBatch, {
          requesterId: nonAdminId,
          records: [{ fullName: 'Catechist 1' }],
        }),
      ).rejects.toThrow('Unauthorized')
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
      ).rejects.toThrow('Unauthorized')
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
              guardian: {
                fullName: 'Nguyen Van B',
                saintName: 'Paul',
                relationship: 'father',
                phone: '+84901234567',
                email: 'guardian@example.com',
              },
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
          records: [{ fullName: 'Solo Student' }],
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
              guardian: {
                fullName: 'Guardian Email Only',
                relationship: 'mother',
                email: 'onlyemail@example.com',
              },
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

    test('one bad record fails while the other succeeds in the same batch', async () => {
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
        const results = await t.mutation(
          internal.csvImport.internalBulkImportStudentsBatch,
          {
            requesterId: adminId,
            records: [
              { fullName: 'Good Student' },
              { fullName: 'Bad Student' },
            ],
          },
        )

        expect(results).toHaveLength(2)
        expect(results[0].status).toBe('ok')
        expect(results[1].status).toBe('error')
        if (results[1].status === 'error') {
          expect(results[1].error).toContain('Simulated hash failure')
        }
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
          records: [{ fullName: 'No Contact Catechist' }],
        },
      )

      expect(results[0].status).toBe('ok')
    })

    test('one bad record fails while the other succeeds in the same batch', async () => {
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
        const results = await t.mutation(
          internal.csvImport.internalBulkImportCatechistsBatch,
          {
            requesterId: adminId,
            records: [
              { fullName: 'Good Catechist' },
              { fullName: 'Bad Catechist' },
            ],
          },
        )

        expect(results).toHaveLength(2)
        expect(results[0].status).toBe('ok')
        expect(results[1].status).toBe('error')
        if (results[1].status === 'error') {
          expect(results[1].error).toContain('Simulated hash failure')
        }
      } finally {
        spy.mockRestore()
      }
    })
  })

  describe('checkDuplicates', () => {
    test('returns only matching names, case-insensitively', async () => {
      const t = convexTest(schema, modules)
      const adminId = await seedAdmin(t)

      await t.mutation(internal.csvImport.internalBulkImportStudentsBatch, {
        requesterId: adminId,
        records: [{ fullName: 'Nguyen Van A' }, { fullName: 'Tran Thi B' }],
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
        records: [{ fullName: 'Le Van D' }],
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
