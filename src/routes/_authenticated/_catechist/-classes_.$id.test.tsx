import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { useParams, useSearch } from '@tanstack/react-router'
import { Route } from './classes_.$id'
import { useAuth } from '~/lib/auth'
import { useInactiveYear, useSelectedAcademicYear } from '~/lib/academic-year'
import { exportCsv, exportPdf } from '~/lib/export'

vi.mock('~/lib/export', () => ({
  exportCsv: vi.fn(),
  exportPdf: vi.fn(),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    useParams: vi.fn(),
    useSearch: vi.fn(),
    useNavigate: vi.fn(() => vi.fn()),
    Link: ({ children, to, params, search, className }: any) => (
      <a
        href={to}
        data-params={JSON.stringify(params)}
        data-search={JSON.stringify(search)}
        className={className}
      >
        {children}
      </a>
    ),
  }
})

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: vi.fn(),
  useInactiveYear: vi.fn(() => ({ isInactive: false, yearName: null })),
}))

vi.mocked(useParams).mockReturnValue({ id: 'class123' })
vi.mocked(useSearch).mockReturnValue({})

function mockUseQuery(data: unknown) {
  vi.mocked(useQuery).mockImplementation((query: any, ..._args: Array<any>) => {
    const name = (query)?.[Symbol.for('functionName')]
    if (name === 'calendarEvents:list') return []
    return data
  })
}

const sampleClass = {
  _id: 'class123',
  name: 'Ấu Nhi 1',
  branchId: 'branch123',
  description: 'Lớp ấu nhi',
  isDeleted: false,
}

const sampleBranch = {
  _id: 'branch123',
  name: 'Ấu Nhi',
  sortOrder: 1,
  isDeleted: false,
}

const sampleClassYear = {
  _id: 'classYear123',
  classId: 'class123',
  academicYearId: 'year123',
  classType: undefined,
  isDeleted: false,
}

const sampleCatechist = {
  _id: 'catechist456',
  memberId: '000456',
  fullName: 'Nguyễn Văn A',
  saintName: 'John',
  isDeleted: false,
}

const sampleStudent = {
  _id: 'student789',
  studentCode: 'S001',
  fullName: 'Trần Thị B',
  saintName: 'Mary',
  dateOfBirth: '2010-05-15',
  gender: 'female' as const,
  isDeleted: false,
}

const classDetailsWithData = {
  class: sampleClass,
  branch: sampleBranch,
  classYear: sampleClassYear,
  assignedCatechists: [
    { role: 'homeroom' as const, catechist: sampleCatechist },
  ],
  students: [
    {
      enrollment: {
        _id: 'enrollment123',
        status: 'active' as const,
        enrolledDate: '2024-09-01',
      },
      student: sampleStudent,
      sacramentDates: {},
    },
  ],
  studentCount: 1,
}

const sampleEventsList = [
  {
    _id: 'event1',
    academicYearId: 'year123',
    date: '2026-07-20',
    liturgicalDate: 'Chúa Nhật XVI TN',
    description: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Họp phụ huynh cuối năm' }],
        },
      ],
    }),
    severity: 'high' as const,
    scope: 'class' as const,
    branchId: undefined,
    classYearId: 'classYear123',
    createdBy: 'catechist456',
    createdAt: Date.now(),
    isDeleted: false,
    branchName: null,
    className: 'Ấu Nhi 1',
    createdByName: 'Nguyễn Văn A',
    updatedByName: null,
  },
  {
    _id: 'event2',
    academicYearId: 'year123',
    date: '2026-08-01',
    liturgicalDate: undefined,
    description: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Kiểm tra cuối khóa' }],
        },
      ],
    }),
    severity: 'medium' as const,
    scope: 'class' as const,
    branchId: undefined,
    classYearId: 'classYear123',
    createdBy: 'catechist456',
    createdAt: Date.now(),
    isDeleted: false,
    branchName: null,
    className: null,
    createdByName: 'Nguyễn Văn A',
    updatedByName: null,
  },
]

const classDetailsNotActivated = {
  class: sampleClass,
  branch: sampleBranch,
  classYear: null,
  assignedCatechists: [],
  students: [],
  studentCount: 0,
}

