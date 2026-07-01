import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation } from 'convex/react'
import { Route } from './login'
import { useAuth } from '~/lib/auth'

describe('LoginPage route component', () => {
  test('renders login card and input fields successfully', () => {
    const LoginPageComponent = (Route as any).options.component
    render(<LoginPageComponent />)

    expect(screen.getByLabelText('auth.loginId')).toBeInTheDocument()
    expect(screen.getByLabelText('auth.password')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'auth.login' }),
    ).toBeInTheDocument()
  })

  test('renders GL logo and app title', () => {
    const LoginPageComponent = (Route as any).options.component
    render(<LoginPageComponent />)

    expect(screen.getByText('GL')).toBeInTheDocument()
    expect(screen.getByText('app.name')).toBeInTheDocument()
    expect(screen.getByText('auth.subtitle')).toBeInTheDocument()
  })

  test('submit button is enabled by default', () => {
    const LoginPageComponent = (Route as any).options.component
    render(<LoginPageComponent />)

    const btn = screen.getByRole('button', { name: 'auth.login' })
    expect(btn).not.toBeDisabled()
  })

  test('calls loginMutation and auth.login on form submit', async () => {
    const mockLoginMutation = vi.fn().mockResolvedValue({
      accountType: 'catechist',
      userDocId: 'cat1',
      memberId: 'GLV0001',
      fullName: 'Test User',
      role: 'user',
    })
    vi.mocked(useMutation).mockReturnValue(mockLoginMutation as any)

    const mockLogin = vi.fn()
    vi.mocked(useAuth).mockReturnValue({
      login: mockLogin,
      logout: vi.fn(),
      user: null,
    })

    const LoginPageComponent = (Route as any).options.component
    render(<LoginPageComponent />)

    fireEvent.change(screen.getByLabelText('auth.loginId'), {
      target: { value: 'GLV0001' },
    })
    fireEvent.change(screen.getByLabelText('auth.password'), {
      target: { value: 'secret123' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'auth.login' }))

    await waitFor(() => {
      expect(mockLoginMutation).toHaveBeenCalledWith({
        loginId: 'GLV0001',
        password: 'secret123',
      })
    })
    expect(mockLogin).toHaveBeenCalled()
  })

  test('does not call mutation when inputs are empty', async () => {
    const mockLoginMutation = vi.fn().mockResolvedValue({})
    vi.mocked(useMutation).mockReturnValue(mockLoginMutation as any)

    const LoginPageComponent = (Route as any).options.component
    render(<LoginPageComponent />)

    // Submit with empty fields — zod validation should prevent the mutation call
    fireEvent.click(screen.getByRole('button', { name: 'auth.login' }))

    await waitFor(() => {
      expect(mockLoginMutation).not.toHaveBeenCalled()
    })
  })

  test('shows field-level required errors on blur for empty loginId and password', async () => {
    const LoginPageComponent = (Route as any).options.component
    render(<LoginPageComponent />)

    fireEvent.blur(screen.getByLabelText('auth.loginId'))
    fireEvent.blur(screen.getByLabelText('auth.password'))

    await waitFor(() => {
      expect(screen.getByText('auth.loginId.required')).toBeInTheDocument()
      expect(screen.getByText('auth.password.required')).toBeInTheDocument()
    })
  })
})
