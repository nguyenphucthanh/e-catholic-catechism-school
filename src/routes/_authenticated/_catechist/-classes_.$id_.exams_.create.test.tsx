import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Route } from './classes_.$id_.exams_.create'
import { useAuth } from '~/lib/auth'

beforeEach(() => {
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
})

const mockUser = {
  _id: 'user123',
  userDocId: 'catechist123',
  memberId: 'GLV0001',
  fullName: 'Homeroom Teacher',
  role: 'user',
} as any

const mockClassDetails = {
  class: {
    _id: 'class123',
    name: 'Ấu Nhi 1',
    branchId: 'branch123',
    isDeleted: false,
  },
  classYear: {
    _id: 'classYear123',
    classId: 'class123',
    academicYearId: 'year123',
    isDeleted: false,
  },
  students: [
    {
      enrollment: {
        _id: 'enrollment1',
        status: 'active',
        enrolledDate: '2024-09-01',
      },
      student: {
        _id: 'student1',
        studentCode: 'HS0001',
        fullName: 'Nguyễn Văn A',
        saintName: 'Giuse',
        isActive: true,
        createdAt: 1725120000000,
        isDeleted: false,
      },
    },
    {
      enrollment: {
        _id: 'enrollment2',
        status: 'active',
        enrolledDate: '2024-09-01',
      },
      student: {
        _id: 'student2',
        studentCode: 'HS0002',
        fullName: 'Trần Thị B',
        saintName: 'Maria',
        isActive: true,
        createdAt: 1725120000000,
        isDeleted: false,
      },
    },
  ],
}

const mockSemesters = [
  {
    _id: 'semester1',
    academicYearId: 'year123',
    semesterNumber: 1,
    name: 'Học Kỳ 1',
    isDeleted: false,
  },
  {
    _id: 'semester2',
    academicYearId: 'year123',
    semesterNumber: 2,
    name: 'Học Kỳ 2',
    isDeleted: false,
  },
]

function setupQueries(details?: any, sems?: any) {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'classes:getClassDetails') return details
    if (path === 'academicYears:listSemesters') return sems
    return undefined
  })
}

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: () => ({
    selectedYearId: 'year123',
    setSelectedYearId: vi.fn(),
  }),
}))

const navigateMock = vi.fn()
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useParams: () => ({ id: 'class123' }),
    useNavigate: () => navigateMock,
  }
})

