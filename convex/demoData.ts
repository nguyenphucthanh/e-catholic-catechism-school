/**
 * Pure, DB-agnostic demo-data generation for convex/seed.ts.
 *
 * Nothing in this file touches `ctx.db` — every export is a plain function
 * that takes an RNG (and sometimes plain-object inputs) and returns plain
 * JS objects/arrays. This keeps the shaping/generation logic unit-testable
 * without a Convex test context; convex/seed.ts is responsible for turning
 * these plain objects into actual table rows (resolving ids, foreign keys,
 * counters, etc).
 *
 * Name pools below are adapted from the previous convex/seed.ts
 * (seedFiftyStudents/seedCalendarEvents) rather than invented fresh.
 */

export type Gender = 'male' | 'female'

// ─── Fixed demo constants ────────────────────────────────────────────────

// Exactly 3 branches for the demo dataset (NOT the full 6-branch production list).
export const BRANCHES = [
  { name: 'Ấu Nhi', sortOrder: 1 },
  { name: 'Thiếu Nhi', sortOrder: 2 },
  { name: 'Nghĩa Sĩ', sortOrder: 3 },
] as const

// One class per branch, same index order as BRANCHES.
export const CLASS_NAMES = ['Ấu Nhi 1', 'Thiếu Nhi 1', 'Nghĩa Sĩ 1'] as const

// Old-year branchIndex -> current-year branchIndex enrollment continuation.
// branchIndex 2 (old Nghĩa Sĩ) has no successor — those students "graduate"
// out of the 3-branch demo scope. branchIndex 0 (current Ấu Nhi) has no
// predecessor — it's filled entirely with brand-new students.
export const CONTINUITY_PLAN: ReadonlyArray<{
  fromBranchIndex: number
  toBranchIndex: number
}> = [
  { fromBranchIndex: 0, toBranchIndex: 1 }, // old Ấu Nhi 1 -> current Thiếu Nhi 1
  { fromBranchIndex: 1, toBranchIndex: 2 }, // old Thiếu Nhi 1 -> current Nghĩa Sĩ 1
]

export const CATECHIST_POOL_SIZE = 20
export const BOARD_MEMBER_COUNT = 3
export const BRANCH_HEAD_CATECHIST_COUNT = 2
export const STUDENTS_PER_CLASS_YEAR = 10
export const SESSIONS_PER_SEMESTER = 4
export const SCORE_COLUMNS_PER_SEMESTER = 3
export const CALENDAR_EVENT_COUNT = 20

export const SCORE_COLUMN_TYPES = [
  'short_quiz',
  'midterm_test',
  'semester_exam',
] as const

// ─── Vietnamese name pools (adapted from the previous convex/seed.ts) ────

export const LAST_NAMES = [
  'Nguyễn',
  'Trần',
  'Lê',
  'Phạm',
  'Huỳnh',
  'Phan',
  'Vũ',
  'Võ',
  'Đặng',
  'Bùi',
  'Đỗ',
  'Hồ',
  'Ngô',
  'Dương',
  'Lý',
]

export const BOY_MIDDLE_NAMES = [
  'Văn',
  'Hữu',
  'Minh',
  'Đức',
  'Quốc',
  'Gia',
  'Anh',
  'Thanh',
  'Xuân',
  'Duy',
  'Khánh',
  'Hoàng',
  'Tuấn',
  'Ngọc',
]
export const GIRL_MIDDLE_NAMES = [
  'Thị',
  'Ngọc',
  'Quỳnh',
  'Thu',
  'Thanh',
  'Kiều',
  'Trúc',
  'Cát',
  'Tuyết',
  'Bạch',
  'Ánh',
  'Phương',
  'Mai',
  'Hồng',
]

