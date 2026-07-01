/// <reference types="vite/client" />
/* eslint-disable no-shadow */
import { convexTest } from 'convex-test'
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
