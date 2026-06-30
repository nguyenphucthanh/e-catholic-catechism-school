import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { Route } from './profile'
import { useAuth } from '~/lib/auth'

describe('ProfilePage component', () => {
  test('renders personal info, address, and contacts successfully when authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: 'user123',
        userDocId: 'catechist123',
        memberId: 'GLV0001',
        fullName: 'Nguyễn Văn A',
        role: 'catechist',
      } as any,
    })

    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:getMyProfile') {
        return {
          _id: 'catechist123',
          memberId: 'GLV0001',
          fullName: 'Nguyễn Văn A',
          saintName: 'Giuse',
          role: 'catechist',
          isActive: true,
          isDeleted: false,
        }
      }
      if (path === 'catechists:getMyAddress') {
        return {
          _id: 'address123',
          catechistId: 'catechist123',
          country: 'VN',
          city: 'Hồ Chí Minh',
          isDeleted: false,
        }
      }
      if (path === 'catechists:getMyContacts') {
        return [
          {
            _id: 'contact123',
            catechistId: 'catechist123',
            label: 'Personal Phone',
            contactType: 'phone',
            value: '+84912345678',
            isPrimary: true,
            isDeleted: false,
          },
        ]
      }
      return undefined
    })

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    expect(screen.getByLabelText(/profile\.personal\.fullName/)).toHaveValue(
      'Nguyễn Văn A',
    )
    expect(screen.getByLabelText(/profile\.personal\.saintName/)).toHaveValue(
      'Giuse',
    )
    expect(screen.getByLabelText(/profile\.address\.city/)).toHaveValue(
      'Hồ Chí Minh',
    )
    expect(screen.getByText('+84912345678')).toBeInTheDocument()
  })

  test('renders stale session message when userDocId is missing', () => {
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

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    expect(
      screen.getByRole('button', { name: 'auth.stale_session_action' }),
    ).toBeInTheDocument()
  })
})
