/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { STUDENT_ERRORS } from './lib/errors'

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
        academicYearId,
        classId,
        classType: 'primary',
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
        academicYearId,
        classId,
        classType: 'primary',
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
})
