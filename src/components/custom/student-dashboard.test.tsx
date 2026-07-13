import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { StudentDashboard } from './student-dashboard'
import type { Id } from '../../../convex/_generated/dataModel'

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock-qr-code'),
  },
}))

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

  test('toggles QR code display when switch is clicked', async () => {
    mockGetMyProfile({
      _id: studentId,
      studentCode: 'HS0001',
      fullName: 'Trần Thị B',
      enrollments: [],
    })

    render(<StudentDashboard studentId={studentId} />)

    expect(screen.getByText('students.detail.showQrCode')).toBeInTheDocument()

    // Switch renders as role switch
    const toggleSwitch = screen.getByRole('switch')
    expect(toggleSwitch).toBeInTheDocument()
    expect(toggleSwitch).toHaveAttribute('aria-checked', 'false')

    // Avatar is rendered initially, QR code is not
    expect(screen.queryByAltText('HS0001')).not.toBeInTheDocument()

    // Click the toggle switch to check it
    fireEvent.click(toggleSwitch)

    // Wait for the QR code image to be displayed
    await waitFor(() => {
      expect(screen.getByAltText('HS0001')).toBeInTheDocument()
    })

    const qrImage = screen.getByAltText('HS0001')
    expect(qrImage).toHaveAttribute('src', 'data:image/png;base64,mock-qr-code')

    // Click the toggle switch again to uncheck it
    fireEvent.click(toggleSwitch)

    // Wait for the QR code image to be removed
    await waitFor(() => {
      expect(screen.queryByAltText('HS0001')).not.toBeInTheDocument()
    })
  })
})
