import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
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
  assignedCatechists: [] as Array<any>,
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

const cat = (
  id: string,
  fullName: string,
  isActive = true,
  saintName = 'Phaolô',
) => ({
  _id: id,
  fullName,
  saintName,
  memberId: `GLV-${id}`,
  isActive,
  isDeleted: false,
})

// Sorted by given name (last word): An (c2), Cường (c1); c3 is inactive
const mockCatechistDetails = {
  ...mockClassDetails,
  assignedCatechists: [
    { role: 'homeroom', catechist: cat('c1', 'Nguyễn Văn Cường') },
    { role: 'co_teacher', catechist: cat('c2', 'Phạm Thị An') },
    { role: 'co_teacher', catechist: cat('c3', 'Lê Văn Bình', false) },
  ],
}

const mockAllActive = [
  cat('c1', 'Nguyễn Văn Cường'),
  cat('c2', 'Phạm Thị An'),
  cat('s1', 'Sub One', true, 'Phêrô'),
  cat('s2', 'Sub Two', true, 'Anna'),
]

function setupQueries(details?: any, sems?: any, allActive?: any) {
  vi.mocked(useQuery).mockImplementation((queryRef: any, args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'classes:getClassDetails') return details
    if (path === 'academicYears:listSemesters') return sems
    if (path === 'catechists:listAllActive')
      return args === 'skip' ? undefined : allActive
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
  QRScanner: (props: { onScan: (c: string) => void; active?: boolean }) => (
    <div data-testid="qr-scanner" data-active={String(props.active)}>
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
  const closeDialog = async () => {
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    })
    await waitFor(() =>
      expect(screen.queryByTestId('qr-scanner')).not.toBeInTheDocument(),
    )
  }
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

    test('starting scan keeps manual edits, unset students become absent', () => {
      renderPage()
      editFirstStudentToLate()
      startScan()
      expect(screen.getByTestId('qr-scanner')).toBeInTheDocument()
      expect(
        screen.queryByText('attendance.createSession.scanResetTitle'),
      ).not.toBeInTheDocument()
      expect(
        screen.getByText(
          (c) =>
            c.startsWith('attendance.createSession.summary|') &&
            c.includes('"late":1') &&
            c.includes('"absent":1'),
        ),
      ).toBeInTheDocument()
    })
  })

  test('submit after scan confirms absent list then sends scanned=present, others=unexcused', async () => {
    const mockCreate = vi.fn().mockResolvedValue('session123')
    vi.mocked(useMutation).mockReturnValue(mockCreate as any)
    renderPage()
    startScan()
    fireEvent.click(screen.getByText('scan-ok'))
    await closeDialog()
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

  test('closing the dialog hides scanner and keeps scanned statuses', async () => {
    renderPage()
    startScan()
    fireEvent.click(screen.getByText('scan-ok'))
    await closeDialog()
    summary(1, 1)
  })

  test('closing the dialog with no scans resets everyone to present', async () => {
    renderPage()
    startScan()
    summary(0, 2)
    await closeDialog()
    summary(2, 0)
  })

  test('scan button opens a dialog containing the scanner', () => {
    renderPage()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    startScan()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByTestId('qr-scanner')).toBeInTheDocument()
  })

  test('feedback pill renders inside the dialog', () => {
    renderPage()
    startScan()
    fireEvent.click(screen.getByText('scan-ok'))
    expect(
      within(screen.getByRole('dialog')).getByRole('status'),
    ).toHaveTextContent('Nguyễn Văn A')
  })

  test('feedback is dropped when the dialog closes', async () => {
    renderPage()
    startScan()
    fireEvent.click(screen.getByText('scan-ok'))
    await closeDialog()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test('scanner is active while the dialog is open', () => {
    renderPage()
    startScan()
    expect(screen.getByTestId('qr-scanner')).toHaveAttribute(
      'data-active',
      'true',
    )
  })

  test('scanner is inactive while the submit confirm dialog is open', () => {
    renderPage()
    startScan()
    fireEvent.click(screen.getByText('scan-ok'))
    // page is aria-hidden behind the modal, so query by text
    fireEvent.click(screen.getByText('attendance.createSession.submit'))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByTestId('qr-scanner')).toHaveAttribute(
      'data-active',
      'false',
    )
  })

  test('scanner is inactive while the leave confirm dialog is open', () => {
    renderPage()
    startScan()
    fireEvent.click(screen.getByText('scan-ok'))
    fireEvent.click(screen.getByText('common.cancel'))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByTestId('qr-scanner')).toHaveAttribute(
      'data-active',
      'false',
    )
  })
})

