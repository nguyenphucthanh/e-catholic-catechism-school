import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Route } from './my-extracurricular-programs_.$id'
import { useAuth } from '~/lib/auth'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    useParams: () => ({ id: 'program1' }),
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => key,
  })),
}))

vi.mock('~/lib/auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('~/components/custom/richtext-editor', () => ({
  RichTextEditor: ({ value }: any) => <div>{value}</div>,
}))

const mockStudentUser = {
  userDocId: 'student123',
  fullName: 'Student User',
  role: 'user',
  accountType: 'student',
} as any

function baseProgram(overrides: Partial<any> = {}) {
  return {
    _id: 'program1',
    title: 'Summer Camp',
    details: 'Program details',
    dateStart: '2020-01-01',
    dateEnd: '2020-01-10',
    enrollmentExpireDate: '2020-01-05',
    feeRequired: false,
    feeAmount: undefined,
    maxCapacity: undefined,
    enrollmentCount: 0,
    userEnrolled: false,
    ...overrides,
  }
}

function setupQuery(program: any) {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'extracurricularPrograms:getProgramDetail') return program
    return undefined
  })
}

const DetailPageComponent = (Route as any).options.component

describe('MyExtracurricularProgramDetailPage component', () => {
  const mockEnroll = vi.fn()

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockStudentUser,
    })
    vi.mocked(useMutation).mockReturnValue(mockEnroll as any)
    mockEnroll.mockReset()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  test('renders loading state while program is undefined', () => {
    setupQuery(undefined)
    render(<DetailPageComponent />)
    expect(screen.getByText('common.loading')).toBeInTheDocument()
  })

  test('renders program details and enroll button when eligible', () => {
    setupQuery(
      baseProgram({
        dateStart: '2099-01-01',
        dateEnd: '2099-01-10',
        enrollmentExpireDate: '2099-01-05',
      }),
    )
    render(<DetailPageComponent />)

    expect(screen.getByText('Summer Camp')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'extracurricular.enroll' }),
    ).toBeInTheDocument()
  })

  test('shows fee dialog after enrolling in a fee-required program', async () => {
    mockEnroll.mockResolvedValue(undefined)
    setupQuery(
      baseProgram({
        feeRequired: true,
        feeAmount: 500000,
        dateStart: '2099-01-01',
        dateEnd: '2099-01-10',
        enrollmentExpireDate: '2099-01-05',
      }),
    )
    render(<DetailPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: 'extracurricular.enroll' }),
    )

    await waitFor(() => {
      expect(mockEnroll).toHaveBeenCalledWith({
        programId: 'program1',
        studentRequesterId: 'student123',
      })
    })

    expect(
      await screen.findByText('extracurricular.feeDialogTitle'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('extracurricular.feeDialogDescription'),
    ).toBeInTheDocument()
  })

  test('does not show fee dialog when program has no fee', async () => {
    mockEnroll.mockResolvedValue(undefined)
    setupQuery(
      baseProgram({
        dateStart: '2099-01-01',
        dateEnd: '2099-01-10',
        enrollmentExpireDate: '2099-01-05',
      }),
    )
    render(<DetailPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: 'extracurricular.enroll' }),
    )

    await waitFor(() => {
      expect(mockEnroll).toHaveBeenCalled()
    })

    expect(
      screen.queryByText('extracurricular.feeDialogTitle'),
    ).not.toBeInTheDocument()
  })

  test('shows enrolled badge when already enrolled', () => {
    setupQuery(baseProgram({ userEnrolled: true }))
    render(<DetailPageComponent />)

    expect(screen.getByText('extracurricular.enrolled')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'extracurricular.enroll' }),
    ).not.toBeInTheDocument()
  })

  test('disables enroll and shows closed message past enrollment deadline', () => {
    setupQuery(
      baseProgram({
        dateStart: '2020-01-01',
        dateEnd: '2099-01-10',
        enrollmentExpireDate: '2020-01-05',
      }),
    )
    render(<DetailPageComponent />)

    expect(
      screen.getByRole('button', { name: 'extracurricular.enrollmentClosed' }),
    ).toBeDisabled()
  })

  test('shows public links on the enrollment card, hides enrolled-only links when not enrolled', () => {
    setupQuery(
      baseProgram({
        dateStart: '2099-01-01',
        dateEnd: '2099-01-10',
        enrollmentExpireDate: '2099-01-05',
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
      }),
    )
    render(<DetailPageComponent />)

    expect(screen.getByText('Public Page')).toBeInTheDocument()
    expect(screen.queryByText('Members Zalo')).not.toBeInTheDocument()
  })

  test('shows join links in the fee dialog after enrolling in a fee-required program', async () => {
    mockEnroll.mockResolvedValue(undefined)
    setupQuery(
      baseProgram({
        feeRequired: true,
        feeAmount: 500000,
        dateStart: '2099-01-01',
        dateEnd: '2099-01-10',
        enrollmentExpireDate: '2099-01-05',
        links: [
          {
            type: 'im',
            label: 'Members Zalo',
            url: 'https://zalo.me/g/members',
            forEnrolledOnly: true,
          },
        ],
      }),
    )
    render(<DetailPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: 'extracurricular.enroll' }),
    )

    expect(
      await screen.findByText('extracurricular.feeDialogTitle'),
    ).toBeInTheDocument()
    const dialog = screen.getByRole('dialog')
    const link = within(dialog).getByRole('button', { name: /Members Zalo/ })
    expect(link).toHaveAttribute('href', 'https://zalo.me/g/members')
  })

  test('can close the fee dialog by clicking Got It', async () => {
    mockEnroll.mockResolvedValue(undefined)
    setupQuery(
      baseProgram({
        feeRequired: true,
        feeAmount: 500000,
        dateStart: '2099-01-01',
        dateEnd: '2099-01-10',
        enrollmentExpireDate: '2099-01-05',
      }),
    )
    render(<DetailPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: 'extracurricular.enroll' }),
    )

    expect(
      await screen.findByText('extracurricular.feeDialogTitle'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'common.gotIt' }))

    await waitFor(() => {
      expect(
        screen.queryByText('extracurricular.feeDialogTitle'),
      ).not.toBeInTheDocument()
    })
  })

  test('triggers unenroll flow when unenroll button is clicked', async () => {
    mockEnroll.mockResolvedValue(undefined)
    setupQuery(
      baseProgram({
        userEnrolled: true,
      }),
    )
    render(<DetailPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: 'extracurricular.unenroll' }),
    )

    await waitFor(() => {
      expect(mockEnroll).toHaveBeenCalledWith({
        programId: 'program1',
        studentRequesterId: 'student123',
      })
    })
  })
})
