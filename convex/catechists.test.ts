/// <reference types="vite/client" />

import { convexTest } from 'convex-test'
/* eslint-disable no-shadow */
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

describe('catechists backend functions', () => {
  test('profile queries and mutations', async () => {
    const t = convexTest(schema, modules)

    const catechistId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV0001',
        fullName: 'Nguyễn Văn A',
        saintName: 'Giuse',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    })

    const profile = await t.query(api.catechists.getMyProfile, { catechistId })
    expect(profile).toMatchObject({
      fullName: 'Nguyễn Văn A',
      saintName: 'Giuse',
      role: 'user',
    })

    await t.mutation(api.catechists.updateMyProfile, {
      catechistId,
      fullName: 'Nguyễn Văn B',
      saintName: 'Maria',
    })

    const updatedProfile = await t.query(api.catechists.getMyProfile, {
      catechistId,
    })
    expect(updatedProfile?.fullName).toBe('Nguyễn Văn B')
    expect(updatedProfile?.saintName).toBe('Maria')
  })

  test('profile update with new fields', async () => {
    const t = convexTest(schema, modules)

    const catechistId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV1001',
        fullName: 'Trần Văn X',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    })

    await t.mutation(api.catechists.updateMyProfile, {
      catechistId,
      fullName: 'Trần Văn X',
      title: 'Cha',
      community: 'Dòng Chúa Cứu Thế',
      level: '1',
    })

    const profile = await t.query(api.catechists.getMyProfile, { catechistId })
    expect(profile?.title).toBe('Cha')
    expect(profile?.community).toBe('Dòng Chúa Cứu Thế')
    expect(profile?.level).toBe('1')

    await t.mutation(api.catechists.updateMyProfile, {
      catechistId,
      fullName: 'Trần Văn X',
      title: '',
      community: '',
      level: '',
    })
    const updated = await t.query(api.catechists.getMyProfile, { catechistId })
    expect(updated?.title).toBe('')
    expect(updated?.community).toBe('')
    expect(updated?.level).toBe('')
  })

  test('profile photo field mutations', async () => {
    const t = convexTest(schema, modules)

    const catechistId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV1002',
        fullName: 'Nguyễn Văn P',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    })

    const profile = await t.query(api.catechists.getMyProfile, { catechistId })
    expect(profile?.profilePhotoStorageId).toBeUndefined()

    await t.run(async (ctx) => {
      await ctx.db.patch('catechists', catechistId, {
        profilePhotoStorageId: undefined,
      })
    })

    const updated = await t.query(api.catechists.getMyProfile, { catechistId })
    expect(updated?.profilePhotoStorageId).toBeUndefined()
  })

  test('admin update with new fields', async () => {
    const t = convexTest(schema, modules)

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV_ADMIN',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const catechistId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV1003',
        fullName: 'Lê Văn Y',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    })

    await t.mutation(api.catechists.update, {
      requesterId: adminId,
      catechistId,
      title: 'Soeur',
      community: 'Dòng Mến Thánh Giá',
      level: '2',
    })

    const profile = await t.query(api.catechists.get, {
      requesterId: adminId,
      catechistId,
    })
    expect(profile?.title).toBe('Soeur')
    expect(profile?.community).toBe('Dòng Mến Thánh Giá')
    expect(profile?.level).toBe('2')
  })

  test('address queries and mutations', async () => {
    const t = convexTest(schema, modules)

    const catechistId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV0002',
        fullName: 'Nguyễn Văn C',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    })

    const initialAddress = await t.query(api.catechists.getMyAddress, {
      catechistId,
    })
    expect(initialAddress).toBeNull()

    await t.mutation(api.catechists.upsertMyAddress, {
      catechistId,
      country: 'VN',
      addressLine1: '123 Đường ABC',
      city: 'Hồ Chí Minh',
    })

    const address = await t.query(api.catechists.getMyAddress, { catechistId })
    expect(address).toMatchObject({
      country: 'VN',
      addressLine1: '123 Đường ABC',
      city: 'Hồ Chí Minh',
    })

    await t.mutation(api.catechists.upsertMyAddress, {
      catechistId,
      country: 'VN',
      addressLine1: '456 Đường DEF',
      city: 'Hà Nội',
    })

    const updatedAddress = await t.query(api.catechists.getMyAddress, {
      catechistId,
    })
    expect(updatedAddress?.addressLine1).toBe('456 Đường DEF')
    expect(updatedAddress?.city).toBe('Hà Nội')
  })

  test('contacts queries and mutations', async () => {
    const t = convexTest(schema, modules)

    const catechistId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV0003',
        fullName: 'Nguyễn Văn D',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    })

    const contactId = await t.mutation(api.catechists.addContact, {
      catechistId,
      label: 'Personal Phone',
      contactType: 'phone',
      value: '+84912345678',
      isPrimary: true,
    })

    const contacts = await t.query(api.catechists.getMyContacts, {
      catechistId,
    })
    expect(contacts).toHaveLength(1)
    expect(contacts[0]).toMatchObject({
      label: 'Personal Phone',
      contactType: 'phone',
      value: '+84912345678',
      isPrimary: true,
    })

    await t.mutation(api.catechists.updateContact, {
      contactId,
      label: 'Work Phone',
      contactType: 'phone',
      value: '+84987654321',
      isPrimary: false,
    })

    const updatedContacts = await t.query(api.catechists.getMyContacts, {
      catechistId,
    })
    expect(updatedContacts[0].label).toBe('Work Phone')
    expect(updatedContacts[0].value).toBe('+84987654321')
    expect(updatedContacts[0].isPrimary).toBe(false)

    await t.mutation(api.catechists.deleteContact, { contactId })
    const postDeleteContacts = await t.query(api.catechists.getMyContacts, {
      catechistId,
    })
    expect(postDeleteContacts).toHaveLength(0)

    const rawContact = await t.run(async (ctx) =>
      ctx.db.get('catechistContacts', contactId),
    )
    expect(rawContact?.isDeleted).toBe(true)
  })

  test('addContact rejects invalid phone E.164', async () => {
    const t = convexTest(schema, modules)
    const catechistId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV0004',
        fullName: 'Test E164',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    })

    await expect(
      t.mutation(api.catechists.addContact, {
        catechistId,
        label: 'Bad Phone',
        contactType: 'phone',
        value: '0912345678', // missing country code prefix
        isPrimary: false,
      }),
    ).rejects.toThrow('CATECHIST_INVALID_PHONE')
  })

  test('addContact allows non-phone without E.164', async () => {
    const t = convexTest(schema, modules)
    const catechistId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV0005',
        fullName: 'Test Email',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    })

    await expect(
      t.mutation(api.catechists.addContact, {
        catechistId,
        label: 'Email',
        contactType: 'email',
        value: 'test@example.com',
        isPrimary: false,
      }),
    ).resolves.not.toThrow()
  })

  test('addContact clears previous primary of same type', async () => {
    const t = convexTest(schema, modules)
    const catechistId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'GLV0006',
        fullName: 'Test Primary',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    })

    const contact1 = await t.mutation(api.catechists.addContact, {
      catechistId,
      label: 'Phone 1',
      contactType: 'phone',
      value: '+84912345671',
      isPrimary: true,
    })

    const contact2 = await t.mutation(api.catechists.addContact, {
      catechistId,
      label: 'Phone 2',
      contactType: 'phone',
      value: '+84912345672',
      isPrimary: true,
    })

    const contacts = await t.query(api.catechists.getMyContacts, {
      catechistId,
    })
    const c1 = contacts.find((c) => c._id === contact1)
    const c2 = contacts.find((c) => c._id === contact2)

    expect(c1?.isPrimary).toBe(false)
    expect(c2?.isPrimary).toBe(true)
  })
})

