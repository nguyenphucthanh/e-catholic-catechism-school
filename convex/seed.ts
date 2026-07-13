/// <reference types="node" />
import { v } from 'convex/values'
import {
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server'
import { internal } from './_generated/api'
import { reserveCounterBatch } from './lib/counter'
import { hashPassword } from './lib/password'
import * as demoData from './demoData'
import type { MutationCtx } from './_generated/server'
import type { Id, TableNames } from './_generated/dataModel'

// Only a deployment with the DEMO_APP env var set to 'true' is allowed to
// actually wipe+reseed. The cron in convex/crons.ts always registers (so it
// exists in every deployment), but the handler below no-ops everywhere else
// — this is the ONLY safety gate, deliberately placed here rather than in
// crons.ts. Set via `npx convex env set DEMO_APP true` on the target
// deployment only.

// ─── Generic bounded-batch table wipe ──────────────────────────────────────

const WIPE_BATCH_SIZE = 200
// Ceiling on batches processed within a single mutation invocation. Real
// demo-data volumes (checked: largest table is ~480 rows) always finish in
// 1-3 batches; this cap (6,000 rows) exists purely as a safety net per the
// Convex bulk-deletion guidance, in case a table ever grows past what fits
// in one transaction. It is not expected to trigger in normal operation.
const WIPE_MAX_BATCHES = 30

async function wipeTable(ctx: MutationCtx, table: TableNames): Promise<number> {
  let deleted = 0
  for (let i = 0; i < WIPE_MAX_BATCHES; i++) {
    const batch = await ctx.db.query(table).take(WIPE_BATCH_SIZE)
    if (batch.length === 0) return deleted
    for (const doc of batch) {
      await ctx.db.delete(table, doc._id)
    }
    deleted += batch.length
    if (batch.length < WIPE_BATCH_SIZE) return deleted
  }
  // Table still had rows after WIPE_MAX_BATCHES passes in this invocation —
  // schedule a continuation rather than silently leaving stale data behind.
  console.warn(
    `wipeTable: '${table}' not fully wiped in one invocation, scheduling continuation`,
  )
  await ctx.scheduler.runAfter(0, internal.seed.continueWipeTable, { table })
  return deleted
}

// Every table name is safe here (validated by the schema-derived union at
// the callers below); kept as its own internal mutation so wipeTable can
// self-reschedule via ctx.scheduler without recursing inside one call.
export const continueWipeTable = internalMutation({
  args: { table: v.string() },
  handler: async (ctx, args) => {
    return await wipeTable(ctx, args.table as TableNames)
  },
})

// Delete order (leaf/child tables first) — Convex has no FK enforcement so
// this is for clarity/safety, not correctness.
export const wipeAttendanceAndGrading = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tables: Array<TableNames> = [
      'attendanceRecords',
      'scoreEntryHistories',
      'scoreEntries',
      'semesterResults',
      'annualResults',
      'studentSacraments',
    ]
    let total = 0
    for (const table of tables) total += await wipeTable(ctx, table)
    return { total }
  },
})

export const wipeEnrollmentAndAssignments = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tables: Array<TableNames> = [
      'studentGuardians',
      'guardianContacts',
      'studentAddresses',
      'catechistContacts',
      'catechistAddresses',
      'classCatechists',
      'branchAssignments',
      'academicYearAssignments',
      'studentClasses',
    ]
    let total = 0
    for (const table of tables) total += await wipeTable(ctx, table)
    return { total }
  },
})

export const wipeScheduleAndOrg = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tables: Array<TableNames> = [
      'scoreColumns',
      'classSessions',
      'calendarEvents',
      'classYears',
      'classes',
    ]
    let total = 0
    for (const table of tables) total += await wipeTable(ctx, table)
    return { total }
  },
})

export const wipeCoreEntitiesAndConfig = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tables: Array<TableNames> = [
      'students',
      'guardians',
      'catechists',
      'accounts',
      'semesters',
      'academicYears',
      'branches',
      'counters',
      'appConfig',
    ]
    let total = 0
    for (const table of tables) total += await wipeTable(ctx, table)
    return { total }
  },
})

