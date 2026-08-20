/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'

const modules = import.meta.glob('./**/*.ts')

test('updateAccountLoginIdPrefixes updates non-matching catechist and student prefixes and re-hashes password', async () => {
  const t = convexTest(schema, modules)

  // Seed sample catechist & student
  const catechistId = await t.run(async (ctx) => {
    return ctx.db.insert('catechists', {
      memberId: '001',
      fullName: 'Test Catechist',
      role: 'user',
      isActive: true,
      isDeleted: false,
    })
  })

  const studentId = await t.run(async (ctx) => {
    return ctx.db.insert('students', {
      studentCode: '002',
      fullName: 'Test Student',
      isActive: true,
      createdAt: Date.now(),
      isDeleted: false,
    })
  })

  // Seed account with old/wrong prefixes
  const oldCatechistAccId = await t.run(async (ctx) => {
    return ctx.db.insert('accounts', {
      loginId: 'OLD-001',
      passwordHash: 'old_hash_1',
      accountType: 'catechist',
      userRefId: catechistId,
      isActive: true,
      createdAt: Date.now(),
      isDeleted: false,
    })
  })

  const oldStudentAccId = await t.run(async (ctx) => {
    return ctx.db.insert('accounts', {
      loginId: '002', // No prefix at all
      passwordHash: 'old_hash_2',
      accountType: 'student',
      userRefId: studentId,
      isActive: true,
      createdAt: Date.now(),
      isDeleted: false,
    })
  })

  const matchingAccId = await t.run(async (ctx) => {
    return ctx.db.insert('accounts', {
      loginId: 'CAT-003',
      passwordHash: 'matching_hash',
      accountType: 'catechist',
      userRefId: catechistId,
      isActive: true,
      createdAt: Date.now(),
      isDeleted: false,
    })
  })

  // Run migration
  const result = await t.action(
    (api as any).updateAccountPrefixes.updateAccountLoginIdPrefixes,
    {},
  )

  expect(result.success).toBe(true)
  expect(result.updatedCount).toBe(2)
  expect(result.totalProcessed).toBe(3)

  // Verify updated accounts
  const updatedCatechistAcc = await t.run(async (ctx) =>
    ctx.db.get('accounts', oldCatechistAccId),
  )
  expect(updatedCatechistAcc?.loginId).toBe('CAT-001')
  expect(updatedCatechistAcc?.passwordHash).not.toBe('old_hash_1')

  const updatedStudentAcc = await t.run(async (ctx) =>
    ctx.db.get('accounts', oldStudentAccId),
  )
  expect(updatedStudentAcc?.loginId).toBe('STD-002')
  expect(updatedStudentAcc?.passwordHash).not.toBe('old_hash_2')

  const unchangedAcc = await t.run(async (ctx) =>
    ctx.db.get('accounts', matchingAccId),
  )
  expect(unchangedAcc?.loginId).toBe('CAT-003')
  expect(unchangedAcc?.passwordHash).toBe('matching_hash')
})
