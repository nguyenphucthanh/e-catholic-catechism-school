import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { Route } from './dashboard'
import { useAuth } from '~/lib/auth'

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: vi.fn(() => ({
    selectedYearId: 'year1',
    setSelectedYearId: vi.fn(),
  })),
}))

describe('DashboardPage route component', () => {
  test('renders page heading with title and icon successfully', () => {
    const DashboardPageComponent = (Route as any).options.component
    render(<DashboardPageComponent />)

    expect(
      screen.getByRole('heading', { name: 'nav.dashboard' }),
    ).toBeInTheDocument()
  })

  test('renders CatechistDashboard for catechist accounts', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        userDocId: 'catechist1',
        loginId: 'CAT-GLV0001',
        memberId: 'GLV0001',
        fullName: 'Nguyễn Văn A',
        accountType: 'catechist',
        role: 'user',
      },
    })
    vi.mocked(useQuery).mockReturnValue(undefined)

    const DashboardPageComponent = (Route as any).options.component
    render(<DashboardPageComponent />)

    expect(screen.getByText('dashboard.myClasses.title')).toBeInTheDocument()
  })

  test('renders StudentDashboard for student accounts', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        userDocId: 'student1',
        loginId: 'STD-HS0001',
        memberId: 'HS0001',
        fullName: 'Trần Thị B',
        accountType: 'student',
        role: null,
      },
    })
    vi.mocked(useQuery).mockReturnValue(undefined)

    const DashboardPageComponent = (Route as any).options.component
    const { container } = render(<DashboardPageComponent />)

    expect(container.querySelector('.aspect-video')).not.toBeInTheDocument()
    expect(
      screen.getByText('students.detail.enrollments.title'),
    ).toBeInTheDocument()
  })
})