// ─── Org structure shape shared across seed phases ─────────────────────────

const orgYearValidator = v.object({
  academicYearId: v.id('academicYears'),
  semesterIds: v.array(v.id('semesters')),
  startDate: v.string(),
  endDate: v.string(),
})

const orgStructureValidator = v.object({
  branchIds: v.array(v.id('branches')),
  classIds: v.array(v.id('classes')),
  oldYear: orgYearValidator,
  currentYear: orgYearValidator,
  oldClassYearIds: v.array(v.id('classYears')),
  currentClassYearIds: v.array(v.id('classYears')),
})

type OrgStructure = {
  branchIds: Array<Id<'branches'>>
  classIds: Array<Id<'classes'>>
  oldYear: {
    academicYearId: Id<'academicYears'>
    semesterIds: Array<Id<'semesters'>>
    startDate: string
    endDate: string
  }
  currentYear: {
    academicYearId: Id<'academicYears'>
    semesterIds: Array<Id<'semesters'>>
    startDate: string
    endDate: string
  }
  oldClassYearIds: Array<Id<'classYears'>>
  currentClassYearIds: Array<Id<'classYears'>>
}

// ─── Seed: org structure (branches, years, semesters, classes, classYears) ─

export const seedOrgStructure = internalMutation({
  args: {},
  handler: async (ctx): Promise<OrgStructure> => {
    const branchIds: Array<Id<'branches'>> = []
    for (const branch of demoData.BRANCHES) {
      branchIds.push(
        await ctx.db.insert('branches', { ...branch, isDeleted: false }),
      )
    }

    const oldYearId = await ctx.db.insert('academicYears', {
      name: '2024-2025',
      startDate: '2024-09-01',
      endDate: '2025-05-31',
      timezone: 'Asia/Ho_Chi_Minh',
      isActive: false,
      isDeleted: false,
    })
    const currentYearId = await ctx.db.insert('academicYears', {
      name: '2025-2026',
      startDate: '2025-09-01',
      endDate: '2026-05-31',
      timezone: 'Asia/Ho_Chi_Minh',
      isActive: true,
      isDeleted: false,
    })

    const insertSemesters = async (academicYearId: Id<'academicYears'>) => {
      const ids: Array<Id<'semesters'>> = []
      for (const semesterNumber of [1, 2]) {
        ids.push(
          await ctx.db.insert('semesters', {
            academicYearId,
            semesterNumber,
            name: `Học kỳ ${semesterNumber}`,
            isDeleted: false,
          }),
        )
      }
      return ids
    }

    const oldSemesterIds = await insertSemesters(oldYearId)
    const currentSemesterIds = await insertSemesters(currentYearId)

    const classIds: Array<Id<'classes'>> = []
    for (let i = 0; i < demoData.BRANCHES.length; i++) {
      classIds.push(
        await ctx.db.insert('classes', {
          branchId: branchIds[i],
          name: demoData.CLASS_NAMES[i],
          description: `Lớp ${demoData.CLASS_NAMES[i]}`,
          isDeleted: false,
        }),
      )
    }

    const oldClassYearIds: Array<Id<'classYears'>> = []
    const currentClassYearIds: Array<Id<'classYears'>> = []
    for (const classId of classIds) {
      oldClassYearIds.push(
        await ctx.db.insert('classYears', {
          classId,
          academicYearId: oldYearId,
          isDeleted: false,
        }),
      )
      currentClassYearIds.push(
        await ctx.db.insert('classYears', {
          classId,
          academicYearId: currentYearId,
          isDeleted: false,
        }),
      )
    }

    return {
      branchIds,
      classIds,
      oldYear: {
        academicYearId: oldYearId,
        semesterIds: oldSemesterIds,
        startDate: '2024-09-01',
        endDate: '2025-05-31',
      },
      currentYear: {
        academicYearId: currentYearId,
        semesterIds: currentSemesterIds,
        startDate: '2025-09-01',
        endDate: '2026-05-31',
      },
      oldClassYearIds,
      currentClassYearIds,
    }
  },
})

