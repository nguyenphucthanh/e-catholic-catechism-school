import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { useParams } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Route } from './extracurricular-programs_.$id'
import { useAuth } from '~/lib/auth'
import { useManagementPermission } from '~/hooks/use-management-permission'
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
    Link: ({ children, to, params, className }: any) => (
      <a href={to} data-params={JSON.stringify(params)} className={className}>
        {children}
      </a>
    ),
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string, opts?: any) => {
      if (key === 'extracurricular.enrollmentCount') {
        return `Enrolled: ${opts?.count ?? 0}`
      }
      return key
    },
  })),
}))

vi.mock('~/lib/auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('~/hooks/use-management-permission', () => ({
  useManagementPermission: vi.fn(),
}))

vi.mock('~/components/custom/richtext-editor', () => ({
  RichTextEditor: ({ value }: any) => <div>{value}</div>,
}))

vi.mocked(useParams).mockReturnValue({ id: 'program1' })

const mockAdminUser = {
  userDocId: 'catechist1',
  fullName: 'Admin Catechist',
  role: 'admin',
} as any

const sampleProgram = {
  _id: 'program1',
  title: 'Youth Retreat 2026',
  details: 'Retreat details',
  target: 'all',
  dateStart: '2026-08-01',
  dateEnd: '2026-08-05',
  enrollmentExpireDate: '2026-07-30',
  feeRequired: false,
  feeAmount: undefined,
  maxCapacity: 50,
  enrollmentCount: 2,
  userEnrolled: false,
  branches: [],
  academicYearId: 'year1',
  isDeleted: false,
}

const sampleEnrollments = [
  {
    _id: 'enrollment1',
    userType: 'catechist',
    createdAt: 1700000000000,
    tokenIdentifier: 'tok1',
    userInfo: {
      saintName: 'Joseph',
      fullName: 'Catechist One',
      code: 'CAT-001',
      className: undefined,
    },
  },
  {
    _id: 'enrollment2',
    userType: 'student',
    createdAt: 1700000050000,
    tokenIdentifier: 'tok2',
    userInfo: {
      saintName: 'Maria',
      fullName: 'Student One',
      code: 'STD-001',
      className: 'Ấu Nhi 1',
    },
  },
]

function setupQueries(
  program: any = sampleProgram,
  enrollments: any = sampleEnrollments,
) {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const name = queryRef?.[Symbol.for('functionName')]
    if (name === 'extracurricularPrograms:getProgramDetail') return program
    if (name === 'extracurricularPrograms:getEnrollments') return enrollments
    return undefined
  })
}

const DetailPageComponent = (Route as any).options.component