export const BOY_FIRST_NAMES = [
  'Anh',
  'Bảo',
  'Cường',
  'Dũng',
  'Đông',
  'Đạt',
  'Duy',
  'Gia',
  'Hải',
  'Huy',
  'Hoàng',
  'Hùng',
  'Khang',
  'Lâm',
  'Long',
  'Minh',
  'Nam',
  'Nhân',
  'Phúc',
  'Phong',
  'Quân',
  'Quang',
  'Sơn',
  'Tâm',
  'Thắng',
  'Thịnh',
  'Trung',
  'Tuấn',
  'Việt',
  'Vy',
]
export const GIRL_FIRST_NAMES = [
  'Anh',
  'Bích',
  'Chi',
  'Cúc',
  'Diệp',
  'Đào',
  'Dung',
  'Giang',
  'Hương',
  'Hạnh',
  'Hoa',
  'Hằng',
  'Khánh',
  'Lan',
  'Linh',
  'Lê',
  'Mai',
  'Minh',
  'Ngọc',
  'Nga',
  'Oanh',
  'Phương',
  'Phượng',
  'Quỳnh',
  'Trang',
  'Tuyết',
  'Trinh',
  'Thảo',
  'Vân',
  'Vy',
  'Yến',
]

export const BOY_SAINT_NAMES = [
  'Giuse',
  'Phêrô',
  'Phaoô',
  'Gioan',
  'Tôma',
  'Antôn',
  'Matthêu',
  'Luca',
  'Máccô',
  'Phanxicô',
  'Đaminh',
  'Augustinô',
  'Stêphanô',
  'Micae',
  'Giacôbê',
  'Nicôla',
]
export const GIRL_SAINT_NAMES = [
  'Maria',
  'Anna',
  'Teresa',
  'Cecilia',
  'Rosa',
  'Lucia',
  'Agatha',
  'Clara',
  'Mônica',
  'Têrêxa',
  'Êlisabét',
  'Anê',
  'Marta',
  'Cataria',
]

export const STREET_NAMES = [
  'Hai Bà Trưng',
  'Lê Lợi',
  'Nguyễn Huệ',
  'Cách Mạng Tháng Tám',
  'Lê Hồng Phong',
  'Nam Kỳ Khởi Nghĩa',
  'Võ Thị Sáu',
  'Điện Biên Phủ',
  'Ba Tháng Hai',
  'Phạm Văn Đồng',
  'Trần Hưng Đạo',
  'Nguyễn Trãi',
]
export const HAMLETS = [
  'Giáo họ Thánh Tâm',
  'Giáo họ Thánh Giuse',
  'Giáo họ Lộ Đức',
  'Giáo họ Thánh Gia',
  'Giáo họ Kitô Vua',
  'Giáo họ Fatima',
  'Giáo họ Mân Côi',
]
export const PARISHES = [
  'Giáo xứ Tân Định',
  'Giáo xứ Đức Bà',
  'Giáo xứ Bình Triệu',
  'Giáo xứ Vườn Xoài',
  'Giáo xứ Hạnh Thông Tây',
  'Giáo xứ Chợ Quán',
  'Giáo xứ Fatima Bình Triệu',
]

export const CALENDAR_EVENT_TITLES = [
  'Họp Ban Quản Trị',
  'Tĩnh tâm giáo lý viên',
  'Lễ khai giảng năm học giáo lý',
  'Thi đua học kỳ',
  'Trại hè giáo lý',
  'Họp phụ huynh',
  'Chầu Thánh Thể',
  'Ngày hội thao',
  'Kiểm tra định kỳ',
  'Tổng kết năm học',
]

export const LITURGICAL_DATES: ReadonlyArray<string | undefined> = [
  'Chúa Nhật I Mùa Vọng',
  'Chúa Nhật Lễ Thánh Gia',
  'Chúa Nhật II Thường Niên',
  'Chúa Nhật Lễ Lá',
  'Chúa Nhật Phục Sinh',
  'Chúa Nhật Chúa Thánh Thần Hiện Xuống',
  'Chúa Nhật XVII Thường Niên',
  undefined,
]

