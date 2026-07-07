import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { Route } from './academic-years_.setup'
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
    Navigate: ({ to }: any) => (
      <div data-testid="navigate-redirect" data-to={to} />
    ),
  }
})

beforeEach(() => {
  mockNavigate.mockClear()
})

const mockAdminUser = {
  _id: 'user123',
  userDocId: 'catechist123',
  memberId: 'GLV0001',
  fullName: 'Nguyễn Văn Admin',
  role: 'admin',
  accountType: 'catechist',
} as any

const mockRegularUser = {
  ...mockAdminUser,
  role: 'user',
}

const sampleYear = {
  _id: 'year123',
  name: '2024-2025',
  startDate: '2024-09-01',
  endDate: '2025-05-31',
  timezone: 'Asia/Ho_Chi_Minh',
  isActive: true,
  isDeleted: false,
}

const inactiveYear = {
  ...sampleYear,
  _id: 'year456',
  name: '2025-2026',
  isActive: false,
  startDate: '2025-09-01',
  endDate: '2026-05-31',
}

function setupQueries({
  academicYears = undefined,
  activeYear = undefined,
  orgStats = undefined,
}: any = {}) {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'academicYears:list') return academicYears
    if (path === 'academicYears:getActive') return activeYear
    if (path === 'orgStats:getOrgStats') return orgStats
    return undefined
  })
}

const SetupPageComponent = (Route as any).options.component

describe('AcademicYearSetupPage component', () => {
  test('redirects non-admin users to dashboard', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockRegularUser,
    })
    setupQueries()

    render(<SetupPageComponent />)

    expect(screen.getByTestId('navigate-redirect')).toHaveAttribute(
      'data-to',
      '/dashboard',
    )
  })

  test('renders loading skeleton when queries are loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries({
      academicYears: undefined,
      activeYear: undefined,
      orgStats: undefined,
    })

    render(<SetupPageComponent />)

    // The page displays loading pulse blocks when isLoading is true
    expect(
      screen.queryByText('academicYears.setup.progress'),
    ).not.toBeInTheDocument()
  })

  test('renders page successfully for admin when queries are loaded', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries({
      academicYears: [sampleYear],
      activeYear: sampleYear,
      orgStats: { totalClasses: 0, totalStudents: 0, totalCatechists: 0 },
    })

    render(<SetupPageComponent />)

    expect(screen.getByText('academicYears.setup.title')).toBeInTheDocument()
    expect(
      screen.getAllByText('academicYears.setup.progress')[0],
    ).toBeInTheDocument()
    // Renders the 5 steps
    expect(
      screen.getByText('academicYears.setup.step1.title'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('academicYears.setup.step2.title'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('academicYears.setup.step3.title'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('academicYears.setup.step4.title'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('academicYears.setup.step5.title'),
    ).toBeInTheDocument()
  })

  test('computes step status correctly - Case 1: No years created', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries({
      academicYears: [],
      activeYear: null,
      orgStats: undefined,
    })

    render(<SetupPageComponent />)

    // 0 out of 5 steps done
    expect(screen.getByText('0 / 5')).toBeInTheDocument()
  })

  test('computes step status correctly - Case 2: One year exists but inactive', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries({
      academicYears: [inactiveYear],
      activeYear: null,
      orgStats: undefined,
    })

    render(<SetupPageComponent />)

    // Only step 1 completed (1 / 5)
    expect(screen.getByText('1 / 5')).toBeInTheDocument()
  })

  test('computes step status correctly - Case 3: Latest year is active but no classes', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    // latest year is active
    setupQueries({
      academicYears: [sampleYear],
      activeYear: sampleYear,
      orgStats: { totalClasses: 0, totalStudents: 0, totalCatechists: 0 },
    })

    render(<SetupPageComponent />)

    // Step 1 & 2 completed (2 / 5)
    expect(screen.getByText('2 / 5')).toBeInTheDocument()
  })

  test('computes step status correctly - Case 4: Classes created but no students', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries({
      academicYears: [sampleYear],
      activeYear: sampleYear,
      orgStats: { totalClasses: 5, totalStudents: 0, totalCatechists: 0 },
    })

    render(<SetupPageComponent />)

    // Step 1, 2 & 3 completed (3 / 5)
    expect(screen.getByText('3 / 5')).toBeInTheDocument()
  })

  test('computes step status correctly - Case 5: All steps completed', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries({
      academicYears: [sampleYear],
      activeYear: sampleYear,
      orgStats: { totalClasses: 5, totalStudents: 45, totalCatechists: 8 },
    })

    render(<SetupPageComponent />)

    // All steps completed (5 / 5)
    expect(screen.getByText('5 / 5')).toBeInTheDocument()
  })

  test('navigates to create year page when click create button', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries({
      academicYears: [],
      activeYear: null,
      orgStats: undefined,
    })

    render(<SetupPageComponent />)

    const createButton = screen.getByRole('button', {
      name: /academicYears\.setup\.step1\.action/i,
    })
    fireEvent.click(createButton)

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/academic-years/create' })
  })

  test('navigates to academic years list when click step 2 button', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries({
      academicYears: [sampleYear],
      activeYear: null,
      orgStats: undefined,
    })

    render(<SetupPageComponent />)

    const activateButton = screen.getByRole('button', {
      name: /academicYears\.setup\.step2\.action/i,
    })
    fireEvent.click(activateButton)

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/academic-years' })
  })

  test('covers sorting academic years to find latest in memo', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries({
      academicYears: [sampleYear, inactiveYear], // has two years to sort
      activeYear: sampleYear,
      orgStats: { totalClasses: 0, totalStudents: 0, totalCatechists: 0 },
    })

    render(<SetupPageComponent />)

    // The latest year name should be sorted and displayed
    expect(screen.getByText('2025-2026')).toBeInTheDocument()
  })

  test('navigates to bulk create classes when click step 3 button', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries({
      academicYears: [sampleYear],
      activeYear: sampleYear,
      orgStats: { totalClasses: 0, totalStudents: 0, totalCatechists: 0 },
    })

    render(<SetupPageComponent />)

    const btn = screen.getByRole('button', {
      name: /academicYears\.setup\.step3\.action/i,
    })
    fireEvent.click(btn)

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/classes/bulk-create' })
  })

  test('navigates to student promotion when click step 4 button', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries({
      academicYears: [sampleYear],
      activeYear: sampleYear,
      orgStats: { totalClasses: 5, totalStudents: 0, totalCatechists: 0 },
    })

    render(<SetupPageComponent />)

    const btn = screen.getByRole('button', {
      name: /academicYears\.setup\.step4\.action/i,
    })
    fireEvent.click(btn)

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/students/promote' })
  })

  test('navigates to assign catechists when click step 5 button', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries({
      academicYears: [sampleYear],
      activeYear: sampleYear,
      orgStats: { totalClasses: 5, totalStudents: 10, totalCatechists: 0 },
    })

    render(<SetupPageComponent />)

    const btn = screen.getByRole('button', {
      name: /academicYears\.setup\.step5\.action/i,
    })
    fireEvent.click(btn)

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/assignments/edit' })
  })

  test('navigates to import page when click import tip button', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })
    setupQueries({
      academicYears: [sampleYear],
      activeYear: sampleYear,
      orgStats: { totalClasses: 5, totalStudents: 10, totalCatechists: 0 },
    })

    render(<SetupPageComponent />)

    const btn = screen.getByRole('button', {
      name: /academicYears\.setup\.importTip\.action/i,
    })
    fireEvent.click(btn)

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/import' })
  })
})
