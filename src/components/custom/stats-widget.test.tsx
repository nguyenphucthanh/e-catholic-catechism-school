import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { useQuery } from 'convex/react'
import { BranchStatsWidget } from './branch-stats-widget'
import { OrgStatsWidget } from './org-stats-widget'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('BranchStatsWidget', () => {
  const requesterId = 'catechist1' as any
  const academicYearId = 'year1' as any

  test('renders loading skeleton when data is undefined', () => {
    vi.mocked(useQuery).mockReturnValue(undefined)

    render(
      <BranchStatsWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    expect(screen.getByText('dashboard.branchStats.title')).toBeInTheDocument()
  })

  test('renders empty state when data is empty array', () => {
    vi.mocked(useQuery).mockReturnValue([])

    render(
      <BranchStatsWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    expect(screen.getByText('dashboard.branchStats.title')).toBeInTheDocument()
    expect(screen.getByText('dashboard.branchStats.empty')).toBeInTheDocument()
  })

  test('renders branch statistics list when data exists', () => {
    vi.mocked(useQuery).mockReturnValue([
      {
        branchId: 'b1',
        branchName: 'Ngành Au',
        classCount: 5,
        studentCount: 120,
        catechistCount: 12,
      },
    ])

    render(
      <BranchStatsWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    expect(screen.getByText('Ngành Au')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })
})

describe('OrgStatsWidget', () => {
  const requesterId = 'catechist1' as any
  const academicYearId = 'year1' as any

  test('renders loading skeleton when data is undefined', () => {
    vi.mocked(useQuery).mockReturnValue(undefined)

    render(
      <OrgStatsWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    expect(screen.getByText('dashboard.orgStats.title')).toBeInTheDocument()
  })

  test('renders stats when data is loaded', () => {
    vi.mocked(useQuery).mockReturnValue({
      totalClasses: 15,
      totalStudents: 350,
      totalCatechists: 40,
    })

    render(
      <OrgStatsWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    expect(screen.getByText('dashboard.orgStats.title')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('350')).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument()
  })

  test('renders 0 for missing totals', () => {
    vi.mocked(useQuery).mockReturnValue({})

    render(
      <OrgStatsWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    expect(screen.getAllByText('0')).toHaveLength(3)
  })
})
