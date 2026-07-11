import * as React from 'react'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '~/lib/auth'

// These message fragments match the errors thrown in convex/lib/authz.ts.
const AUTH_ERROR_PATTERNS = [
  'Catechist profile not found',
  'Account has been deleted',
  'Account is inactive',
  'Student profile not found',
]

function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return AUTH_ERROR_PATTERNS.some((pattern) => error.message.includes(pattern))
}

/** Rendered when the boundary catches an auth error. Performs forced logout. */
function ForceLogout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  React.useEffect(() => {
    toast.error(t('auth.profile_not_found'), {
      description: t('auth.forced_logout'),
      duration: 6000,
    })
    logout()
    void navigate({ to: '/login' })
  }, [logout, navigate, t])

  return null
}

type Props = { children: React.ReactNode }
type State = { caughtAuthError: boolean }

export class AuthErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { caughtAuthError: false }
  }

  static getDerivedStateFromError(error: unknown): Partial<State> | null {
    if (isAuthError(error)) {
      return { caughtAuthError: true }
    }
    // Let non-auth errors propagate normally
    return null
  }

  override componentDidCatch(error: unknown, info: React.ErrorInfo) {
    if (!isAuthError(error)) {
      throw error
    }
    console.warn(
      '[AuthErrorBoundary] Caught auth error, forcing logout:',
      error,
      info,
    )
  }

  override render() {
    if (this.state.caughtAuthError) {
      return <ForceLogout />
    }
    return this.props.children
  }
}
