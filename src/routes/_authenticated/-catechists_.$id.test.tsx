import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { useParams } from '@tanstack/react-router'
import { Route } from './catechists_.$id'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    Link: ({ children, ...props }: any) => <a href={props.to}>{children}</a>,
    useParams: vi.fn(),
    useNavigate: vi.fn(() => vi.fn()),
  }
})

vi.mock('~/lib/permissions', () => ({
  isAdmin: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(useQuery).mockClear()
  vi.mocked(useParams).mockReturnValue({ id: 'catechist123' })
})

const mockAssignments = [
  {
    _id: 'assign1',
    role: 'homeroom',
    classYearId: 'cy1',
    classId: 'class1',
    className: 'Lớp 1A',
    branchId: 'branch1',
    branchName: 'Ấu Nhi',
    academicYearId: 'year1',
    academicYearName: '2024-2025',
  },
  {
    _id: 'assign2',
    role: 'co_teacher',
    classYearId: 'cy2',
    classId: 'class2',
    className: 'Lớp 2B',
    branchId: 'branch1',
    branchName: 'Ấu Nhi',
    academicYearId: 'year2',
    academicYearName: '2023-2024',
  },
]

const mockCatechist = {
  _id: 'catechist123',
  memberId: 'GLV0001',
  fullName: 'Nguyễn Văn A',
  saintName: 'Giuse',
  role: 'user',
  isActive: true,
  dateOfBirth: '1990-01-01',
  gender: 'male',
  joinedDate: '2020-01-01',
  notes: 'Test note',
  address: {
    addressLine1: '123 Main St',
    city: 'Hồ Chí Minh',
  },
  contacts: [
    {
      _id: 'contact1',
      contactType: 'phone',
      value: '+84912345678',
      isPrimary: true,
    },
  ],
}

describe('CatechistDetailPage', () => {
  test('route has breadcrumbs defined in staticData', () => {
    expect((Route as any).options.staticData?.crumbs).toBeDefined()
    expect((Route as any).options.staticData?.crumbs.length).toBeGreaterThan(0)
  })

  test('renders skeleton while loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.mocked(useQuery).mockReturnValue(undefined)

    const DetailPage = (Route as any).options.component
    const { container } = render(<DetailPage />)

    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('renders not-found when data is null', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123' },
    } as any)
    vi.mocked(useQuery).mockReturnValue(null)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('catechists.notFound')).toBeInTheDocument()
  })

  test('renders catechist fields correctly', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(false)
    vi.mocked(useQuery)
      .mockReturnValueOnce(mockCatechist as any)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce([])

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(
      screen.getAllByRole('heading', { name: /Giuse Nguyễn Văn A/ })[0],
    ).toBeInTheDocument()
    expect(screen.getByText('1990-01-01')).toBeInTheDocument()
    expect(screen.getByText('123 Main St')).toBeInTheDocument()
    expect(screen.getByText('+84912345678')).toBeInTheDocument()
  })

  test('edit button visible to admin, hidden to user', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'user123', role: 'user' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(false)
    vi.mocked(useQuery)
      .mockReturnValueOnce(mockCatechist as any)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce([])

    const DetailPage = (Route as any).options.component
    const { rerender } = render(<DetailPage />)

    expect(screen.queryByText('common.edit')).not.toBeInTheDocument()

    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.mocked(useQuery)
      .mockReturnValueOnce(mockCatechist as any)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce([])

    rerender(<DetailPage />)
    expect(screen.getByText('common.edit')).toBeInTheDocument()
  })

  test('renders teaching assignments section with class names and role badges', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(false)
    vi.mocked(useQuery)
      .mockReturnValueOnce(mockCatechist as any)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(mockAssignments as any)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(
      screen.getByText('catechists.detail.classes.title'),
    ).toBeInTheDocument()
    expect(screen.getByText('2024-2025')).toBeInTheDocument()
    expect(screen.getByText('2023-2024')).toBeInTheDocument()
    expect(screen.getByText('Lớp 1A')).toBeInTheDocument()
    expect(screen.getByText('Lớp 2B')).toBeInTheDocument()
    expect(
      screen.getByText('catechists.detail.classes.role.homeroom'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('catechists.detail.classes.role.co_teacher'),
    ).toBeInTheDocument()
  })

  test('renders empty state when no teaching assignments', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(false)
    vi.mocked(useQuery)
      .mockReturnValueOnce(mockCatechist as any)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce([])

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(
      screen.getByText('catechists.detail.classes.empty'),
    ).toBeInTheDocument()
  })

  test('renders skeletons for assignments while loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(false)
    vi.mocked(useQuery)
      .mockReturnValueOnce(mockCatechist as any)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(undefined)

    const DetailPage = (Route as any).options.component
    const { container } = render(<DetailPage />)

    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})
