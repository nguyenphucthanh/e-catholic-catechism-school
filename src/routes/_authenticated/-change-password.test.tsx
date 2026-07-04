import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation } from 'convex/react'
import { Route } from './change-password'
import { useAuth } from '~/lib/auth'

const mockUser = {
  _id: 'user123',
  loginId: 'CAT-GLV0001',
  memberId: 'GLV0001',
  fullName: 'Nguyễn Văn A',
  role: 'user',
} as any

function setupAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    login: vi.fn(),
    logout: vi.fn(),
    user: mockUser,
    ...overrides,
  })
}

describe('ChangePasswordPage component', () => {
  test('renders input fields and submit button successfully', () => {
    setupAuth()
    const ChangePasswordComponent = (Route as any).options.component
    render(<ChangePasswordComponent />)

    expect(screen.getByLabelText('password.current')).toBeInTheDocument()
    expect(screen.getByLabelText('password.new')).toBeInTheDocument()
    expect(screen.getByLabelText('password.confirm')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'password.submit' }),
    ).toBeInTheDocument()
  })

  test('renders page header title', () => {
    setupAuth()
    const ChangePasswordComponent = (Route as any).options.component
    render(<ChangePasswordComponent />)
    expect(screen.getByText('password.title')).toBeInTheDocument()
  })

  test('submit button starts enabled', () => {
    setupAuth()
    const ChangePasswordComponent = (Route as any).options.component
    render(<ChangePasswordComponent />)
    expect(
      screen.getByRole('button', { name: 'password.submit' }),
    ).not.toBeDisabled()
  })

  test('calls changePasswordMutation when form is submitted with values', async () => {
    setupAuth()
    const mockChangePw = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockChangePw as any)

    const ChangePasswordComponent = (Route as any).options.component
    render(<ChangePasswordComponent />)

    fireEvent.change(screen.getByLabelText('password.current'), {
      target: { value: 'oldPass1' },
    })
    fireEvent.change(screen.getByLabelText('password.new'), {
      target: { value: 'newPass2' },
    })
    fireEvent.change(screen.getByLabelText('password.confirm'), {
      target: { value: 'newPass2' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'password.submit' }))

    await waitFor(() => {
      expect(mockChangePw).toHaveBeenCalledWith({
        loginId: 'CAT-GLV0001',
        oldPassword: 'oldPass1',
        newPassword: 'newPass2',
      })
    })
  })

  test('all three input fields are of type password', () => {
    setupAuth()
    const ChangePasswordComponent = (Route as any).options.component
    render(<ChangePasswordComponent />)

    const inputs = screen
      .getAllByDisplayValue('')
      .filter((el) => (el as HTMLInputElement).type === 'password')
    expect(inputs.length).toBeGreaterThanOrEqual(3)
  })
})