// ─── Seed: catechists (admin + 20 random) ──────────────────────────────────

type SeededCatechist = {
  catechistId: Id<'catechists'>
  memberId: string
  isAdmin: boolean
}

export const seedCatechists = internalMutation({
  args: {},
  handler: async (ctx): Promise<Array<SeededCatechist>> => {
    const pool = demoData.generateCatechistPool(
      Math.random,
      demoData.CATECHIST_POOL_SIZE,
    )
    const memberIds = await reserveCounterBatch(
      ctx,
      'catechist',
      pool.length + 1, // + admin
    )

    const results: Array<SeededCatechist> = []

    const adminId = await ctx.db.insert('catechists', {
      memberId: memberIds[0].toString(),
      fullName: 'Admin',
      role: 'admin',
      isActive: true,
      isDeleted: false,
    })
    results.push({
      catechistId: adminId,
      memberId: memberIds[0].toString(),
      isAdmin: true,
    })

    for (let i = 0; i < pool.length; i++) {
      const profile = pool[i]
      const memberId = memberIds[i + 1].toString()
      const catechistId = await ctx.db.insert('catechists', {
        memberId,
        fullName: profile.fullName,
        saintName: profile.saintName,
        gender: profile.gender,
        dateOfBirth: profile.dateOfBirth,
        joinedDate: profile.joinedDate,
        role: 'user',
        isActive: true,
        isDeleted: false,
      })
      results.push({ catechistId, memberId, isAdmin: false })
    }

    return results
  },
})

// ─── Seed: catechist accounts (password hashes precomputed in the action) ──

const accountInputValidator = v.object({
  userRefId: v.id('catechists'),
  loginId: v.string(),
  passwordHash: v.string(),
})

