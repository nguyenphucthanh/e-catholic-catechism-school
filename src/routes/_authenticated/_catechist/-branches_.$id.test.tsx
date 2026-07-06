import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { useParams } from '@tanstack/react-router'
import { Route } from './branches_.$id'
import { useAuth } from '~/lib/auth'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    useParams: vi.fn(),
    useNavigate: vi.fn(() => vi.fn()),
    Link: ({ children, to, params, className }: any) => (
      <a href={to} data-params={JSON.stringify(params)} className={className}>
        {children}
      </a>
    ),
  }
})

vi.mocked(useParams).mockReturnValue({ id: 'branch123' })
vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: vi.fn(() => ({
    selectedYearId: 'year2024',
    setSelectedYearId: vi.fn(),
  })),
}))

const sampleBranchDetail = {
  branch: { _id: 'branch123', name: 'Ấu Nhi', description: 'Mô tả ấu nhi' },
  stats: { totalStudents: 15, totalCatechists: 4, totalClasses: 3 },
  classes: [
    {
      classId: 'class1',
      className: 'Lớp 1A',
      assignedCatechists: [
        {
          catechistId: 'cat1',
          fullName: 'Nguyễn Văn A',
          saintName: 'Phêrô',
          role: 'homeroom' as const,
        },
      ],
      studentCount: 8,
    },
    {
      classId: 'class2',
      className: 'Lớp 1B',
      assignedCatechists: [],
      studentCount: 7,
    },
  ],
}

describe('BranchDetailPage', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
  })

  test('renders skeleton while loading', () => {
    vi.mocked(useQuery).mockReturnValue(undefined)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('branches.detail.title')).toBeInTheDocument()
  })

  test('renders stats cards and class table when data is available', () => {
    vi.mocked(useQuery).mockReturnValue(sampleBranchDetail)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('Ấu Nhi')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Lớp 1A')).toBeInTheDocument()
    expect(screen.getByText('Lớp 1B')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('Phêrô Nguyễn Văn A')).toBeInTheDocument()
  })

  test('renders not found message when branch is null', () => {
    vi.mocked(useQuery).mockReturnValue(null)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('branches.detail.notFound')).toBeInTheDocument()
  })

  test('renders fallback title when branch name unavailable', () => {
    vi.mocked(useQuery).mockReturnValue(undefined)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('branches.detail.title')).toBeInTheDocument()
  })
})
