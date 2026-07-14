import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { useParams } from '@tanstack/react-router'
import { getFunctionName } from 'convex/server'
import { api } from '../../../../convex/_generated/api'
import { Route } from './students_.$id_.attendance'
import { useAuth } from '~/lib/auth'
import { exportCsv, exportPdf } from '~/lib/export'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useParams: vi.fn(),
    Link: ({ children, to, params, className }: any) => (
      <a href={`${to}`.replace('$id', params?.id)} className={className}>
        {children}
      </a>
    ),
  }
})

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

const mockStudentDetail = {
  _id: 'student123',
  studentCode: 'HS0001',
  fullName: 'John Doe',
  saintName: 'John',
} as any

const mockRecords = [
  {
    _id: 'record1',
    status: 'present',
    notes: null,
    deviceQueuedAt: 1773043800000,
    sessionType: 'mass',
    sessionDate: '2026-07-08',
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
    sessionType: 'extracurricular',
    sessionDate: '2026-07-09',
    classId: null,
    className: null,
    recordedByCatechistId: null,
    recordedByCatechistName: 'Catechist Two',
  },
]

function setupQueries({
  student,
  records,
}: {
  student: unknown
  records: unknown
}) {
  const studentDetailName = getFunctionName(api.students.getStudentDetail)
  const attendanceReportName = getFunctionName(
    api.attendance.getStudentAttendanceReport,
  )
  vi.mocked(useQuery).mockImplementation(((query: unknown, args?: unknown) => {
    const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
    if (args === 'skip') return undefined
    if (name === studentDetailName) return student
    if (name === attendanceReportName) return records
    return undefined
  }) as typeof useQuery)
}

const AttendancePage = (Route as any).options.component

describe('StudentAttendanceReportPage component', () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockClear()
    vi.mocked(exportCsv).mockClear()
    vi.mocked(exportPdf).mockClear()
    vi.mocked(useParams).mockReturnValue({ id: 'student123' })
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
  })

  test('renders loading skeleton while records are undefined', () => {
    setupQueries({ student: mockStudentDetail, records: undefined })

    const { container } = render(<AttendancePage />)

    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
    expect(screen.queryByText('Catechist Recorder')).not.toBeInTheDocument()
  })

  test('renders records with formatted time, type, class name, status, recorded-by', () => {
    setupQueries({ student: mockStudentDetail, records: mockRecords })

    render(<AttendancePage />)

    expect(
      screen.getByText('students.attendance.types.mass'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('students.attendance.types.extracurricular'),
    ).toBeInTheDocument()
    expect(screen.getByText('Chiên Con 1')).toBeInTheDocument()
    // null className renders as em dash
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('attendance.status.present')).toBeInTheDocument()
    expect(screen.getByText('attendance.status.late')).toBeInTheDocument()
    expect(screen.getByText('Catechist Recorder')).toBeInTheDocument()
    expect(screen.getByText('Catechist Two')).toBeInTheDocument()

    // Subtitle uses formatted student name
    expect(screen.getByText('John John Doe')).toBeInTheDocument()

    // Class name links to class detail page when classId present
    expect(screen.getByText('Chiên Con 1').closest('a')).toHaveAttribute(
      'href',
      '/classes/class1',
    )
    // Recorded-by links to catechist detail page when id present
    expect(screen.getByText('Catechist Recorder').closest('a')).toHaveAttribute(
      'href',
      '/catechists/catechist1',
    )
    // Falls back to plain text (no link) when ids are missing
    expect(screen.getByText('Catechist Two').closest('a')).toBeNull()
  })

  test('date range filters narrow the record list', () => {
    setupQueries({ student: mockStudentDetail, records: mockRecords })

    render(<AttendancePage />)

    expect(screen.getByText('Catechist Recorder')).toBeInTheDocument()
    expect(screen.getByText('Catechist Two')).toBeInTheDocument()

    const trigger = screen
      .getByText('students.attendance.filters.dateFrom')
      .closest('button')!
    fireEvent.click(trigger)

    const dateButton = screen.getByRole('button', {
      name: 'Thursday, July 9th, 2026',
    })
    fireEvent.click(dateButton)

    expect(screen.queryByText('Catechist Recorder')).not.toBeInTheDocument()
    expect(screen.getByText('Catechist Two')).toBeInTheDocument()
  })

  test('type filter narrows the record list to the selected session type', () => {
    setupQueries({ student: mockStudentDetail, records: mockRecords })

    render(<AttendancePage />)

    expect(screen.getByText('Catechist Recorder')).toBeInTheDocument()
    expect(screen.getByText('Catechist Two')).toBeInTheDocument()

    const trigger = screen
      .getByText('students.attendance.filters.allTypes')
      .closest('button')!
    fireEvent.click(trigger)

    const massOption = screen.getByRole('option', {
      name: 'students.attendance.types.mass',
    })
    fireEvent.pointerDown(massOption)
    fireEvent.click(massOption)

    expect(screen.getByText('Catechist Recorder')).toBeInTheDocument()
    expect(screen.queryByText('Catechist Two')).not.toBeInTheDocument()
  })

  test('shows empty state text when filtered record list is empty', () => {
    setupQueries({ student: mockStudentDetail, records: [] })

    render(<AttendancePage />)

    expect(screen.getByText('students.attendance.empty')).toBeInTheDocument()
  })

  test('export dropdown is hidden when there are no records and shown when there are', () => {
    setupQueries({ student: mockStudentDetail, records: [] })
    const { rerender } = render(<AttendancePage />)

    expect(
      screen.queryByRole('button', { name: /classes\.export\.title/i }),
    ).not.toBeInTheDocument()

    setupQueries({ student: mockStudentDetail, records: mockRecords })
    rerender(<AttendancePage />)

    const exportButton = screen.getByRole('button', {
      name: /classes\.export\.title/i,
    })
    expect(exportButton).toBeInTheDocument()

    fireEvent.click(exportButton)
    fireEvent.click(screen.getByText(/classes\.export\.csv/i))
    expect(exportCsv).toHaveBeenCalledTimes(1)

    fireEvent.click(exportButton)
    fireEvent.click(screen.getByText(/classes\.export\.pdf/i))
    expect(exportPdf).toHaveBeenCalledTimes(1)
  })

  test('skips both queries when user is not an authenticated catechist', () => {
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
    setupQueries({ student: undefined, records: undefined })

    render(<AttendancePage />)

    expect(useQuery).toHaveBeenCalledWith(api.students.getStudentDetail, 'skip')
    expect(useQuery).toHaveBeenCalledWith(
      api.attendance.getStudentAttendanceReport,
      'skip',
    )
    expect(screen.queryByText('Catechist Recorder')).not.toBeInTheDocument()
  })
})
