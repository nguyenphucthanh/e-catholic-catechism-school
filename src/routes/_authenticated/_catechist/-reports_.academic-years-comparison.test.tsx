import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { Route } from './reports_.academic-years-comparison'
import { useAuth } from '~/lib/auth'

const mockCatechistUser = {
  _id: 'user123',
  userDocId: 'catechist123',
  memberId: 'GLV0001',
  fullName: 'Catechist User',
  role: 'user',
  accountType: 'catechist',
} as any

const mockComparisonData = {
  years: [
    { academicYearId: 'year1', label: '2024-2025', startDate: '2024-09-01' },
    { academicYearId: 'year2', label: '2025-2026', startDate: '2025-09-01' },
  ],
  enrollment: [
    {
      academicYearId: 'year1',
      totalActive: 100,
      byClass: [{ className: 'Chiên Con 1', count: 20 }],
    },
    {
      academicYearId: 'year2',
      totalActive: 120,
      byClass: [{ className: 'Chiên Con 1', count: 25 }],
    },
  ],
  attendance: [
    {
      academicYearId: 'year1',
      massAttendanceRate: 80,
      extracurricularAttendanceRate: 70,
      classAttendanceRate: 90,
    },
    {
      academicYearId: 'year2',
      massAttendanceRate: 85,
      extracurricularAttendanceRate: null,
      classAttendanceRate: 92,
    },
  ],
  grades: [
    { academicYearId: 'year1', passRate: 88, averageScore: 7.5 },
    { academicYearId: 'year2', passRate: null, averageScore: null },
  ],
  staffing: [
    {
      academicYearId: 'year1',
      catechistCount: 10,
      classCount: 12,
      branchCount: 2,
    },
    {
      academicYearId: 'year2',
      catechistCount: 11,
      classCount: 13,
      branchCount: 2,
    },
  ],
}

function setupQueries(result: any) {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'reports:academicYearComparison') return result
    return undefined
  })
}

const ReportPageComponent = (Route as any).options.component

describe('AcademicYearsComparisonReportPage component', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
  })

  test('renders loading skeletons while data is undefined', () => {
    setupQueries(undefined)

    const { container } = render(<ReportPageComponent />)

    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4)
    expect(
      screen.queryByText('reports.academicYearsComparison.empty'),
    ).not.toBeInTheDocument()
  })

  test('renders empty state when there are no years', () => {
    setupQueries({ ...mockComparisonData, years: [] })

    render(<ReportPageComponent />)

    expect(
      screen.getByText('reports.academicYearsComparison.empty'),
    ).toBeInTheDocument()
  })

  test('renders all report sections when data is populated', () => {
    setupQueries(mockComparisonData)

    render(<ReportPageComponent />)

    expect(
      screen.getByText('reports.academicYearsComparison.enrollment.title'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('reports.academicYearsComparison.attendance.title'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('reports.academicYearsComparison.grades.title'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('reports.academicYearsComparison.staffing.title'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('reports.academicYearsComparison.empty'),
    ).not.toBeInTheDocument()
  })

  test('skips the query and does not crash when user is not a catechist', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: 'user456',
        fullName: 'Student User',
        role: 'user',
        accountType: 'student',
      } as any,
    })
    setupQueries(undefined)

    render(<ReportPageComponent />)

    // Falls into the loading branch since data stays undefined ('skip').
    expect(
      screen.getByText('reports.academicYearsComparison.title'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('reports.academicYearsComparison.enrollment.title'),
    ).not.toBeInTheDocument()
  })
})
