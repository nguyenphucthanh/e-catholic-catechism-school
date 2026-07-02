import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // ─── 7.1 Core Organization ────────────────────────────────────────────────

  /**
   * Branch (Ngành) — 6 fixed branches, seeded at setup.
   * e.g. Chiên Con, Ấu Nhi, Thiếu Nhi, Nghĩa Sĩ, Hiệp Sĩ, Dự Trưởng
   */
  branches: defineTable({
    name: v.string(),
    sortOrder: v.number(), // 1 = Chiên Con … 6 = Dự Trưởng; must be unique per application layer
    description: v.optional(v.string()),
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_name', ['name'])
    .index('by_sort_order', ['sortOrder'])
    .index('by_is_deleted', ['isDeleted']),

  /**
   * AcademicYear (Năm Học)
   * Only one year may be active at a time (enforced at application layer).
   */
  academicYears: defineTable({
    name: v.string(), // e.g. "2024-2025"; unique per application layer
    startDate: v.string(), // ISO date string YYYY-MM-DD
    endDate: v.string(), // ISO date string YYYY-MM-DD
    timezone: v.string(), // IANA timezone, e.g. "Asia/Ho_Chi_Minh", "America/Los_Angeles"
    isActive: v.boolean(),
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_name', ['name'])
    .index('by_is_deleted', ['isDeleted'])
    .index('by_start_date', ['startDate']),

  /**
   * Semester (Học Kỳ)
   * semester_number 1–4 allowed, set once at academic year creation, immutable (enforced at application layer).
   * Unique on (academicYearId, semesterNumber).
   */
  semesters: defineTable({
    academicYearId: v.id('academicYears'),
    semesterNumber: v.number(), // 1–4 allowed, set at academic year creation, immutable
    name: v.optional(v.string()), // e.g. "Học Kỳ 1"
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_academic_year_id_and_semester_number', [
      'academicYearId',
      'semesterNumber',
    ])
    .index('by_is_deleted', ['isDeleted']),

  /**
   * Class (Lớp) — year-agnostic template.
   * e.g. "Ấu Nhi 1". Gets a new ClassYear each academic year.
   */
  classes: defineTable({
    branchId: v.id('branches'),
    name: v.string(), // e.g. "Ấu Nhi 1"
    description: v.optional(v.string()),
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_is_deleted', ['isDeleted'])
    .index('by_branch_id', ['branchId']),

  /**
   * ClassYear (Lớp × Năm Học) — live instance for a given year.
   * Central anchor for attendance, enrollments, and grading.
   * Unique on (classId, academicYearId).
   */
  classYears: defineTable({
    classId: v.id('classes'),
    academicYearId: v.id('academicYears'),
    classType: v.union(
      v.literal('primary'),
      v.literal('apostle'),
      v.literal('sacrament_review'),
      v.literal('supplemental_other'),
    ),
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_academic_year_id', ['academicYearId'])
    .index('by_class_id', ['classId'])
    .index('by_class_id_and_academic_year_id', ['classId', 'academicYearId'])
    .index('by_is_deleted', ['isDeleted']),

  // ─── 7.2 Catechists (Giáo Lý Viên) ───────────────────────────────────────

  /**
   * Catechist
   * memberId is the login identifier, derived from the document _id at the
   * UI layer (zero-padded). Unique per application layer.
   */
  catechists: defineTable({
    memberId: v.string(), // login identifier; unique per application layer
    fullName: v.string(),
    saintName: v.optional(v.string()), // Tên Thánh
    dateOfBirth: v.optional(v.string()), // ISO date string YYYY-MM-DD
    gender: v.optional(v.union(v.literal('male'), v.literal('female'))),
    role: v.union(v.literal('admin'), v.literal('user')),
    isActive: v.boolean(),
    joinedDate: v.optional(v.string()), // ISO date string YYYY-MM-DD
    notes: v.optional(v.string()),
    title: v.optional(v.string()),
    community: v.optional(v.string()),
    level: v.optional(v.string()),
    profilePhotoStorageId: v.optional(v.id('_storage')),
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_member_id', ['memberId'])
    .index('by_is_deleted', ['isDeleted']),

  /**
   * CatechistAddress — 1-to-1 with Catechist.
   * Supports Vietnam and overseas address formats.
   * Unique on catechistId per application layer.
   */
  catechistAddresses: defineTable({
    catechistId: v.id('catechists'),
    country: v.string(), // ISO 3166-1 alpha-2, e.g. "VN", "US", "AU", "CA"
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    stateProvince: v.optional(v.string()), // Tỉnh (VN) / State (US, AU) / Province (CA)
    postalCode: v.optional(v.string()),
    hamlet: v.optional(v.string()), // Giáo Họ — VN context
    subHamlet: v.optional(v.string()), // Giáo Xóm — VN context
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_catechist_id', ['catechistId'])
    .index('by_is_deleted', ['isDeleted']),

  /**
   * CatechistContact — phone / email / zalo entries per catechist.
   * Phone values must be E.164 format: +[country_code][number]
   */
  catechistContacts: defineTable({
    catechistId: v.id('catechists'),
    label: v.string(), // e.g. "Personal Phone", "Zalo"
    contactType: v.union(
      v.literal('phone'),
      v.literal('email'),
      v.literal('zalo'),
      v.literal('other'),
    ),
    value: v.string(), // E.164 for phone: +84901234567
    isPrimary: v.boolean(),
    notes: v.optional(v.string()),
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_catechist_id', ['catechistId'])
    .index('by_is_deleted', ['isDeleted']),

  /**
   * CatechistClass — Teaching Assignment.
   * Many-to-many between Catechist and ClassYear.
   * Unique on (catechistId, classYearId).
   */
  // @deprecated Use classCatechists instead
  catechistClasses: defineTable({
    catechistId: v.id('catechists'),
    classYearId: v.id('classYears'),
    role: v.union(
      v.literal('homeroom'), // chủ nhiệm
      v.literal('co_teacher'), // đồng giảng
    ),
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_catechist_id', ['catechistId'])
    .index('by_class_year_id', ['classYearId'])
    .index('by_catechist_id_and_class_year_id', ['catechistId', 'classYearId'])
    .index('by_is_deleted', ['isDeleted']),

  /**
   * AcademicYearAssignment — board_member per academic year.
   * Unique: (academicYearId, catechistId).
   */
  academicYearAssignments: defineTable({
    academicYearId: v.id('academicYears'),
    catechistId: v.id('catechists'),
    assignmentType: v.literal('board_member'),
    isDeleted: v.boolean(),
  })
    .index('by_academic_year_id', ['academicYearId'])
    .index('by_catechist_id', ['catechistId'])
    .index('by_academic_year_id_and_catechist_id', [
      'academicYearId',
      'catechistId',
    ])
    .index('by_is_deleted', ['isDeleted']),

  /**
   * BranchAssignment — branch_head per branch per academic year.
   * One catechist may head multiple branches in same AY.
   * Unique: (academicYearId, catechistId, branchId).
   */
  branchAssignments: defineTable({
    academicYearId: v.id('academicYears'),
    catechistId: v.id('catechists'),
    branchId: v.id('branches'),
    isDeleted: v.boolean(),
  })
    .index('by_academic_year_id', ['academicYearId'])
    .index('by_catechist_id', ['catechistId'])
    .index('by_branch_id', ['branchId'])
    .index('by_academic_year_id_and_branch_id', ['academicYearId', 'branchId'])
    .index('by_academic_year_id_and_catechist_id_and_branch_id', [
      'academicYearId',
      'catechistId',
      'branchId',
    ])
    .index('by_is_deleted', ['isDeleted']),

  /**
   * ClassCatechist — teaching assignment per class per AY.
   * Replaces catechistClasses with explicit academicYearId.
   * Unique: (catechistId, classYearId).
   */
  classCatechists: defineTable({
    catechistId: v.id('catechists'),
    classYearId: v.id('classYears'),
    academicYearId: v.id('academicYears'),
    role: v.union(v.literal('homeroom'), v.literal('co_teacher')),
    isDeleted: v.boolean(),
  })
    .index('by_catechist_id', ['catechistId'])
    .index('by_class_year_id', ['classYearId'])
    .index('by_academic_year_id', ['academicYearId'])
    .index('by_catechist_id_and_class_year_id', ['catechistId', 'classYearId'])
    .index('by_is_deleted', ['isDeleted']),

  // ─── 7.3 Students (Học Sinh) ──────────────────────────────────────────────

  /**
   * Student
   * studentCode is the parent-login identifier, derived from _id at UI layer.
   * createdAt is immutable (set once on creation, Unix ms).
   */
  students: defineTable({
    studentCode: v.string(), // login identifier for parent; unique per application layer
    fullName: v.string(),
    saintName: v.optional(v.string()), // Tên Thánh
    dateOfBirth: v.optional(v.string()), // ISO date string YYYY-MM-DD; also default password DDMMYYYY
    gender: v.optional(v.union(v.literal('male'), v.literal('female'))),
    previousParish: v.optional(v.string()), // Giáo xứ cũ
    previousDiocese: v.optional(v.string()), // Giáo phận cũ
    isActive: v.boolean(),
    createdAt: v.number(), // Unix ms; immutable
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_student_code', ['studentCode'])
    .index('by_is_active', ['isActive'])
    .index('by_is_deleted', ['isDeleted']),

  /**
   * StudentAddress — 1-to-1 with Student.
   * Unique on studentId per application layer.
   */
  studentAddresses: defineTable({
    studentId: v.id('students'),
    country: v.string(), // ISO 3166-1 alpha-2
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    stateProvince: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    hamlet: v.optional(v.string()), // Giáo Họ
    subHamlet: v.optional(v.string()), // Giáo Xóm
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_student_id', ['studentId'])
    .index('by_is_deleted', ['isDeleted']),

  /**
   * Guardian (Phụ Huynh / Người Bảo Hộ) — independent entity.
   * One Guardian record per adult, shared across sibling students via StudentGuardian.
   */
  guardians: defineTable({
    fullName: v.string(),
    saintName: v.optional(v.string()), // Tên Thánh
    notes: v.optional(v.string()),
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  }).index('by_is_deleted', ['isDeleted']),

  /**
   * GuardianContact — contact entries attached to the Guardian, not the Student.
   * Updating a number here propagates to all linked children automatically.
   * Phone values must be E.164: +[country_code][number]
   * Indexed on value for phone-number lookup flow.
   */
  guardianContacts: defineTable({
    guardianId: v.id('guardians'),
    contactType: v.union(
      v.literal('phone'),
      v.literal('email'),
      v.literal('zalo'),
      v.literal('other'),
    ),
    value: v.string(), // E.164 for phone; indexed for lookup
    isPrimary: v.boolean(),
    notes: v.optional(v.string()), // e.g. "Call after 5pm"
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_guardian_id', ['guardianId'])
    .index('by_value', ['value'])
    .index('by_is_deleted', ['isDeleted']),

  /**
   * StudentGuardian — many-to-many link between Student and Guardian.
   * Enables sibling families and ordered emergency contact lists.
   * Unique on (studentId, guardianId).
   * Unique on (studentId, contactPriority) — no duplicate priority per student.
   */
  studentGuardians: defineTable({
    studentId: v.id('students'),
    guardianId: v.id('guardians'),
    relationship: v.string(), // "father" / "mother" / "guardian" / free text
    contactPriority: v.number(), // 1 = first to contact; unique per studentId
    notes: v.optional(v.string()), // e.g. "custody: weekdays only"
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_student_id', ['studentId'])
    .index('by_guardian_id', ['guardianId'])
    .index('by_student_id_and_guardian_id', ['studentId', 'guardianId'])
    .index('by_student_id_and_contact_priority', [
      'studentId',
      'contactPriority',
    ])
    .index('by_is_deleted', ['isDeleted']),

  /**
   * StudentSacrament — one row per sacrament per student. Max 4 rows.
   * Unique on (studentId, sacramentType).
   */
  studentSacraments: defineTable({
    studentId: v.id('students'),
    sacramentType: v.union(
      v.literal('baptism'),
      v.literal('first_confession'),
      v.literal('first_communion'),
      v.literal('confirmation'),
    ),
    receivedDate: v.optional(v.string()), // ISO date string YYYY-MM-DD
    receivedPlace: v.optional(v.string()), // free text: church name, parish
    notes: v.optional(v.string()),
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_student_id', ['studentId'])
    .index('by_student_id_and_sacrament_type', ['studentId', 'sacramentType'])
    .index('by_is_deleted', ['isDeleted']),

  /**
   * StudentClass — Enrollment Record.
   * Exactly one primary class per student per academic year (enforced at application layer).
   * Unique on (studentId, classYearId).
   */
  studentClasses: defineTable({
    studentId: v.id('students'),
    classYearId: v.id('classYears'),
    isPrimaryClass: v.boolean(), // true = primary; exactly one per student per year
    enrolledDate: v.string(), // ISO date string YYYY-MM-DD
    status: v.union(
      v.literal('active'),
      v.literal('on_leave'),
      v.literal('withdrawn'),
    ),
    statusChangedDate: v.optional(v.string()), // ISO date string YYYY-MM-DD
    leftDate: v.optional(v.string()), // ISO date string; set only when status = withdrawn
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_student_id', ['studentId'])
    .index('by_class_year_id', ['classYearId'])
    .index('by_student_id_and_class_year_id', ['studentId', 'classYearId'])
    .index('by_student_id_and_is_primary_class', [
      'studentId',
      'isPrimaryClass',
    ])
    .index('by_status', ['status'])
    .index('by_is_deleted', ['isDeleted']),

  // ─── 7.4 Attendance ───────────────────────────────────────────────────────

  /**
   * ClassSession (Buổi Học) — one scheduled meeting.
   * Cancelled sessions (isCancelled = true) are excluded from diligence calculation.
   *
   * Two scopes, by sessionType:
   * - class-scoped (catechism, supplemental): classYearId + semesterId required.
   *   Feeds per-class diligence_score.
   * - parish-scoped (mass, extracurricular): classYearId + semesterId are null —
   *   one row per date for the whole parish, not per class. academicYearId is set
   *   instead. Never feeds diligence_score; tracked separately for campaign
   *   reporting (e.g. mass_attendance_rate, computed the same way as diligence
   *   but scoped by date range instead of class).
   */
  classSessions: defineTable({
    classYearId: v.optional(v.id('classYears')), // required for catechism/supplemental; null for mass/extracurricular
    semesterId: v.optional(v.id('semesters')), // required for catechism/supplemental; null for mass/extracurricular
    academicYearId: v.optional(v.id('academicYears')), // set for mass/extracurricular only
    sessionDate: v.string(), // ISO date string YYYY-MM-DD
    sessionType: v.union(
      v.literal('mass'),
      v.literal('catechism'),
      v.literal('supplemental'),
      v.literal('extracurricular'),
    ),
    isCancelled: v.boolean(),
    notes: v.optional(v.string()),
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_class_year_id_and_semester_id', ['classYearId', 'semesterId'])
    .index('by_session_date', ['sessionDate'])
    .index('by_session_type_and_session_date', ['sessionType', 'sessionDate'])
    .index('by_is_deleted', ['isDeleted']),

  /**
   * AttendanceRecord (Điểm Danh) — one record per student per session.
   * studentClassId always points at the student's *primary* StudentClass for the
   * relevant academic year — for class-scoped sessions that's the obvious class;
   * for parish-scoped sessions (mass, extracurricular) the session itself has no
   * class, so the mutation resolves studentClassId via the student's primary
   * enrollment instead.
   * Two timestamps support offline-first QR scanning.
   * deviceQueuedAt: actual moment of scan on device — source of truth for presence.
   * syncedAt: server-side receipt time; null means not yet synced.
   * Unique on (sessionId, studentClassId) — first-write-wins on conflict.
   */
  attendanceRecords: defineTable({
    sessionId: v.id('classSessions'),
    studentClassId: v.id('studentClasses'),
    status: v.union(
      v.literal('present'),
      v.literal('excused_absence'),
      v.literal('unexcused_absence'),
      v.literal('late'),
    ),
    notes: v.optional(v.string()),
    recordedBy: v.id('catechists'),
    deviceQueuedAt: v.number(), // Unix ms; immutable; source of truth
    syncedAt: v.optional(v.number()), // Unix ms; null = not yet synced
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_session_id', ['sessionId'])
    .index('by_student_class_id', ['studentClassId'])
    .index('by_session_id_and_student_class_id', [
      'sessionId',
      'studentClassId',
    ])
    .index('by_synced_at', ['syncedAt'])
    .index('by_is_deleted', ['isDeleted']),

  // ─── 7.5 Grading ──────────────────────────────────────────────────────────

  /**
   * ScoreColumn — grade column configuration per class per semester.
   * Two columns are auto-seeded at semester creation with isMandatory = true:
   * semester_exam and diligence. These cannot be deleted.
   * diligence columns never have ScoreEntry rows (computed from attendance).
   */
  scoreColumns: defineTable({
    classYearId: v.id('classYears'),
    semesterId: v.id('semesters'),
    columnName: v.string(), // e.g. "15-min Quiz 1", "Semester Exam"
    columnType: v.union(
      v.literal('short_quiz'),
      v.literal('midterm_test'),
      v.literal('semester_exam'),
      v.literal('diligence'),
    ),
    weight: v.optional(v.number()), // null for diligence; defaults: short_quiz=1, midterm_test=2, semester_exam=3
    isMandatory: v.boolean(), // true for semester_exam and diligence
    sortOrder: v.number(),
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_class_year_id_and_semester_id', ['classYearId', 'semesterId'])
    .index('by_is_deleted', ['isDeleted']),

  /**
   * ScoreEntry — one numeric score per student per column.
   * Only for short_quiz, midterm_test, semester_exam. Never for diligence.
   * Unique on (studentClassId, scoreColumnId).
   * weighted_average is computed at query time — never stored.
   */
  scoreEntries: defineTable({
    studentClassId: v.id('studentClasses'),
    scoreColumnId: v.id('scoreColumns'),
    score: v.optional(v.number()), // 0.00 – 10.00
    enteredBy: v.id('catechists'),
    enteredAt: v.number(), // Unix ms
    updatedAt: v.optional(v.number()), // Unix ms
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_student_class_id', ['studentClassId'])
    .index('by_score_column_id', ['scoreColumnId'])
    .index('by_student_class_id_and_score_column_id', [
      'studentClassId',
      'scoreColumnId',
    ])
    .index('by_is_deleted', ['isDeleted']),

  /**
   * ScoreEntryHistory — append-only audit trail.
   * One row per modification to any ScoreEntry. Immutable after write.
   * No isDeleted — audit trail rows are never deleted, soft or hard.
   */
  scoreEntryHistories: defineTable({
    scoreEntryId: v.id('scoreEntries'),
    oldScore: v.optional(v.number()), // null on initial entry
    newScore: v.optional(v.number()),
    changedBy: v.id('catechists'),
    changedAt: v.number(), // Unix ms; immutable
    reason: v.optional(v.string()),
  }).index('by_score_entry_id', ['scoreEntryId']),

  /**
   * AnnualResult — end-of-year evaluation, written once per student per class year.
   * conduct is qualitative — not a ScoreColumn.
   * weighted_average and diligence_score are computed at query time — never stored here.
   * Unique on studentClassId.
   */
  annualResults: defineTable({
    studentClassId: v.id('studentClasses'),
    conductGrade: v.optional(
      v.union(
        v.literal('excellent'),
        v.literal('good'),
        v.literal('average'),
        v.literal('below_average'),
        v.literal('poor'),
      ),
    ),
    remark: v.optional(v.string()), // homeroom teacher's narrative
    isCompleted: v.optional(v.boolean()), // true = passed the year
    recordedBy: v.optional(v.id('catechists')),
    recordedAt: v.optional(v.number()), // Unix ms
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_student_class_id', ['studentClassId'])
    .index('by_is_deleted', ['isDeleted']),

  // ─── 7.6 Authentication ───────────────────────────────────────────────────

  /**
   * Account — source of truth for credentials.
   * loginId: catechist → member_id; parent → student's student_code. Unique.
   * userRefId: points to catechists._id or students._id depending on accountType.
   * createdAt is immutable.
   * No email-based reset flow — passwords reset by admin only.
   */
  accounts: defineTable({
    loginId: v.string(), // unique per application layer
    passwordHash: v.string(), // bcrypt or argon2; never plaintext
    accountType: v.union(v.literal('catechist'), v.literal('student')),
    userRefId: v.union(v.id('catechists'), v.id('students')), // polymorphic; type determined by accountType
    isActive: v.boolean(),
    lastLoginAt: v.optional(v.number()), // Unix ms
    createdAt: v.number(), // Unix ms; immutable
    isDeleted: v.boolean(), // soft delete — never hard-delete, preserves relationships
  })
    .index('by_login_id', ['loginId'])
    .index('by_is_deleted', ['isDeleted']),

  // counters — internal sequence generator, not user data. No isDeleted.
  counters: defineTable({
    name: v.string(),
    value: v.number(),
  }).index('by_name', ['name']),
})
