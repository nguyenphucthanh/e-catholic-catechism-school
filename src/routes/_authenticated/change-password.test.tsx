import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Route } from './change-password'
import { useAuth } from '~/lib/auth'

describe('ChangePasswordPage component', () => {
  test('renders input fields and submit button successfully', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: 'user123',
        memberId: 'GLV0001',
        fullName: 'Nguyễn Văn A',
        role: 'catechist',
      } as any,
    })

    const ChangePasswordComponent = (Route as any).options.component
    render(<ChangePasswordComponent />)

    expect(screen.getByLabelText('password.current')).toBeInTheDocument()
    expect(screen.getByLabelText('password.new')).toBeInTheDocument()
    expect(screen.getByLabelText('password.confirm')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'password.submit' }),
    ).toBeInTheDocument()
  })
})