describe('ExtracurricularProgramDetailPage component', () => {
  const mockMutation = vi.fn()

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    vi.mocked(useManagementPermission).mockReturnValue({
      canManage: true,
      isLoading: false,
      permissions: {
        isAdmin: true,
        isBoardMember: true,
        branchHeadOf: [],
        classCatechistOf: [],
      },
    })
    vi.mocked(useMutation).mockReturnValue(mockMutation as any)
    mockMutation.mockReset()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    vi.clearAllMocks()
  })

  test('renders program detail and enrollments list with filter and export options', () => {
    setupQueries()
    render(<DetailPageComponent />)

    expect(screen.getByText('Youth Retreat 2026')).toBeDefined()
    expect(screen.getByText('extracurricular.enrollments')).toBeDefined()
    expect(screen.getByText('Joseph Catechist One')).toBeDefined()
    expect(screen.getByText('Maria Student One')).toBeDefined()
    expect(screen.getByText('extracurricular.export.title')).toBeDefined()
  })

  test('filters enrollments by role/userType when selected', async () => {
    setupQueries()
    render(<DetailPageComponent />)

    expect(screen.getByText('Joseph Catechist One')).toBeDefined()
    expect(screen.getByText('Maria Student One')).toBeDefined()

    // Trigger select filter dropdown (first combobox in table filter toolbar)
    const selectTrigger = screen.getAllByRole('combobox')[0]
    fireEvent.click(selectTrigger)

    // Select Catechists filter
    const catechistOption = await screen.findByRole('option', {
      name: 'extracurricular.target.catechist',
    })
    fireEvent.pointerDown(catechistOption)
    fireEvent.click(catechistOption)

    expect(screen.getByText('Joseph Catechist One')).toBeDefined()
    expect(screen.queryByText('Maria Student One')).toBeNull()
  })

  test('triggers export CSV and PDF actions', () => {
    setupQueries()
    render(<DetailPageComponent />)

    const exportBtn = screen.getByText('extracurricular.export.title')
    fireEvent.click(exportBtn)

    const exportPdfItem = screen.getByText('extracurricular.export.pdf')
    fireEvent.click(exportPdfItem)
    expect(exportPdf).toHaveBeenCalledTimes(1)

    fireEvent.click(exportBtn)
    const exportCsvItem = screen.getByText('extracurricular.export.csv')
    fireEvent.click(exportCsvItem)
    expect(exportCsv).toHaveBeenCalledTimes(1)
  })

  test('shows links visible to everyone, hides enrolled-only links when not enrolled', () => {
    setupQueries({
      ...sampleProgram,
      userEnrolled: false,
      links: [
        {
          type: 'social',
          label: 'Public Page',
          url: 'https://facebook.com/pub',
          forEnrolledOnly: false,
        },
        {
          type: 'im',
          label: 'Members Zalo',
          url: 'https://zalo.me/g/members',
          forEnrolledOnly: true,
        },
      ],
    })
    render(<DetailPageComponent />)

    expect(screen.getByText('Public Page')).toBeInTheDocument()
    expect(screen.queryByText('Members Zalo')).not.toBeInTheDocument()
  })

  test('shows enrolled-only links when the viewer is enrolled', () => {
    setupQueries({
      ...sampleProgram,
      userEnrolled: true,
      links: [
        {
          type: 'im',
          label: 'Members Zalo',
          url: 'https://zalo.me/g/members',
          forEnrolledOnly: true,
        },
      ],
    })
    render(<DetailPageComponent />)

    expect(screen.getByText('Members Zalo')).toBeInTheDocument()
  })

  test('renders loading state when program is undefined', () => {
    setupQueries(null, [])
    render(<DetailPageComponent />)
    expect(screen.getByText('common.loading')).toBeInTheDocument()
  })

  test('triggers enroll flow when enroll button is clicked', async () => {
    mockMutation.mockResolvedValue(undefined)
    setupQueries(
      {
        ...sampleProgram,
        userEnrolled: false,
      },
      [],
    )
    render(<DetailPageComponent />)

    const enrollBtn = screen.getByRole('button', {
      name: 'extracurricular.enroll',
    })
    fireEvent.click(enrollBtn)

    await waitFor(() => {
      expect(mockMutation).toHaveBeenCalledWith({
        programId: 'program1',
        requesterId: 'catechist1',
      })
    })
  })

  test('triggers unenroll flow when unenroll button is clicked', async () => {
    mockMutation.mockResolvedValue(undefined)
    setupQueries(
      {
        ...sampleProgram,
        userEnrolled: true,
      },
      [],
    )
    render(<DetailPageComponent />)

    const unenrollBtn = screen.getByRole('button', {
      name: 'extracurricular.unenroll',
    })
    fireEvent.click(unenrollBtn)

    await waitFor(() => {
      expect(mockMutation).toHaveBeenCalledWith({
        programId: 'program1',
        requesterId: 'catechist1',
      })
    })
  })

  test('triggers delete flow when delete button is clicked and confirmed', async () => {
    mockMutation.mockResolvedValue(undefined)
    setupQueries()

    const originalLocation = window.location
    // @ts-ignore - Mocking read-only window.location
    delete window.location
    window.location = { ...originalLocation, href: '' } as any

    render(<DetailPageComponent />)

    const deleteBtn = screen.getByRole('button', { name: 'common.delete' })
    fireEvent.click(deleteBtn)

    expect(screen.getByText('common.confirmDelete')).toBeInTheDocument()

    const deleteBtns = screen.getAllByText('common.delete')
    expect(deleteBtns).toHaveLength(2)
    fireEvent.click(deleteBtns[1])

    await waitFor(() => {
      expect(mockMutation).toHaveBeenCalledWith({
        programId: 'program1',
        requesterId: 'catechist1',
      })
    })

    // @ts-ignore - Restoring original window.location
    window.location = originalLocation
  })

  test('handles enroll failure', async () => {
    mockMutation.mockRejectedValue(new Error('Enroll failed'))
    setupQueries(
      {
        ...sampleProgram,
        userEnrolled: false,
      },
      [],
    )
    render(<DetailPageComponent />)

    const enrollBtn = screen.getByRole('button', {
      name: 'extracurricular.enroll',
    })
    fireEvent.click(enrollBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
  })

  test('handles unenroll failure', async () => {
    mockMutation.mockRejectedValue(new Error('Unenroll failed'))
    setupQueries(
      {
        ...sampleProgram,
        userEnrolled: true,
      },
      [],
    )
    render(<DetailPageComponent />)

    const unenrollBtn = screen.getByRole('button', {
      name: 'extracurricular.unenroll',
    })
    fireEvent.click(unenrollBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
  })

  test('handles delete failure', async () => {
    mockMutation.mockRejectedValue(new Error('Delete failed'))
    setupQueries()

    render(<DetailPageComponent />)

    const deleteBtn = screen.getByRole('button', { name: 'common.delete' })
    fireEvent.click(deleteBtn)

    const deleteBtns = screen.getAllByText('common.delete')
    fireEvent.click(deleteBtns[1])

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
  })

  test('renders student target program alert', () => {
    setupQueries(
      {
        ...sampleProgram,
        target: 'student',
        userEnrolled: false,
      },
      [],
    )
    render(<DetailPageComponent />)
    expect(
      screen.getByText('extracurricular.studentOnlyTarget'),
    ).toBeInTheDocument()
  })

  test('renders closed enrollment state', () => {
    setupQueries(
      {
        ...sampleProgram,
        enrollmentExpireDate: '2020-01-01',
        userEnrolled: false,
      },
      [],
    )
    render(<DetailPageComponent />)
    expect(
      screen.getByRole('button', { name: 'extracurricular.enrollmentClosed' }),
    ).toBeDisabled()
  })

  test('renders capacity reached state', () => {
    setupQueries(
      {
        ...sampleProgram,
        maxCapacity: 10,
        enrollmentCount: 10,
        userEnrolled: false,
      },
      [],
    )
    render(<DetailPageComponent />)
    expect(
      screen.getByRole('button', { name: 'extracurricular.capacityReached' }),
    ).toBeDisabled()
  })

  test('renders fee amount and no capacity limit', () => {
    setupQueries(
      {
        ...sampleProgram,
        feeRequired: true,
        feeAmount: 200000,
        maxCapacity: undefined,
      },
      [],
    )
    render(<DetailPageComponent />)
    expect(screen.getByText('extracurricular.fee')).toBeInTheDocument()
  })

  test('renders active program status', () => {
    setupQueries(
      {
        ...sampleProgram,
        dateStart: '2026-07-01',
        dateEnd: '2026-08-05',
      },
      [],
    )
    render(<DetailPageComponent />)
    expect(
      screen.getByText('extracurricular.status.active'),
    ).toBeInTheDocument()
  })

  test('renders past program status', () => {
    setupQueries(
      {
        ...sampleProgram,
        dateStart: '2026-07-01',
        dateEnd: '2026-07-20',
      },
      [],
    )
    render(<DetailPageComponent />)
    expect(screen.getByText('extracurricular.status.past')).toBeInTheDocument()
  })
})
