import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { BranchStatsWidget } from './branch-stats-widget'
import { OrgStatsWidget } from './org-stats-widget'
import { useOneShotQuery } from '~/hooks/use-one-shot-query'

vi.mock('~/hooks/use-one-shot-query', () => ({
  useOneShotQuery: vi.fn(),
}))

const refresh = vi.fn()
const mockData = (data: unknown, isRefreshing = false) =>
  vi.mocked(useOneShotQuery).mockReturnValue({
    data,
    isRefreshing,
    refresh,
  })

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('BranchStatsWidget', () => {
  const academicYearId = 'year1' as any

  test('renders loading skeleton when data is undefined', () => {
    mockData(undefined)

    render(<BranchStatsWidget academicYearId={academicYearId} />)

    expect(screen.getByText('dashboard.branchStats.title')).toBeInTheDocument()
  })

  test('renders empty state when data is empty array', () => {
    mockData([])

    render(<BranchStatsWidget academicYearId={academicYearId} />)

    expect(screen.getByText('dashboard.branchStats.title')).toBeInTheDocument()
    expect(screen.getByText('dashboard.branchStats.empty')).toBeInTheDocument()
  })

  test('refresh button triggers refetch', () => {
    mockData([])
    render(<BranchStatsWidget academicYearId={academicYearId} />)
    fireEvent.click(screen.getByLabelText('dashboard.branchStats.refresh'))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  test('renders branch statistics list when data exists', () => {
    mockData([
      {
        branchId: 'b1',
        branchName: 'Ngành Au',
        classCount: 5,
        studentCount: 120,
        catechistCount: 12,
      },
    ])

    render(<BranchStatsWidget academicYearId={academicYearId} />)

    expect(screen.getByText('Ngành Au')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })
})

describe('OrgStatsWidget', () => {
  const academicYearId = 'year1' as any

  test('renders loading skeleton when data is undefined', () => {
    mockData(undefined)

    render(<OrgStatsWidget academicYearId={academicYearId} />)

    expect(screen.getByText('dashboard.orgStats.title')).toBeInTheDocument()
  })

  test('renders stats when data is loaded', () => {
    mockData({
      totalClasses: 15,
      totalStudents: 350,
      totalCatechists: 40,
    })

    render(<OrgStatsWidget academicYearId={academicYearId} />)

    expect(screen.getByText('dashboard.orgStats.title')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('350')).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument()
  })

  test('refresh button triggers refetch and disables while refreshing', () => {
    mockData({ totalClasses: 1, totalStudents: 2, totalCatechists: 3 })
    const { unmount } = render(
      <OrgStatsWidget academicYearId={academicYearId} />,
    )
    fireEvent.click(screen.getByLabelText('dashboard.orgStats.refresh'))
    expect(refresh).toHaveBeenCalledTimes(1)
    unmount()

    mockData({ totalClasses: 1, totalStudents: 2, totalCatechists: 3 }, true)
    render(<OrgStatsWidget academicYearId={academicYearId} />)
    expect(screen.getByLabelText('dashboard.orgStats.refresh')).toBeDisabled()
  })

  test('renders 0 for missing totals', () => {
    mockData({})

    render(<OrgStatsWidget academicYearId={academicYearId} />)

    expect(screen.getAllByText('0')).toHaveLength(3)
  })
})
