/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { ENROLLMENT_ERRORS, STUDENT_ERRORS } from './lib/errors'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

describe('students backend functions', () => {
  test('list query', async () => {
    const t = convexTest(schema, modules)

    const catechistId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV001',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    await t.mutation(api.students.create, {
      requesterId: catechistId,
      fullName: 'Student 1',
    })

    const s2Id = await t.mutation(api.students.create, {
      requesterId: catechistId,
      fullName: 'Student 2',
    })
    await t.mutation(api.students.update, {
      requesterId: catechistId,
      studentId: s2Id,
      isActive: false,
    })

    const listRes = await t.query(api.students.list, {
      requesterId: catechistId,
      paginationOpts: { numItems: 10, cursor: null },
    })

    expect(listRes.page).toHaveLength(2)

    const listActive = await t.query(api.students.list, {
      requesterId: catechistId,
      paginationOpts: { numItems: 10, cursor: null },
      isActive: true,
    })

    expect(listActive.page).toHaveLength(1)
    expect(listActive.page[0].fullName).toBe('Student 1')
  })

  test('get query', async () => {
    const t = convexTest(schema, modules)

    const catechistId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV001',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const studentId = await t.mutation(api.students.create, {
      requesterId: catechistId,
      fullName: 'Student 1',
    })

    const student = await t.query(api.students.get, {
      requesterId: catechistId,
      id: studentId,
    })

    expect(student).not.toBeNull()
    expect(student?.fullName).toBe('Student 1')
    expect(student?.address).toBeNull()
    expect(student?.guardians).toEqual([])

    await t.mutation(api.students.softDelete, {
      requesterId: catechistId,
      studentId,
    })

    const deletedStudent = await t.query(api.students.get, {
      requesterId: catechistId,
      id: studentId,
    })

    expect(deletedStudent).toBeNull()

    // Non-existent id
    const fakeId = await t.run(async (ctx) => {
      return ctx.db.insert('students', {
        studentCode: '999',
        fullName: 'Fake',
        isActive: true,
        isDeleted: false,
        createdAt: Date.now(),
      })
    })
    await t.run(async (ctx) => {
      await ctx.db.patch('students', fakeId, { isDeleted: true })
    })

    const nonExistent = await t.query(api.students.get, {
      requesterId: catechistId,
      id: fakeId,
    })

    expect(nonExistent).toBeNull()
  })

  test('create mutation', async () => {
    const t = convexTest(schema, modules)

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV001',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV002',
        fullName: 'User',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    })

    const student1Id = await t.mutation(api.students.create, {
      requesterId: adminId,
      fullName: 'Student 1',
      dateOfBirth: '2010-01-01',
      gender: 'male',
    })

    const student2Id = await t.mutation(api.students.create, {
      requesterId: adminId,
      fullName: 'Student 2',
    })

    const s1 = await t.query(api.students.get, {
      requesterId: adminId,
      id: student1Id,
    })
    const s2 = await t.query(api.students.get, {
      requesterId: adminId,
      id: student2Id,
    })

    expect(s1?.studentCode).toBe('1')
    expect(s2?.studentCode).toBe('2')
    expect(s1?.dateOfBirth).toBe('2010-01-01')
    expect(s1?.gender).toBe('male')
    expect(s1?.isActive).toBe(true)
    expect(s1?.isDeleted).toBe(false)
    expect(s1?.createdAt).toBeDefined()

    await expect(
      t.mutation(api.students.create, {
        requesterId: userId,
        fullName: 'Student 3',
      }),
    ).rejects.toThrow()
  })

  test('update mutation', async () => {
    const t = convexTest(schema, modules)

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV001',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const studentId = await t.mutation(api.students.create, {
      requesterId: adminId,
      fullName: 'Student 1',
    })

    await t.mutation(api.students.update, {
      requesterId: adminId,
      studentId,
      fullName: 'Student 1 Updated',
      isActive: false,
    })

    const updated = await t.query(api.students.get, {
      requesterId: adminId,
      id: studentId,
    })
    expect(updated?.fullName).toBe('Student 1 Updated')
    expect(updated?.isActive).toBe(false)

    // Soft deleted update should fail
    await t.mutation(api.students.softDelete, {
      requesterId: adminId,
      studentId,
    })

    await expect(
      t.mutation(api.students.update, {
        requesterId: adminId,
        studentId,
        fullName: 'Student 1 Updated Again',
      }),
    ).rejects.toThrow(STUDENT_ERRORS.NOT_FOUND)
  })

  test('softDelete mutation', async () => {
    const t = convexTest(schema, modules)

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV001',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const studentId = await t.mutation(api.students.create, {
      requesterId: adminId,
      fullName: 'Student 1',
    })

    const academicYearId = await t.run(async (ctx) => {
      return await ctx.db.insert('academicYears', {
        name: '2023-2024',
        startDate: '2023-09-01',
        endDate: '2024-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: true,
        isDeleted: false,
      })
    })

    const branchId = await t.run(async (ctx) => {
      return await ctx.db.insert('branches', {
        name: 'Branch 1',
        sortOrder: 1,
        isDeleted: false,
      })
    })

    const classId = await t.run(async (ctx) => {
      return await ctx.db.insert('classes', {
        branchId,
        name: 'Class 1',
        isDeleted: false,
      })
    })

    const classYearId = await t.run(async (ctx) => {
      return await ctx.db.insert('classYears', {
        classId,
        academicYearId,
        isDeleted: false,
      })
    })

    const enrollmentId = await t.run(async (ctx) => {
      return await ctx.db.insert('studentClasses', {
        studentId,
        classYearId,
        isPrimaryClass: true,
        enrolledDate: '2023-01-01',
        status: 'active',
        isDeleted: false,
      })
    })

    // Active enrollment prevents deletion
    await expect(
      t.mutation(api.students.softDelete, {
        requesterId: adminId,
        studentId,
      }),
    ).rejects.toThrow(STUDENT_ERRORS.IN_USE_BY_ENROLLMENT)

    // Withdrawn enrollment allows deletion
    await t.run(async (ctx) => {
      await ctx.db.patch('studentClasses', enrollmentId, {
        status: 'withdrawn',
      })
    })

    await t.mutation(api.students.softDelete, {
      requesterId: adminId,
      studentId,
    })

    const deleted = await t.run(async (ctx) => {
      return await ctx.db.get('students', studentId)
    })
    expect(deleted?.isDeleted).toBe(true)

    // Soft deleted deletion should fail
    await expect(
      t.mutation(api.students.softDelete, {
        requesterId: adminId,
        studentId,
      }),
    ).rejects.toThrow(STUDENT_ERRORS.NOT_FOUND)
  })

  describe('StudentAddress mutations', () => {
    test('upsertStudentAddress and getStudentAddress', async () => {
      const t = convexTest(schema, modules)
      const adminId = await t.run(async (ctx) => {
        return await ctx.db.insert('catechists', {
          memberId: 'GLV001',
          fullName: 'Admin',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
      })
      const studentId = await t.mutation(api.students.create, {
        requesterId: adminId,
        fullName: 'Student 1',
      })

      // 1. getStudentAddress returns null when no address
      const addr1 = await t.query(api.students.getStudentAddress, {
        requesterId: adminId,
        studentId,
      })
      expect(addr1).toBeNull()

      // 2. upsertStudentAddress creates address
      await t.mutation(api.students.upsertStudentAddress, {
        requesterId: adminId,
        studentId,
        country: 'VN',
        city: 'Ho Chi Minh',
      })
      const addr2 = await t.query(api.students.getStudentAddress, {
        requesterId: adminId,
        studentId,
      })
      expect(addr2).not.toBeNull()
      expect(addr2?.country).toBe('VN')
      expect(addr2?.city).toBe('Ho Chi Minh')

      // 3. upsertStudentAddress again updates
      await t.mutation(api.students.upsertStudentAddress, {
        requesterId: adminId,
        studentId,
        country: 'VN',
        city: 'Hanoi',
      })
      const addr3 = await t.query(api.students.getStudentAddress, {
        requesterId: adminId,
        studentId,
      })
      expect(addr3?.city).toBe('Hanoi')
      expect(addr3?._id).toBe(addr2?._id)

      // Test student get returns address
      const student = await t.query(api.students.get, {
        requesterId: adminId,
        id: studentId,
      })
      expect(student?.address?.city).toBe('Hanoi')

      // 4. softDeleteStudentAddress
      await t.mutation(api.students.softDeleteStudentAddress, {
        requesterId: adminId,
        studentId,
      })
      const deletedAddr = await t.run(async (ctx) => {
        return await ctx.db.get('studentAddresses', addr3!._id)
      })
      expect(deletedAddr?.isDeleted).toBe(true)

      // 5. softDelete on already deleted throws
      await expect(
        t.mutation(api.students.softDeleteStudentAddress, {
          requesterId: adminId,
          studentId,
        }),
      ).rejects.toThrow(STUDENT_ERRORS.ADDRESS_NOT_FOUND)
    })

    test('upsertStudentAddress unauthorized', async () => {
      const t = convexTest(schema, modules)
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert('catechists', {
          memberId: 'GLV002',
          fullName: 'User',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
      })
      const studentId = await t.run(async (ctx) => {
        return await ctx.db.insert('students', {
          studentCode: '1',
          fullName: 'Student 1',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        })
      })

      await expect(
        t.mutation(api.students.upsertStudentAddress, {
          requesterId: userId,
          studentId,
          country: 'VN',
        }),
      ).rejects.toThrow()
    })
  })

  test('getStudentDetail query', async () => {
    const t = convexTest(schema, modules)

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV001',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const studentId = await t.mutation(api.students.create, {
      requesterId: adminId,
      fullName: 'John Doe',
      dateOfBirth: '2012-05-15',
      gender: 'male',
    })

    // Create address
    await t.mutation(api.students.upsertStudentAddress, {
      requesterId: adminId,
      studentId,
      country: 'VN',
      city: 'Ho Chi Minh',
      addressLine1: '123 Main St',
    })

    // Create sacraments
    await t.run(async (ctx) => {
      await ctx.db.insert('studentSacraments', {
        studentId,
        sacramentType: 'baptism',
        receivedDate: '2012-06-01',
        receivedPlace: 'St. Peter Church',
        isDeleted: false,
      })
      await ctx.db.insert('studentSacraments', {
        studentId,
        sacramentType: 'first_communion',
        receivedDate: '2020-05-10',
        receivedPlace: 'St. Peter Church',
        isDeleted: false,
      })
    })

    // Create enrollment data
    const academicYearId = await t.run(async (ctx) => {
      return await ctx.db.insert('academicYears', {
        name: '2024-2025',
        startDate: '2024-09-01',
        endDate: '2025-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: true,
        isDeleted: false,
      })
    })

    const branchId = await t.run(async (ctx) => {
      return await ctx.db.insert('branches', {
        name: 'Branch A',
        sortOrder: 1,
        isDeleted: false,
      })
    })

    const classId = await t.run(async (ctx) => {
      return await ctx.db.insert('classes', {
        branchId,
        name: 'Au Nhi 1',
        isDeleted: false,
      })
    })

    const classYearId = await t.run(async (ctx) => {
      return await ctx.db.insert('classYears', {
        classId,
        academicYearId,
        isDeleted: false,
      })
    })

    await t.run(async (ctx) => {
      await ctx.db.insert('studentClasses', {
        studentId,
        classYearId,
        isPrimaryClass: true,
        enrolledDate: '2024-09-01',
        status: 'active',
        isDeleted: false,
      })
    })

    // Call getStudentDetail
    const detail = await t.query(api.students.getStudentDetail, {
      requesterId: adminId,
      studentId,
    })

    expect(detail).not.toBeNull()
    expect(detail?.fullName).toBe('John Doe')
    expect(detail?.address).not.toBeNull()
    expect(detail?.address?.city).toBe('Ho Chi Minh')
    expect(detail?.sacraments).toHaveLength(2)
    expect(detail?.sacraments[0].sacramentType).toBe('baptism')
    expect(detail?.enrollments).toHaveLength(1)
    expect(detail?.enrollments[0].classYear.className).toBe('Au Nhi 1')
    expect(detail?.enrollments[0].classYear.academicYearName).toBe('2024-2025')

    // Test non-existent student
    const fakeId = await t.run(async (ctx) => {
      return ctx.db.insert('students', {
        studentCode: '999',
        fullName: 'Fake',
        isActive: true,
        isDeleted: false,
        createdAt: Date.now(),
      })
    })
    await t.run(async (ctx) => {
      await ctx.db.patch('students', fakeId, { isDeleted: true })
    })

    const nonExistent = await t.query(api.students.getStudentDetail, {
      requesterId: adminId,
      studentId: fakeId,
    })
    expect(nonExistent).toBeNull()
  })

  describe('upsertStudentSacrament mutation', () => {
    test('inserts a new sacrament record', async () => {
      const t = convexTest(schema, modules)
      const adminId = await t.run(async (ctx) => {
        return await ctx.db.insert('catechists', {
          memberId: 'GLV001',
          fullName: 'Admin',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
      })
      const studentId = await t.mutation(api.students.create, {
        requesterId: adminId,
        fullName: 'Student 1',
      })

      const sacramentId = await t.mutation(
        api.students.upsertStudentSacrament,
        {
          requesterId: adminId,
          studentId,
          sacramentType: 'baptism',
          receivedDate: '2015-06-01',
          receivedPlace: 'St. Mary Church',
        },
      )

      expect(sacramentId).toBeDefined()

      const record = await t.run(async (ctx) => {
        return await ctx.db.get('studentSacraments', sacramentId)
      })
      expect(record?.sacramentType).toBe('baptism')
      expect(record?.receivedDate).toBe('2015-06-01')
      expect(record?.receivedPlace).toBe('St. Mary Church')
      expect(record?.isDeleted).toBe(false)
    })

    test('patches an existing non-deleted sacrament record', async () => {
      const t = convexTest(schema, modules)
      const adminId = await t.run(async (ctx) => {
        return await ctx.db.insert('catechists', {
          memberId: 'GLV001',
          fullName: 'Admin',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
      })
      const studentId = await t.mutation(api.students.create, {
        requesterId: adminId,
        fullName: 'Student 1',
      })

      const firstId = await t.mutation(api.students.upsertStudentSacrament, {
        requesterId: adminId,
        studentId,
        sacramentType: 'baptism',
        receivedDate: '2015-06-01',
        receivedPlace: 'Old Church',
      })

      const secondId = await t.mutation(api.students.upsertStudentSacrament, {
        requesterId: adminId,
        studentId,
        sacramentType: 'baptism',
        receivedDate: '2015-06-01',
        receivedPlace: 'New Church',
        notes: 'Updated',
      })

      // Same record id — no new insert
      expect(secondId).toBe(firstId)

      const record = await t.run(async (ctx) => {
        return await ctx.db.get('studentSacraments', firstId)
      })
      expect(record?.receivedPlace).toBe('New Church')
      expect(record?.notes).toBe('Updated')
      expect(record?.isDeleted).toBe(false)
    })

    test('re-activates a previously soft-deleted sacrament record', async () => {
      const t = convexTest(schema, modules)
      const adminId = await t.run(async (ctx) => {
        return await ctx.db.insert('catechists', {
          memberId: 'GLV001',
          fullName: 'Admin',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
      })
      const studentId = await t.mutation(api.students.create, {
        requesterId: adminId,
        fullName: 'Student 1',
      })

      const firstId = await t.mutation(api.students.upsertStudentSacrament, {
        requesterId: adminId,
        studentId,
        sacramentType: 'first_communion',
      })

      // Soft delete it
      await t.mutation(api.students.softDeleteStudentSacrament, {
        requesterId: adminId,
        studentId,
        sacramentType: 'first_communion',
      })

      const afterDelete = await t.run(async (ctx) => {
        return await ctx.db.get('studentSacraments', firstId)
      })
      expect(afterDelete?.isDeleted).toBe(true)

      // Upsert again — should patch isDeleted: false
      const secondId = await t.mutation(api.students.upsertStudentSacrament, {
        requesterId: adminId,
        studentId,
        sacramentType: 'first_communion',
        notes: 'Re-activated',
      })

      expect(secondId).toBe(firstId)
      const reactivated = await t.run(async (ctx) => {
        return await ctx.db.get('studentSacraments', firstId)
      })
      expect(reactivated?.isDeleted).toBe(false)
      expect(reactivated?.notes).toBe('Re-activated')
    })

    test('throws Unauthorized for non-admin requester', async () => {
      const t = convexTest(schema, modules)
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert('catechists', {
          memberId: 'GLV002',
          fullName: 'User',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
      })
      const studentId = await t.run(async (ctx) => {
        return await ctx.db.insert('students', {
          studentCode: '1',
          fullName: 'Student 1',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        })
      })

      await expect(
        t.mutation(api.students.upsertStudentSacrament, {
          requesterId: userId,
          studentId,
          sacramentType: 'baptism',
        }),
      ).rejects.toThrow()
    })
  })

  describe('softDeleteStudentSacrament mutation', () => {
    test('soft deletes an existing sacrament record', async () => {
      const t = convexTest(schema, modules)
      const adminId = await t.run(async (ctx) => {
        return await ctx.db.insert('catechists', {
          memberId: 'GLV001',
          fullName: 'Admin',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
      })
      const studentId = await t.mutation(api.students.create, {
        requesterId: adminId,
        fullName: 'Student 1',
      })

      const sacramentId = await t.mutation(
        api.students.upsertStudentSacrament,
        {
          requesterId: adminId,
          studentId,
          sacramentType: 'confirmation',
          receivedDate: '2020-05-10',
        },
      )

      await t.mutation(api.students.softDeleteStudentSacrament, {
        requesterId: adminId,
        studentId,
        sacramentType: 'confirmation',
      })

      const record = await t.run(async (ctx) => {
        return await ctx.db.get('studentSacraments', sacramentId)
      })
      expect(record?.isDeleted).toBe(true)
    })

    test('no-ops if sacrament record does not exist', async () => {
      const t = convexTest(schema, modules)
      const adminId = await t.run(async (ctx) => {
        return await ctx.db.insert('catechists', {
          memberId: 'GLV001',
          fullName: 'Admin',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
      })
      const studentId = await t.mutation(api.students.create, {
        requesterId: adminId,
        fullName: 'Student 1',
      })

      // No sacrament inserted — should not throw
      await expect(
        t.mutation(api.students.softDeleteStudentSacrament, {
          requesterId: adminId,
          studentId,
          sacramentType: 'first_confession',
        }),
      ).resolves.not.toThrow()
    })

    test('no-ops if sacrament record is already deleted', async () => {
      const t = convexTest(schema, modules)
      const adminId = await t.run(async (ctx) => {
        return await ctx.db.insert('catechists', {
          memberId: 'GLV001',
          fullName: 'Admin',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
      })
      const studentId = await t.mutation(api.students.create, {
        requesterId: adminId,
        fullName: 'Student 1',
      })

      await t.mutation(api.students.upsertStudentSacrament, {
        requesterId: adminId,
        studentId,
        sacramentType: 'baptism',
      })
      await t.mutation(api.students.softDeleteStudentSacrament, {
        requesterId: adminId,
        studentId,
        sacramentType: 'baptism',
      })

      // Second delete — should be a no-op, not throw
      await expect(
        t.mutation(api.students.softDeleteStudentSacrament, {
          requesterId: adminId,
          studentId,
          sacramentType: 'baptism',
        }),
      ).resolves.not.toThrow()
    })

    test('throws Unauthorized for non-admin requester', async () => {
      const t = convexTest(schema, modules)
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert('catechists', {
          memberId: 'GLV002',
          fullName: 'User',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
      })
      const studentId = await t.run(async (ctx) => {
        return await ctx.db.insert('students', {
          studentCode: '1',
          fullName: 'Student 1',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        })
      })

      await expect(
        t.mutation(api.students.softDeleteStudentSacrament, {
          requesterId: userId,
          studentId,
          sacramentType: 'baptism',
        }),
      ).rejects.toThrow()
    })
  })

  describe('enrollStudentInClass mutation', () => {
    async function setupEnrollmentFixture(t: ReturnType<typeof convexTest>) {
      const adminId = await t.run(async (ctx) => {
        return await ctx.db.insert('catechists', {
          memberId: 'GLV001',
          fullName: 'Admin',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
      })

      const studentId = await t.mutation(api.students.create, {
        requesterId: adminId,
        fullName: 'Student Enroll',
      })

      const academicYearId = await t.run(async (ctx) => {
        return await ctx.db.insert('academicYears', {
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-05-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
          isDeleted: false,
        })
      })

      const branchId = await t.run(async (ctx) => {
        return await ctx.db.insert('branches', {
          name: 'Branch A',
          sortOrder: 1,
          isDeleted: false,
        })
      })

      const classId = await t.run(async (ctx) => {
        return await ctx.db.insert('classes', {
          branchId,
          name: 'Au Nhi 1',
          isDeleted: false,
        })
      })

      const classYearId = await t.run(async (ctx) => {
        return await ctx.db.insert('classYears', {
          academicYearId,
          classId,
          isDeleted: false,
        })
      })

      return {
        adminId,
        studentId,
        academicYearId,
        branchId,
        classId,
        classYearId,
      }
    }

    test('enrolls student in a class year (happy path)', async () => {
      const t = convexTest(schema, modules)
      const { adminId, studentId, classYearId } =
        await setupEnrollmentFixture(t)

      const enrollmentId = await t.mutation(api.students.enrollStudentInClass, {
        requesterId: adminId,
        studentId,
        classYearId,
        enrolledDate: '2024-09-01',
      })

      expect(enrollmentId).toBeDefined()

      const record = await t.run(async (ctx) => {
        return await ctx.db.get('studentClasses', enrollmentId)
      })
      expect(record?.status).toBe('active')
      expect(record?.isPrimaryClass).toBe(true)
      expect(record?.isDeleted).toBe(false)
      expect(record?.enrolledDate).toBe('2024-09-01')
    })

    test('throws on duplicate active enrollment in same class year', async () => {
      const t = convexTest(schema, modules)
      const { adminId, studentId, classYearId } =
        await setupEnrollmentFixture(t)

      await t.mutation(api.students.enrollStudentInClass, {
        requesterId: adminId,
        studentId,
        classYearId,
        enrolledDate: '2024-09-01',
      })

      await expect(
        t.mutation(api.students.enrollStudentInClass, {
          requesterId: adminId,
          studentId,
          classYearId,
          enrolledDate: '2024-09-01',
        }),
      ).rejects.toThrow(ENROLLMENT_ERRORS.ALREADY_ENROLLED)
    })

    test('re-activates a soft-deleted enrollment record', async () => {
      const t = convexTest(schema, modules)
      const { adminId, studentId, classYearId } =
        await setupEnrollmentFixture(t)

      const firstId = await t.mutation(api.students.enrollStudentInClass, {
        requesterId: adminId,
        studentId,
        classYearId,
        enrolledDate: '2024-09-01',
      })

      // Soft delete the enrollment
      await t.run(async (ctx) => {
        await ctx.db.patch('studentClasses', firstId, { isDeleted: true })
      })

      // Re-enroll — should re-activate
      const secondId = await t.mutation(api.students.enrollStudentInClass, {
        requesterId: adminId,
        studentId,
        classYearId,
        enrolledDate: '2024-09-15',
      })

      expect(secondId).toBe(firstId)

      const record = await t.run(async (ctx) => {
        return await ctx.db.get('studentClasses', firstId)
      })
      expect(record?.isDeleted).toBe(false)
      expect(record?.status).toBe('active')
      expect(record?.enrolledDate).toBe('2024-09-15')
    })

    test('re-activates a withdrawn enrollment record', async () => {
      const t = convexTest(schema, modules)
      const { adminId, studentId, classYearId } =
        await setupEnrollmentFixture(t)

      const firstId = await t.mutation(api.students.enrollStudentInClass, {
        requesterId: adminId,
        studentId,
        classYearId,
        enrolledDate: '2024-09-01',
      })

      // Withdraw the enrollment
      await t.run(async (ctx) => {
        await ctx.db.patch('studentClasses', firstId, { status: 'withdrawn' })
      })

      // Re-enroll — should re-activate
      const secondId = await t.mutation(api.students.enrollStudentInClass, {
        requesterId: adminId,
        studentId,
        classYearId,
        enrolledDate: '2024-09-20',
      })

      expect(secondId).toBe(firstId)

      const record = await t.run(async (ctx) => {
        return await ctx.db.get('studentClasses', firstId)
      })
      expect(record?.status).toBe('active')
      expect(record?.isDeleted).toBe(false)
    })

    test('throws on primary class conflict for same academic year', async () => {
      const t = convexTest(schema, modules)
      const { adminId, studentId, academicYearId, branchId, classYearId } =
        await setupEnrollmentFixture(t)

      // Enroll in the first class year
      await t.mutation(api.students.enrollStudentInClass, {
        requesterId: adminId,
        studentId,
        classYearId,
        enrolledDate: '2024-09-01',
      })

      // Create a second class and class year in the same academic year
      const class2Id = await t.run(async (ctx) => {
        return await ctx.db.insert('classes', {
          branchId,
          name: 'Au Nhi 2',
          isDeleted: false,
        })
      })
      const classYear2Id = await t.run(async (ctx) => {
        return await ctx.db.insert('classYears', {
          academicYearId,
          classId: class2Id,
          isDeleted: false,
        })
      })

      await expect(
        t.mutation(api.students.enrollStudentInClass, {
          requesterId: adminId,
          studentId,
          classYearId: classYear2Id,
          enrolledDate: '2024-09-01',
        }),
      ).rejects.toThrow(ENROLLMENT_ERRORS.PRIMARY_CLASS_CONFLICT)
    })

    test('throws Unauthorized for non-admin requester', async () => {
      const t = convexTest(schema, modules)
      const { classYearId } = await setupEnrollmentFixture(t)

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert('catechists', {
          memberId: 'GLV099',
          fullName: 'User',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
      })
      const studentId = await t.run(async (ctx) => {
        return await ctx.db.insert('students', {
          studentCode: '99',
          fullName: 'Other Student',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        })
      })

      await expect(
        t.mutation(api.students.enrollStudentInClass, {
          requesterId: userId,
          studentId,
          classYearId,
          enrolledDate: '2024-09-01',
        }),
      ).rejects.toThrow()
    })
  })

  describe('enrollStudents mutation', () => {
    async function setupFixture(t: ReturnType<typeof convexTest>) {
      const adminId = await t.run(async (ctx) => {
        return await ctx.db.insert('catechists', {
          memberId: 'GLV001',
          fullName: 'Admin',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
      })

      const academicYearId = await t.run(async (ctx) => {
        return await ctx.db.insert('academicYears', {
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-05-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
          isDeleted: false,
        })
      })

      const branchId = await t.run(async (ctx) => {
        return await ctx.db.insert('branches', {
          name: 'Branch A',
          sortOrder: 1,
          isDeleted: false,
        })
      })

      const classId = await t.run(async (ctx) => {
        return await ctx.db.insert('classes', {
          branchId,
          name: 'Au Nhi 1',
          isDeleted: false,
        })
      })

      const classYearId = await t.run(async (ctx) => {
        return await ctx.db.insert('classYears', {
          academicYearId,
          classId,
          isDeleted: false,
        })
      })

      return { adminId, academicYearId, branchId, classId, classYearId }
    }

    async function makeStudent(
      t: ReturnType<typeof convexTest>,
      adminId: Id<'catechists'>,
      fullName: string,
    ) {
      return await t.mutation(api.students.create, {
        requesterId: adminId,
        fullName,
      })
    }

    async function makeCatechist(
      t: ReturnType<typeof convexTest>,
      memberId: string,
      fullName: string,
    ) {
      return await t.run(async (ctx) => {
        return await ctx.db.insert('catechists', {
          memberId,
          fullName,
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
      })
    }

    describe('permission assertions', () => {
      test('admin is allowed', async () => {
        const t = convexTest(schema, modules)
        const { adminId, classYearId } = await setupFixture(t)
        const studentId = await makeStudent(t, adminId, 'Student A')

        await expect(
          t.mutation(api.students.enrollStudents, {
            requesterId: adminId,
            studentIds: [studentId],
            classYearId,
            isPrimaryClass: true,
            enrolledDate: '2024-09-01',
          }),
        ).resolves.toBeDefined()
      })

      test('board_member is allowed', async () => {
        const t = convexTest(schema, modules)
        const { adminId, academicYearId, classYearId } = await setupFixture(t)
        const studentId = await makeStudent(t, adminId, 'Student A')
        const boardMemberId = await makeCatechist(t, 'GLV010', 'Board Member')

        await t.run(async (ctx) => {
          await ctx.db.insert('academicYearAssignments', {
            academicYearId,
            catechistId: boardMemberId,
            assignmentType: 'board_member',
            isDeleted: false,
          })
        })

        await expect(
          t.mutation(api.students.enrollStudents, {
            requesterId: boardMemberId,
            studentIds: [studentId],
            classYearId,
            isPrimaryClass: true,
            enrolledDate: '2024-09-01',
          }),
        ).resolves.toBeDefined()
      })

      test('branch_head of class branch is allowed', async () => {
        const t = convexTest(schema, modules)
        const { adminId, academicYearId, branchId, classYearId } =
          await setupFixture(t)
        const studentId = await makeStudent(t, adminId, 'Student A')
        const branchHeadId = await makeCatechist(t, 'GLV011', 'Branch Head')

        await t.run(async (ctx) => {
          await ctx.db.insert('branchAssignments', {
            academicYearId,
            catechistId: branchHeadId,
            branchId,
            isDeleted: false,
          })
        })

        await expect(
          t.mutation(api.students.enrollStudents, {
            requesterId: branchHeadId,
            studentIds: [studentId],
            classYearId,
            isPrimaryClass: true,
            enrolledDate: '2024-09-01',
          }),
        ).resolves.toBeDefined()
      })

      test('homeroom teacher of class year is allowed', async () => {
        const t = convexTest(schema, modules)
        const { adminId, academicYearId, classYearId } = await setupFixture(t)
        const studentId = await makeStudent(t, adminId, 'Student A')
        const homeroomId = await makeCatechist(t, 'GLV012', 'Homeroom')

        await t.run(async (ctx) => {
          await ctx.db.insert('classCatechists', {
            catechistId: homeroomId,
            classYearId,
            academicYearId,
            role: 'homeroom',
            isDeleted: false,
          })
        })

        await expect(
          t.mutation(api.students.enrollStudents, {
            requesterId: homeroomId,
            studentIds: [studentId],
            classYearId,
            isPrimaryClass: true,
            enrolledDate: '2024-09-01',
          }),
        ).resolves.toBeDefined()
      })

      test('co_teacher of class year is allowed', async () => {
        const t = convexTest(schema, modules)
        const { adminId, academicYearId, classYearId } = await setupFixture(t)
        const studentId = await makeStudent(t, adminId, 'Student A')
        const coTeacherId = await makeCatechist(t, 'GLV013', 'Co Teacher')

        await t.run(async (ctx) => {
          await ctx.db.insert('classCatechists', {
            catechistId: coTeacherId,
            classYearId,
            academicYearId,
            role: 'co_teacher',
            isDeleted: false,
          })
        })

        await expect(
          t.mutation(api.students.enrollStudents, {
            requesterId: coTeacherId,
            studentIds: [studentId],
            classYearId,
            isPrimaryClass: true,
            enrolledDate: '2024-09-01',
          }),
        ).resolves.toBeDefined()
      })

      test('other catechists with no assignment are rejected', async () => {
        const t = convexTest(schema, modules)
        const { adminId, classYearId } = await setupFixture(t)
        const studentId = await makeStudent(t, adminId, 'Student A')
        const otherId = await makeCatechist(t, 'GLV014', 'Other')

        await expect(
          t.mutation(api.students.enrollStudents, {
            requesterId: otherId,
            studentIds: [studentId],
            classYearId,
            isPrimaryClass: true,
            enrolledDate: '2024-09-01',
          }),
        ).rejects.toThrow(ENROLLMENT_ERRORS.UNAUTHORIZED)
      })
    })

    describe('active academic year', () => {
      test('enrollment succeeds when academic year is active', async () => {
        const t = convexTest(schema, modules)
        const { adminId, classYearId } = await setupFixture(t)
        const studentId = await makeStudent(t, adminId, 'Student A')

        await expect(
          t.mutation(api.students.enrollStudents, {
            requesterId: adminId,
            studentIds: [studentId],
            classYearId,
            isPrimaryClass: true,
            enrolledDate: '2024-09-01',
          }),
        ).resolves.toBeDefined()
      })

      test('enrollment throws when academic year is inactive', async () => {
        const t = convexTest(schema, modules)
        const { adminId, academicYearId, classYearId } = await setupFixture(t)
        const studentId = await makeStudent(t, adminId, 'Student A')

        await t.run(async (ctx) => {
          await ctx.db.patch('academicYears', academicYearId, {
            isActive: false,
          })
        })

        await expect(
          t.mutation(api.students.enrollStudents, {
            requesterId: adminId,
            studentIds: [studentId],
            classYearId,
            isPrimaryClass: true,
            enrolledDate: '2024-09-01',
          }),
        ).rejects.toThrow(ENROLLMENT_ERRORS.ACADEMIC_YEAR_NOT_ACTIVE)
      })
    })

    describe('primary class constraints', () => {
      test('enroll student into a primary class succeeds', async () => {
        const t = convexTest(schema, modules)
        const { adminId, classYearId } = await setupFixture(t)
        const studentId = await makeStudent(t, adminId, 'Student A')

        const ids = await t.mutation(api.students.enrollStudents, {
          requesterId: adminId,
          studentIds: [studentId],
          classYearId,
          isPrimaryClass: true,
          enrolledDate: '2024-09-01',
        })
        expect(ids).toHaveLength(1)

        const record = await t.run(async (ctx) => {
          return await ctx.db.get('studentClasses', ids[0])
        })
        expect(record?.isPrimaryClass).toBe(true)
      })

      test('enroll student into a supplemental class succeeds', async () => {
        const t = convexTest(schema, modules)
        const { adminId, classYearId } = await setupFixture(t)
        const studentId = await makeStudent(t, adminId, 'Student A')

        const ids = await t.mutation(api.students.enrollStudents, {
          requesterId: adminId,
          studentIds: [studentId],
          classYearId,
          isPrimaryClass: false,
          enrolledDate: '2024-09-01',
        })
        expect(ids).toHaveLength(1)

        const record = await t.run(async (ctx) => {
          return await ctx.db.get('studentClasses', ids[0])
        })
        expect(record?.isPrimaryClass).toBe(false)
      })

      test('second primary class in same AY throws conflict', async () => {
        const t = convexTest(schema, modules)
        const { adminId, academicYearId, branchId, classYearId } =
          await setupFixture(t)
        const studentId = await makeStudent(t, adminId, 'Student A')

        await t.mutation(api.students.enrollStudents, {
          requesterId: adminId,
          studentIds: [studentId],
          classYearId,
          isPrimaryClass: true,
          enrolledDate: '2024-09-01',
        })

        const class2Id = await t.run(async (ctx) => {
          return await ctx.db.insert('classes', {
            branchId,
            name: 'Au Nhi 2',
            isDeleted: false,
          })
        })
        const classYear2Id = await t.run(async (ctx) => {
          return await ctx.db.insert('classYears', {
            academicYearId,
            classId: class2Id,
            isDeleted: false,
          })
        })

        await expect(
          t.mutation(api.students.enrollStudents, {
            requesterId: adminId,
            studentIds: [studentId],
            classYearId: classYear2Id,
            isPrimaryClass: true,
            enrolledDate: '2024-09-01',
          }),
        ).rejects.toThrow(ENROLLMENT_ERRORS.PRIMARY_CLASS_CONFLICT)
      })

      test('withdraw from primary then enroll in another primary succeeds', async () => {
        const t = convexTest(schema, modules)
        const { adminId, academicYearId, branchId, classYearId } =
          await setupFixture(t)
        const studentId = await makeStudent(t, adminId, 'Student A')

        const [firstId] = await t.mutation(api.students.enrollStudents, {
          requesterId: adminId,
          studentIds: [studentId],
          classYearId,
          isPrimaryClass: true,
          enrolledDate: '2024-09-01',
        })

        await t.mutation(api.students.updateEnrollmentsStatus, {
          requesterId: adminId,
          studentClassIds: [firstId],
          status: 'withdrawn',
          statusChangedDate: '2024-10-01',
        })

        const class2Id = await t.run(async (ctx) => {
          return await ctx.db.insert('classes', {
            branchId,
            name: 'Au Nhi 2',
            isDeleted: false,
          })
        })
        const classYear2Id = await t.run(async (ctx) => {
          return await ctx.db.insert('classYears', {
            academicYearId,
            classId: class2Id,
            isDeleted: false,
          })
        })

        await expect(
          t.mutation(api.students.enrollStudents, {
            requesterId: adminId,
            studentIds: [studentId],
            classYearId: classYear2Id,
            isPrimaryClass: true,
            enrolledDate: '2024-10-02',
          }),
        ).resolves.toBeDefined()
      })

      test('on_leave in primary then enroll in another primary throws conflict', async () => {
        const t = convexTest(schema, modules)
        const { adminId, academicYearId, branchId, classYearId } =
          await setupFixture(t)
        const studentId = await makeStudent(t, adminId, 'Student A')

        const [firstId] = await t.mutation(api.students.enrollStudents, {
          requesterId: adminId,
          studentIds: [studentId],
          classYearId,
          isPrimaryClass: true,
          enrolledDate: '2024-09-01',
        })

        await t.mutation(api.students.updateEnrollmentsStatus, {
          requesterId: adminId,
          studentClassIds: [firstId],
          status: 'on_leave',
          statusChangedDate: '2024-10-01',
        })

        const class2Id = await t.run(async (ctx) => {
          return await ctx.db.insert('classes', {
            branchId,
            name: 'Au Nhi 2',
            isDeleted: false,
          })
        })
        const classYear2Id = await t.run(async (ctx) => {
          return await ctx.db.insert('classYears', {
            academicYearId,
            classId: class2Id,
            isDeleted: false,
          })
        })

        await expect(
          t.mutation(api.students.enrollStudents, {
            requesterId: adminId,
            studentIds: [studentId],
            classYearId: classYear2Id,
            isPrimaryClass: true,
            enrolledDate: '2024-10-02',
          }),
        ).rejects.toThrow(ENROLLMENT_ERRORS.PRIMARY_CLASS_CONFLICT)
      })
    })

    describe('bulk enrollment', () => {
      test('bulk enrolls multiple students as primary', async () => {
        const t = convexTest(schema, modules)
        const { adminId, classYearId } = await setupFixture(t)
        const student1 = await makeStudent(t, adminId, 'Student A')
        const student2 = await makeStudent(t, adminId, 'Student B')

        const ids = await t.mutation(api.students.enrollStudents, {
          requesterId: adminId,
          studentIds: [student1, student2],
          classYearId,
          isPrimaryClass: true,
          enrolledDate: '2024-09-01',
        })

        expect(ids).toHaveLength(2)
      })

      test('bulk enrolls multiple students as supplemental', async () => {
        const t = convexTest(schema, modules)
        const { adminId, classYearId } = await setupFixture(t)
        const student1 = await makeStudent(t, adminId, 'Student A')
        const student2 = await makeStudent(t, adminId, 'Student B')

        const ids = await t.mutation(api.students.enrollStudents, {
          requesterId: adminId,
          studentIds: [student1, student2],
          classYearId,
          isPrimaryClass: false,
          enrolledDate: '2024-09-01',
        })

        expect(ids).toHaveLength(2)
      })

      test('rolls back all-or-nothing when one student has a conflict', async () => {
        const t = convexTest(schema, modules)
        const { adminId, academicYearId, branchId, classYearId } =
          await setupFixture(t)
        const student1 = await makeStudent(t, adminId, 'Student A')
        const student2 = await makeStudent(t, adminId, 'Student B')

        // student2 already has a primary class in a different classYear of
        // the same academic year, so bulk-enrolling both into classYearId
        // as primary should fail entirely (including student1's insert).
        const class2Id = await t.run(async (ctx) => {
          return await ctx.db.insert('classes', {
            branchId,
            name: 'Au Nhi 2',
            isDeleted: false,
          })
        })
        const classYear2Id = await t.run(async (ctx) => {
          return await ctx.db.insert('classYears', {
            academicYearId,
            classId: class2Id,
            isDeleted: false,
          })
        })

        await t.mutation(api.students.enrollStudents, {
          requesterId: adminId,
          studentIds: [student2],
          classYearId: classYear2Id,
          isPrimaryClass: true,
          enrolledDate: '2024-09-01',
        })

        await expect(
          t.mutation(api.students.enrollStudents, {
            requesterId: adminId,
            studentIds: [student1, student2],
            classYearId,
            isPrimaryClass: true,
            enrolledDate: '2024-09-01',
          }),
        ).rejects.toThrow(ENROLLMENT_ERRORS.PRIMARY_CLASS_CONFLICT)

        // student1 should NOT have been enrolled — mutation is transactional
        const student1Enrollments = await t.run(async (ctx) => {
          return await ctx.db
            .query('studentClasses')
            .withIndex('by_student_id', (q) => q.eq('studentId', student1))
            .collect()
        })
        expect(student1Enrollments).toHaveLength(0)
      })
    })
  })

  describe('updateEnrollmentsStatus mutation', () => {
    async function setupFixture(t: ReturnType<typeof convexTest>) {
      const adminId = await t.run(async (ctx) => {
        return await ctx.db.insert('catechists', {
          memberId: 'GLV001',
          fullName: 'Admin',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
      })

      const academicYearId = await t.run(async (ctx) => {
        return await ctx.db.insert('academicYears', {
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-05-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
          isDeleted: false,
        })
      })

      const branchId = await t.run(async (ctx) => {
        return await ctx.db.insert('branches', {
          name: 'Branch A',
          sortOrder: 1,
          isDeleted: false,
        })
      })

      const classId = await t.run(async (ctx) => {
        return await ctx.db.insert('classes', {
          branchId,
          name: 'Au Nhi 1',
          isDeleted: false,
        })
      })

      const classYearId = await t.run(async (ctx) => {
        return await ctx.db.insert('classYears', {
          academicYearId,
          classId,
          isDeleted: false,
        })
      })

      const studentId = await t.mutation(api.students.create, {
        requesterId: adminId,
        fullName: 'Student A',
      })

      const [studentClassId] = await t.mutation(api.students.enrollStudents, {
        requesterId: adminId,
        studentIds: [studentId],
        classYearId,
        isPrimaryClass: true,
        enrolledDate: '2024-09-01',
      })

      return {
        adminId,
        academicYearId,
        branchId,
        classId,
        classYearId,
        studentId,
        studentClassId,
      }
    }

    test('marks enrollment as on_leave and clears leftDate', async () => {
      const t = convexTest(schema, modules)
      const { adminId, studentClassId } = await setupFixture(t)

      await t.mutation(api.students.updateEnrollmentsStatus, {
        requesterId: adminId,
        studentClassIds: [studentClassId],
        status: 'on_leave',
        statusChangedDate: '2024-10-01',
      })

      const record = await t.run(async (ctx) => {
        return await ctx.db.get('studentClasses', studentClassId)
      })
      expect(record?.status).toBe('on_leave')
      expect(record?.statusChangedDate).toBe('2024-10-01')
      expect(record?.leftDate).toBeUndefined()
    })

    test('marks enrollment as withdrawn and sets leftDate', async () => {
      const t = convexTest(schema, modules)
      const { adminId, studentClassId } = await setupFixture(t)

      await t.mutation(api.students.updateEnrollmentsStatus, {
        requesterId: adminId,
        studentClassIds: [studentClassId],
        status: 'withdrawn',
        statusChangedDate: '2024-11-15',
      })

      const record = await t.run(async (ctx) => {
        return await ctx.db.get('studentClasses', studentClassId)
      })
      expect(record?.status).toBe('withdrawn')
      expect(record?.statusChangedDate).toBe('2024-11-15')
      expect(record?.leftDate).toBe('2024-11-15')
    })

    test('reactivating from withdrawn to active clears leftDate', async () => {
      const t = convexTest(schema, modules)
      const { adminId, studentClassId } = await setupFixture(t)

      await t.mutation(api.students.updateEnrollmentsStatus, {
        requesterId: adminId,
        studentClassIds: [studentClassId],
        status: 'withdrawn',
        statusChangedDate: '2024-11-15',
      })

      await t.mutation(api.students.updateEnrollmentsStatus, {
        requesterId: adminId,
        studentClassIds: [studentClassId],
        status: 'active',
        statusChangedDate: '2024-12-01',
      })

      const record = await t.run(async (ctx) => {
        return await ctx.db.get('studentClasses', studentClassId)
      })
      expect(record?.status).toBe('active')
      expect(record?.statusChangedDate).toBe('2024-12-01')
      expect(record?.leftDate).toBeUndefined()
    })

    test('throws RECORD_NOT_FOUND for deleted studentClass record', async () => {
      const t = convexTest(schema, modules)
      const { adminId, studentClassId } = await setupFixture(t)

      await t.run(async (ctx) => {
        await ctx.db.patch('studentClasses', studentClassId, {
          isDeleted: true,
        })
      })

      await expect(
        t.mutation(api.students.updateEnrollmentsStatus, {
          requesterId: adminId,
          studentClassIds: [studentClassId],
          status: 'withdrawn',
          statusChangedDate: '2024-11-15',
        }),
      ).rejects.toThrow(ENROLLMENT_ERRORS.RECORD_NOT_FOUND)
    })

    test('throws UNAUTHORIZED for a catechist without permission', async () => {
      const t = convexTest(schema, modules)
      const { studentClassId } = await setupFixture(t)

      const otherId = await t.run(async (ctx) => {
        return await ctx.db.insert('catechists', {
          memberId: 'GLV020',
          fullName: 'Other',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
      })

      await expect(
        t.mutation(api.students.updateEnrollmentsStatus, {
          requesterId: otherId,
          studentClassIds: [studentClassId],
          status: 'withdrawn',
          statusChangedDate: '2024-11-15',
        }),
      ).rejects.toThrow(ENROLLMENT_ERRORS.UNAUTHORIZED)
    })

    test('allows status change even when academic year is inactive', async () => {
      const t = convexTest(schema, modules)
      const { adminId, academicYearId, studentClassId } = await setupFixture(t)

      await t.run(async (ctx) => {
        await ctx.db.patch('academicYears', academicYearId, {
          isActive: false,
        })
      })

      await expect(
        t.mutation(api.students.updateEnrollmentsStatus, {
          requesterId: adminId,
          studentClassIds: [studentClassId],
          status: 'withdrawn',
          statusChangedDate: '2024-12-01',
        }),
      ).resolves.not.toThrow()

      const record = await t.run(async (ctx) => {
        return await ctx.db.get('studentClasses', studentClassId)
      })
      expect(record?.status).toBe('withdrawn')
    })

    test('reactivating a withdrawn primary throws conflict when another primary is active', async () => {
      const t = convexTest(schema, modules)
      const { adminId, academicYearId, branchId, studentId, studentClassId } =
        await setupFixture(t)

      // Withdraw the original primary class enrollment.
      await t.mutation(api.students.updateEnrollmentsStatus, {
        requesterId: adminId,
        studentClassIds: [studentClassId],
        status: 'withdrawn',
        statusChangedDate: '2024-10-05',
      })

      // Enroll the student in a second primary class in the same AY.
      const class2Id = await t.run(async (ctx) => {
        return await ctx.db.insert('classes', {
          branchId,
          name: 'Au Nhi 2',
          isDeleted: false,
        })
      })
      const classYear2Id = await t.run(async (ctx) => {
        return await ctx.db.insert('classYears', {
          academicYearId,
          classId: class2Id,
          isDeleted: false,
        })
      })

      await t.mutation(api.students.enrollStudents, {
        requesterId: adminId,
        studentIds: [studentId],
        classYearId: classYear2Id,
        isPrimaryClass: true,
        enrolledDate: '2024-10-06',
      })

      // Reactivating the original withdrawn primary should now conflict,
      // since the second primary class enrollment is active.
      await expect(
        t.mutation(api.students.updateEnrollmentsStatus, {
          requesterId: adminId,
          studentClassIds: [studentClassId],
          status: 'active',
          statusChangedDate: '2024-10-06',
        }),
      ).rejects.toThrow(ENROLLMENT_ERRORS.PRIMARY_CLASS_CONFLICT)
    })
  })

  test('seedSampleStudents mutation', async () => {
    const t = convexTest(schema, modules)

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV001',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const res = await t.mutation(api.seed.seedSampleStudents, {
      requesterId: adminId,
    })
    expect(res).toBeDefined()
    expect(res.studentCode).toBeDefined()
    expect(res.studentId).toBeDefined()

    const detail = await t.query(api.students.getStudentDetail, {
      requesterId: adminId,
      studentId: res.studentId,
    })

    expect(detail).not.toBeNull()
    expect(detail?.fullName).toBe('Maria Nguyễn Thị Hương')
    expect(detail?.address).not.toBeNull()
    expect(detail?.address?.city).toBe('Hồ Chí Minh')
    expect(detail?.sacraments).toHaveLength(2)
    expect(detail?.enrollments).toHaveLength(1)
  })

  test('seedFiftyStudents mutation', async () => {
    const t = convexTest(schema, modules)

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV001',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const res = await t.mutation(api.seed.seedFiftyStudents, {
      requesterId: adminId,
    })
    expect(res).toBeDefined()
    expect(res.studentsSeeded).toBe(50)
    expect(res.familiesSeeded).toBe(35)

    // Verify some students exist in the DB
    const listResult = await t.query(api.students.list, {
      requesterId: adminId,
      paginationOpts: { cursor: null, numItems: 100 },
    })
    expect(listResult.page).toHaveLength(50)

    // Grab a student and check details
    const student = listResult.page[0]
    const detail = await t.query(api.students.getStudentDetail, {
      requesterId: adminId,
      studentId: student._id,
    })
    expect(detail).not.toBeNull()
    expect(detail?.address).not.toBeNull()
    expect(detail?.address?.city).toBe('Hồ Chí Minh')
    expect(detail?.sacraments.length).toBeGreaterThanOrEqual(1) // at least baptism
    expect(detail?.enrollments).toHaveLength(1)
  })

  test('getEligibleForEnrollment query returns active students with enrollment info', async () => {
    const t = convexTest(schema, modules)

    // Create catechist and academic year
    const catechistId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV001',
        fullName: 'Catechist',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const academicYearId = await t.run(async (ctx) => {
      return await ctx.db.insert('academicYears', {
        name: '2024-2025',
        startDate: '2024-09-01',
        endDate: '2025-06-30',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: true,
        isDeleted: false,
      })
    })

    // Create branch and class
    const classId = await t.run(async (ctx) => {
      const branchId = await ctx.db.insert('branches', {
        name: 'Ấu Nhi',
        sortOrder: 2,
        isDeleted: false,
      })
      return await ctx.db.insert('classes', {
        branchId,
        name: 'Ấu Nhi 1',
        isDeleted: false,
      })
    })

    // Create class year
    const classYearId = await t.run(async (ctx) => {
      return await ctx.db.insert('classYears', {
        classId,
        academicYearId,
        isDeleted: false,
      })
    })

    // Create two active students
    const student1Id = await t.mutation(api.students.create, {
      requesterId: catechistId,
      fullName: 'Active Student 1',
    })

    const student2Id = await t.mutation(api.students.create, {
      requesterId: catechistId,
      fullName: 'Active Student 2',
    })

    // Create an inactive student
    const student3Id = await t.mutation(api.students.create, {
      requesterId: catechistId,
      fullName: 'Inactive Student',
    })
    await t.mutation(api.students.update, {
      requesterId: catechistId,
      studentId: student3Id,
      isActive: false,
    })

    // Enroll student 1 in the class (active primary)
    await t.mutation(api.students.enrollStudents, {
      requesterId: catechistId,
      studentIds: [student1Id],
      classYearId,
      isPrimaryClass: true,
      enrolledDate: '2024-09-01',
    })

    // Query eligible students
    const eligibleStudents = await t.query(
      api.students.getEligibleForEnrollment,
      {
        requesterId: catechistId,
        academicYearId,
      },
    )

    // Should return both active students (even if one is enrolled)
    const activeStudents = eligibleStudents.filter(
      (s) => s._id === student1Id || s._id === student2Id,
    )
    expect(activeStudents).toHaveLength(2)

    // Student 1 should have enrollment info
    const student1Result = eligibleStudents.find((s) => s._id === student1Id)
    expect(student1Result?.enrolledClassYearId).toBe(classYearId)
    expect(student1Result?.className).toBe('Ấu Nhi 1')
    expect(student1Result?.isPrimaryClass).toBe(true)
    expect(student1Result?.status).toBe('active')

    // Student 2 should not have enrollment info
    const student2Result = eligibleStudents.find((s) => s._id === student2Id)
    expect(student2Result?.enrolledClassYearId).toBeNull()
    expect(student2Result?.className).toBeNull()
    expect(student2Result?.status).toBeNull()

    // Inactive student should not be in results
    const inactiveStudent = eligibleStudents.find((s) => s._id === student3Id)
    expect(inactiveStudent).toBeUndefined()
  })
})

describe('auto-account creation for students', () => {
  test('create auto-creates an account with loginId STD-<studentCode>', async () => {
    const t = convexTest(schema, modules)
    const adminId = await t.run(async (ctx) => {
      return ctx.db.insert('catechists', {
        memberId: 'ADMIN',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const studentId = await t.mutation(api.students.create, {
      requesterId: adminId,
      fullName: 'New Student',
    })

    const newStudent = await t.run(async (ctx) => ctx.db.get('students', studentId))
    expect(newStudent?.studentCode).toBe('1')

    const account = await t.run(async (ctx) =>
      ctx.db
        .query('accounts')
        .withIndex('by_login_id', (q) => q.eq('loginId', 'STD-1'))
        .unique(),
    )
    expect(account).not.toBeNull()
    expect(account?.loginId).toBe('STD-1')
    expect(account?.accountType).toBe('student')
    expect(account?.userRefId).toBe(studentId)
    expect(account?.isActive).toBe(true)
    expect(account?.isDeleted).toBe(false)
    expect(account?.passwordHash).toMatch(/^\$2/) // bcrypt
  })
})