describe('assigned catechists', () => {
  const renderPage = () => {
    const Component = (Route as any).options.component
    return render(<Component />)
  }
  const tileIds = () =>
    Array.from(document.querySelectorAll('[id^="catechist-"]')).map(
      (el) => el.id,
    )
  const setStatus = (rowId: string, shortKey: string) => {
    const row = document.getElementById(rowId)!
    fireEvent.click(row.querySelector('button')!)
    fireEvent.click(within(row).getByRole('button', { name: shortKey }))
  }
  const absent = 'attendance.status.unexcused_absence.short'
  const submitBtn = () =>
    screen.getByRole('button', { name: 'attendance.createSession.submit' })
  const subInput = () =>
    screen.getByPlaceholderText(
      'attendance.createSession.substitutePlaceholder',
    )
  const pickSub = (label: string) => {
    fireEvent.mouseDown(subInput())
    const option = screen.getByText(label)
    fireEvent.pointerDown(option)
    fireEvent.click(option)
  }
  const allAbsent = () => {
    setStatus('catechist-c1', absent)
    setStatus('catechist-c2', absent)
  }
  const lastCall = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[0][0]

  beforeEach(() => {
    navigateMock.mockClear()
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockUser,
    })
    setupQueries(mockCatechistDetails, mockSemesters, mockAllActive)
  })

  describe('section', () => {
    test('renders active catechists sorted by name with role badges', () => {
      renderPage()
      expect(tileIds()).toEqual(['catechist-c2', 'catechist-c1'])
      expect(
        screen.getByText('attendance.createSession.catechists'),
      ).toBeInTheDocument()
      expect(screen.getByText('Phạm Thị An')).toBeInTheDocument()
      expect(screen.queryByText('Lê Văn Bình')).not.toBeInTheDocument()
      const home = document.getElementById('catechist-c1')!
      expect(
        within(home).getByText('catechistAttendance.role.homeroom'),
      ).toBeInTheDocument()
      expect(
        within(document.getElementById('catechist-c2')!).getByText(
          'catechistAttendance.role.co_teacher',
        ),
      ).toBeInTheDocument()
    })

    test('is hidden when the class has no assigned catechists', () => {
      setupQueries(mockClassDetails, mockSemesters, mockAllActive)
      renderPage()
      expect(
        screen.queryByText('attendance.createSession.catechists'),
      ).not.toBeInTheDocument()
      expect(tileIds()).toEqual([])
    })

    test('is hidden when every assigned catechist is inactive', () => {
      setupQueries(
        {
          ...mockClassDetails,
          assignedCatechists: [
            { role: 'homeroom', catechist: cat('c3', 'Lê Văn Bình', false) },
          ],
        },
        mockSemesters,
      )
      renderPage()
      expect(tileIds()).toEqual([])
    })

    test('status change through the tile is reflected and collapses it', () => {
      renderPage()
      setStatus('catechist-c1', 'attendance.status.late.short')
      const row = document.getElementById('catechist-c1')!
      expect(
        within(row).queryByRole('button', {
          name: 'attendance.status.late.short',
        }),
      ).not.toBeInTheDocument()
      expect(row.querySelector('button')!.className).toContain('#fef08a')
      // other tile untouched
      expect(
        document.getElementById('catechist-c2')!.querySelector('button')!
          .className,
      ).toContain('#bbf7d0')
    })

    test('search does not filter catechists', () => {
      renderPage()
      fireEvent.change(
        screen.getByPlaceholderText(
          'attendance.createSession.searchPlaceholder',
        ),
        { target: { value: 'Maria' } },
      )
      expect(screen.queryByText('Nguyễn Văn A')).not.toBeInTheDocument()
      expect(tileIds()).toEqual(['catechist-c2', 'catechist-c1'])
    })

    test('only one tile is expanded at a time across both lists', () => {
      renderPage()
      const shortLate = 'attendance.status.late.short'
      const cRow = document.getElementById('catechist-c1')!
      const sRow = document.getElementById('student-student1')!
      fireEvent.click(cRow.querySelector('button')!)
      expect(
        within(cRow).getByRole('button', { name: shortLate }),
      ).toBeInTheDocument()
      fireEvent.click(sRow.querySelector('button')!)
      expect(
        within(sRow).getByRole('button', { name: shortLate }),
      ).toBeInTheDocument()
      expect(
        within(cRow).queryByRole('button', { name: shortLate }),
      ).not.toBeInTheDocument()
    })
  })

  describe('substitute input', () => {
    test('hidden when none assigned', () => {
      setupQueries(mockClassDetails, mockSemesters, mockAllActive)
      renderPage()
      expect(
        screen.queryByPlaceholderText(
          'attendance.createSession.substitutePlaceholder',
        ),
      ).not.toBeInTheDocument()
    })

    test('hidden when everyone is present or only one is absent', () => {
      renderPage()
      const ph = 'attendance.createSession.substitutePlaceholder'
      expect(screen.queryByPlaceholderText(ph)).not.toBeInTheDocument()
      setStatus('catechist-c1', absent)
      expect(screen.queryByPlaceholderText(ph)).not.toBeInTheDocument()
    })

    test('shown when all assigned are absent (excused counts too)', () => {
      renderPage()
      setStatus('catechist-c1', 'attendance.status.excused_absence.short')
      setStatus('catechist-c2', absent)
      expect(subInput()).toBeInTheDocument()
      expect(
        screen.getByText('attendance.createSession.substitutes'),
      ).toBeInTheDocument()
    })

    test('inactive assigned catechist is ignored for the all-absent rule', () => {
      renderPage()
      allAbsent() // c3 (inactive) stays default present
      expect(subInput()).toBeInTheDocument()
    })

    test('lists active catechists minus assigned and already picked', () => {
      renderPage()
      allAbsent()
      fireEvent.mouseDown(subInput())
      expect(screen.getByText('Phêrô Sub One')).toBeInTheDocument()
      expect(screen.getByText('Anna Sub Two')).toBeInTheDocument()
      expect(screen.queryByText('Phaolô Phạm Thị An')).not.toBeInTheDocument()
      expect(
        screen.queryByText('Phaolô Nguyễn Văn Cường'),
      ).not.toBeInTheDocument()
    })

    test('picked substitutes show as badges, leave the list, and can be removed', () => {
      renderPage()
      allAbsent()
      pickSub('Phêrô Sub One')
      pickSub('Anna Sub Two')
      const removes = screen.getAllByRole('button', {
        name: 'attendance.createSession.substituteRemove',
      })
      expect(removes).toHaveLength(2)
      expect(screen.getAllByText('Phêrô Sub One')).toHaveLength(1)

      fireEvent.click(removes[0])
      expect(
        screen.getAllByRole('button', {
          name: 'attendance.createSession.substituteRemove',
        }),
      ).toHaveLength(1)
      expect(screen.queryByText('Phêrô Sub One')).not.toBeInTheDocument()
      expect(screen.getByText('Anna Sub Two')).toBeInTheDocument()
    })

    test('hides and clears picks when an assigned catechist returns', () => {
      renderPage()
      allAbsent()
      pickSub('Phêrô Sub One')
      setStatus('catechist-c1', 'attendance.status.present.short')
      expect(
        screen.queryByPlaceholderText(
          'attendance.createSession.substitutePlaceholder',
        ),
      ).not.toBeInTheDocument()
      expect(screen.queryByText('Phêrô Sub One')).not.toBeInTheDocument()
      // absent again: previous pick is gone
      setStatus('catechist-c1', absent)
      expect(
        screen.queryByRole('button', {
          name: 'attendance.createSession.substituteRemove',
        }),
      ).not.toBeInTheDocument()
    })
  })

  describe('submit', () => {
    test('omits catechistAttendance when nobody is assigned', async () => {
      setupQueries(mockClassDetails, mockSemesters)
      const mockCreate = vi.fn().mockResolvedValue('s')
      vi.mocked(useMutation).mockReturnValue(mockCreate as any)
      renderPage()
      fireEvent.click(submitBtn())
      await waitFor(() => expect(mockCreate).toHaveBeenCalled())
      expect(lastCall(mockCreate).catechistAttendance).toBeUndefined()
    })

    test('sends assigned catechists as present by default, sorted, inactive excluded', async () => {
      const mockCreate = vi.fn().mockResolvedValue('s')
      vi.mocked(useMutation).mockReturnValue(mockCreate as any)
      renderPage()
      fireEvent.click(submitBtn())
      await waitFor(() => expect(mockCreate).toHaveBeenCalled())
      expect(lastCall(mockCreate).catechistAttendance).toEqual([
        { catechistId: 'c2', status: 'present', notes: undefined },
        { catechistId: 'c1', status: 'present', notes: undefined },
      ])
    })

    test('sends changed statuses and substitutes as present/substitute', async () => {
      const mockCreate = vi.fn().mockResolvedValue('s')
      vi.mocked(useMutation).mockReturnValue(mockCreate as any)
      renderPage()
      setStatus('catechist-c1', 'attendance.status.excused_absence.short')
      setStatus('catechist-c2', absent)
      pickSub('Phêrô Sub One')
      pickSub('Anna Sub Two')
      fireEvent.click(submitBtn())
      await waitFor(() => expect(mockCreate).toHaveBeenCalled())
      expect(lastCall(mockCreate).catechistAttendance).toEqual([
        { catechistId: 'c2', status: 'unexcused_absence', notes: undefined },
        { catechistId: 'c1', status: 'excused_absence', notes: undefined },
        { catechistId: 's1', status: 'present', roleAtSession: 'substitute' },
        { catechistId: 's2', status: 'present', roleAtSession: 'substitute' },
      ])
    })

    test('ignores substitutes once not all assigned are absent', async () => {
      const mockCreate = vi.fn().mockResolvedValue('s')
      vi.mocked(useMutation).mockReturnValue(mockCreate as any)
      renderPage()
      allAbsent()
      pickSub('Phêrô Sub One')
      setStatus('catechist-c2', 'attendance.status.late.short')
      fireEvent.click(submitBtn())
      await waitFor(() => expect(mockCreate).toHaveBeenCalled())
      const sent = lastCall(mockCreate).catechistAttendance
      expect(sent).toHaveLength(2)
      expect(sent.some((r: any) => r.roleAtSession === 'substitute')).toBe(
        false,
      )
    })

    test('shows an error toast and stays on the page when the mutation fails', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockCreate = vi.fn().mockRejectedValue(new Error('boom'))
      vi.mocked(useMutation).mockReturnValue(mockCreate as any)
      renderPage()
      fireEvent.click(submitBtn())
      await waitFor(() => expect(toast.error).toHaveBeenCalled())
      expect(toast.success).not.toHaveBeenCalled()
      expect(navigateMock).not.toHaveBeenCalled()
      errSpy.mockRestore()
    })
  })

  describe('leave confirmation', () => {
    const cancel = () =>
      fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))

    test('untouched form leaves without confirmation', () => {
      renderPage()
      cancel()
      expect(navigateMock).toHaveBeenCalledWith({ to: '/classes/class123' })
    })

    test('a catechist status change makes the form dirty', () => {
      renderPage()
      setStatus('catechist-c1', 'attendance.status.late.short')
      cancel()
      expect(
        screen.getByText('attendance.createSession.confirmLeaveTitle'),
      ).toBeInTheDocument()
      expect(navigateMock).not.toHaveBeenCalled()
    })

    test('picking a substitute is dirty; reverting everything is clean again', () => {
      renderPage()
      allAbsent()
      pickSub('Phêrô Sub One')
      setStatus('catechist-c1', 'attendance.status.present.short')
      setStatus('catechist-c2', 'attendance.status.present.short')
      cancel()
      expect(navigateMock).toHaveBeenCalledWith({ to: '/classes/class123' })
    })
  })
})

