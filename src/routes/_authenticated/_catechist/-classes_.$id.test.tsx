import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { useParams, useSearch } from '@tanstack/react-router'
import { Route } from './classes_.$id'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'

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
}))

vi.mocked(useParams).mockReturnValue({ id: 'class123' })
vi.mocked(useSearch).mockReturnValue({})

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
    vi.mocked(useQuery).mockReturnValue(classDetailsWithData)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('Ấu Nhi 1')).toBeInTheDocument()
  })

  test('renders alert when class is not activated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    vi.mocked(useQuery).mockReturnValue(classDetailsNotActivated)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('classes.detail.notActivated')).toBeInTheDocument()
  })

  test('renders catechists section when class year is active', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    vi.mocked(useQuery).mockReturnValue(classDetailsWithData)

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
    vi.mocked(useQuery).mockReturnValue(classDetailsWithData)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(
      screen.getByText('classes.detail.students.count'),
    ).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  test('renders tabs when class year is active', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    vi.mocked(useQuery).mockReturnValue(classDetailsWithData)

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
    vi.mocked(useQuery).mockReturnValue(classDetailsWithData)

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
        {
          enrollment: {
            _id: 'enrollment4',
            status: 'active' as const,
            enrolledDate: '2024-09-01',
          },
          student: null,
          sacramentDates: {},
        },
      ],
      studentCount: 3,
    }

    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
    vi.mocked(useQuery).mockReturnValue(classDetailsFallbackData)

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
    vi.mocked(useQuery).mockReturnValue(classDetailsNotActivated)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('classes.detail.notActivated')).toBeInTheDocument()
  })
})
