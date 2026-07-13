import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { Route } from './reports_.academic-year-report'
import { useAuth } from '~/lib/auth'

const mockCatechistUser = {
  _id: 'user123',
  userDocId: 'catechist123',
  memberId: 'GLV0001',
  fullName: 'Catechist User',
  role: 'user',
  accountType: 'catechist',
} as any

const mockReportData = {
  academicYearName: '2024-2025',
  kpis: {
    totalClasses: 2,
    totalStudents: 45,
    averageAttendanceRate: 85,
    activeCatechists: 6,
  },
  classesComparison: [
    { classId: 'c1', className: 'Ấu Nhi 1', studentCount: 20, classType: 'primary' },
    { classId: 'c2', className: 'Ấu Nhi 2', studentCount: 25, classType: 'primary' },
  ],
  branches: [
    {
      branchId: 'b1',
      branchName: 'Ấu Nhi',
      classes: [
        {
          classId: 'c1',
          classYearId: 'cy1',
          className: 'Ấu Nhi 1',
          studentCount: 20,
          classType: 'primary',
          overallAttendanceRate: 88,
          attendanceHistory: [
            { sessionDate: '2024-10-01', rate: 90 },
            { sessionDate: '2024-10-08', rate: 86 },
          ],
        },
        {
          classId: 'c2',
          classYearId: 'cy2',
          className: 'Ấu Nhi 2',
          studentCount: 25,
          classType: 'primary',
          overallAttendanceRate: 82,
          attendanceHistory: [
            { sessionDate: '2024-10-01', rate: 80 },
            { sessionDate: '2024-10-08', rate: 84 },
          ],
        },
      ],
    },
  ],
  atRiskStudents: [
    {
      studentId: 's1',
      studentCode: 'HS001',
      fullName: 'Student One',
      className: 'Ấu Nhi 1',
      consecutiveAbsences: 3,
    },
  ],
}

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: () => ({ selectedYearId: 'year123' }),
  useInactiveYear: () => ({ isInactive: false, yearName: '2024-2025' }),
}))

function setupQueries(result: any) {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'reports:academicYearReport') return result
    return undefined
  })
}

const ReportPageComponent = (Route as any).options.component

describe('AcademicYearReportPage component', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
  })

  test('renders loading skeleton state when data is undefined', () => {
    setupQueries(undefined)

    const { container } = render(<ReportPageComponent />)

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(
      screen.queryByText('reports.academicYearReport.kpi.totalClasses'),
    ).not.toBeInTheDocument()
  })

  test('renders page content when data is loaded', () => {
    setupQueries(mockReportData)

    render(<ReportPageComponent />)

    // Verify Title & Subtitle
    expect(screen.getByText('reports.academicYearReport.title')).toBeInTheDocument()
    expect(
      screen.getByText(/reports.academicYearReport.description/),
    ).toBeInTheDocument()

    // Verify KPIs
    expect(screen.getByText('reports.academicYearReport.kpi.totalClasses')).toBeInTheDocument()
    expect(screen.getByText('reports.academicYearReport.kpi.totalStudents')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // KPI Value
    expect(screen.getByText('45')).toBeInTheDocument() // KPI Value
    expect(screen.getByText('85%')).toBeInTheDocument() // KPI Value

    // Verify Branches & Classes
    expect(screen.getByText('Ấu Nhi')).toBeInTheDocument()
    expect(screen.getAllByText('Ấu Nhi 1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ấu Nhi 2').length).toBeGreaterThan(0)

    // Verify At-Risk Students
    expect(screen.getByText('reports.academicYearReport.atRisk.title')).toBeInTheDocument()
    expect(screen.getByText('Student One')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument() // consecutive absences
  })

  test('renders low attendance badge if rate is less than 80%', () => {
    const lowAttendanceData = {
      ...mockReportData,
      branches: [
        {
          branchId: 'b1',
          branchName: 'Ấu Nhi',
          classes: [
            {
              classId: 'c1',
              classYearId: 'cy1',
              className: 'Ấu Nhi 1',
              studentCount: 20,
              classType: 'primary',
              overallAttendanceRate: 75, // < 80
              attendanceHistory: [{ sessionDate: '2024-10-01', rate: 75 }],
            },
          ],
        },
      ],
    }
    setupQueries(lowAttendanceData)

    render(<ReportPageComponent />)

    expect(screen.getByText('reports.academicYearReport.classes.lowAttendance')).toBeInTheDocument()
  })

  test('renders empty state if no classes are matched', () => {
    setupQueries({
      ...mockReportData,
      classesComparison: [],
      branches: [],
    })

    render(<ReportPageComponent />)

    expect(screen.getByText('reports.academicYearReport.empty')).toBeInTheDocument()
  })

  test('triggers window.print when print button is clicked', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    setupQueries(mockReportData)

    render(<ReportPageComponent />)

    const printBtn = screen.getByText('reports.academicYearReport.print')
    fireEvent.click(printBtn)

    expect(printSpy).toHaveBeenCalled()
    printSpy.mockRestore()
  })
})
