import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Route } from './academic-years'
import { useAuth } from '~/lib/auth'

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    useNavigate: () => mockNavigate,
    Link: ({ children, to, params, className }: any) => (
      <a href={to} data-params={JSON.stringify(params)} className={className}>
        {children}
      </a>
    ),
  }
})

beforeEach(() => {
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
  mockNavigate.mockClear()
})

const mockBoardUser = {
  _id: 'user123',
  userDocId: 'catechist123',
  memberId: 'GLV0001',
  fullName: 'Nguyễn Văn A',
  role: 'board',
} as any

const sampleYear = {
  _id: 'year123',
  name: '2024-2025',
  startDate: '2024-09-01',
  endDate: '2025-05-31',
  timezone: 'Asia/Ho_Chi_Minh',
  isActive: true,
  isDeleted: false,
}

function setupYearsQuery(years = [sampleYear]) {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'academicYears:list') return years
    return undefined
  })
}

describe('AcademicYearsPage component', () => {
  test('renders years table and board-only create button for board member', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery()

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    expect(screen.getByText('academicYears.title')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /academicYears\.actions\.create/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('2024-2025')).toBeInTheDocument()
  })

  test('navigates to create page when create button is clicked', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery()

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: /academicYears\.actions\.create/i }),
    )

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/academic-years/create' })
  })

  async function openRowAction(actionText: string) {
    const moreActionsBtns = screen.getAllByRole('button', {
      name: 'common.moreActions',
    })
    fireEvent.click(moreActionsBtns[0])
    const item = await screen.findByText(actionText)
    fireEvent.click(item)
  }

  test('navigates to edit page when edit action is clicked', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([sampleYear])

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    await openRowAction('common.edit')

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/academic-years/$id/edit',
      params: { id: sampleYear._id },
    })
  })

  test('calls deleteMutation and shows success toast when delete is confirmed', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([sampleYear])

    const mockDelete = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockDelete as any)

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('academicYears.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'academicYears.delete.confirm' }),
    )

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith({
        requesterId: 'catechist123',
        academicYearId: 'year123',
      })
    })
    expect(toast.success).toHaveBeenCalledWith('academicYears.deleted')
  })
})
