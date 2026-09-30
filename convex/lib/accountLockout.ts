export const MAX_FAILED_LOGIN_ATTEMPTS = 5
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes
export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

export const RESET_LOCKOUT_FIELDS = {
  failedLoginAttempts: 0,
  lockoutUntil: undefined,
  lastFailedLoginAt: undefined,
} as const