export const SEVERITIES = ['high', 'medium', 'low'] as const

// ─── RNG ──────────────────────────────────────────────────────────────────

/**
 * Deterministic seeded PRNG (mulberry32). Lets unit tests assert exact
 * shapes/values; production seed.ts can pass `Math.random` instead.
 */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pick<T>(rng: () => number, arr: ReadonlyArray<T>): T {
  if (arr.length === 0) {
    throw new Error('pick: cannot pick from an empty array')
  }
  return arr[Math.floor(rng() * arr.length)]
}

export function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(min + rng() * (max - min + 1))
}

export function randomVnPhone(rng: () => number): string {
  return `+849${randomInt(rng, 10000000, 99999999)}`
}

/** Shuffles a copy of `arr` (Fisher-Yates), never mutates the input. */
export function shuffle<T>(rng: () => number, arr: ReadonlyArray<T>): Array<T> {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

// ─── Name / person generation ─────────────────────────────────────────────

export type PersonName = {
  saintName: string
  middleName: string
  firstName: string
  lastName: string
  fullName: string
}

export function generatePersonName(
  rng: () => number,
  gender: Gender,
): PersonName {
  const lastName = pick(rng, LAST_NAMES)
  const middleName =
    gender === 'male'
      ? pick(rng, BOY_MIDDLE_NAMES)
      : pick(rng, GIRL_MIDDLE_NAMES)
  const firstName =
    gender === 'male' ? pick(rng, BOY_FIRST_NAMES) : pick(rng, GIRL_FIRST_NAMES)
  const saintName =
    gender === 'male' ? pick(rng, BOY_SAINT_NAMES) : pick(rng, GIRL_SAINT_NAMES)
  return {
    saintName,
    middleName,
    firstName,
    lastName,
    fullName: `${lastName} ${middleName} ${firstName}`,
  }
}

function randomDateOfBirth(
  rng: () => number,
  minAge: number,
  maxAge: number,
): string {
  const currentYear = 2026
  const age = randomInt(rng, minAge, maxAge)
  const year = currentYear - age
  const month = randomInt(rng, 1, 12)
  const day = randomInt(rng, 1, 28)
  return `${year}-${pad2(month)}-${pad2(day)}`
}

// ─── Catechists ────────────────────────────────────────────────────────────

export type CatechistProfile = {
  fullName: string
  saintName: string
  gender: Gender
  dateOfBirth: string
  joinedDate: string
}

export function generateCatechistPool(
  rng: () => number,
  count: number = CATECHIST_POOL_SIZE,
): Array<CatechistProfile> {
  return Array.from({ length: count }, () => {
    const gender: Gender = rng() > 0.5 ? 'male' : 'female'
    const name = generatePersonName(rng, gender)
    return {
      fullName: name.fullName,
      saintName: name.saintName,
      gender,
      dateOfBirth: randomDateOfBirth(rng, 22, 55),
      joinedDate: randomDateOfBirth(rng, 0, 8).replace(/^\d{4}/, '2018'), // rough "joined in the last ~8 years"
    }
  })
}

/** Picks `count` distinct indices into a pool of `poolSize` catechists. */
export function pickBoardMembers(
  rng: () => number,
  poolSize: number,
  count: number = BOARD_MEMBER_COUNT,
): Array<number> {
  const indices = Array.from({ length: poolSize }, (_, i) => i)
  return shuffle(rng, indices).slice(0, count)
}

export type BranchHeadPlan = Array<{
  catechistIndex: number
  branchIndices: Array<number>
}>

/**
 * Distributes `branchCount` branches across `catechistCount` distinct
 * catechists so every branch has exactly one head. When catechistCount <
 * branchCount, at least one catechist heads multiple branches (schema
 * explicitly allows this — unique index is on (year, catechist, branch)).
 */
export function pickBranchHeads(
  rng: () => number,
  poolSize: number,
  branchCount: number,
  catechistCount: number = BRANCH_HEAD_CATECHIST_COUNT,
): BranchHeadPlan {
  const indices = Array.from({ length: poolSize }, (_, i) => i)
  const chosen = shuffle(rng, indices).slice(0, catechistCount)
  const plan: BranchHeadPlan = chosen.map((catechistIndex) => ({
    catechistIndex,
    branchIndices: [],
  }))
  // Round-robin branches across the chosen catechists so distribution stays
  // even and every branch is covered exactly once.
  for (let branchIndex = 0; branchIndex < branchCount; branchIndex++) {
    plan[branchIndex % plan.length].branchIndices.push(branchIndex)
  }
  return plan
}

export type ClassStaffingPlan = {
  homeroomIndex: number
  coTeacherIndex: number | null
}

/** Picks a homeroom (and optional distinct co-teacher) catechist index. */
export function pickClassStaffing(
  rng: () => number,
  poolSize: number,
  hasCoTeacher: boolean,
): ClassStaffingPlan {
  const homeroomIndex = randomInt(rng, 0, poolSize - 1)
  if (!hasCoTeacher) {
    return { homeroomIndex, coTeacherIndex: null }
  }
  let coTeacherIndex = randomInt(rng, 0, poolSize - 1)
  // Best-effort distinctness; poolSize is always >= 2 in practice.
  for (
    let attempt = 0;
    attempt < 5 && coTeacherIndex === homeroomIndex;
    attempt++
  ) {
    coTeacherIndex = randomInt(rng, 0, poolSize - 1)
  }
  return { homeroomIndex, coTeacherIndex }
}

// ─── Students / guardians / addresses ─────────────────────────────────────

export type StudentProfile = {
  fullName: string
  saintName: string
  gender: Gender
  dateOfBirth: string
}

export function generateStudentPool(
  rng: () => number,
  count: number,
): Array<StudentProfile> {
  return Array.from({ length: count }, () => {
    const gender: Gender = rng() > 0.5 ? 'male' : 'female'
    const name = generatePersonName(rng, gender)
    return {
      fullName: name.fullName,
      saintName: name.saintName,
      gender,
      dateOfBirth: randomDateOfBirth(rng, 6, 15),
    }
  })
}

export type GuardianProfile = {
  fullName: string
  saintName: string
  gender: Gender
  phone: string
  relationship: 'father' | 'mother'
}

/** Generates a single guardian sharing the student's last name. */
export function generateGuardianFor(
  rng: () => number,
  studentLastName: string,
): GuardianProfile {
  const gender: Gender = rng() > 0.5 ? 'male' : 'female'
  const relationship = gender === 'male' ? 'father' : 'mother'
  const middleName =
    gender === 'male'
      ? pick(rng, BOY_MIDDLE_NAMES)
      : pick(rng, GIRL_MIDDLE_NAMES)
  const firstName =
    gender === 'male' ? pick(rng, BOY_FIRST_NAMES) : pick(rng, GIRL_FIRST_NAMES)
  const saintName =
    gender === 'male' ? pick(rng, BOY_SAINT_NAMES) : pick(rng, GIRL_SAINT_NAMES)
  return {
    fullName: `${studentLastName} ${middleName} ${firstName}`,
    saintName,
    gender,
    phone: randomVnPhone(rng),
    relationship,
  }
}

export type AddressProfile = {
  country: string
  city: string
  addressLine1: string
  hamlet: string
  subHamlet: string
}

export function generateAddress(rng: () => number): AddressProfile {
  return {
    country: 'VN',
    city: 'Hồ Chí Minh',
    addressLine1: `${randomInt(rng, 10, 500)} ${pick(rng, STREET_NAMES)}`,
    hamlet: pick(rng, HAMLETS),
    subHamlet: `Xóm ${randomInt(rng, 1, 10)}`,
  }
}

export function pickPreviousParish(rng: () => number): string {
  return pick(rng, PARISHES)
}

// ─── Attendance / grading ──────────────────────────────────────────────────

export type AttendanceStatus = 'present' | 'late' | 'excused_absence'

/** Weighted pick: 80% present, 10% late, 10% excused_absence. */
export function generateAttendanceStatus(rng: () => number): AttendanceStatus {
  const roll = rng()
  if (roll < 0.8) return 'present'
  if (roll < 0.9) return 'late'
  return 'excused_absence'
}

/** Score in [4.0, 10.0], rounded to 1 decimal — realistic passing-ish spread. */
export function generateScoreValue(rng: () => number): number {
  const raw = 4 + rng() * 6
  return Math.round(raw * 10) / 10
}

/** Evenly spaces `count` ISO dates (YYYY-MM-DD) across [start, end] inclusive. */
export function spreadDatesWithinRange(
  start: string,
  end: string,
  count: number,
): Array<string> {
  const startMs = new Date(start + 'T00:00:00Z').getTime()
  const endMs = new Date(end + 'T00:00:00Z').getTime()
  if (count <= 1) return [start]
  const stepMs = (endMs - startMs) / (count + 1)
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(startMs + stepMs * (i + 1))
    return d.toISOString().slice(0, 10)
  })
}

