import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import React from 'react'
import { useAuth } from '~/lib/auth'
import { Route } from './classes_.$id'

const mockNonAdminUser = {
  _id: 'user123',
  userDocId: 'catechist123',
  memberId: 'GLV0001',
  fullName: 'Homeroom Teacher',
  role: 'user',
} as any

const mockAdminUser = {
  _id: 'admin123',
  userDocId: 'catechist456',
  memberId: 'GLV0002',
  fullName: 'Admin User',
  role: 'admin',
} as any

const mockStudents = [
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
    sacramentDates: {},
  },
]

function buildClassDetails(overrides: Record<string, any> = {}) {
  return {
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
      classType: 'primary',
      isDeleted: false,
    },
    students: mockStudents,
    assignedCatechists: [],
    canManageEnrollments: false,
    ...overrides,
  }
}

function setupQueries(details?: any) {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'classes:getClassDetails') return details
    return undefined
  })
}

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: () => ({
    selectedYearId: 'year123',
    setSelectedYearId: vi.fn(),
  }),
  useInactiveYear: () => ({
    isInactive: false,
    yearName: '2024-2025',
  }),
}))

vi.mock('@tanstack/react-router', () => {
  const createFileRoute = vi.fn(() => (options: any) => ({ options }))
  const Link = vi.fn(({ to, children, ...props }: any) =>
    React.createElement('a', { href: to, ...props }, children),
  )
  return {
    createFileRoute,
    Link,
    useParams: () => ({ id: 'class123' }),
    useSearch: () => ({ tab: undefined }),
  }
})

vi.mock('~/components/forms/calendar-event-dialog', () => ({
  CalendarEventDialog: ({ isOpen, defaults, onSuccess }: any) =>
    isOpen ? (
      <div data-testid="mock-calendar-event-dialog">
        <span data-testid="event-dialog-scope">{defaults?.scope}</span>
        <span data-testid="event-dialog-class-year-id">
          {defaults?.classYearId}
        </span>
        <button type="button" onClick={onSuccess}>
          Simulate Save
        </button>
      </div>
    ) : null,
}))

describe('ClassDetailPage component', () => {
  test('shows only access-denied alert when classYear exists, cannot manage, and not admin', () => {
    setupQueries(buildClassDetails({ canManageEnrollments: false }))
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockNonAdminUser,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.getByText('classes.detail.accessDenied')).toBeInTheDocument()

    // No normal page content should render
    expect(
      screen.queryByText('classes.detail.tabs.students'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('classes.detail.tabs.attendance'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('classes.detail.tabs.exams'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('classes.export.title')).not.toBeInTheDocument()
    expect(screen.queryByText('printCards.buttonLabel')).not.toBeInTheDocument()
    expect(
      screen.queryByText('classes.detail.catechists.title'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('classes.detail.notActivated'),
    ).not.toBeInTheDocument()
  })

  test('renders normal page content when canManageEnrollments is true, even if not admin', () => {
    setupQueries(buildClassDetails({ canManageEnrollments: true }))
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockNonAdminUser,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    expect(
      screen.queryByText('classes.detail.accessDenied'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('classes.detail.tabs.students')).toBeInTheDocument()
    expect(
      screen.getByText('classes.detail.tabs.attendance'),
    ).toBeInTheDocument()
    expect(screen.getByText('classes.detail.tabs.exams')).toBeInTheDocument()
  })

  test('renders normal page content when user is admin, even if canManageEnrollments is false', () => {
    setupQueries(buildClassDetails({ canManageEnrollments: false }))
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockAdminUser,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    expect(
      screen.queryByText('classes.detail.accessDenied'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('classes.detail.tabs.students')).toBeInTheDocument()
    expect(
      screen.getByText('classes.detail.tabs.attendance'),
    ).toBeInTheDocument()
    expect(screen.getByText('classes.detail.tabs.exams')).toBeInTheDocument()
  })

  test('still shows not-activated alert (not access-denied) when classYear is null, regardless of permission', () => {
    setupQueries(
      buildClassDetails({ classYear: null, canManageEnrollments: false }),
    )
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockNonAdminUser,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.getByText('classes.detail.notActivated')).toBeInTheDocument()
    expect(
      screen.queryByText('classes.detail.accessDenied'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('classes.detail.tabs.students'),
    ).not.toBeInTheDocument()
  })

  test('renders Plus button in events widget and opens CalendarEventDialog with default scope "class"', () => {
    setupQueries(buildClassDetails({ canManageEnrollments: true }))
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockNonAdminUser,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    // Verify upcoming events section and view all link
    expect(
      screen.getByText('classes.detail.upcomingEvents.title'),
    ).toBeInTheDocument()
    const viewAllLink = screen.getByText(
      'classes.detail.upcomingEvents.viewAll',
    )
    expect(viewAllLink).toBeInTheDocument()

    // Verify Plus button is present
    const addEventButton = screen.getByRole('button', {
      name: 'calendarEvents.manage.addEvent',
    })
    expect(addEventButton).toBeInTheDocument()

    // Dialog should not be open initially
    expect(
      screen.queryByTestId('mock-calendar-event-dialog'),
    ).not.toBeInTheDocument()

    // Click Plus button
    fireEvent.click(addEventButton)

    // Dialog should now be open with scope 'class' and current classYearId
    expect(screen.getByTestId('mock-calendar-event-dialog')).toBeInTheDocument()
    expect(screen.getByTestId('event-dialog-scope')).toHaveTextContent('class')
    expect(screen.getByTestId('event-dialog-class-year-id')).toHaveTextContent(
      'classYear123',
    )

    // Simulate successful save
    const simulateSaveButton = screen.getByRole('button', {
      name: 'Simulate Save',
    })
    fireEvent.click(simulateSaveButton)
  })
})
