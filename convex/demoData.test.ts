import { describe, expect, test } from 'vitest'
import * as demoData from './demoData'

describe('demoData pure generators', () => {
  describe('createRng', () => {
    test('is deterministic for the same seed', () => {
      const rngA = demoData.createRng(42)
      const rngB = demoData.createRng(42)
      const seqA = Array.from({ length: 10 }, () => rngA())
      const seqB = Array.from({ length: 10 }, () => rngB())
      expect(seqA).toEqual(seqB)
    })

    test('produces values in [0, 1)', () => {
      const rng = demoData.createRng(7)
      for (let i = 0; i < 50; i++) {
        const v = rng()
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(1)
      }
    })

    test('different seeds diverge', () => {
      const rngA = demoData.createRng(1)
      const rngB = demoData.createRng(2)
      const seqA = Array.from({ length: 5 }, () => rngA())
      const seqB = Array.from({ length: 5 }, () => rngB())
      expect(seqA).not.toEqual(seqB)
    })
  })

  describe('pick / randomInt / randomVnPhone / shuffle', () => {
    test('pick always returns an element of the array', () => {
      const rng = demoData.createRng(1)
      const arr = ['a', 'b', 'c']
      for (let i = 0; i < 20; i++) {
        expect(arr).toContain(demoData.pick(rng, arr))
      }
    })

    test('pick throws on empty array', () => {
      const rng = demoData.createRng(1)
      expect(() => demoData.pick(rng, [])).toThrow()
    })

    test('randomInt stays within inclusive bounds', () => {
      const rng = demoData.createRng(3)
      for (let i = 0; i < 50; i++) {
        const v = demoData.randomInt(rng, 5, 8)
        expect(v).toBeGreaterThanOrEqual(5)
        expect(v).toBeLessThanOrEqual(8)
      }
    })

    test('randomVnPhone matches E.164 +849xxxxxxxx shape', () => {
      const rng = demoData.createRng(9)
      const phone = demoData.randomVnPhone(rng)
      expect(phone).toMatch(/^\+849\d{8}$/)
    })

    test('shuffle returns a permutation without mutating the input', () => {
      const rng = demoData.createRng(11)
      const input = [1, 2, 3, 4, 5]
      const originalCopy = [...input]
      const result = demoData.shuffle(rng, input)
      expect(input).toEqual(originalCopy) // not mutated
      expect(result.slice().sort()).toEqual(input.slice().sort())
      expect(result.length).toBe(input.length)
    })
  })

  describe('generatePersonName', () => {
    test('male gender pulls from boy pools', () => {
      const rng = demoData.createRng(5)
      const name = demoData.generatePersonName(rng, 'male')
      expect(demoData.LAST_NAMES).toContain(name.lastName)
      expect(demoData.BOY_MIDDLE_NAMES).toContain(name.middleName)
      expect(demoData.BOY_FIRST_NAMES).toContain(name.firstName)
      expect(demoData.BOY_SAINT_NAMES).toContain(name.saintName)
      expect(name.fullName).toBe(
        `${name.lastName} ${name.middleName} ${name.firstName}`,
      )
    })

    test('female gender pulls from girl pools', () => {
      const rng = demoData.createRng(6)
      const name = demoData.generatePersonName(rng, 'female')
      expect(demoData.GIRL_MIDDLE_NAMES).toContain(name.middleName)
      expect(demoData.GIRL_FIRST_NAMES).toContain(name.firstName)
      expect(demoData.GIRL_SAINT_NAMES).toContain(name.saintName)
    })
  })

  describe('generateCatechistPool', () => {
    test('generates exactly `count` profiles with valid shape', () => {
      const rng = demoData.createRng(20)
      const pool = demoData.generateCatechistPool(
        rng,
        demoData.CATECHIST_POOL_SIZE,
      )
      expect(pool).toHaveLength(demoData.CATECHIST_POOL_SIZE)
      for (const profile of pool) {
        expect(profile.fullName.length).toBeGreaterThan(0)
        expect(['male', 'female']).toContain(profile.gender)
        expect(profile.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(profile.joinedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    })
  })

  describe('pickBoardMembers', () => {
    test('returns `count` distinct indices within pool bounds', () => {
      const rng = demoData.createRng(13)
      const indices = demoData.pickBoardMembers(
        rng,
        20,
        demoData.BOARD_MEMBER_COUNT,
      )
      expect(indices).toHaveLength(demoData.BOARD_MEMBER_COUNT)
      expect(new Set(indices).size).toBe(indices.length)
      for (const idx of indices) {
        expect(idx).toBeGreaterThanOrEqual(0)
        expect(idx).toBeLessThan(20)
      }
    })
  })

  describe('pickBranchHeads', () => {
    test('covers every branch exactly once across exactly `catechistCount` catechists', () => {
      const rng = demoData.createRng(21)
      const plan = demoData.pickBranchHeads(rng, 20, 3, 2)
      expect(plan).toHaveLength(2)

      const allBranchIndices = plan.flatMap((p) => p.branchIndices)
      expect(allBranchIndices.sort()).toEqual([0, 1, 2])

      const catechistIndices = plan.map((p) => p.catechistIndex)
      expect(new Set(catechistIndices).size).toBe(2)
    })

    test('at least one catechist heads more than one branch when catechists < branches', () => {
      const rng = demoData.createRng(99)
      const plan = demoData.pickBranchHeads(rng, 20, 3, 2)
      expect(plan.some((p) => p.branchIndices.length >= 2)).toBe(true)
    })
  })

  describe('pickClassStaffing', () => {
    test('returns null co-teacher when hasCoTeacher is false', () => {
      const rng = demoData.createRng(4)
      const staffing = demoData.pickClassStaffing(rng, 20, false)
      expect(staffing.coTeacherIndex).toBeNull()
      expect(staffing.homeroomIndex).toBeGreaterThanOrEqual(0)
    })

    test('returns a co-teacher index when hasCoTeacher is true', () => {
      const rng = demoData.createRng(4)
      const staffing = demoData.pickClassStaffing(rng, 20, true)
      expect(staffing.coTeacherIndex).not.toBeNull()
      expect(staffing.coTeacherIndex).toBeGreaterThanOrEqual(0)
      expect(staffing.coTeacherIndex).toBeLessThan(20)
    })
  })

  describe('generateStudentPool', () => {
    test('generates exactly `count` student profiles', () => {
      const rng = demoData.createRng(30)
      const pool = demoData.generateStudentPool(rng, 40)
      expect(pool).toHaveLength(40)
      for (const s of pool) {
        expect(s.fullName.length).toBeGreaterThan(0)
        expect(['male', 'female']).toContain(s.gender)
        expect(s.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    })
  })

  describe('generateGuardianFor', () => {
    test('shares the student last name and returns a valid E.164 phone', () => {
      const rng = demoData.createRng(8)
      const guardian = demoData.generateGuardianFor(rng, 'Nguyễn')
      expect(guardian.fullName.startsWith('Nguyễn')).toBe(true)
      expect(guardian.phone).toMatch(/^\+849\d{8}$/)
      expect(['father', 'mother']).toContain(guardian.relationship)
    })
  })

  describe('generateAddress', () => {
    test('returns a Vietnam address with the expected fields', () => {
      const rng = demoData.createRng(15)
      const address = demoData.generateAddress(rng)
      expect(address.country).toBe('VN')
      expect(address.addressLine1.length).toBeGreaterThan(0)
      expect(demoData.HAMLETS).toContain(address.hamlet)
    })
  })

  describe('generateAttendanceStatus', () => {
    test('only ever returns present/late/excused_absence', () => {
      const rng = demoData.createRng(17)
      const seen = new Set<string>()
      for (let i = 0; i < 200; i++) {
        seen.add(demoData.generateAttendanceStatus(rng))
      }
      for (const status of seen) {
        expect(['present', 'late', 'excused_absence']).toContain(status)
      }
    })

    test('is present-heavy (roughly 80%) over a large sample', () => {
      const rng = demoData.createRng(17)
      let presentCount = 0
      const total = 1000
      for (let i = 0; i < total; i++) {
        if (demoData.generateAttendanceStatus(rng) === 'present') presentCount++
      }
      expect(presentCount / total).toBeGreaterThan(0.6)
    })
  })

  describe('generateScoreValue', () => {
    test('stays within [4, 10] and rounds to 1 decimal', () => {
      const rng = demoData.createRng(19)
      for (let i = 0; i < 50; i++) {
        const score = demoData.generateScoreValue(rng)
        expect(score).toBeGreaterThanOrEqual(4)
        expect(score).toBeLessThanOrEqual(10)
        expect(Math.round(score * 10)).toBe(score * 10)
      }
    })
  })

  describe('spreadDatesWithinRange', () => {
    test('returns `count` ascending dates within [start, end]', () => {
      const dates = demoData.spreadDatesWithinRange(
        '2025-09-01',
        '2026-01-31',
        4,
      )
      expect(dates).toHaveLength(4)
      const sorted = [...dates].sort()
      expect(dates).toEqual(sorted)
      for (const d of dates) {
        expect(d >= '2025-09-01' && d <= '2026-01-31').toBe(true)
      }
    })

    test('returns the start date when count <= 1', () => {
      expect(
        demoData.spreadDatesWithinRange('2025-09-01', '2026-01-31', 1),
      ).toEqual(['2025-09-01'])
    })
  })

  describe('splitAcademicYearIntoSemesterRanges', () => {
    test('splits into two contiguous, non-overlapping ranges', () => {
      const [sem1, sem2] = demoData.splitAcademicYearIntoSemesterRanges(
        '2024-09-01',
        '2025-05-31',
      )
      expect(sem1.start).toBe('2024-09-01')
      expect(sem2.end).toBe('2025-05-31')
      expect(sem1.end < sem2.start).toBe(true)
    })
  })

  describe('addDays', () => {
    test('adds positive and negative offsets correctly', () => {
      expect(demoData.addDays('2026-07-11', 1)).toBe('2026-07-12')
      expect(demoData.addDays('2026-07-11', -1)).toBe('2026-07-10')
      expect(demoData.addDays('2026-07-11', 0)).toBe('2026-07-11')
    })
  })

  describe('makeTiptapDescription', () => {
    test('serializes a valid Tiptap doc JSON containing the title', () => {
      const json = demoData.makeTiptapDescription('Họp Ban Quản Trị')
      const parsed = JSON.parse(json)
      expect(parsed.type).toBe('doc')
      expect(parsed.content[0].content[0].text).toBe('Họp Ban Quản Trị')
    })
  })

  describe('generateCalendarEventsPlan', () => {
    test('generates the requested count with valid scope-specific fields', () => {
      const rng = demoData.createRng(23)
      const plan = demoData.generateCalendarEventsPlan(rng, {
        count: demoData.CALENDAR_EVENT_COUNT,
        branchCount: 3,
        classYearCount: 6,
      })
      expect(plan).toHaveLength(demoData.CALENDAR_EVENT_COUNT)

      for (const item of plan) {
        expect(item.dateOffsetDays).toBeGreaterThanOrEqual(-90)
        expect(item.dateOffsetDays).toBeLessThanOrEqual(90)
        expect(['board', 'branch', 'class']).toContain(item.scope)

        if (item.scope === 'branch') {
          expect(item.branchIndex).toBeGreaterThanOrEqual(0)
          expect(item.branchIndex).toBeLessThan(3)
          expect(item.classYearIndex).toBeUndefined()
        } else if (item.scope === 'class') {
          expect(item.classYearIndex).toBeGreaterThanOrEqual(0)
          expect(item.classYearIndex).toBeLessThan(6)
          expect(item.branchIndex).toBeUndefined()
        } else {
          expect(item.branchIndex).toBeUndefined()
          expect(item.classYearIndex).toBeUndefined()
        }

        const parsedDescription = JSON.parse(item.description)
        expect(parsedDescription.type).toBe('doc')
      }
    })

    test('produces a mix of all three scopes over the default count', () => {
      const rng = demoData.createRng(23)
      const plan = demoData.generateCalendarEventsPlan(rng, {
        branchCount: 3,
        classYearCount: 6,
      })
      const scopes = new Set(plan.map((p) => p.scope))
      expect(scopes.size).toBeGreaterThan(1)
    })
  })

  describe('fixed constants', () => {
    test('BRANCHES has exactly 3 branches with sequential sortOrder', () => {
      expect(demoData.BRANCHES).toHaveLength(3)
      expect(demoData.BRANCHES.map((b) => b.sortOrder)).toEqual([1, 2, 3])
      expect(demoData.BRANCHES.map((b) => b.name)).toEqual([
        'Ấu Nhi',
        'Thiếu Nhi',
        'Nghĩa Sĩ',
      ])
    })

    test('CLASS_NAMES has one class per branch in the same order', () => {
      expect(demoData.CLASS_NAMES).toHaveLength(3)
    })

    test('CONTINUITY_PLAN links old Ấu Nhi->Thiếu Nhi and old Thiếu Nhi->Nghĩa Sĩ only', () => {
      expect(demoData.CONTINUITY_PLAN).toEqual([
        { fromBranchIndex: 0, toBranchIndex: 1 },
        { fromBranchIndex: 1, toBranchIndex: 2 },
      ])
    })
  })
})
