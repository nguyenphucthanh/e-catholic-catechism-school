import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { Route } from './my-extracurricular-programs'
import { useAuth } from '~/lib/auth'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    Link: ({ children, to, params, className }: any) => (
      <a href={to} data-params={JSON.stringify(params)} className={className}>
        {children}
      </a>
    ),
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => key,
  })),
}))

vi.mock('~/lib/auth', () => ({
  useAuth: vi.fn(),
}))

const mockStudentUser = {
  userDocId: 'student123',
  fullName: 'Student User',
  role: 'user',
  accountType: 'student',
} as any

function setupQuery(programs: any) {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'extracurricularPrograms:listEligiblePrograms') return programs
    return undefined
  })
}

const MyExtracurricularProgramsPageComponent = (Route as any).options.component

describe('MyExtracurricularProgramsPage component', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockStudentUser,
    })
  })

  test('renders loading skeleton while programs are undefined', () => {
    setupQuery(undefined)

    const { container } = render(<MyExtracurricularProgramsPageComponent />)

    expect(screen.getByText('extracurricular.title')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(3)
  })

  test('renders empty state when there are no eligible programs', () => {
    setupQuery([])

    render(<MyExtracurricularProgramsPageComponent />)

    expect(
      screen.getByText('extracurricular.myProgramsEmpty'),
    ).toBeInTheDocument()
  })

  test('renders program cards with enrollment status and fee badge', () => {
    setupQuery([
      {
        _id: 'program1',
        title: 'Summer Camp',
        dateStart: '2026-08-01',
        dateEnd: '2026-08-10',
        feeRequired: true,
        feeAmount: 500000,
        userEnrolled: false,
      },
      {
        _id: 'program2',
        title: 'Retreat',
        dateStart: '2026-09-01',
        dateEnd: '2026-09-05',
        feeRequired: false,
        userEnrolled: true,
      },
    ])

    render(<MyExtracurricularProgramsPageComponent />)

    expect(screen.getByText('Summer Camp')).toBeInTheDocument()
    expect(screen.getByText('Retreat')).toBeInTheDocument()
    expect(screen.getByText('extracurricular.fee: 500000')).toBeInTheDocument()
    expect(screen.getByText('extracurricular.enrolled')).toBeInTheDocument()
    expect(screen.getByText('extracurricular.notEnrolled')).toBeInTheDocument()
  })
})
