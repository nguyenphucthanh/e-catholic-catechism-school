import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { StudentDashboard } from './student-dashboard'
import type { Id } from '../../../convex/_generated/dataModel'

const studentId = 'student1' as Id<'students'>

function mockGetMyProfile(value: unknown) {
  vi.mocked(useQuery).mockImplementation(((queryRef: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'students:getMyProfile') return value
    return undefined
  }) as any)
}

describe('StudentDashboard', () => {
  test('shows loading skeleton while profile query is pending', () => {
    mockGetMyProfile(undefined)

    render(<StudentDashboard studentId={studentId} />)

    expect(
      screen.getByText('students.detail.enrollments.title'),
    ).toBeInTheDocument()
  })

  test('shows empty state when student has no enrollments', () => {
    mockGetMyProfile({
      _id: studentId,
      studentCode: 'HS0001',
      fullName: 'Trần Thị B',
      enrollments: [],
    })

    render(<StudentDashboard studentId={studentId} />)

    expect(
      screen.getByText('students.enrollments.noRecord'),
    ).toBeInTheDocument()
  })

  test('renders the enrollment with the most recent enrolledDate as the current class', () => {
    mockGetMyProfile({
      _id: studentId,
      studentCode: 'HS0001',
      fullName: 'Trần Thị B',
      enrollments: [
        {
          _id: 'enrollment-old',
          enrolledDate: '2023-09-01',
          classYear: {
            className: 'Au Nhi 1',
            academicYearName: '2023-2024',
          },
        },
        {
          _id: 'enrollment-new',
          enrolledDate: '2024-09-01',
          classYear: {
            className: 'Au Nhi 2',
            academicYearName: '2024-2025',
          },
        },
      ],
    })

    render(<StudentDashboard studentId={studentId} />)

    expect(screen.getByText('Au Nhi 2')).toBeInTheDocument()
    expect(screen.getByText('2024-2025')).toBeInTheDocument()
    expect(screen.queryByText('Au Nhi 1')).not.toBeInTheDocument()

    const link = screen.getByRole('link', {
      name: 'students.dashboard.viewAllHistoryLink',
    })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/profile')
  })
})
