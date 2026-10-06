import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Route } from './classes_.$id_.sessions_.create'
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

vi.mock('~/components/custom/qr-scanner', () => ({
  QRScanner: (props: { onScan: (c: string) => void }) => (
    <div data-testid="qr-scanner">
      <button onClick={() => props.onScan('HS0001')}>scan-ok</button>
      <button onClick={() => props.onScan('NOPE')}>scan-unknown</button>
    </div>
  ),
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

describe('CreateSessionWithAttendancePage component', () => {
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
    expect(
      screen.getByText('attendance.createSession.title'),
    ).toBeInTheDocument()
    expect(screen.getByText('Ấu Nhi 1')).toBeInTheDocument()

    // Verify form fields
    expect(
      screen.getByLabelText('attendance.createSession.date', { exact: false }),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('attendance.createSession.semester', {
        exact: false,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('attendance.createSession.type'),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('attendance.createSession.notes'),
    ).toBeInTheDocument()

    // Verify student names are rendered
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText('Giuse')).toBeInTheDocument()
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument()
    expect(screen.getByText('Maria')).toBeInTheDocument()

    // Verify search input is present in bottom footer
    expect(
      screen.getByPlaceholderText('attendance.createSession.searchPlaceholder'),
    ).toBeInTheDocument()
  })

  test('filters student list based on search query', () => {
    setupQueries(mockClassDetails, mockSemesters)
    const Component = (Route as any).options.component
    render(<Component />)

    const searchInput = screen.getByPlaceholderText(
      'attendance.createSession.searchPlaceholder',
    )

    // Type query matching student 1 only
    fireEvent.change(searchInput, { target: { value: 'Nguyễn' } })
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.queryByText('Trần Thị B')).not.toBeInTheDocument()

    // Type query matching saint name
    fireEvent.change(searchInput, { target: { value: 'Maria' } })
    expect(screen.queryByText('Nguyễn Văn A')).not.toBeInTheDocument()
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument()

    // Clear search query
    fireEvent.change(searchInput, { target: { value: '' } })
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument()
  })

  test('shows and hides warning discard changes dialog', () => {
    setupQueries(mockClassDetails, mockSemesters)
    const Component = (Route as any).options.component
    render(<Component />)

    // Change date to make form dirty
    const dateInput = screen.getByLabelText('attendance.createSession.date', {
      exact: false,
    })
    fireEvent.change(dateInput, { target: { value: '2024-10-02' } })

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
    const mockCreate = vi.fn().mockResolvedValue('session123')
    vi.mocked(useMutation).mockReturnValue(mockCreate as any)

    const Component = (Route as any).options.component
    render(<Component />)

    // Set notes
    const notesInput = screen.getByLabelText('attendance.createSession.notes')
    fireEvent.change(notesInput, { target: { value: 'Lesson 1: Intro' } })

    // Click submit button in fixed footer
    fireEvent.click(
      screen.getByRole('button', { name: 'attendance.createSession.submit' }),
    )

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          requesterId: 'catechist123',
          classYearId: 'classYear123',
          semesterId: 'semester1',
          sessionDate: expect.any(String),
          sessionType: 'catechism',
          notes: 'Lesson 1: Intro',
          attendance: [
            { studentId: 'student1', status: 'present' },
            { studentId: 'student2', status: 'present' },
          ],
        }),
      )
    })

    expect(toast.success).toHaveBeenCalledWith(
      'attendance.createSession.success',
    )
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/classes/$id',
      params: { id: 'class123' },
      search: { tab: 'attendance' },
    })
  })
})

