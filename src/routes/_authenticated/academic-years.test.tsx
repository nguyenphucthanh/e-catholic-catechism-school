import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { Route } from './academic-years'
import { useAuth } from '~/lib/auth'

describe('AcademicYearsPage component', () => {
  test('renders years table and board-only create button for board member', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: 'user123',
        userDocId: 'catechist123',
        memberId: 'GLV0001',
        fullName: 'Nguyễn Văn A',
        role: 'board',
      } as any,
    })

    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'academicYears:list') {
        return [
          {
            _id: 'year123',
            name: '2024-2025',
            startDate: '2024-09-01',
            endDate: '2025-05-31',
            timezone: 'Asia/Ho_Chi_Minh',
            isActive: true,
            isDeleted: false,
          },
        ]
      }
      return undefined
    })

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    // Check title renders
    expect(screen.getByText('academicYears.title')).toBeInTheDocument()

    // Check board-only buttons render
    expect(
      screen.getByRole('button', { name: /create|add/i }),
    ).toBeInTheDocument()

    // Check data row renders
    expect(screen.getByText('2024-2025')).toBeInTheDocument()
    expect(screen.getByText('Asia/Ho_Chi_Minh')).toBeInTheDocument()
    expect(screen.getByText('academicYears.status.active')).toBeInTheDocument()
  })

  test('hides create button for non-board catechist', () => {
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
      if (path === 'academicYears:list') {
        return []
      }
      return undefined
    })

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    // Check board-only button is hidden
    expect(
      screen.queryByRole('button', { name: /create|add/i }),
    ).not.toBeInTheDocument()
  })
})
