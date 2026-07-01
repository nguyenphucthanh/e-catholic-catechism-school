import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

// Unmock ~/lib/auth so we can test the real implementation
vi.unmock('~/lib/auth')

// Re-import the real module after unmocking
const { AuthProvider, useAuth } = await import('~/lib/auth')

// Clear localStorage between tests
beforeEach(() => {
  localStorage.clear()
})

// Helper: a component that exercises the auth context
function AuthConsumer() {
  const { user, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="user">{user ? user.fullName : 'no-user'}</span>
      <button
        onClick={() =>
          login({
            userDocId: 'cat1',
            memberId: 'GLV0001',
            fullName: 'Nguyễn Văn A',
            accountType: 'catechist',
            role: 'admin',
          })
        }
      >
        login
      </button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

describe('AuthProvider / useAuth', () => {
  test('starts with no user when localStorage is empty', () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )
    expect(screen.getByTestId('user').textContent).toBe('no-user')
  })

  test('login sets the user and persists to localStorage', () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'login' }))
    })
    expect(screen.getByTestId('user').textContent).toBe('Nguyễn Văn A')
    const stored = JSON.parse(localStorage.getItem('giaoly_auth')!)
    expect(stored.memberId).toBe('GLV0001')
  })

  test('logout clears the user and removes from localStorage', () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'login' }))
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'logout' }))
    })
    expect(screen.getByTestId('user').textContent).toBe('no-user')
    expect(localStorage.getItem('giaoly_auth')).toBeNull()
  })

  test('reads persisted user from localStorage on mount', () => {
    const stored = {
      userDocId: 'cat99',
      memberId: 'GLV0099',
      fullName: 'Persisted User',
      accountType: 'catechist',
      role: null,
    }
    localStorage.setItem('giaoly_auth', JSON.stringify(stored))

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )
    expect(screen.getByTestId('user').textContent).toBe('Persisted User')
  })

  test('handles corrupted localStorage data gracefully', () => {
    localStorage.setItem('giaoly_auth', 'not-valid-json}}}')

    // Should not throw; falls back to null
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )
    expect(screen.getByTestId('user').textContent).toBe('no-user')
  })

  test('useAuth throws when used outside AuthProvider', () => {
    // Suppress the expected React error boundary console output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function Bare() {
      useAuth()
      return null
    }

    expect(() => render(<Bare />)).toThrow(
      'useAuth must be used within AuthProvider',
    )

    spy.mockRestore()
  })
})