export const seedCatechistAccounts = internalMutation({
  args: { accounts: v.array(accountInputValidator) },
  handler: async (ctx, args) => {
    for (const account of args.accounts) {
      await ctx.db.insert('accounts', {
        loginId: account.loginId,
        passwordHash: account.passwordHash,
        accountType: 'catechist',
        userRefId: account.userRefId,
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
    }
    return { count: args.accounts.length }
  },
})

// ─── Seed: board members, branch heads, class staffing ─────────────────────

export const seedAssignments = internalMutation({
  args: {
    org: orgStructureValidator,
    // catechistIds[0] is the admin; catechistIds[1..20] are the 20-pool,
    // matching the index order returned by seedCatechists/demoData.generateCatechistPool.
    catechistIds: v.array(v.id('catechists')),
  },
  handler: async (ctx, args) => {
    const poolIds = args.catechistIds.slice(1) // exclude admin
    const rng = Math.random

    const boardIndices = demoData.pickBoardMembers(rng, poolIds.length)
    const years = [args.org.oldYear, args.org.currentYear]
    for (const year of years) {
      for (const idx of boardIndices) {
        await ctx.db.insert('academicYearAssignments', {
          academicYearId: year.academicYearId,
          catechistId: poolIds[idx],
          assignmentType: 'board_member',
          isDeleted: false,
        })
      }
    }

    const branchHeadPlan = demoData.pickBranchHeads(
      rng,
      poolIds.length,
      args.org.branchIds.length,
    )
    for (const year of years) {
      for (const { catechistIndex, branchIndices } of branchHeadPlan) {
        for (const branchIndex of branchIndices) {
          await ctx.db.insert('branchAssignments', {
            academicYearId: year.academicYearId,
            catechistId: poolIds[catechistIndex],
            branchId: args.org.branchIds[branchIndex],
            isDeleted: false,
          })
        }
      }
    }

    // Class staffing: homeroom (+ optional co-teacher) per classYear. Give a
    // co-teacher to every classYear except the two "edge" ones (old Nghĩa Sĩ
    // — no successor; current Ấu Nhi — brand new class) for realism.
    const classYearsWithYear: Array<{
      classYearId: Id<'classYears'>
      academicYearId: Id<'academicYears'>
      hasCoTeacher: boolean
    }> = [
      ...args.org.oldClassYearIds.map((classYearId, i) => ({
        classYearId,
        academicYearId: args.org.oldYear.academicYearId,
        hasCoTeacher: i !== 2, // skip old Nghĩa Sĩ
      })),
      ...args.org.currentClassYearIds.map((classYearId, i) => ({
        classYearId,
        academicYearId: args.org.currentYear.academicYearId,
        hasCoTeacher: i !== 0, // skip current Ấu Nhi
      })),
    ]

    for (const cy of classYearsWithYear) {
      const staffing = demoData.pickClassStaffing(
        rng,
        poolIds.length,
        cy.hasCoTeacher,
      )
      await ctx.db.insert('classCatechists', {
        catechistId: poolIds[staffing.homeroomIndex],
        classYearId: cy.classYearId,
        academicYearId: cy.academicYearId,
        role: 'homeroom',
        isDeleted: false,
      })
      if (staffing.coTeacherIndex !== null) {
        await ctx.db.insert('classCatechists', {
          catechistId: poolIds[staffing.coTeacherIndex],
          classYearId: cy.classYearId,
          academicYearId: cy.academicYearId,
          role: 'co_teacher',
          isDeleted: false,
        })
      }
    }

    return { done: true }
  },
})

// ─── Seed: students + guardians + addresses (no accounts / enrollment yet) ─

export type SeededStudent = {
  studentId: Id<'students'>
  studentCode: string
  // Which branchIndex/year bucket this student belongs to, so seedEnrollments
  // knows where to enroll them.
  bucket: 'oldBranch0' | 'oldBranch1' | 'oldBranch2' | 'currentBranch0'
}

export const seedStudentsCore = internalMutation({
  args: {},
  handler: async (ctx): Promise<Array<SeededStudent>> => {
    const rng = Math.random
    const buckets: Array<SeededStudent['bucket']> = [
      'oldBranch0',
      'oldBranch1',
      'oldBranch2',
      'currentBranch0',
    ]
    const totalStudents = buckets.length * demoData.STUDENTS_PER_CLASS_YEAR
    const studentCodes = await reserveCounterBatch(
      ctx,
      'student',
      totalStudents,
    )

    const profiles = demoData.generateStudentPool(rng, totalStudents)
    const results: Array<SeededStudent> = []

    let cursor = 0
    for (const bucket of buckets) {
      for (let i = 0; i < demoData.STUDENTS_PER_CLASS_YEAR; i++) {
        const profile = profiles[cursor]
        const studentCode = studentCodes[cursor].toString()
        cursor++

        const studentId = await ctx.db.insert('students', {
          studentCode,
          fullName: profile.fullName,
          saintName: profile.saintName,
          gender: profile.gender,
          dateOfBirth: profile.dateOfBirth,
          previousParish: demoData.pickPreviousParish(rng),
          previousDiocese: 'Tổng Giáo phận Sài Gòn',
          isActive: true,
          isDeleted: false,
          createdAt: Date.now(),
        })

        const address = demoData.generateAddress(rng)
        await ctx.db.insert('studentAddresses', {
          studentId,
          ...address,
          isDeleted: false,
        })

        const lastName = profile.fullName.split(' ')[0]
        const guardianProfile = demoData.generateGuardianFor(rng, lastName)
        const guardianId = await ctx.db.insert('guardians', {
          fullName: guardianProfile.fullName,
          saintName: guardianProfile.saintName,
          isDeleted: false,
        })
        await ctx.db.insert('guardianContacts', {
          guardianId,
          contactType: 'phone',
          value: guardianProfile.phone,
          isPrimary: true,
          isDeleted: false,
        })
        await ctx.db.insert('studentGuardians', {
          studentId,
          guardianId,
          relationship: guardianProfile.relationship,
          contactPriority: 1,
          isDeleted: false,
        })

        results.push({ studentId, studentCode, bucket })
      }
    }

    return results
  },
})

export const seedStudentAccounts = internalMutation({
  args: {
    accounts: v.array(
      v.object({
        userRefId: v.id('students'),
        loginId: v.string(),
        passwordHash: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const account of args.accounts) {
      await ctx.db.insert('accounts', {
        loginId: account.loginId,
        passwordHash: account.passwordHash,
        accountType: 'student',
        userRefId: account.userRefId,
        isActive: true,
        createdAt: Date.now(),
        isDeleted: false,
      })
    }
    return { count: args.accounts.length }
  },
})

// ─── Seed: enrollments (studentClasses), with old->current continuity ─────

export const seedEnrollments = internalMutation({
  args: {
    org: orgStructureValidator,
    students: v.array(
      v.object({
        studentId: v.id('students'),
        studentCode: v.string(),
        bucket: v.union(
          v.literal('oldBranch0'),
          v.literal('oldBranch1'),
          v.literal('oldBranch2'),
          v.literal('currentBranch0'),
        ),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const enrolledDateFor = (academicYearId: Id<'academicYears'>) =>
      academicYearId === args.org.oldYear.academicYearId
        ? args.org.oldYear.startDate
        : args.org.currentYear.startDate

    const enroll = async (
      studentId: Id<'students'>,
      classYearId: Id<'classYears'>,
      academicYearId: Id<'academicYears'>,
    ) => {
      await ctx.db.insert('studentClasses', {
        studentId,
        classYearId,
        isPrimaryClass: true,
        enrolledDate: enrolledDateFor(academicYearId),
        status: 'active',
        isDeleted: false,
      })
    }

    let count = 0
    for (const student of args.students) {
      if (student.bucket === 'oldBranch0') {
        // old Ấu Nhi 1 -> also current Thiếu Nhi 1
        await enroll(
          student.studentId,
          args.org.oldClassYearIds[0],
          args.org.oldYear.academicYearId,
        )
        await enroll(
          student.studentId,
          args.org.currentClassYearIds[1],
          args.org.currentYear.academicYearId,
        )
        count += 2
      } else if (student.bucket === 'oldBranch1') {
        // old Thiếu Nhi 1 -> also current Nghĩa Sĩ 1
        await enroll(
          student.studentId,
          args.org.oldClassYearIds[1],
          args.org.oldYear.academicYearId,
        )
        await enroll(
          student.studentId,
          args.org.currentClassYearIds[2],
          args.org.currentYear.academicYearId,
        )
        count += 2
      } else if (student.bucket === 'oldBranch2') {
        // old Nghĩa Sĩ 1 -> no continuation (graduates out of scope)
        await enroll(
          student.studentId,
          args.org.oldClassYearIds[2],
          args.org.oldYear.academicYearId,
        )
        count += 1
      } else {
        // currentBranch0: brand-new current-year Ấu Nhi 1 students
        await enroll(
          student.studentId,
          args.org.currentClassYearIds[0],
          args.org.currentYear.academicYearId,
        )
        count += 1
      }
    }

    return { count }
  },
})

// ─── Seed: attendance (classSessions + attendanceRecords) ──────────────────

export const seedAttendance = internalMutation({
  args: {
    org: orgStructureValidator,
    // homeroomByClassYearId lets each session's attendance be recordedBy the
    // classYear's homeroom catechist.
    homeroomByClassYearId: v.array(
      v.object({
        classYearId: v.id('classYears'),
        catechistId: v.id('catechists'),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const homeroomMap = new Map(
      args.homeroomByClassYearId.map((h) => [h.classYearId, h.catechistId]),
    )

    const classYearYearPairs: Array<{
      classYearId: Id<'classYears'>
      semesterIds: Array<Id<'semesters'>>
      yearRange: { start: string; end: string }
    }> = [
      ...args.org.oldClassYearIds.map((classYearId) => ({
        classYearId,
        semesterIds: args.org.oldYear.semesterIds,
        yearRange: {
          start: args.org.oldYear.startDate,
          end: args.org.oldYear.endDate,
        },
      })),
      ...args.org.currentClassYearIds.map((classYearId) => ({
        classYearId,
        semesterIds: args.org.currentYear.semesterIds,
        yearRange: {
          start: args.org.currentYear.startDate,
          end: args.org.currentYear.endDate,
        },
      })),
    ]

    let sessionCount = 0
    let attendanceCount = 0

    for (const { classYearId, semesterIds, yearRange } of classYearYearPairs) {
      const recordedBy = homeroomMap.get(classYearId)
      if (!recordedBy) continue

      const studentClasses = await ctx.db
        .query('studentClasses')
        .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYearId))
        .collect()
      const activeStudentClassIds = studentClasses
        .filter((sc) => !sc.isDeleted && sc.status === 'active')
        .map((sc) => sc._id)

      const semesterRanges = demoData.splitAcademicYearIntoSemesterRanges(
        yearRange.start,
        yearRange.end,
      )

      for (let s = 0; s < semesterIds.length; s++) {
        const semesterId = semesterIds[s]
        const range = semesterRanges[s]
        const sessionDates = demoData.spreadDatesWithinRange(
          range.start,
          range.end,
          demoData.SESSIONS_PER_SEMESTER,
        )

        for (const sessionDate of sessionDates) {
          const sessionId = await ctx.db.insert('classSessions', {
            classYearId,
            semesterId,
            sessionDate,
            sessionType: 'catechism',
            isCancelled: false,
            isDeleted: false,
          })
          sessionCount++

          for (const studentClassId of activeStudentClassIds) {
            const status = demoData.generateAttendanceStatus(Math.random)
            await ctx.db.insert('attendanceRecords', {
              sessionId,
              studentClassId,
              status,
              recordedBy,
              deviceQueuedAt: Date.now(),
              syncedAt: Date.now(),
              isDeleted: false,
            })
            attendanceCount++
          }
        }
      }
    }

    return { sessionCount, attendanceCount }
  },
})

// ─── Seed: grading (scoreColumns + scoreEntries) ───────────────────────────

export const seedGrading = internalMutation({
  args: {
    org: orgStructureValidator,
    homeroomByClassYearId: v.array(
      v.object({
        classYearId: v.id('classYears'),
        catechistId: v.id('catechists'),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const homeroomMap = new Map(
      args.homeroomByClassYearId.map((h) => [h.classYearId, h.catechistId]),
    )

    const classYearSemesterPairs: Array<{
      classYearId: Id<'classYears'>
      semesterIds: Array<Id<'semesters'>>
    }> = [
      ...args.org.oldClassYearIds.map((classYearId) => ({
        classYearId,
        semesterIds: args.org.oldYear.semesterIds,
      })),
      ...args.org.currentClassYearIds.map((classYearId) => ({
        classYearId,
        semesterIds: args.org.currentYear.semesterIds,
      })),
    ]

    let columnCount = 0
    let entryCount = 0

    for (const { classYearId, semesterIds } of classYearSemesterPairs) {
      const enteredBy = homeroomMap.get(classYearId)
      if (!enteredBy) continue

      const studentClasses = await ctx.db
        .query('studentClasses')
        .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYearId))
        .collect()
      const activeStudentClassIds = studentClasses
        .filter((sc) => !sc.isDeleted && sc.status === 'active')
        .map((sc) => sc._id)

      for (const semesterId of semesterIds) {
        for (let i = 0; i < demoData.SCORE_COLUMN_TYPES.length; i++) {
          const columnType = demoData.SCORE_COLUMN_TYPES[i]
          const scoreColumnId = await ctx.db.insert('scoreColumns', {
            classYearId,
            semesterId,
            columnName: `${columnType} ${i + 1}`,
            columnType,
            scaleType: 'scale_10',
            sortOrder: i + 1,
            isDeleted: false,
          })
          columnCount++

          for (const studentClassId of activeStudentClassIds) {
            await ctx.db.insert('scoreEntries', {
              studentClassId,
              scoreColumnId,
              scoreValue: demoData.generateScoreValue(Math.random),
              enteredBy,
              enteredAt: Date.now(),
              isDeleted: false,
            })
            entryCount++
          }
        }
      }
    }

    return { columnCount, entryCount }
  },
})

// ─── Seed: calendar events ──────────────────────────────────────────────────

export const seedCalendarEvents = internalMutation({
  args: {
    org: orgStructureValidator,
    createdBy: v.id('catechists'),
    // ISO date string for "today" — the reference point the +/-90 day plan
    // is spread around. Passed in from the action so tests can pin it.
    today: v.string(),
  },
  handler: async (ctx, args) => {
    const classYearIds = [
      ...args.org.oldClassYearIds,
      ...args.org.currentClassYearIds,
    ]

    const plan = demoData.generateCalendarEventsPlan(Math.random, {
      count: demoData.CALENDAR_EVENT_COUNT,
      branchCount: args.org.branchIds.length,
      classYearCount: classYearIds.length,
    })

    let seeded = 0
    for (const item of plan) {
      const date = demoData.addDays(args.today, item.dateOffsetDays)
      // Attribute the event to whichever academic year the date's
      // corresponding class/branch data actually lives in when possible;
      // otherwise default to the current year (the demo's "active" year).
      const academicYearId = args.org.currentYear.academicYearId

      const branchId =
        item.scope === 'branch' && item.branchIndex !== undefined
          ? args.org.branchIds[item.branchIndex]
          : undefined
      const classYearId =
        item.scope === 'class' && item.classYearIndex !== undefined
          ? classYearIds[item.classYearIndex]
          : undefined

      await ctx.db.insert('calendarEvents', {
        academicYearId,
        date,
        liturgicalDate: item.liturgicalDate,
        description: item.description,
        severity: item.severity,
        scope: item.scope,
        branchId,
        classYearId,
        createdBy: args.createdBy,
        createdAt: Date.now(),
        isDeleted: false,
      })
      seeded++
    }

    return { seeded }
  },
})

// ─── Seed: appConfig singleton ─────────────────────────────────────────────

export const seedAppConfig = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.db.insert('appConfig', {
      parishName: 'Giáo xứ Mẫu',
      dioceseName: 'Tổng Giáo phận Sài Gòn',
      nameFormat: 'firstName_lastName',
    })
    return { done: true }
  },
})

// ─── Orchestrator ───────────────────────────────────────────────────────────

type ResetDemoDataResult =
  | { skipped: true }
  | {
      skipped: false
      catechistCount: number
      studentCount: number
      enrollmentCount: number
      sessionCount: number
      attendanceRecordCount: number
      scoreColumnCount: number
      scoreEntryCount: number
      calendarEventCount: number
    }

export const resetDemoData = internalAction({
  args: {},
  handler: async (ctx): Promise<ResetDemoDataResult> => {
    if (process.env.DEMO_APP !== 'true') {
      console.log(
        `resetDemoData: skipping — DEMO_APP is '${process.env.DEMO_APP ?? 'undefined'}', not 'true'`,
      )
      return { skipped: true }
    }

    // 1. Wipe every table, leaf/child tables first.
    await ctx.runMutation(internal.seed.wipeAttendanceAndGrading, {})
    await ctx.runMutation(internal.seed.wipeEnrollmentAndAssignments, {})
    await ctx.runMutation(internal.seed.wipeScheduleAndOrg, {})
    await ctx.runMutation(internal.seed.wipeCoreEntitiesAndConfig, {})

    // 2. Org structure (branches, years, semesters, classes, classYears).
    const org: OrgStructure = await ctx.runMutation(
      internal.seed.seedOrgStructure,
      {},
    )

    // 3. Catechists (admin + 20 random).
    const catechists: Array<SeededCatechist> = await ctx.runMutation(
      internal.seed.seedCatechists,
      {},
    )

    // 4. Catechist accounts — bcrypt hashing happens here in the action
    //    (CPU-bound work must not run inside a mutation).
    const catechistAccounts = catechists.map((c) => ({
      userRefId: c.catechistId,
      loginId: `CAT-${c.memberId}`,
      passwordHash: hashPassword(`CAT-${c.memberId}`),
    }))
    await ctx.runMutation(internal.seed.seedCatechistAccounts, {
      accounts: catechistAccounts,
    })

    // 5. Board members / branch heads / class staffing.
    await ctx.runMutation(internal.seed.seedAssignments, {
      org,
      catechistIds: catechists.map((c) => c.catechistId),
    })

    // Resolve each classYear's homeroom catechist for attendance/grading.
    const homeroomAssignments: Array<{
      classYearId: Id<'classYears'>
      catechistId: Id<'catechists'>
    }> = await ctx.runQuery(internal.seed.getHomeroomAssignments, { org })

    // 6. Students + guardians + addresses (no accounts / enrollment yet).
    const students: Array<SeededStudent> = await ctx.runMutation(
      internal.seed.seedStudentsCore,
      {},
    )

    // 7. Student accounts — bcrypt hashing in the action, same reasoning as (4).
    const studentAccounts = students.map((s) => ({
      userRefId: s.studentId,
      loginId: `STD-${s.studentCode}`,
      passwordHash: hashPassword(`STD-${s.studentCode}`),
    }))
    await ctx.runMutation(internal.seed.seedStudentAccounts, {
      accounts: studentAccounts,
    })

    // 8. Enrollments (studentClasses), with old->current continuity.
    const enrollmentResult: { count: number } = await ctx.runMutation(
      internal.seed.seedEnrollments,
      { org, students },
    )

    // 9. Attendance (classSessions + attendanceRecords).
    const attendanceResult: {
      sessionCount: number
      attendanceCount: number
    } = await ctx.runMutation(internal.seed.seedAttendance, {
      org,
      homeroomByClassYearId: homeroomAssignments,
    })

    // 10. Grading (scoreColumns + scoreEntries).
    const gradingResult: {
      columnCount: number
      entryCount: number
    } = await ctx.runMutation(internal.seed.seedGrading, {
      org,
      homeroomByClassYearId: homeroomAssignments,
    })

    // 11. Calendar events.
    const adminCatechistId = catechists[0].catechistId
    const calendarResult: { seeded: number } = await ctx.runMutation(
      internal.seed.seedCalendarEvents,
      {
        org,
        createdBy: adminCatechistId,
        today: new Date().toISOString().slice(0, 10),
      },
    )

    // 12. appConfig singleton.
    await ctx.runMutation(internal.seed.seedAppConfig, {})

    return {
      skipped: false,
      catechistCount: catechists.length,
      studentCount: students.length,
      enrollmentCount: enrollmentResult.count,
      sessionCount: attendanceResult.sessionCount,
      attendanceRecordCount: attendanceResult.attendanceCount,
      scoreColumnCount: gradingResult.columnCount,
      scoreEntryCount: gradingResult.entryCount,
      calendarEventCount: calendarResult.seeded,
    }
  },
})

// Internal query helper: resolves each classYear's homeroom catechist id so
// the action can pass a plain {classYearId, catechistId}[] into the
// attendance/grading mutations (avoids re-querying classCatechists per call).
export const getHomeroomAssignments = internalQuery({
  args: { org: orgStructureValidator },
  handler: async (ctx, args) => {
    const classYearIds = [
      ...args.org.oldClassYearIds,
      ...args.org.currentClassYearIds,
    ]
    const results: Array<{
      classYearId: Id<'classYears'>
      catechistId: Id<'catechists'>
    }> = []
    for (const classYearId of classYearIds) {
      const assignments = await ctx.db
        .query('classCatechists')
        .withIndex('by_class_year_id', (q) => q.eq('classYearId', classYearId))
        .collect()
      const homeroom = assignments.find(
        (a) => !a.isDeleted && a.role === 'homeroom',
      )
      if (homeroom) {
        results.push({ classYearId, catechistId: homeroom.catechistId })
      }
    }
    return results
  },
})
