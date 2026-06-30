/// <reference types="vite/client" />
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
        role: 'catechist',
        isActive: true,
        isDeleted: false,
      })
    })

    const profile = await t.query(api.catechists.getMyProfile, { catechistId })
    expect(profile).toMatchObject({
      fullName: 'Nguyễn Văn A',
      saintName: 'Giuse',
      role: 'catechist',
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
        role: 'catechist',
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
        role: 'catechist',
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
  })
})
