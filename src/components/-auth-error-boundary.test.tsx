import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { AuthErrorBoundary } from './auth-error-boundary'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: vi.fn(() => vi.fn()),
}))

vi.mock('~/lib/auth', () => ({
  useAuth: vi.fn(() => ({ logout: vi.fn() })),
}))

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({ t: (k: string) => k })),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

// Suppress the React error boundary console output during tests
const originalConsoleError = console.error
const originalConsoleWarn = console.warn
beforeEach(() => {
  vi.clearAllMocks()
  console.error = vi.fn()
  console.warn = vi.fn()
})
afterEach(() => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})

/** A child component that throws a given error on render. */
function ThrowOnRender({ error }: { error: Error }): React.ReactNode {
  throw error
}

describe('AuthErrorBoundary', () => {
  describe('when the error is an auth error', () => {
    const authErrors = [
      new Error('AUTHZ_CATECHIST_NOT_FOUND'),
      new Error('AUTHZ_ACCOUNT_DELETED'),
      new Error('AUTHZ_ACCOUNT_INACTIVE'),
      new Error('AUTHZ_STUDENT_NOT_FOUND'),
    ]

    test.each(authErrors)(
      'catches "$message" and triggers forced logout',
      async (error) => {
        // Set up spies fresh each iteration
        const mockNavigate = vi.fn()
        const mockLogout = vi.fn()
        const { useNavigate } = await import('@tanstack/react-router')
        const { useAuth } = await import('~/lib/auth')
        const { toast } = await import('sonner')
        vi.mocked(useNavigate).mockReturnValue(mockNavigate as any)
        vi.mocked(useAuth).mockReturnValue({
          logout: mockLogout,
          login: vi.fn(),
          user: null,
        })

        render(
          <AuthErrorBoundary>
            <ThrowOnRender error={error} />
          </AuthErrorBoundary>,
        )

        await waitFor(() => {
          expect(toast.error).toHaveBeenCalledWith(
            'auth.profile_not_found',
            expect.objectContaining({ description: 'auth.forced_logout' }),
          )
          expect(mockLogout).toHaveBeenCalledTimes(1)
          expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' })
        })
      },
    )
  })

  describe('when children render successfully', () => {
    test('renders children normally without triggering logout', async () => {
      const { useAuth } = await import('~/lib/auth')
      const mockLogout = vi.fn()
      vi.mocked(useAuth).mockReturnValue({
        logout: mockLogout,
        login: vi.fn(),
        user: null,
      })

      render(
        <AuthErrorBoundary>
          <div data-testid="child">Hello</div>
        </AuthErrorBoundary>,
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
      expect(mockLogout).not.toHaveBeenCalled()
    })
  })

  describe('when the error is NOT an auth error', () => {
    test('re-throws the error so it propagates to a parent boundary', async () => {
      const nonAuthError = new Error('Something else went wrong')
      const { useAuth } = await import('~/lib/auth')
      const { toast } = await import('sonner')
      const mockLogout = vi.fn()
      vi.mocked(useAuth).mockReturnValue({
        logout: mockLogout,
        login: vi.fn(),
        user: null,
      })

      // Wrap in a simple outer error boundary to catch the re-throw
      class OuterBoundary extends React.Component<
        { children: React.ReactNode },
        { caught: boolean }
      > {
        constructor(props: { children: React.ReactNode }) {
          super(props)
          this.state = { caught: false }
        }
        static getDerivedStateFromError() {
          return { caught: true }
        }
        override render() {
          if (this.state.caught) return <div data-testid="outer-caught" />
          return this.props.children
        }
      }

      render(
        <OuterBoundary>
          <AuthErrorBoundary>
            <ThrowOnRender error={nonAuthError} />
          </AuthErrorBoundary>
        </OuterBoundary>,
      )

      expect(screen.getByTestId('outer-caught')).toBeInTheDocument()
      expect(mockLogout).not.toHaveBeenCalled()
      expect(toast.error).not.toHaveBeenCalled()
    })
  })

  describe('when pathname prop changes after catching an error', () => {
    test('resets the caught error state and renders children again', async () => {
      const error = new Error('AUTHZ_CATECHIST_NOT_FOUND')
      const mockNavigate = vi.fn()
      const mockLogout = vi.fn()
      const { useNavigate } = await import('@tanstack/react-router')
      const { useAuth } = await import('~/lib/auth')

      vi.mocked(useNavigate).mockReturnValue(mockNavigate as any)
      vi.mocked(useAuth).mockReturnValue({
        logout: mockLogout,
        login: vi.fn(),
        user: null,
      })

      let shouldThrow = true
      function ConditionalThrow() {
        if (shouldThrow) {
          throw error
        }
        return <div data-testid="recovered-child">Recovered!</div>
      }

      const { rerender } = render(
        <AuthErrorBoundary pathname="/old-path">
          <ConditionalThrow />
        </AuthErrorBoundary>,
      )

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalledTimes(1)
      })

      shouldThrow = false
      rerender(
        <AuthErrorBoundary pathname="/new-path">
          <ConditionalThrow />
        </AuthErrorBoundary>,
      )

      expect(screen.getByTestId('recovered-child')).toBeInTheDocument()
    })
  })
})
