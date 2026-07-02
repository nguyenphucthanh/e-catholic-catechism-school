import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { useParams } from '@tanstack/react-router'
import { Route } from './students_.$id'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: () => mockNavigate,
  }
})

vi.mock('~/lib/permissions', () => ({
  isAdmin: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(useQuery).mockClear()
  vi.mocked(useParams).mockReturnValue({ id: 'student123' })
  mockNavigate.mockClear()
})

const mockStudentDetail = {
  _id: 'student123',
  studentCode: 'HS0001',
  fullName: 'John Doe',
  saintName: 'John',
  dateOfBirth: '2015-05-15',
  gender: 'male',
  isActive: true,
  isDeleted: false,
  previousParish: 'St. Mary Parish',
  previousDiocese: 'Diocese of HCMC',
  address: {
    addressLine1: '123 Main Street',
    addressLine2: 'Apt 4B',
    city: 'HCMC',
    stateProvince: 'HCMC',
    postalCode: '70000',
    hamlet: 'Thanh Loc',
    subHamlet: 'Hamlet 1',
    country: 'VN',
  },
  sacraments: [
    {
      _id: 'sacrament1',
      studentId: 'student123',
      sacramentType: 'baptism',
      receivedDate: '2015-06-01',
      receivedPlace: 'St. Peter Church',
      notes: 'Baptized by Fr. John',
      isDeleted: false,
    },
  ],
  enrollments: [
    {
      _id: 'enrollment1',
      studentId: 'student123',
      classYearId: 'classYear123',
      isPrimaryClass: true,
      enrolledDate: '2024-09-01',
      status: 'active',
      isDeleted: false,
      classYear: {
        _id: 'classYear123',
        classId: 'class123',
        academicYearId: 'ay123',
        isDeleted: false,
        className: 'Au Nhi 1',
        academicYearName: '2024-2025',
      },
    },
    {
      _id: 'enrollment2',
      studentId: 'student123',
      classYearId: 'classYear124',
      isPrimaryClass: false,
      enrolledDate: '2023-09-01',
      status: 'on_leave',
      isDeleted: false,
      classYear: {
        _id: 'classYear124',
        classId: 'class123',
        academicYearId: 'ay122',
        isDeleted: false,
        className: 'Au Nhi 1',
        academicYearName: '2023-2024',
      },
    },
    {
      _id: 'enrollment3',
      studentId: 'student123',
      classYearId: 'classYear125',
      isPrimaryClass: false,
      enrolledDate: '2022-09-01',
      status: 'withdrawn',
      leftDate: '2023-02-15',
      isDeleted: false,
      classYear: {
        _id: 'classYear125',
        classId: 'class123',
        academicYearId: 'ay121',
        isDeleted: false,
        className: 'Au Nhi 1',
        academicYearName: '2022-2023',
      },
    },
  ],
}

describe('StudentDetailPage', () => {
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

    expect(screen.getByText('students.notFound')).toBeInTheDocument()

    // Clicking back button should navigate back to students
    const backBtn = screen.getByRole('button', { name: 'common.back' })
    expect(backBtn).toBeInTheDocument()
    fireEvent.click(backBtn)
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/students' })
  })

  test('renders student fields and related data correctly', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(false)
    vi.mocked(useQuery).mockReturnValue(mockStudentDetail)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    // Heading should be student name
    expect(
      screen.getByRole('heading', { name: /John Doe/ }),
    ).toBeInTheDocument()

    // Personal fields
    expect(screen.getByText('HS0001')).toBeInTheDocument()
    expect(screen.getByText('John')).toBeInTheDocument()
    expect(screen.getByText('St. Mary Parish')).toBeInTheDocument()
    expect(screen.getByText('Diocese of HCMC')).toBeInTheDocument()
    expect(screen.getByText('students.gender.male')).toBeInTheDocument()
    expect(
      screen.getAllByText('students.status.active').length,
    ).toBeGreaterThanOrEqual(1)

    // Address
    expect(screen.getByText('123 Main Street')).toBeInTheDocument()
    expect(screen.getByText('Apt 4B')).toBeInTheDocument()
    expect(screen.getByText('Thanh Loc')).toBeInTheDocument()

    // Sacraments (rendered via table)
    expect(screen.getByText('students.sacraments.baptism')).toBeInTheDocument()
    expect(screen.getByText('St. Peter Church')).toBeInTheDocument()
    expect(screen.getByText('Baptized by Fr. John')).toBeInTheDocument()

    // Enrollments
    expect(screen.getAllByText('Au Nhi 1').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('classes.title: 2024-2025')).toBeInTheDocument()
    expect(screen.getByText('students.detail.isPrimary')).toBeInTheDocument()
    expect(screen.getByText('students.status.on_leave')).toBeInTheDocument()
    expect(screen.getByText('students.status.withdrawn')).toBeInTheDocument()
    expect(screen.getByText(/15\/2\/2023/)).toBeInTheDocument()
  })

  test('renders empty state text for sacraments if empty', () => {
    const studentNoSacraments = {
      ...mockStudentDetail,
      sacraments: [],
    }

    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(false)
    vi.mocked(useQuery).mockReturnValue(studentNoSacraments)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(screen.getByText('students.sacraments.noRecord')).toBeInTheDocument()
  })

  test('renders empty state text for enrollments if empty', () => {
    const studentNoEnrollments = {
      ...mockStudentDetail,
      enrollments: [],
    }

    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(false)
    vi.mocked(useQuery).mockReturnValue(studentNoEnrollments)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    expect(
      screen.getByText('students.enrollments.noRecord'),
    ).toBeInTheDocument()
  })

  test('renders correctly with no address, inactive status, and undefined gender', () => {
    const studentMinimal = {
      ...mockStudentDetail,
      gender: undefined,
      isActive: false,
      address: null,
    }

    vi.mocked(useAuth).mockReturnValue({
      user: null,
    } as any)
    vi.mocked(isAdmin).mockReturnValue(false)
    vi.mocked(useQuery).mockReturnValue(studentMinimal)

    const DetailPage = (Route as any).options.component
    render(<DetailPage />)

    // Gender should render '-'
    const genderLabel = screen.getByText('students.col.gender')
    const genderContainer = genderLabel.nextElementSibling
    expect(genderContainer?.textContent).toBe('-')

    // Status should be inactive
    expect(screen.getByText('students.status.inactive')).toBeInTheDocument()

    // Address section should render '-'
    const addressLabel = screen.getByText('profile.address.title')
    const addressContainer = addressLabel.nextElementSibling
    expect(addressContainer?.textContent).toBe('-')
  })

  test('edit button visibility and navigation', () => {
    // Hidden to user
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'user123', role: 'user' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(false)
    vi.mocked(useQuery).mockReturnValue(mockStudentDetail)

    const DetailPage = (Route as any).options.component
    const { rerender } = render(<DetailPage />)

    expect(screen.queryByText('common.edit')).not.toBeInTheDocument()

    // Visible to admin
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.mocked(useQuery).mockReturnValue(mockStudentDetail)

    rerender(<DetailPage />)
    const editBtn = screen.getByText('common.edit')
    expect(editBtn).toBeInTheDocument()

    // Clicking navigate to edit page
    fireEvent.click(editBtn)
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/students/$id/edit',
      params: { id: 'student123' },
    })
  })
})
