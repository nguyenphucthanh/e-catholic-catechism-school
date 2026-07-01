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

    // Skeleton should be rendered in the body (usually 5 + 2 + 1 skeleton elements based on my UI)
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
    vi.mocked(useQuery).mockReturnValue(mockCatechist)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(
      screen.getByRole('heading', { name: /Nguyễn Văn A/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('Giuse')).toBeInTheDocument()
    expect(screen.getByText('1990-01-01')).toBeInTheDocument()
    expect(screen.getByText('123 Main St')).toBeInTheDocument()
    expect(screen.getByText('+84912345678')).toBeInTheDocument()
  })

  test('edit button visible to admin, hidden to user', () => {
    // Hidden to user
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'user123', role: 'user' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(false)
    vi.mocked(useQuery).mockReturnValue(mockCatechist)

    const DetailPage = (Route as any).options.component
    const { rerender } = render(<DetailPage />)

    expect(screen.queryByText('common.edit')).not.toBeInTheDocument()

    // Visible to admin
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.mocked(useQuery).mockReturnValue(mockCatechist)

    rerender(<DetailPage />)
    expect(screen.getByText('common.edit')).toBeInTheDocument()
  })
})