describe('Mark all as...', () => {
  const defaultT = () =>
    ({
      t: (key: string) => key,
      i18n: { language: 'en', changeLanguage: vi.fn() },
    }) as any

  beforeEach(() => {
    navigateMock.mockClear()
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
  })

  const renderPage = () => {
    const Component = (Route as any).options.component
    return render(<Component />)
  }
  const openMenu = () =>
    fireEvent.click(
      screen.getByRole('button', {
        name: /attendance\.createSession\.markAll/,
      }),
    )
  const chooseOption = async (status: string) => {
    openMenu()
    fireEvent.click(
      await screen.findByRole('menuitem', {
        name: `attendance.createSession.markAll.${status}`,
      }),
    )
  }
  const summaryHas = (...parts: Array<string>) =>
    screen.getByText(
      (c) =>
        c.startsWith('attendance.createSession.summary|') &&
        parts.every((p) => c.includes(p)),
    )

  test('menu shows the four status options', async () => {
    renderPage()
    openMenu()
    for (const status of [
      'present',
      'unexcused_absence',
      'excused_absence',
      'late',
    ]) {
      expect(
        await screen.findByRole('menuitem', {
          name: `attendance.createSession.markAll.${status}`,
        }),
      ).toBeInTheDocument()
    }
    expect(screen.getAllByRole('menuitem')).toHaveLength(4)
  })

  test('selecting an option opens the confirmation dialog', async () => {
    renderPage()
    await chooseOption('late')
    const dialog = await screen.findByRole('alertdialog')
    expect(
      within(dialog).getByText('attendance.createSession.markAllConfirmTitle'),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        (c) =>
          c.startsWith('attendance.createSession.markAllConfirmDesc|') &&
          c.includes('"count":2') &&
          c.includes('attendance.status.late'),
      ),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', {
        name: 'attendance.createSession.markAllConfirm',
      }),
    ).toBeInTheDocument()
  })

  test('cancel closes the dialog and leaves statuses unchanged', async () => {
    renderPage()
    summaryHas('"present":2', '"late":0')
    await chooseOption('late')
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'common.cancel' }),
    )
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    )
    expect(summaryHas('"present":2', '"late":0')).toBeInTheDocument()
  })

  test.each([
    ['present', '"present":2,"late":0,"absent":0,"excused":0'],
    ['unexcused_absence', '"present":0,"late":0,"absent":2,"excused":0'],
    ['excused_absence', '"present":0,"late":0,"absent":0,"excused":2'],
    ['late', '"present":0,"late":2,"absent":0,"excused":0'],
  ])('confirming %s applies it to every student', async (status, expected) => {
    renderPage()
    // Start from a mixed state so the overwrite is observable
    const row = document.getElementById('student-student1')!
    fireEvent.click(row.querySelector('button')!)
    fireEvent.click(
      screen.getByRole('button', { name: 'attendance.status.late.short' }),
    )
    await chooseOption(status)
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'attendance.createSession.markAllConfirm',
      }),
    )
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    )
    expect(summaryHas(expected)).toBeInTheDocument()
  })
})
