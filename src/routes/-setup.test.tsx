import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation } from 'convex/react'
import { SETUP_ERRORS } from '../../convex/lib/errors'
import { Route } from './setup'
import { useAuth } from '~/lib/auth'

describe('SetupPage route component', () => {
  test('renders all fields and the submit button', () => {
    const SetupPageComponent = (Route as any).options.component
    render(<SetupPageComponent />)

    expect(screen.getByLabelText('setup.fullName')).toBeInTheDocument()
    expect(screen.getByLabelText('setup.saintName')).toBeInTheDocument()
    expect(screen.getByLabelText('setup.loginId')).toBeInTheDocument()
    expect(screen.getByLabelText('setup.password')).toBeInTheDocument()
    expect(screen.getByLabelText('setup.confirmPassword')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'setup.submit' }),
    ).toBeInTheDocument()
  })

  test('renders title and subtitle', () => {
    const SetupPageComponent = (Route as any).options.component
    render(<SetupPageComponent />)

    expect(screen.getByText('setup.title')).toBeInTheDocument()
    expect(screen.getByText('setup.subtitle')).toBeInTheDocument()
  })

  test('shows required errors on blur for empty fullName and loginId', async () => {
    const SetupPageComponent = (Route as any).options.component
    render(<SetupPageComponent />)

    fireEvent.blur(screen.getByLabelText('setup.fullName'))
    fireEvent.blur(screen.getByLabelText('setup.loginId'))

    await waitFor(() => {
      expect(screen.getByText('setup.fullName.required')).toBeInTheDocument()
      expect(screen.getByText('setup.loginId.required')).toBeInTheDocument()
    })
  })

  test('shows min-length error when password is under 8 characters', async () => {
    const SetupPageComponent = (Route as any).options.component
    render(<SetupPageComponent />)

    fireEvent.change(screen.getByLabelText('setup.password'), {
      target: { value: 'short' },
    })
    fireEvent.blur(screen.getByLabelText('setup.password'))

    await waitFor(() => {
      expect(screen.getByText('setup.password.min')).toBeInTheDocument()
    })
  })

  test('shows mismatch error when confirmPassword does not match password', async () => {
    const SetupPageComponent = (Route as any).options.component
    render(<SetupPageComponent />)

    fireEvent.change(screen.getByLabelText('setup.password'), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByLabelText('setup.confirmPassword'), {
      target: { value: 'different123' },
    })
    fireEvent.blur(screen.getByLabelText('setup.confirmPassword'))

    await waitFor(() => {
      expect(
        screen.getByText('setup.confirmPassword.mismatch'),
      ).toBeInTheDocument()
    })
  })

  test('does not call mutation when required fields are empty', async () => {
    const mockRunSetup = vi.fn().mockResolvedValue({})
    vi.mocked(useMutation).mockReturnValue(mockRunSetup as any)

    const SetupPageComponent = (Route as any).options.component
    render(<SetupPageComponent />)

    fireEvent.click(screen.getByRole('button', { name: 'setup.submit' }))

    await waitFor(() => {
      expect(mockRunSetup).not.toHaveBeenCalled()
    })
  })

  test('calls runSetup and auth.login with correct args on valid submit, then navigates', async () => {
    const mutationResult = {
      accountType: 'catechist',
      userDocId: 'cat1',
      loginId: 'GLV0001',
      memberId: 'GLV0001',
      fullName: 'Nguyen Van A',
      role: 'admin',
    }
    const mockRunSetup = vi.fn().mockResolvedValue(mutationResult)
    vi.mocked(useMutation).mockReturnValue(mockRunSetup as any)

    const mockLogin = vi.fn()
    vi.mocked(useAuth).mockReturnValue({
      login: mockLogin,
      logout: vi.fn(),
      user: null,
    })

    const SetupPageComponent = (Route as any).options.component
    render(<SetupPageComponent />)

    fireEvent.change(screen.getByLabelText('setup.fullName'), {
      target: { value: 'Nguyen Van A' },
    })
    fireEvent.change(screen.getByLabelText('setup.saintName'), {
      target: { value: 'Peter' },
    })
    fireEvent.change(screen.getByLabelText('setup.loginId'), {
      target: { value: 'GLV0001' },
    })
    fireEvent.change(screen.getByLabelText('setup.password'), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByLabelText('setup.confirmPassword'), {
      target: { value: 'password123' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'setup.submit' }))

    await waitFor(() => {
      expect(mockRunSetup).toHaveBeenCalledWith({
        fullName: 'Nguyen Van A',
        saintName: 'Peter',
        loginId: 'GLV0001',
        password: 'password123',
      })
    })
    expect(mockRunSetup).not.toHaveBeenCalledWith(
      expect.objectContaining({ confirmPassword: expect.anything() }),
    )
    expect(mockLogin).toHaveBeenCalledWith(mutationResult)
  })

  test('submits with saintName undefined when left blank', async () => {
    const mutationResult = {
      accountType: 'catechist',
      userDocId: 'cat1',
      loginId: 'GLV0002',
      memberId: 'GLV0002',
      fullName: 'Tran Thi B',
      role: 'admin',
    }
    const mockRunSetup = vi.fn().mockResolvedValue(mutationResult)
    vi.mocked(useMutation).mockReturnValue(mockRunSetup as any)

    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: null,
    })

    const SetupPageComponent = (Route as any).options.component
    render(<SetupPageComponent />)

    fireEvent.change(screen.getByLabelText('setup.fullName'), {
      target: { value: 'Tran Thi B' },
    })
    fireEvent.change(screen.getByLabelText('setup.loginId'), {
      target: { value: 'GLV0002' },
    })
    fireEvent.change(screen.getByLabelText('setup.password'), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByLabelText('setup.confirmPassword'), {
      target: { value: 'password123' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'setup.submit' }))

    await waitFor(() => {
      expect(mockRunSetup).toHaveBeenCalledWith({
        fullName: 'Tran Thi B',
        saintName: undefined,
        loginId: 'GLV0002',
        password: 'password123',
      })
    })
  })

  test('displays alert with error message when setup fails and does not navigate or login', async () => {
    const mockRunSetup = vi
      .fn()
      .mockRejectedValue(new Error(SETUP_ERRORS.ALREADY_COMPLETED))
    vi.mocked(useMutation).mockReturnValue(mockRunSetup as any)

    const mockLogin = vi.fn()
    vi.mocked(useAuth).mockReturnValue({
      login: mockLogin,
      logout: vi.fn(),
      user: null,
    })

    const SetupPageComponent = (Route as any).options.component
    render(<SetupPageComponent />)

    fireEvent.change(screen.getByLabelText('setup.fullName'), {
      target: { value: 'Nguyen Van A' },
    })
    fireEvent.change(screen.getByLabelText('setup.loginId'), {
      target: { value: 'GLV0001' },
    })
    fireEvent.change(screen.getByLabelText('setup.password'), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByLabelText('setup.confirmPassword'), {
      target: { value: 'password123' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'setup.submit' }))

    await waitFor(() => {
      expect(
        screen.getByText('errors.setupAlreadyCompleted'),
      ).toBeInTheDocument()
    })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('data-slot', 'alert')
    expect(mockLogin).not.toHaveBeenCalled()
  })
})
