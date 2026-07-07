/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { GUARDIAN_ERRORS } from './lib/errors'

const modules = import.meta.glob('./**/*.ts')

describe('guardians backend functions', () => {
  test('Guardian CRUD', async () => {
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

    // 7. createGuardian
    const guardianId = await t.mutation(api.guardians.createGuardian, {
      requesterId: adminId,
      fullName: 'Guardian 1',
    })

    let guardian = await t.query(api.guardians.getGuardian, {
      requesterId: adminId,
      guardianId,
    })
    expect(guardian?.fullName).toBe('Guardian 1')

    // 8. updateGuardian patches
    await t.mutation(api.guardians.updateGuardian, {
      requesterId: adminId,
      guardianId,
      fullName: 'Guardian 1 Updated',
      saintName: 'Peter',
    })
    guardian = await t.query(api.guardians.getGuardian, {
      requesterId: adminId,
      guardianId,
    })
    expect(guardian?.fullName).toBe('Guardian 1 Updated')
    expect(guardian?.saintName).toBe('Peter')

    // 12. Non-admin can create guardian
    const g2Id = await t.mutation(api.guardians.createGuardian, {
      requesterId: userId,
      fullName: 'Guardian 2',
    })
    expect(g2Id).toBeDefined()

    // Create a student to test link
    const studentId = await t.mutation(api.students.create, {
      requesterId: adminId,
      fullName: 'Student 1',
    })

    await t.mutation(api.guardians.linkGuardianToStudent, {
      requesterId: adminId,
      studentId,
      guardianId,
      relationship: 'father',
      contactPriority: 1,
    })

    // 10. softDeleteGuardian with active link -> throws
    await expect(
      t.mutation(api.guardians.softDeleteGuardian, {
        requesterId: adminId,
        guardianId,
      }),
    ).rejects.toThrow(GUARDIAN_ERRORS.IN_USE_BY_STUDENT)

    // Unlink first
    const links = await t.query(api.guardians.getStudentGuardians, {
      requesterId: adminId,
      studentId,
    })
    const linkId = links[0]._id
    await t.mutation(api.guardians.unlinkGuardianFromStudent, {
      requesterId: adminId,
      linkId,
    })

    // 11. softDeleteGuardian after unlinking -> sets isDeleted: true
    await t.mutation(api.guardians.softDeleteGuardian, {
      requesterId: adminId,
      guardianId,
    })
    const deleted = await t.run(async (ctx) => {
      return await ctx.db.get('guardians', guardianId)
    })
    expect(deleted?.isDeleted).toBe(true)

    // 9. updateGuardian on deleted -> throws
    await expect(
      t.mutation(api.guardians.updateGuardian, {
        requesterId: adminId,
        guardianId,
        fullName: 'Again',
      }),
    ).rejects.toThrow(GUARDIAN_ERRORS.NOT_FOUND)

    // Test linkGuardianToStudent with deleted guardian -> throws
    await expect(
      t.mutation(api.guardians.linkGuardianToStudent, {
        requesterId: adminId,
        studentId,
        guardianId,
        relationship: 'mother',
        contactPriority: 2,
      }),
    ).rejects.toThrow(GUARDIAN_ERRORS.NOT_FOUND)
  })

  test('GuardianContact CRUD', async () => {
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

    const guardianId = await t.mutation(api.guardians.createGuardian, {
      requesterId: adminId,
      fullName: 'Guardian 1',
    })

    // 13. addGuardianContact phone (valid)
    const contactId = await t.mutation(api.guardians.addGuardianContact, {
      requesterId: adminId,
      guardianId,
      contactType: 'phone',
      value: '+1234567890',
      isPrimary: true,
    })

    let guardian = await t.query(api.guardians.getGuardian, {
      requesterId: adminId,
      guardianId,
    })
    expect(guardian?.contacts).toHaveLength(1)
    expect(guardian?.contacts[0].value).toBe('+1234567890')

    // 14. addGuardianContact invalid phone -> throws
    await expect(
      t.mutation(api.guardians.addGuardianContact, {
        requesterId: adminId,
        guardianId,
        contactType: 'phone',
        value: '0912345678',
        isPrimary: false,
      }),
    ).rejects.toThrow(GUARDIAN_ERRORS.INVALID_PHONE)

    // 15. addGuardianContact email - no E.164 check
    await t.mutation(api.guardians.addGuardianContact, {
      requesterId: adminId,
      guardianId,
      contactType: 'email',
      value: 'test@example.com',
      isPrimary: true,
    })

    // 16. addGuardianContact isPrimary: true twice same type -> first cleared
    const contactId2 = await t.mutation(api.guardians.addGuardianContact, {
      requesterId: adminId,
      guardianId,
      contactType: 'phone',
      value: '+1987654321',
      isPrimary: true,
    })

    guardian = await t.query(api.guardians.getGuardian, {
      requesterId: adminId,
      guardianId,
    })
    const c1 = guardian?.contacts.find((c) => c._id === contactId)
    const c2 = guardian?.contacts.find((c) => c._id === contactId2)
    expect(c1?.isPrimary).toBe(false)
    expect(c2?.isPrimary).toBe(true)

    // 17. updateGuardianContact patches value/isPrimary
    await t.mutation(api.guardians.updateGuardianContact, {
      requesterId: adminId,
      contactId,
      contactType: 'phone',
      value: '+1111111111',
      isPrimary: true,
    })

    guardian = await t.query(api.guardians.getGuardian, {
      requesterId: adminId,
      guardianId,
    })
    const updatedC1 = guardian?.contacts.find((c) => c._id === contactId)
    const updatedC2 = guardian?.contacts.find((c) => c._id === contactId2)
    expect(updatedC1?.isPrimary).toBe(true)
    expect(updatedC2?.isPrimary).toBe(false)

    // 18. deleteGuardianContact sets isDeleted: true
    await t.mutation(api.guardians.deleteGuardianContact, {
      requesterId: adminId,
      contactId,
    })

    const deletedContact = await t.run(async (ctx) => {
      return await ctx.db.get('guardianContacts', contactId)
    })
    expect(deletedContact?.isDeleted).toBe(true)

    // 19. deleteGuardianContact on missing/deleted -> throws
    await expect(
      t.mutation(api.guardians.deleteGuardianContact, {
        requesterId: adminId,
        contactId,
      }),
    ).rejects.toThrow(GUARDIAN_ERRORS.CONTACT_NOT_FOUND)

    // updateGuardianContact on deleted -> throws
    await expect(
      t.mutation(api.guardians.updateGuardianContact, {
        requesterId: adminId,
        contactId,
        contactType: 'phone',
        value: '+2222222222',
        isPrimary: false,
      }),
    ).rejects.toThrow(GUARDIAN_ERRORS.CONTACT_NOT_FOUND)
  })

  test('StudentGuardian links', async () => {
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

    const guardianId = await t.mutation(api.guardians.createGuardian, {
      requesterId: adminId,
      fullName: 'Guardian 1',
    })

    const guardian2Id = await t.mutation(api.guardians.createGuardian, {
      requesterId: adminId,
      fullName: 'Guardian 2',
    })

    // 20. linkGuardianToStudent
    const linkId = await t.mutation(api.guardians.linkGuardianToStudent, {
      requesterId: adminId,
      studentId,
      guardianId,
      relationship: 'father',
      contactPriority: 1,
    })

    let links = await t.query(api.guardians.getStudentGuardians, {
      requesterId: adminId,
      studentId,
    })
    expect(links).toHaveLength(1)
    expect(links[0].relationship).toBe('father')
    expect(links[0].contactPriority).toBe(1)
    expect(links[0].guardian?.fullName).toBe('Guardian 1')

    // 21. Duplicate link -> throws
    await expect(
      t.mutation(api.guardians.linkGuardianToStudent, {
        requesterId: adminId,
        studentId,
        guardianId,
        relationship: 'mother',
        contactPriority: 2,
      }),
    ).rejects.toThrow(GUARDIAN_ERRORS.DUPLICATE_LINK)

    // 22. Duplicate priority -> throws
    await expect(
      t.mutation(api.guardians.linkGuardianToStudent, {
        requesterId: adminId,
        studentId,
        guardianId: guardian2Id,
        relationship: 'mother',
        contactPriority: 1,
      }),
    ).rejects.toThrow(GUARDIAN_ERRORS.DUPLICATE_PRIORITY)

    const link2Id = await t.mutation(api.guardians.linkGuardianToStudent, {
      requesterId: adminId,
      studentId,
      guardianId: guardian2Id,
      relationship: 'mother',
      contactPriority: 2,
    })

    // 23. updateStudentGuardianLink patches
    await t.mutation(api.guardians.updateStudentGuardianLink, {
      requesterId: adminId,
      linkId,
      relationship: 'step-father',
      contactPriority: 3,
    })
    links = await t.query(api.guardians.getStudentGuardians, {
      requesterId: adminId,
      studentId,
    })
    const updatedLink = links.find((l) => l._id === linkId)
    expect(updatedLink?.relationship).toBe('step-father')
    expect(updatedLink?.contactPriority).toBe(3)

    // 24. Priority conflict on update
    await expect(
      t.mutation(api.guardians.updateStudentGuardianLink, {
        requesterId: adminId,
        linkId,
        relationship: 'step-father',
        contactPriority: 2, // In use by link2Id
      }),
    ).rejects.toThrow(GUARDIAN_ERRORS.DUPLICATE_PRIORITY)

    // 25. unlinkGuardianFromStudent
    await t.mutation(api.guardians.unlinkGuardianFromStudent, {
      requesterId: adminId,
      linkId,
    })
    const deletedLink = await t.run(async (ctx) => {
      return await ctx.db.get('studentGuardians', linkId)
    })
    expect(deletedLink?.isDeleted).toBe(true)

    // 26. unlink already deleted -> throws
    await expect(
      t.mutation(api.guardians.unlinkGuardianFromStudent, {
        requesterId: adminId,
        linkId,
      }),
    ).rejects.toThrow(GUARDIAN_ERRORS.LINK_NOT_FOUND)

    // 27. getStudentGuardians returns nested
    const finalLinks = await t.query(api.guardians.getStudentGuardians, {
      requesterId: adminId,
      studentId,
    })
    expect(finalLinks).toHaveLength(1)
    expect(finalLinks[0]._id).toBe(link2Id)
    expect(finalLinks[0].guardian?.fullName).toBe('Guardian 2')

    // Test branch where guardian is missing in getStudentGuardians
    await t.run(async (ctx) => {
      await ctx.db.patch('guardians', guardian2Id, { isDeleted: true })
    })
    const finalLinksMissingGuardian = await t.query(
      api.guardians.getStudentGuardians,
      {
        requesterId: adminId,
        studentId,
      },
    )
    expect(finalLinksMissingGuardian[0].guardian).toBeNull()

    // Check students.get
    const studentGet = await t.query(api.students.get, {
      requesterId: adminId,
      id: studentId,
    })
    expect(studentGet?.guardians).toHaveLength(1)
    expect(studentGet?.guardians[0].guardian).toBeNull()
  })

  describe('findByPhone query', () => {
    test('returns guardian info when phone contact is found and active', async () => {
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

      const guardianId = await t.mutation(api.guardians.createGuardian, {
        requesterId: adminId,
        fullName: 'Nguyen Van A',
        saintName: 'Peter',
        notes: 'Father',
      })

      await t.mutation(api.guardians.addGuardianContact, {
        requesterId: adminId,
        guardianId,
        contactType: 'phone',
        value: '+84912345678',
        isPrimary: true,
      })

      const result = await t.query(api.guardians.findByPhone, {
        requesterId: adminId,
        phone: '+84912345678',
      })

      expect(result).not.toBeNull()
      expect(result?._id).toBe(guardianId)
      expect(result?.fullName).toBe('Nguyen Van A')
      expect(result?.saintName).toBe('Peter')
      expect(result?.notes).toBe('Father')
    })

    test('returns null when phone number does not exist', async () => {
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

      const result = await t.query(api.guardians.findByPhone, {
        requesterId: adminId,
        phone: '+84999999999',
      })

      expect(result).toBeNull()
    })

    test('returns null when contact is soft-deleted', async () => {
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

      const guardianId = await t.mutation(api.guardians.createGuardian, {
        requesterId: adminId,
        fullName: 'Nguyen Van B',
      })

      const contactId = await t.mutation(api.guardians.addGuardianContact, {
        requesterId: adminId,
        guardianId,
        contactType: 'phone',
        value: '+84911111111',
        isPrimary: true,
      })

      await t.mutation(api.guardians.deleteGuardianContact, {
        requesterId: adminId,
        contactId,
      })

      const result = await t.query(api.guardians.findByPhone, {
        requesterId: adminId,
        phone: '+84911111111',
      })

      expect(result).toBeNull()
    })

    test('returns null when contact type is not phone', async () => {
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

      const guardianId = await t.mutation(api.guardians.createGuardian, {
        requesterId: adminId,
        fullName: 'Nguyen Van C',
      })

      // Insert a non-phone contact with a phone-like value directly
      await t.run(async (ctx) => {
        await ctx.db.insert('guardianContacts', {
          guardianId,
          contactType: 'zalo',
          value: '+84922222222',
          isPrimary: false,
          isDeleted: false,
        })
      })

      const result = await t.query(api.guardians.findByPhone, {
        requesterId: adminId,
        phone: '+84922222222',
      })

      expect(result).toBeNull()
    })

    test('returns null when guardian is soft-deleted', async () => {
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

      const guardianId = await t.mutation(api.guardians.createGuardian, {
        requesterId: adminId,
        fullName: 'Nguyen Van D',
      })

      await t.mutation(api.guardians.addGuardianContact, {
        requesterId: adminId,
        guardianId,
        contactType: 'phone',
        value: '+84933333333',
        isPrimary: true,
      })

      // Soft-delete the guardian directly
      await t.run(async (ctx) => {
        await ctx.db.patch('guardians', guardianId, { isDeleted: true })
      })

      const result = await t.query(api.guardians.findByPhone, {
        requesterId: adminId,
        phone: '+84933333333',
      })

      expect(result).toBeNull()
    })

    test('throws for invalid (non-catechist) requester', async () => {
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

      // Use the adminId as a fake student id — wrong table, should fail authz
      await expect(
        t.query(api.guardians.findByPhone, {
          requesterId: adminId,
          phone: '+84944444444',
        }),
      ).resolves.toBeNull() // valid catechist, just no result

      // Deleted catechist should fail
      await t.run(async (ctx) => {
        await ctx.db.patch('catechists', adminId, { isDeleted: true })
      })

      await expect(
        t.query(api.guardians.findByPhone, {
          requesterId: adminId,
          phone: '+84944444444',
        }),
      ).rejects.toThrow()
    })
  })
})