describe('admin CRUD', () => {
  test('create generates memberId and returns id', async () => {
    const t = convexTest(schema, modules)
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'ADMIN',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const newId = await t.mutation(api.catechists.create, {
      requesterId: adminId,
      fullName: 'New User',
      role: 'user',
    })

    const newUser = await t.run(async (ctx) => ctx.db.get('catechists', newId))
    expect(newUser?.fullName).toBe('New User')
    expect(newUser?.memberId).toBe('1')
  })

  test('list returns only non-deleted catechists', async () => {
    const t = convexTest(schema, modules)
    const adminId = await t.run(async (ctx) => {
      const admin = await ctx.db.insert('catechists', {
        memberId: 'ADMIN',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
      await ctx.db.insert('catechists', {
        memberId: 'DEL',
        fullName: 'Deleted',
        role: 'user',
        isActive: true,
        isDeleted: true,
      })
      return admin
    })

    const list = await t.query(api.catechists.list, { requesterId: adminId })
    expect(list).toHaveLength(1)
    expect(list[0]._id).toBe(adminId)
  })

  test('get returns profile + address + contacts', async () => {
    const t = convexTest(schema, modules)
    const { adminId, userId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert('catechists', {
        memberId: 'ADMIN',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
      const userId = await ctx.db.insert('catechists', {
        memberId: 'USER',
        fullName: 'User',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
      await ctx.db.insert('catechistAddresses', {
        catechistId: userId,
        country: 'VN',
        isDeleted: false,
      })
      await ctx.db.insert('catechistContacts', {
        catechistId: userId,
        label: 'Phone',
        contactType: 'phone',
        value: '+84123',
        isPrimary: true,
        isDeleted: false,
      })
      return { adminId, userId }
    })

    const result = await t.query(api.catechists.get, {
      requesterId: adminId,
      catechistId: userId,
    })
    expect(result).not.toBeNull()
    expect(result?.fullName).toBe('User')
    expect(result?.address?.country).toBe('VN')
    expect(result?.contacts).toHaveLength(1)
  })

  test('get returns null for invalid or deleted catechist', async () => {
    const t = convexTest(schema, modules)
    const { adminId, deletedId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert('catechists', {
        memberId: 'ADMIN',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
      const deletedId = await ctx.db.insert('catechists', {
        memberId: 'DEL',
        fullName: 'Deleted User',
        role: 'user',
        isActive: true,
        isDeleted: true,
      })
      return { adminId, deletedId }
    })

    const deletedResult = await t.query(api.catechists.get, {
      requesterId: adminId,
      catechistId: deletedId,
    })
    expect(deletedResult).toBeNull()

    const invalidId = await t.run(async (ctx) => {
      const id = await ctx.db.insert('catechists', {
        memberId: 'TMP',
        fullName: 'TMP',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
      await ctx.db.delete('catechists', id)
      return id
    })

    const notFoundResult = await t.query(api.catechists.get, {
      requesterId: adminId,
      catechistId: invalidId,
    })
    expect(notFoundResult).toBeNull()
  })

  test('update patches fields', async () => {
    const t = convexTest(schema, modules)
    const { adminId, userId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert('catechists', {
        memberId: 'ADMIN',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
      const userId = await ctx.db.insert('catechists', {
        memberId: 'USER',
        fullName: 'User',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
      return { adminId, userId }
    })

    await t.mutation(api.catechists.update, {
      requesterId: adminId,
      catechistId: userId,
      fullName: 'Updated User',
      isActive: false,
    })

    const updated = await t.run(async (ctx) => ctx.db.get('catechists', userId))
    expect(updated?.fullName).toBe('Updated User')
    expect(updated?.isActive).toBe(false)
  })

  test('softDelete sets isDeleted true', async () => {
    const t = convexTest(schema, modules)
    const { adminId, userId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert('catechists', {
        memberId: 'ADMIN',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
      const userId = await ctx.db.insert('catechists', {
        memberId: 'USER',
        fullName: 'User',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
      return { adminId, userId }
    })

    await t.mutation(api.catechists.softDelete, {
      requesterId: adminId,
      catechistId: userId,
    })

    const updated = await t.run(async (ctx) => ctx.db.get('catechists', userId))
    expect(updated?.isDeleted).toBe(true)
  })

  test('softDeleteAddress sets isDeleted true', async () => {
    const t = convexTest(schema, modules)
    const { adminId, addressId, userId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert('catechists', {
        memberId: 'ADMIN',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
      const userId = await ctx.db.insert('catechists', {
        memberId: 'USER',
        fullName: 'User',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
      const addressId = await ctx.db.insert('catechistAddresses', {
        catechistId: userId,
        country: 'VN',
        isDeleted: false,
      })
      return { adminId, addressId, userId }
    })

    const resultBefore = await t.run(async (ctx) =>
      ctx.db.get('catechistAddresses', addressId),
    )
    expect(resultBefore?.isDeleted).toBe(false)

    await t.mutation(api.catechists.softDeleteAddress, {
      requesterId: adminId,
      catechistId: userId,
    })

    const updated = await t.run(async (ctx) =>
      ctx.db.get('catechistAddresses', addressId),
    )
    expect(updated?.isDeleted).toBe(true)
  })

  test('non-admin cannot create/update/softDelete', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'USER',
        fullName: 'User',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
    })

    await expect(
      t.mutation(api.catechists.create, {
        requesterId: userId,
        fullName: 'New User',
        role: 'user',
      }),
    ).rejects.toThrow('Unauthorized')
  })

  test('update throws NOT_FOUND for invalid id', async () => {
    const t = convexTest(schema, modules)
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'ADMIN',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    // valid Id format, but we will test with a non-existent id by creating and hard deleting
    const invalidId = await t.run(async (ctx) => {
      const id = await ctx.db.insert('catechists', {
        memberId: 'TMP',
        fullName: 'TMP',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
      await ctx.db.delete('catechists', id)
      return id
    })

    await expect(
      t.mutation(api.catechists.update, {
        requesterId: adminId,
        catechistId: invalidId,
        fullName: 'Updated User',
      }),
    ).rejects.toThrow('CATECHIST_NOT_FOUND')
  })

  test('softDelete throws NOT_FOUND for invalid id', async () => {
    const t = convexTest(schema, modules)
    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert('catechists', {
        memberId: 'ADMIN',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
    })

    const invalidId = await t.run(async (ctx) => {
      const id = await ctx.db.insert('catechists', {
        memberId: 'TMP',
        fullName: 'TMP',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
      await ctx.db.delete('catechists', id)
      return id
    })

    await expect(
      t.mutation(api.catechists.softDelete, {
        requesterId: adminId,
        catechistId: invalidId,
      }),
    ).rejects.toThrow('CATECHIST_NOT_FOUND')
  })

  test('softDeleteAddress throws ADDRESS_NOT_FOUND if none exists', async () => {
    const t = convexTest(schema, modules)
    const { adminId, userId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert('catechists', {
        memberId: 'ADMIN',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
      const userId = await ctx.db.insert('catechists', {
        memberId: 'USER',
        fullName: 'User',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
      return { adminId, userId }
    })

    await expect(
      t.mutation(api.catechists.softDeleteAddress, {
        requesterId: adminId,
        catechistId: userId,
      }),
    ).rejects.toThrow('CATECHIST_ADDRESS_NOT_FOUND')
  })
})

describe('getClassAssignments', () => {
  test('returns resolved class assignments grouped data', async () => {
    const t = convexTest(schema, modules)
    const { requesterId, catechistId, classId, yearId, branchId } = await t.run(
      async (ctx) => {
        const requesterId = await ctx.db.insert('catechists', {
          memberId: 'ADMIN',
          fullName: 'Admin',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
        const catechistId = await ctx.db.insert('catechists', {
          memberId: 'GLV01',
          fullName: 'Giáo Lý Viên A',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
        const branchId = await ctx.db.insert('branches', {
          name: 'Ấu Nhi',
          sortOrder: 1,
          isDeleted: false,
        })
        const classId = await ctx.db.insert('classes', {
          name: 'Lớp 1A',
          branchId,
          isDeleted: false,
        })
        const yearId = await ctx.db.insert('academicYears', {
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-05-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
          isDeleted: false,
        })
        const classYearId = await ctx.db.insert('classYears', {
          classId,
          academicYearId: yearId,
          classType: 'primary',
          isDeleted: false,
        })
        await ctx.db.insert('classCatechists', {
          catechistId,
          classYearId,
          academicYearId: yearId,
          role: 'homeroom',
          isDeleted: false,
        })
        return { requesterId, catechistId, classId, yearId, branchId }
      },
    )

    const result = await t.query(api.catechists.getClassAssignments, {
      requesterId,
      catechistId,
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      className: 'Lớp 1A',
      branchName: 'Ấu Nhi',
      academicYearName: '2024-2025',
      role: 'homeroom',
      classId,
      branchId,
      academicYearId: yearId,
    })
  })

  test('excludes soft-deleted assignments', async () => {
    const t = convexTest(schema, modules)
    const { requesterId, catechistId } = await t.run(async (ctx) => {
      const requesterId = await ctx.db.insert('catechists', {
        memberId: 'ADMIN',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
      const catechistId = await ctx.db.insert('catechists', {
        memberId: 'GLV02',
        fullName: 'GLV B',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
      const branchId = await ctx.db.insert('branches', {
        name: 'Thiếu Nhi',
        sortOrder: 2,
        isDeleted: false,
      })
      const classId = await ctx.db.insert('classes', {
        name: 'Lớp 2B',
        branchId,
        isDeleted: false,
      })
      const yearId = await ctx.db.insert('academicYears', {
        name: '2023-2024',
        startDate: '2023-09-01',
        endDate: '2024-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: false,
        isDeleted: false,
      })
      const classYearId = await ctx.db.insert('classYears', {
        classId,
        academicYearId: yearId,
        classType: 'primary',
        isDeleted: false,
      })
      await ctx.db.insert('classCatechists', {
        catechistId,
        classYearId,
        academicYearId: yearId,
        role: 'co_teacher',
        isDeleted: true,
      })
      return { requesterId, catechistId }
    })

    const result = await t.query(api.catechists.getClassAssignments, {
      requesterId,
      catechistId,
    })
    expect(result).toHaveLength(0)
  })

  test('returns empty array when no assignments exist', async () => {
    const t = convexTest(schema, modules)
    const { requesterId, catechistId } = await t.run(async (ctx) => {
      const requesterId = await ctx.db.insert('catechists', {
        memberId: 'ADMIN',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
      const catechistId = await ctx.db.insert('catechists', {
        memberId: 'GLV03',
        fullName: 'GLV C',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
      return { requesterId, catechistId }
    })

    const result = await t.query(api.catechists.getClassAssignments, {
      requesterId,
      catechistId,
    })
    expect(result).toHaveLength(0)
  })
})

describe('list with branch filter', () => {
  test('returns all catechists when no branchId/academicYearId provided', async () => {
    const t = convexTest(schema, modules)
    const adminId = await t.run(async (ctx) => {
      const admin = await ctx.db.insert('catechists', {
        memberId: 'ADMIN',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
      await ctx.db.insert('catechists', {
        memberId: 'USER',
        fullName: 'User',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
      return admin
    })

    const list = await t.query(api.catechists.list, { requesterId: adminId })
    expect(list).toHaveLength(2)
  })

  test('returns only branch-assigned catechists when filters provided', async () => {
    const t = convexTest(schema, modules)
    const { adminId, branchId, yearId, assignedUserId } = await t.run(
      async (ctx) => {
        const adminId = await ctx.db.insert('catechists', {
          memberId: 'ADMIN',
          fullName: 'Admin',
          role: 'admin',
          isActive: true,
          isDeleted: false,
        })
        const assignedUserId = await ctx.db.insert('catechists', {
          memberId: 'USER1',
          fullName: 'User 1',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
        await ctx.db.insert('catechists', {
          memberId: 'USER2',
          fullName: 'User 2',
          role: 'user',
          isActive: true,
          isDeleted: false,
        })
        const branchId = await ctx.db.insert('branches', {
          name: 'Chiên Con',
          sortOrder: 1,
          isDeleted: false,
        })
        const yearId = await ctx.db.insert('academicYears', {
          name: '2023-2024',
          startDate: '2023-09-01',
          endDate: '2024-05-31',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
          isDeleted: false,
        })
        await ctx.db.insert('branchAssignments', {
          academicYearId: yearId,
          branchId: branchId,
          catechistId: assignedUserId,
          isDeleted: false,
        })
        return { adminId, branchId, yearId, assignedUserId }
      },
    )

    const list = await t.query(api.catechists.list, {
      requesterId: adminId,
      branchId,
      academicYearId: yearId,
    })
    expect(list).toHaveLength(1)
    expect(list[0]._id).toBe(assignedUserId)
  })

  test('excludes soft-deleted assignments and soft-deleted catechists', async () => {
    const t = convexTest(schema, modules)
    const { adminId, branchId, yearId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert('catechists', {
        memberId: 'ADMIN',
        fullName: 'Admin',
        role: 'admin',
        isActive: true,
        isDeleted: false,
      })
      const user1 = await ctx.db.insert('catechists', {
        memberId: 'USER1',
        fullName: 'User 1',
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
      const user2 = await ctx.db.insert('catechists', {
        memberId: 'USER2',
        fullName: 'User 2 (Deleted)',
        role: 'user',
        isActive: true,
        isDeleted: true,
      })
      const branchId = await ctx.db.insert('branches', {
        name: 'Ấu Nhi',
        sortOrder: 1,
        isDeleted: false,
      })
      const yearId = await ctx.db.insert('academicYears', {
        name: '2023-2024',
        startDate: '2023-09-01',
        endDate: '2024-05-31',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: true,
        isDeleted: false,
      })
      // Assignment is soft-deleted
      await ctx.db.insert('branchAssignments', {
        academicYearId: yearId,
        branchId: branchId,
        catechistId: user1,
        isDeleted: true,
      })
      // Catechist is soft-deleted, but assignment is active
      await ctx.db.insert('branchAssignments', {
        academicYearId: yearId,
        branchId: branchId,
        catechistId: user2,
        isDeleted: false,
      })
      return { adminId, branchId, yearId }
    })

    const list = await t.query(api.catechists.list, {
      requesterId: adminId,
      branchId,
      academicYearId: yearId,
    })
    expect(list).toHaveLength(0)
  })
})
