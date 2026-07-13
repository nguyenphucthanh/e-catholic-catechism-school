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

function mockUseQuery(
  branchDetailData: unknown,
  calendarEventsData: unknown = [],
) {
  vi.mocked(useQuery).mockImplementation((query: any, ..._args: Array<any>) => {
    const name = query?.[Symbol.for('functionName')]
    if (name === 'calendarEvents:list') return calendarEventsData
    return branchDetailData
  })
}

const sampleEventsList = [
  {
    _id: 'event1',
    academicYearId: 'year2024',
    date: '2026-07-20',
    liturgicalDate: 'Chúa Nhật XVI TN',
    description: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Họp phụ huynh cuối năm' }],
        },
      ],
    }),
    severity: 'high' as const,
    scope: 'branch' as const,
    branchId: 'branch123',
    classYearId: undefined,
    createdBy: 'catechist123',
    createdAt: Date.now(),
    isDeleted: false,
    branchName: 'Ấu Nhi',
    className: null,
    createdByName: 'Nguyễn Văn A',
    updatedByName: null,
  },
  {
    _id: 'event2',
    academicYearId: 'year2024',
    date: '2026-08-01',
    liturgicalDate: undefined,
    description: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Kiểm tra cuối kỳ' }],
        },
      ],
    }),
    severity: 'medium' as const,
    scope: 'branch' as const,
    branchId: 'branch123',
    classYearId: undefined,
    createdBy: 'catechist123',
    createdAt: Date.now(),
    isDeleted: false,
    branchName: 'Ấu Nhi',
    className: null,
    createdByName: 'Nguyễn Văn A',
    updatedByName: null,
  },
]

describe('BranchDetailPage', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123' },
    } as any)
  })

  test('renders skeleton while loading', () => {
    mockUseQuery(undefined, undefined)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('branches.detail.title')).toBeInTheDocument()
  })

  test('renders stats cards and class table when data is available', () => {
    mockUseQuery(sampleBranchDetail, [])

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
    mockUseQuery(null, [])

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('branches.detail.notFound')).toBeInTheDocument()
  })

  test('renders fallback title when branch name unavailable', () => {
    mockUseQuery(undefined, undefined)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('branches.detail.title')).toBeInTheDocument()
  })

  test('renders upcoming events card with branch-scoped events', () => {
    mockUseQuery(sampleBranchDetail, sampleEventsList)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(
      screen.getByText('branches.detail.upcomingEvents.title'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('branches.detail.upcomingEvents.viewAll'),
    ).toBeInTheDocument()
    expect(screen.getByText('Họp phụ huynh cuối năm')).toBeInTheDocument()
    expect(screen.getByText('Kiểm tra cuối kỳ')).toBeInTheDocument()
  })

  test('renders empty state when no upcoming events', () => {
    mockUseQuery(sampleBranchDetail, [])

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(
      screen.getByText('branches.detail.upcomingEvents.empty'),
    ).toBeInTheDocument()
  })
})
