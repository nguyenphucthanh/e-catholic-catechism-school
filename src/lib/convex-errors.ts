import {
  ACADEMIC_YEAR_ERRORS,
  ACCOUNT_ADMIN_ERRORS,
  ASSIGNMENT_ERRORS,
  ATTENDANCE_ERRORS,
  AUTHZ_ERRORS,
  AUTH_ERRORS,
  BRANCH_ERRORS,
  CALENDAR_EVENT_ERRORS,
  CATECHIST_ERRORS,
  CLASS_ERRORS,
  CLASS_SESSION_ERRORS,
  ENROLLMENT_ERRORS,
  EXTRACURRICULAR_ERRORS,
  GRADING_ERRORS,
  GUARDIAN_ERRORS,
  SCORE_COLUMN_ERRORS,
  SCORE_ENTRY_ERRORS,
  SETUP_ERRORS,
  STUDENT_ERRORS,
} from '../../convex/lib/errors'

// Maps stable Convex error codes (convex/lib/errors.ts) to i18n keys, so a
// thrown code can be shown to the user as a specific, translated message
// instead of a generic one or a raw code string.
const CODE_TO_I18N_KEY: Record<string, string> = {
  [ACADEMIC_YEAR_ERRORS.DUPLICATE_NAME]: 'academicYears.fields.name.duplicate',
  [ACADEMIC_YEAR_ERRORS.CANNOT_DELETE_ACTIVE]:
    'academicYears.deleteActiveError',
  [ACADEMIC_YEAR_ERRORS.INVALID_SEMESTER_COUNT]:
    'academicYears.fields.numberOfSemesters.error',
  [ACADEMIC_YEAR_ERRORS.NOT_FOUND]: 'errors.academicYearNotFound',

  [BRANCH_ERRORS.DUPLICATE_NAME]: 'branches.fields.name.duplicate',
  [BRANCH_ERRORS.NOT_FOUND]: 'branches.detail.notFound',
  [BRANCH_ERRORS.IN_USE_BY_CLASS]: 'branches.deleteInUseError',

  [CLASS_ERRORS.NOT_FOUND]: 'errors.classNotFound',
  [CLASS_ERRORS.IN_USE_BY_CLASS_YEAR]: 'classes.deleteInUseError',
  [CLASS_ERRORS.EMPTY_NAME]: 'errors.classNameRequired',
  [CLASS_ERRORS.CLASS_YEAR_DUPLICATE]: 'classes.classYearDuplicate',

  [STUDENT_ERRORS.NOT_FOUND]: 'students.notFound',
  [STUDENT_ERRORS.IN_USE_BY_ENROLLMENT]: 'students.deleteActiveEnrollmentError',
  [STUDENT_ERRORS.ADDRESS_NOT_FOUND]: 'errors.studentAddressNotFound',
  [STUDENT_ERRORS.EXPORT_UNAUTHORIZED]: 'students.export.unauthorized',

  [CATECHIST_ERRORS.NOT_FOUND]: 'catechists.notFound',
  [CATECHIST_ERRORS.DUPLICATE_MEMBER_ID]: 'errors.catechistMemberIdDuplicate',
  [CATECHIST_ERRORS.CONTACT_NOT_FOUND]: 'errors.catechistContactNotFound',
  [CATECHIST_ERRORS.ADDRESS_NOT_FOUND]: 'errors.catechistAddressNotFound',
  [CATECHIST_ERRORS.INVALID_PHONE]: 'errors.invalidPhone',
  [CATECHIST_ERRORS.EXPORT_UNAUTHORIZED]: 'catechists.export.unauthorized',
  [CATECHIST_ERRORS.OWN_PROFILE_ONLY]: 'errors.ownProfileOnly',
  [CATECHIST_ERRORS.OWN_ADDRESS_ONLY]: 'errors.ownAddressOnly',
  [CATECHIST_ERRORS.OWN_CONTACT_ONLY]: 'errors.ownContactOnly',
  [CATECHIST_ERRORS.OWN_PROFILE_PHOTO_UPDATE_ONLY]: 'errors.ownPhotoUpdateOnly',
  [CATECHIST_ERRORS.OWN_PROFILE_PHOTO_DELETE_ONLY]: 'errors.ownPhotoDeleteOnly',

  [GUARDIAN_ERRORS.NOT_FOUND]: 'errors.guardianNotFound',
  [GUARDIAN_ERRORS.CONTACT_NOT_FOUND]: 'errors.guardianContactNotFound',
  [GUARDIAN_ERRORS.INVALID_PHONE]: 'errors.invalidPhone',
  [GUARDIAN_ERRORS.LINK_NOT_FOUND]: 'errors.guardianLinkNotFound',
  [GUARDIAN_ERRORS.DUPLICATE_LINK]: 'errors.guardianDuplicateLink',
  [GUARDIAN_ERRORS.DUPLICATE_PRIORITY]: 'errors.guardianDuplicatePriority',
  [GUARDIAN_ERRORS.IN_USE_BY_STUDENT]: 'errors.guardianInUseByStudent',

  [ENROLLMENT_ERRORS.CLASS_YEAR_NOT_FOUND]: 'errors.classYearNotFound',
  [ENROLLMENT_ERRORS.ACADEMIC_YEAR_NOT_ACTIVE]: 'errors.academicYearInactive',
  [ENROLLMENT_ERRORS.ALREADY_ENROLLED]: 'errors.alreadyEnrolled',
  [ENROLLMENT_ERRORS.PRIMARY_CLASS_CONFLICT]: 'students.promote.conflictError',
  [ENROLLMENT_ERRORS.RECORD_NOT_FOUND]: 'errors.enrollmentRecordNotFound',
  [ENROLLMENT_ERRORS.UNAUTHORIZED]: 'errors.enrollmentUnauthorized',
  [ENROLLMENT_ERRORS.STUDENT_NOT_ENROLLED]: 'errors.studentNotEnrolled',

  [CLASS_SESSION_ERRORS.NOT_FOUND]: 'errors.classSessionNotFound',
  [CLASS_SESSION_ERRORS.INACTIVE_ACADEMIC_YEAR]: 'errors.academicYearInactive',
  [CLASS_SESSION_ERRORS.INVALID_SCOPE]: 'errors.invalidScope',
  [CLASS_SESSION_ERRORS.CLASS_YEAR_NOT_FOUND]: 'errors.classYearNotFound',
  [CLASS_SESSION_ERRORS.SEMESTER_NOT_FOUND]: 'errors.semesterNotFound',
  [CLASS_SESSION_ERRORS.NO_ACTIVE_YEAR]: 'errors.noActiveAcademicYear',
  [CLASS_SESSION_ERRORS.ACADEMIC_YEAR_NOT_FOUND]: 'errors.academicYearNotFound',
  [CLASS_SESSION_ERRORS.MISSING_ACADEMIC_YEAR_REF]:
    'errors.academicYearNotFound',
  [CLASS_SESSION_ERRORS.DUPLICATE_STUDENT_IN_ATTENDANCE]:
    'errors.duplicateStudentInList',

  [ATTENDANCE_ERRORS.SESSION_NOT_FOUND]: 'errors.classSessionNotFound',
  [ATTENDANCE_ERRORS.SESSION_CANCELLED]: 'errors.sessionCancelled',
  [ATTENDANCE_ERRORS.STUDENT_NOT_ENROLLED]: 'errors.studentNotEnrolled',
  [ATTENDANCE_ERRORS.INACTIVE_ACADEMIC_YEAR]: 'errors.academicYearInactive',
  [ATTENDANCE_ERRORS.ALREADY_RECORDED]: 'errors.attendanceAlreadyRecorded',
  [ATTENDANCE_ERRORS.RECORD_NOT_FOUND]: 'errors.attendanceRecordNotFound',

  [SCORE_COLUMN_ERRORS.NOT_FOUND]: 'errors.scoreColumnNotFound',
  [SCORE_COLUMN_ERRORS.DUPLICATE_NAME]: 'errors.scoreColumnDuplicateName',
  [SCORE_COLUMN_ERRORS.IN_USE_BY_ENTRIES]: 'errors.scoreColumnInUse',
  [SCORE_COLUMN_ERRORS.INVALID_WEIGHT]: 'exams.popover.scoreRangeError',

  [SCORE_ENTRY_ERRORS.NOT_FOUND]: 'errors.scoreEntryNotFound',
  [SCORE_ENTRY_ERRORS.DUPLICATE_ENTRY]: 'errors.scoreEntryDuplicate',
  [SCORE_ENTRY_ERRORS.COLUMN_NOT_FOUND]: 'errors.scoreColumnNotFound',

  [CALENDAR_EVENT_ERRORS.NOT_FOUND]: 'errors.calendarEventNotFound',
  [CALENDAR_EVENT_ERRORS.INACTIVE_ACADEMIC_YEAR]: 'errors.academicYearInactive',
  [CALENDAR_EVENT_ERRORS.INVALID_SCOPE]: 'errors.invalidScope',
  [CALENDAR_EVENT_ERRORS.BRANCH_NOT_FOUND]: 'branches.detail.notFound',
  [CALENDAR_EVENT_ERRORS.CLASS_YEAR_NOT_FOUND]: 'errors.classYearNotFound',
  [CALENDAR_EVENT_ERRORS.UNAUTHORIZED]: 'errors.calendarEventUnauthorized',
  [CALENDAR_EVENT_ERRORS.NOT_ASSIGNED]: 'errors.calendarEventNotAssigned',

  [AUTHZ_ERRORS.CATECHIST_NOT_FOUND]: 'auth.profile_not_found',
  [AUTHZ_ERRORS.STUDENT_NOT_FOUND]: 'auth.profile_not_found',
  [AUTHZ_ERRORS.ACCOUNT_DELETED]: 'auth.profile_not_found',
  [AUTHZ_ERRORS.ACCOUNT_INACTIVE]: 'auth.profile_not_found',
  [AUTHZ_ERRORS.ADMIN_REQUIRED]: 'errors.adminRequired',
  [AUTHZ_ERRORS.NOT_BOARD_MEMBER]: 'errors.notBoardMember',
  [AUTHZ_ERRORS.NOT_BRANCH_HEAD_OR_ABOVE]: 'errors.notBranchHead',
  [AUTHZ_ERRORS.CLASS_YEAR_NOT_FOUND]: 'errors.classYearNotFound',
  [AUTHZ_ERRORS.CLASS_NOT_FOUND]: 'errors.classNotFound',
  [AUTHZ_ERRORS.NO_CLASS_ACCESS]: 'errors.noClassAccess',
  [AUTHZ_ERRORS.CANNOT_EDIT_STUDENT]: 'errors.cannotEditStudent',
  [AUTHZ_ERRORS.CANNOT_MANAGE_GUARDIAN]: 'errors.cannotManageGuardian',
  [AUTHZ_ERRORS.UNAUTHORIZED]: 'common.contactAdmin',

  [AUTH_ERRORS.INVALID_CREDENTIALS]: 'errors.invalidCredentials',
  [AUTH_ERRORS.USER_NOT_FOUND]: 'auth.profile_not_found',
  [AUTH_ERRORS.CURRENT_PASSWORD_INCORRECT]: 'password.error.incorrect',

  [SETUP_ERRORS.ALREADY_COMPLETED]: 'errors.setupAlreadyCompleted',
  [SETUP_ERRORS.LOGIN_ID_IN_USE]: 'errors.loginIdInUse',
  [SETUP_ERRORS.PASSWORD_TOO_SHORT]: 'errors.passwordTooShort',

  [ASSIGNMENT_ERRORS.ACADEMIC_YEAR_NOT_FOUND]: 'errors.academicYearNotFound',
  [ASSIGNMENT_ERRORS.INACTIVE_ACADEMIC_YEAR]: 'errors.academicYearInactive',
  [ASSIGNMENT_ERRORS.INVALID_CATECHIST]: 'errors.invalidCatechist',
  [ASSIGNMENT_ERRORS.BRANCH_NOT_FOUND]: 'branches.detail.notFound',
  [ASSIGNMENT_ERRORS.CLASS_YEAR_NOT_FOUND]: 'errors.classYearNotFound',
  [ASSIGNMENT_ERRORS.CLASS_YEAR_WRONG_ACADEMIC_YEAR]:
    'errors.classYearWrongAcademicYear',
  [ASSIGNMENT_ERRORS.INVALID_HOMEROOM_CATECHIST]: 'errors.invalidCatechist',
  [ASSIGNMENT_ERRORS.INVALID_CO_TEACHER_CATECHIST]: 'errors.invalidCatechist',

  [GRADING_ERRORS.CLASS_YEAR_NOT_FOUND]: 'errors.classYearNotFound',
  [GRADING_ERRORS.SEMESTER_NOT_FOUND]: 'errors.semesterNotFound',
  [GRADING_ERRORS.DUPLICATE_STUDENT_IN_SCORES]: 'errors.duplicateStudentInList',
  [GRADING_ERRORS.STUDENT_NOT_ENROLLED]: 'errors.studentNotEnrolled',

  // ACCOUNT_ADMIN_ERRORS.CATECHIST_NOT_FOUND and .STUDENT_NOT_FOUND share the
  // same string values as CATECHIST_ERRORS.NOT_FOUND / STUDENT_ERRORS.NOT_FOUND
  // above, so they're already covered by those entries.
  [ACCOUNT_ADMIN_ERRORS.ACCOUNT_ALREADY_EXISTS]:
    'adminAccounts.accountAlreadyExists',
  [ACCOUNT_ADMIN_ERRORS.ACCOUNT_NOT_FOUND]: 'errors.accountNotFound',
  [ACCOUNT_ADMIN_ERRORS.CANNOT_LOGIN_AS_SELF]: 'errors.cannotLoginAsSelf',
  [ACCOUNT_ADMIN_ERRORS.ACCOUNT_NOT_ACTIVE]: 'errors.accountNotActive',

  [EXTRACURRICULAR_ERRORS.NOT_FOUND]: 'errors.extracurricularNotFound',
  [EXTRACURRICULAR_ERRORS.INVALID_DATE_RANGE]:
    'errors.extracurricularInvalidDateRange',
  [EXTRACURRICULAR_ERRORS.INVALID_ENROLLMENT_DATE]:
    'errors.extracurricularInvalidEnrollmentDate',
  [EXTRACURRICULAR_ERRORS.ALREADY_ENROLLED]:
    'errors.extracurricularAlreadyEnrolled',
  [EXTRACURRICULAR_ERRORS.NOT_ENROLLED]: 'errors.extracurricularNotEnrolled',
  [EXTRACURRICULAR_ERRORS.CAPACITY_EXCEEDED]:
    'errors.extracurricularCapacityExceeded',
  [EXTRACURRICULAR_ERRORS.PAST_START_DATE]:
    'errors.extracurricularPastStartDate',
}

/**
 * Translates a thrown Convex error into a specific, localized message.
 * Falls back to `common.error` when the error isn't a recognized stable
 * code (e.g. a network error, or an old ad-hoc string not yet migrated).
 */
export function translateConvexError(
  err: unknown,
  t: (key: string) => string,
  fallback = 'common.error',
): string {
  const message = err instanceof Error ? err.message : undefined
  if (!message) return t(fallback)

  const directKey = CODE_TO_I18N_KEY[message]
  if (directKey) {
    return t(directKey)
  }

  // Look for any known stable error code embedded within the message string
  for (const code of Object.keys(CODE_TO_I18N_KEY)) {
    if (message.includes(code)) {
      return t(CODE_TO_I18N_KEY[code])
    }
  }

  return t(fallback)
}