describe('CreateExamPage component', () => {
  beforeEach(() => {
    navigateMock.mockClear()
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockUser,
    })
  })

  test('renders loading state when classDetails are undefined', () => {
    setupQueries(undefined, mockSemesters)
    const Component = (Route as any).options.component
    const { container } = render(<Component />)
    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  test('renders form, class details and students list', () => {
    setupQueries(mockClassDetails, mockSemesters)
    const Component = (Route as any).options.component
    render(<Component />)

    // Verify title and subtitle
    expect(screen.getByText('exams.create.title')).toBeInTheDocument()
    expect(screen.getByText('Ấu Nhi 1')).toBeInTheDocument()

    // Verify form fields
    expect(screen.getByLabelText('exams.create.name')).toBeInTheDocument()
    expect(
      screen.getByLabelText('attendance.createSession.semester'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('exams.create.type')).toBeInTheDocument()
    expect(screen.getByLabelText('exams.create.scale')).toBeInTheDocument()
    expect(screen.getByLabelText('exams.create.weight')).toBeInTheDocument()
    expect(screen.getByLabelText('exams.create.examDate')).toBeInTheDocument()
    expect(screen.getByLabelText('exams.create.sortOrder')).toBeInTheDocument()

    // Verify student names are rendered
    expect(screen.getByText('Giuse Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText('Maria Trần Thị B')).toBeInTheDocument()

    // Verify search input is present in bottom footer
    expect(
      screen.getByPlaceholderText('exams.create.searchPlaceholder'),
    ).toBeInTheDocument()
  })

  test('filters student list based on search query', () => {
    setupQueries(mockClassDetails, mockSemesters)
    const Component = (Route as any).options.component
    render(<Component />)

    const searchInput = screen.getByPlaceholderText(
      'exams.create.searchPlaceholder',
    )

    // Type query matching student 1 only
    fireEvent.change(searchInput, { target: { value: 'Nguyễn' } })
    expect(screen.getByText('Giuse Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.queryByText('Maria Trần Thị B')).not.toBeInTheDocument()

    // Type query matching saint name
    fireEvent.change(searchInput, { target: { value: 'Maria' } })
    expect(screen.queryByText('Giuse Nguyễn Văn A')).not.toBeInTheDocument()
    expect(screen.getByText('Maria Trần Thị B')).toBeInTheDocument()

    // Clear search query
    fireEvent.change(searchInput, { target: { value: '' } })
    expect(screen.getByText('Giuse Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText('Maria Trần Thị B')).toBeInTheDocument()
  })

  test('shows and hides warning discard changes dialog', () => {
    setupQueries(mockClassDetails, mockSemesters)
    const Component = (Route as any).options.component
    render(<Component />)

    // Change column name to make form dirty
    const nameInput = screen.getByLabelText('exams.create.name')
    fireEvent.change(nameInput, { target: { value: 'Midterm Test' } })

    // Click Cancel
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))

    // AlertDialog should open
    expect(
      screen.getByText('attendance.createSession.confirmLeaveTitle'),
    ).toBeInTheDocument()

    // Discard changes
    fireEvent.click(
      screen.getByRole('button', { name: 'classes.confirmLeave.discard' }),
    )
    expect(navigateMock).toHaveBeenCalledWith({ to: '/classes/class123' })
  })

  test('submits successfully calling mutation', async () => {
    setupQueries(mockClassDetails, mockSemesters)
    const mockCreate = vi.fn().mockResolvedValue('exam123')
    vi.mocked(useMutation).mockReturnValue(mockCreate as any)

    const Component = (Route as any).options.component
    render(<Component />)

    // Set name
    const nameInput = screen.getByLabelText('exams.create.name')
    fireEvent.change(nameInput, { target: { value: 'Midterm Test' } })

    // Click submit button in fixed footer
    fireEvent.click(screen.getByRole('button', { name: 'exams.create.submit' }))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          requesterId: 'catechist123',
          classYearId: 'classYear123',
          semesterId: 'semester1',
          columnName: 'Midterm Test',
          columnType: '',
          scaleType: 'scale_10',
          weight: 1,
          sortOrder: 1,
          scores: [
            {
              studentId: 'student1',
              scoreValue: undefined,
              scoreLabel: undefined,
            },
            {
              studentId: 'student2',
              scoreValue: undefined,
              scoreLabel: undefined,
            },
          ],
        }),
      )
    })

    expect(toast.success).toHaveBeenCalledWith('exams.create.success')
    expect(navigateMock).toHaveBeenCalledWith({ to: '/classes/class123' })
  })

  test('renders and updates pass_fail and letter_af score scales', () => {
    setupQueries(mockClassDetails, mockSemesters)
    const Component = (Route as any).options.component
    render(<Component />)

    // Change scaleType to pass_fail
    const scaleSelect = screen.getByLabelText('exams.create.scale')
    fireEvent.pointerDown(scaleSelect)
    fireEvent.click(scaleSelect)

    const pfOption = screen.getByRole('option', {
      name: 'exams.create.scale.pass_fail',
    })
    fireEvent.pointerDown(pfOption)
    fireEvent.click(pfOption)

    // In pass_fail mode, it renders a Select for student scores with option "Chưa nhập"
    expect(screen.getAllByText('Chưa nhập').length).toBeGreaterThan(0)

    // Change scaleType to letter_af
    fireEvent.pointerDown(scaleSelect)
    fireEvent.click(scaleSelect)

    const lafOption = screen.getByRole('option', {
      name: 'exams.create.scale.letter_af',
    })
    fireEvent.pointerDown(lafOption)
    fireEvent.click(lafOption)

    // In letter_af mode, it renders a text Input with placeholder "Ví dụ: A+, B-"
    const letterInput = screen.getAllByPlaceholderText('Ví dụ: A+, B-')[0]
    fireEvent.change(letterInput, { target: { value: 'A+' } })
    expect(letterInput).toHaveValue('A+')
  })
})
