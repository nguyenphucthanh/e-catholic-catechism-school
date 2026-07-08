import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { Route } from './reports_.mass-extra-attendance'
import { useAuth } from '~/lib/auth'
import { exportCsv, exportPdf } from '~/lib/export'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    Link: ({ children, to, params, className }: any) => (
      <a href={`${to}`.replace('$id', params?.id)} className={className}>
        {children}
      </a>
    ),
  }
})

vi.mock('~/lib/auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('~/lib/export', () => ({
  exportCsv: vi.fn(),
  exportPdf: vi.fn(),
}))

const mockCatechistUser = {
  _id: 'user123',
  userDocId: 'catechist123',
  memberId: 'GLV0001',
  fullName: 'Catechist User',
  role: 'user',
  accountType: 'catechist',
} as any

const mockReportData = {
  session: {
    _id: 'session123',
    sessionDate: '2026-07-08',
    sessionType: 'mass',
    isCancelled: false,
  },
  records: [
    {
      _id: 'record1',
      status: 'present',
      notes: null,
      deviceQueuedAt: 1773043800000,
      syncedAt: 1773043805000,
      studentId: 'student1',
      studentCode: 'HV0001',
      fullName: 'Student One',
      saintName: 'Giuse',
      classId: 'class1',
      className: 'Chiên Con 1',
      recordedByCatechistId: 'catechist1',
      recordedByCatechistName: 'Catechist Recorder',
    },
    {
      _id: 'record2',
      status: 'late',
      notes: 'Came late',
      deviceQueuedAt: 1773044400000,
      syncedAt: null,
      studentId: 'student2',
      studentCode: 'HV0002',
      fullName: 'Student Two',
      saintName: null,
      classId: 'class2',
      className: 'Ấu Nhi 1',
      recordedByCatechistId: null,
      recordedByCatechistName: 'Unknown',
    },
  ],
}

function setupQueries(reportResult: any) {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'attendance:getParishAttendanceReport') return reportResult
    return undefined
  })
}

const ReportPageComponent = (Route as any).options.component

describe('MassExtraAttendanceReportPage component', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    vi.mocked(exportCsv).mockClear()
    vi.mocked(exportPdf).mockClear()
  })

  test('renders page layout, filters, and stats correctly', () => {
    setupQueries(mockReportData)

    render(<ReportPageComponent />)

    // Title and description
    expect(
      screen.getByText('reports.massExtraAttendance.title'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('reports.massExtraAttendance.description'),
    ).toBeInTheDocument()

    // Filters
    expect(
      screen.getByText('reports.massExtraAttendance.filters.date'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('reports.massExtraAttendance.filters.type'),
    ).toBeInTheDocument()

    // Table rows
    expect(screen.getByText('HV0001')).toBeInTheDocument()
    expect(screen.getByText('Giuse Student One')).toBeInTheDocument()
    expect(screen.getByText('Chiên Con 1')).toBeInTheDocument()
    expect(screen.getByText('HV0002')).toBeInTheDocument()
    expect(screen.getByText('Student Two')).toBeInTheDocument()
    expect(screen.getByText('Ấu Nhi 1')).toBeInTheDocument()

    // Full name links to student detail page
    expect(screen.getByText('Giuse Student One').closest('a')).toHaveAttribute(
      'href',
      '/students/student1',
    )
    expect(screen.getByText('Student Two').closest('a')).toHaveAttribute(
      'href',
      '/students/student2',
    )

    // Recorded-by links to catechist detail page when id present
    expect(screen.getByText('Catechist Recorder').closest('a')).toHaveAttribute(
      'href',
      '/catechists/catechist1',
    )
    // Falls back to plain text (no link) when catechist id is missing
    expect(screen.getByText('Unknown').closest('a')).toBeNull()

    // Class name links to class detail page
    expect(screen.getByText('Chiên Con 1').closest('a')).toHaveAttribute(
      'href',
      '/classes/class1',
    )
    expect(screen.getByText('Ấu Nhi 1').closest('a')).toHaveAttribute(
      'href',
      '/classes/class2',
    )
  })

  test('triggers exports when export options are clicked', () => {
    setupQueries(mockReportData)

    render(<ReportPageComponent />)

    // Find export dropdown button
    const exportButton = screen.getByRole('button', {
      name: /classes\.export\.title/i,
    })
    expect(exportButton).toBeInTheDocument()
    fireEvent.click(exportButton)

    // Select CSV export
    const csvItem = screen.getByText(/classes\.export\.csv/i)
    fireEvent.click(csvItem)
    expect(exportCsv).toHaveBeenCalledTimes(1)

    // Re-click and select PDF export
    fireEvent.click(exportButton)
    const pdfItem = screen.getByText(/classes\.export\.pdf/i)
    fireEvent.click(pdfItem)
    expect(exportPdf).toHaveBeenCalledTimes(1)
  })

  test('skips query if user is not a catechist', () => {
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

    expect(screen.queryByText('HV0001')).not.toBeInTheDocument()
  })
})