/** Splits an academic year's date range into two roughly-equal semester ranges. */
export function splitAcademicYearIntoSemesterRanges(
  startDate: string,
  endDate: string,
): [{ start: string; end: string }, { start: string; end: string }] {
  const startMs = new Date(startDate + 'T00:00:00Z').getTime()
  const endMs = new Date(endDate + 'T00:00:00Z').getTime()
  const midMs = startMs + (endMs - startMs) / 2
  const mid = new Date(midMs).toISOString().slice(0, 10)
  const midNext = new Date(midMs + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  return [
    { start: startDate, end: mid },
    { start: midNext, end: endDate },
  ]
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function makeTiptapDescription(title: string): string {
  return JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: title }],
      },
    ],
  })
}

// ─── Calendar events ────────────────────────────────────────────────────────

export type CalendarEventScope = 'board' | 'branch' | 'class'

export type CalendarEventPlanItem = {
  dateOffsetDays: number // relative to a reference "today"; range roughly [-90, 90]
  scope: CalendarEventScope
  branchIndex?: number // set iff scope === 'branch'
  classYearIndex?: number // set iff scope === 'class'; index into a flattened classYearIds list
  severity: (typeof SEVERITIES)[number]
  liturgicalDate?: string
  title: string
  description: string
}

/**
 * Builds a plain plan for `count` calendar events spread across roughly a
 * +/-90 day window around "today", with a board/branch/class scope mix
 * (mirrors the old seedCalendarEvents' scope distribution, scaled down).
 */
export function generateCalendarEventsPlan(
  rng: () => number,
  opts: { count?: number; branchCount: number; classYearCount: number },
): Array<CalendarEventPlanItem> {
  const count = opts.count ?? CALENDAR_EVENT_COUNT
  const items: Array<CalendarEventPlanItem> = []
  for (let i = 0; i < count; i++) {
    const scopeRoll = rng()
    const scope: CalendarEventScope =
      scopeRoll < 0.34 ? 'board' : scopeRoll < 0.67 ? 'branch' : 'class'
    const title = pick(rng, CALENDAR_EVENT_TITLES)
    items.push({
      dateOffsetDays: randomInt(rng, -90, 90),
      scope,
      branchIndex:
        scope === 'branch'
          ? randomInt(rng, 0, opts.branchCount - 1)
          : undefined,
      classYearIndex:
        scope === 'class'
          ? randomInt(rng, 0, opts.classYearCount - 1)
          : undefined,
      severity: pick(rng, SEVERITIES),
      liturgicalDate: pick(rng, LITURGICAL_DATES),
      title,
      description: makeTiptapDescription(title),
    })
  }
  return items
}