describe('ClassDetailPage', () => {
  beforeEach(() => {
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: 'year123',
    } as any)
    vi.mocked(useInactiveYear).mockReturnValue({
      isInactive: false,
      yearName: null,
    })
  })

  test('renders skeleton while loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    vi.mocked(useQuery).mockReturnValue(undefined)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  test('renders class name when data is available', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    mockUseQuery(classDetailsWithData)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('Ấu Nhi 1')).toBeInTheDocument()
  })

  test('renders alert when class is not activated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    mockUseQuery(classDetailsNotActivated)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('classes.detail.notActivated')).toBeInTheDocument()
  })

  test('renders catechists section when class year is active', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    mockUseQuery(classDetailsWithData)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(
      screen.getByText('classes.detail.catechists.title'),
    ).toBeInTheDocument()
    expect(screen.getByText('John Nguyễn Văn A')).toBeInTheDocument()
  })

  test('renders student count when class year is active', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    mockUseQuery(classDetailsWithData)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(
      screen.getByText('classes.detail.students.count'),
    ).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  test('renders upcoming events card with class-scoped events', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    vi.mocked(useQuery).mockImplementation(
      (query: any, ..._args: Array<any>) => {
        const name = (query)?.[Symbol.for('functionName')]
        if (name === 'calendarEvents:list') return sampleEventsList
        return classDetailsWithData
      },
    )

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(
      screen.getByText('classes.detail.upcomingEvents.title'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('classes.detail.upcomingEvents.viewAll'),
    ).toBeInTheDocument()
    expect(screen.getByText('Họp phụ huynh cuối năm')).toBeInTheDocument()
    expect(screen.getByText('Kiểm tra cuối khóa')).toBeInTheDocument()
  })

  test('renders empty state when no upcoming events', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    vi.mocked(useQuery).mockImplementation(
      (query: any, ..._args: Array<any>) => {
        const name = (query)?.[Symbol.for('functionName')]
        if (name === 'calendarEvents:list') return []
        return classDetailsWithData
      },
    )

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(
      screen.getByText('classes.detail.upcomingEvents.empty'),
    ).toBeInTheDocument()
  })

  test('renders tabs when class year is active', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    mockUseQuery(classDetailsWithData)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('classes.detail.tabs.students')).toBeInTheDocument()
    expect(screen.getByText('classes.detail.tabs.exams')).toBeInTheDocument()
    expect(
      screen.getByText('classes.detail.tabs.attendance'),
    ).toBeInTheDocument()
  })

  test('renders student data in table', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    mockUseQuery(classDetailsWithData)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('S001')).toBeInTheDocument()
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument()
  })

  test('renders student data with fallback and different statuses', () => {
    const classDetailsFallbackData = {
      class: sampleClass,
      branch: sampleBranch,
      classYear: sampleClassYear,
      assignedCatechists: [
        {
          role: 'co_teacher' as const,
          catechist: {
            _id: 'cat1',
            fullName: 'Co Teacher',
            saintName: undefined,
            isDeleted: false,
          },
        },
        {
          role: 'homeroom' as const,
          catechist: {
            _id: 'cat2',
            fullName: 'Homeroom Teacher',
            saintName: 'Peter',
            isDeleted: false,
          },
        },
      ],
      students: [
        {
          enrollment: {
            _id: 'enrollment2',
            status: 'on_leave' as const,
            enrolledDate: '2024-09-01',
          },
          student: {
            _id: 'student2',
            studentCode: 'S002',
            fullName: 'Nguyen Van C',
            saintName: undefined,
            dateOfBirth: undefined,
            gender: undefined,
            isDeleted: false,
          },
          sacramentDates: {},
        },
        {
          enrollment: {
            _id: 'enrollment3',
            status: 'withdrawn' as const,
            enrolledDate: '2024-09-01',
          },
          student: {
            _id: 'student3',
            studentCode: 'S003',
            fullName: 'Le Thi D',
            saintName: 'Anne',
            dateOfBirth: '2011-10-10',
            gender: 'female' as const,
            isDeleted: false,
          },
          sacramentDates: {},
        },
      ],
      studentCount: 2,
    }

    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    mockUseQuery(classDetailsFallbackData)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    // Homeroom teacher should sort first and render role badge
    expect(screen.getByText('Peter Homeroom Teacher')).toBeInTheDocument()
    expect(screen.getByText('Co Teacher')).toBeInTheDocument()

    // Students with fallbacks
    expect(screen.getByText('S002')).toBeInTheDocument()
    expect(screen.getByText('Nguyen Van C')).toBeInTheDocument()

    expect(screen.getByText('S003')).toBeInTheDocument()
    expect(screen.getByText('Le Thi D')).toBeInTheDocument()
  })

  test('renders activated view with empty selected academic year', () => {
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: null,
    } as any)
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    mockUseQuery(classDetailsNotActivated)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('classes.detail.notActivated')).toBeInTheDocument()
  })

  test('renders warning banner and hides enroll button when year is inactive', () => {
    vi.mocked(useInactiveYear).mockReturnValue({
      isInactive: true,
      yearName: '2023-2024',
    })
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)

    // Setup classDetails with canManageEnrollments = true
    const classDetailsWithManager = {
      ...classDetailsWithData,
      canManageEnrollments: true,
    }
    mockUseQuery(classDetailsWithManager)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    // Alert warning banner is shown
    expect(
      screen.getByText('classes.detail.pastYearWarning'),
    ).toBeInTheDocument()

    // Enroll students button should be hidden
    expect(
      screen.queryByText('classes.enrollment.buttonLabel'),
    ).not.toBeInTheDocument()
  })

  test('handles exporting to CSV and PDF', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    mockUseQuery(classDetailsWithData)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    // Find export button and click it to open menu
    const exportBtn = screen.getByRole('button', {
      name: 'classes.export.title',
    })
    expect(exportBtn).toBeInTheDocument()
    fireEvent.click(exportBtn)

    // Click CSV export
    const csvBtn = screen.getByText('classes.export.csv')
    fireEvent.click(csvBtn)
    expect(exportCsv).toHaveBeenCalled()

    // Click PDF export
    fireEvent.click(exportBtn)
    const pdfBtn = screen.getByText('classes.export.pdf')
    fireEvent.click(pdfBtn)
    expect(exportPdf).toHaveBeenCalled()
  })

  test('handles tab switches', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    vi.mocked(useQuery).mockImplementation((query, ..._args: Array<any>) => {
      const name = (query as any)?.[Symbol.for('functionName')]
      if (name === 'classes:getClassDetails') {
        return classDetailsWithData
      }
      if (name === 'grading:getScoresGrid') {
        return {
          scoreColumns: [],
          students: [],
          scoreEntriesMap: {},
        }
      }
      if (name === 'attendance:getAttendanceGrid') {
        return {
          sessions: [],
          attendanceMap: {},
          students: [],
        }
      }
      if (name === 'academicYears:listSemesters') {
        return []
      }
      if (name === 'grading:listSemesterResultsByClassYear') {
        return []
      }
      if (name === 'grading:listAnnualResults') {
        return []
      }
      if (name === 'appConfig:get') {
        return { nameFormat: 'firstName_lastName' }
      }
      if (name === 'calendarEvents:list') {
        return []
      }
      return undefined
    })

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    // Click Exams tab
    const examsTab = screen.getByRole('tab', {
      name: 'classes.detail.tabs.exams',
    })
    fireEvent.click(examsTab)

    // Click Attendance tab
    const attendanceTab = screen.getByRole('tab', {
      name: 'classes.detail.tabs.attendance',
    })
    fireEvent.click(attendanceTab)
  })

  test('opens remove student confirmation and removes student', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)

    // Setup classDetails with canManageEnrollments = true
    const classDetailsWithManager = {
      ...classDetailsWithData,
      canManageEnrollments: true,
    }
    mockUseQuery(classDetailsWithManager)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    // Find the More Actions button (MoreHorizontal)
    const actionBtn = screen.getByRole('button', { name: 'common.moreActions' })
    expect(actionBtn).toBeInTheDocument()
    fireEvent.click(actionBtn)

    // Click the remove option
    const removeBtn = screen.getByText('classes.enrollment.remove.title')
    fireEvent.click(removeBtn)

    // Confirmation dialog should be open
    expect(
      screen.getByText('classes.enrollment.remove.confirm'),
    ).toBeInTheDocument()

    // Click confirm
    const confirmBtn = screen.getByText('classes.enrollment.remove.confirm')
    fireEvent.click(confirmBtn)
  })
})
