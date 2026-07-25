import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
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

  test('displays alert with translated error message when login fails with invalid credentials', async () => {
    const mockLoginMutation = vi
      .fn()
      .mockRejectedValue(new Error('AUTH_INVALID_CREDENTIALS'))
    vi.mocked(useMutation).mockReturnValue(mockLoginMutation as any)

    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: null,
    })

    const LoginPageComponent = (Route as any).options.component
    render(<LoginPageComponent />)

    fireEvent.change(screen.getByLabelText('auth.loginId'), {
      target: { value: 'GLV0001' },
    })
    fireEvent.change(screen.getByLabelText('auth.password'), {
      target: { value: 'wrongpassword' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'auth.login' }))

    await waitFor(() => {
      expect(screen.getByText('errors.invalidCredentials')).toBeInTheDocument()
    })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('data-slot', 'alert')
  })

  test('displays alert with fallback message when login fails with an unknown error', async () => {
    const mockLoginMutation = vi
      .fn()
      .mockRejectedValue(new Error('Some network failure or random error'))
    vi.mocked(useMutation).mockReturnValue(mockLoginMutation as any)

    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: null,
    })

    const LoginPageComponent = (Route as any).options.component
    render(<LoginPageComponent />)

    fireEvent.change(screen.getByLabelText('auth.loginId'), {
      target: { value: 'GLV0001' },
    })
    fireEvent.change(screen.getByLabelText('auth.password'), {
      target: { value: 'wrongpassword' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'auth.login' }))

    await waitFor(() => {
      expect(screen.getByText('common.error')).toBeInTheDocument()
    })
  })

  test('redirects to dashboard when user is already authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        accountType: 'catechist',
        userDocId: 'cat1',
        memberId: 'GLV0001',
        fullName: 'Test User',
        role: 'user',
      } as any,
    })

    const LoginPageComponent = (Route as any).options.component
    const { container } = render(<LoginPageComponent />)

    const navigateEl = container.querySelector('[data-to="/dashboard"]')
    expect(navigateEl).toBeInTheDocument()
  })

  test('displays app logo when appConfig.logoUrl is present', () => {
    const mockLoginMutation = vi.fn().mockResolvedValue({
      accountType: 'catechist',
      userDocId: 'cat1',
      memberId: 'GLV0001',
      fullName: 'Test User',
      role: 'user',
    })
    vi.mocked(useMutation).mockReturnValue(mockLoginMutation as any)

    const mockUseQuery = vi.fn().mockReturnValue({
      logoUrl: 'https://example.com/logo.png',
      parishName: 'Test Parish',
      troopName: 'Test Troop',
    })
    vi.mocked(useQuery).mockImplementation(mockUseQuery as any)

    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: null,
    })

    const LoginPageComponent = (Route as any).options.component
    render(<LoginPageComponent />)

    const logoImg = screen.getByAltText('')
    expect(logoImg).toHaveAttribute('src', 'https://example.com/logo.png')
  })

  test('displays parish and troop names when appConfig provides them', () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      logoUrl: null,
      parishName: 'Parish of St. Mary',
      troopName: 'Troop Alpha',
    })
    vi.mocked(useQuery).mockImplementation(mockUseQuery as any)

    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: null,
    })

    const LoginPageComponent = (Route as any).options.component
    render(<LoginPageComponent />)

    expect(screen.getByText('Parish of St. Mary')).toBeInTheDocument()
    expect(screen.getByText('Troop Alpha')).toBeInTheDocument()
  })

  test('clears submit error when submitting again after a previous error', async () => {
    const mockLoginMutation = vi
      .fn()
      .mockRejectedValueOnce(new Error('AUTH_INVALID_CREDENTIALS'))
      .mockResolvedValueOnce({
        accountType: 'catechist',
        userDocId: 'cat1',
        memberId: 'GLV0001',
        fullName: 'Test User',
        role: 'user',
      })
    vi.mocked(useMutation).mockReturnValue(mockLoginMutation as any)

    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: null,
    })

    const LoginPageComponent = (Route as any).options.component
    render(<LoginPageComponent />)

    fireEvent.change(screen.getByLabelText('auth.loginId'), {
      target: { value: 'GLV0001' },
    })
    fireEvent.change(screen.getByLabelText('auth.password'), {
      target: { value: 'wrongpassword' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'auth.login' }))

    await waitFor(() => {
      expect(screen.getByText('errors.invalidCredentials')).toBeInTheDocument()
    })

    // Change password and try again
    fireEvent.change(screen.getByLabelText('auth.password'), {
      target: { value: 'correctpassword' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'auth.login' }))

    await waitFor(() => {
      expect(
        screen.queryByText('errors.invalidCredentials'),
      ).not.toBeInTheDocument()
    })
  })
})