describe('QR scan mode', () => {
  const defaultT = () =>
    ({
      t: (key: string) => key,
      i18n: { language: 'en', changeLanguage: vi.fn() },
    }) as any
  let now = 1_000_000

  beforeEach(() => {
    navigateMock.mockClear()
    now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    // Interpolate options so the summary counts are assertable
    vi.mocked(useTranslation).mockImplementation(
      () =>
        ({
          t: (key: string, opts?: object) =>
            opts ? `${key}|${JSON.stringify(opts)}` : key,
          i18n: { language: 'en', changeLanguage: vi.fn() },
        }) as any,
    )
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockUser,
    })
    setupQueries(mockClassDetails, mockSemesters)
  })

  afterEach(() => {
    vi.mocked(useTranslation).mockImplementation(defaultT)
    vi.restoreAllMocks()
  })

  const renderPage = () => {
    const Component = (Route as any).options.component
    return render(<Component />)
  }
  const startScan = () =>
    fireEvent.click(
      screen.getByRole('button', {
        name: 'attendance.createSession.scanStart',
      }),
    )
  const summary = (present: number, absent: number) =>
    screen.getByText(
      (c) =>
        c.startsWith('attendance.createSession.summary|') &&
        c.includes(`"present":${present}`) &&
        c.includes(`"absent":${absent}`),
    )

  test('start scanning shows scanner and marks everyone unexcused', () => {
    renderPage()
    summary(2, 0)
    startScan()
    expect(screen.getByTestId('qr-scanner')).toBeInTheDocument()
    summary(0, 2)
  })

  test('scanning a valid code marks student present with success feedback', () => {
    renderPage()
    startScan()
    fireEvent.click(screen.getByText('scan-ok'))
    summary(1, 1)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Nguyễn Văn A — attendance.scanning.overlay.success',
    )
  })

  test('rescanning after debounce window shows duplicate and changes nothing', () => {
    renderPage()
    startScan()
    fireEvent.click(screen.getByText('scan-ok'))
    // within the window: ignored entirely
    now += 200
    fireEvent.click(screen.getByText('scan-ok'))
    expect(screen.getByRole('status')).toHaveTextContent(
      'attendance.scanning.overlay.success',
    )
    now += 2000
    fireEvent.click(screen.getByText('scan-ok'))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Nguyễn Văn A — attendance.scanning.overlay.duplicate',
    )
    summary(1, 1)
  })

  test('unknown code shows unknown feedback and changes nothing', () => {
    renderPage()
    startScan()
    fireEvent.click(screen.getByText('scan-unknown'))
    expect(screen.getByRole('status')).toHaveTextContent(
      'attendance.scanning.overlay.unknownLabel',
    )
    summary(0, 2)
  })

  test('feedback clears after timeout', () => {
    vi.useFakeTimers()
    try {
      renderPage()
      startScan()
      fireEvent.click(screen.getByText('scan-ok'))
      expect(screen.getByRole('status')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(2100)
      })
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  describe('after a manual edit', () => {
    const editFirstStudentToLate = () => {
      const row = document.getElementById('student-student1')!
      fireEvent.click(row.querySelector('button')!)
      fireEvent.click(
        screen.getByRole('button', {
          name: 'attendance.status.late.short',
        }),
      )
    }

    test('cancel keeps manual state', () => {
      renderPage()
      editFirstStudentToLate()
      startScan()
      expect(
        screen.getByText('attendance.createSession.scanResetTitle'),
      ).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))
      expect(screen.queryByTestId('qr-scanner')).not.toBeInTheDocument()
      expect(
        screen.getByText(
          (c) =>
            c.startsWith('attendance.createSession.summary|') &&
            c.includes('"late":1') &&
            c.includes('"present":1'),
        ),
      ).toBeInTheDocument()
    })

    test('confirm resets everyone to unexcused and starts scanning', () => {
      renderPage()
      editFirstStudentToLate()
      startScan()
      fireEvent.click(
        screen.getByRole('button', {
          name: 'attendance.createSession.scanResetConfirm',
        }),
      )
      expect(screen.getByTestId('qr-scanner')).toBeInTheDocument()
      summary(0, 2)
    })
  })

  test('submit after scan confirms absent list then sends scanned=present, others=unexcused', async () => {
    const mockCreate = vi.fn().mockResolvedValue('session123')
    vi.mocked(useMutation).mockReturnValue(mockCreate as any)
    renderPage()
    startScan()
    fireEvent.click(screen.getByText('scan-ok'))
    fireEvent.click(
      screen.getByRole('button', { name: 'attendance.createSession.submit' }),
    )
    expect(mockCreate).not.toHaveBeenCalled()
    expect(
      screen.getByText(
        (c) =>
          c.startsWith('attendance.createSession.scanSubmitTitle|') &&
          c.includes('"count":1'),
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Maria Trần Thị B')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'attendance.createSession.scanSubmitConfirm',
      }),
    )
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          attendance: [
            { studentId: 'student1', status: 'present' },
            { studentId: 'student2', status: 'unexcused_absence' },
          ],
        }),
      )
    })
  })

  test('stop scanning hides scanner and keeps statuses', () => {
    renderPage()
    startScan()
    fireEvent.click(screen.getByText('scan-ok'))
    fireEvent.click(
      screen.getByRole('button', { name: 'attendance.createSession.scanStop' }),
    )
    expect(screen.queryByTestId('qr-scanner')).not.toBeInTheDocument()
    summary(1, 1)
  })

  test('stop scanning with no scans resets everyone to present', () => {
    renderPage()
    startScan()
    summary(0, 2)
    fireEvent.click(
      screen.getByRole('button', { name: 'attendance.createSession.scanStop' }),
    )
    expect(screen.queryByTestId('qr-scanner')).not.toBeInTheDocument()
    summary(2, 0)
  })
})
