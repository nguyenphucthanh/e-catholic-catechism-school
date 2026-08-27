import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useQuery } from 'convex/react'
import QRCode from 'qrcode'
import { Route } from './profile'
import { useAuth } from '~/lib/auth'

import { exportQrCardsPdf } from '~/lib/export/qr-card-pdf'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  }
})

const mockStudentProfile = {
  _id: 'student-1',
  studentCode: '1001',
  fullName: 'Nguyễn Thị A',
  saintName: 'Maria',
  dateOfBirth: '2015-05-01',
  gender: 'female',
  isActive: true,
  isDeleted: false,
  isEditable: false,
  address: {
    _id: 'addr-1',
    studentId: 'student-1',
    addressLine1: '123********',
    addressLine2: 'Khu****',
    fullAddress: '123*****************',
    country: 'VN',
    city: 'Hồ Chí Minh',
    isDeleted: false,
  },
  sacraments: [],
  guardians: [
    {
      _id: 'guardian-link-1',
      studentId: 'student-1',
      guardianId: 'guardian-1',
      relationship: 'mother',
      contactPriority: 1,
      guardian: {
        _id: 'guardian-1',
        fullName: 'Trần Thị Mẹ',
        saintName: 'Anna',
      },
      contacts: [
        {
          _id: 'c-1',
          guardianId: 'guardian-1',
          contactType: 'phone',
          value: '******4567',
          isPrimary: true,
          isDeleted: false,
        },
        {
          _id: 'c-2',
          guardianId: 'guardian-1',
          contactType: 'email',
          value: 'mary****************',
          isPrimary: false,
          isDeleted: false,
        },
      ],
    },
  ],
  siblings: [],
  enrollments: [],
}

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockqr'),
  },
}))

vi.mock('~/lib/export/qr-card-pdf', () => ({
  exportQrCardsPdf: vi.fn(),
}))

describe('ProfilePage for Student', () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'students:getMyProfile') {
        return mockStudentProfile
      }
      if (path === 'appConfig:get') {
        return { troopName: 'Đoàn TNTT', parishName: 'Giáo xứ' }
      }
      return undefined
    })
  })

  test('renders student self profile with masked address and contacts', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: 'user-student',
        userDocId: 'student-1',
        accountType: 'student',
      } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    // Name and student info are visible
    expect(screen.getAllByText('Maria Nguyễn Thị A').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/1001/).length).toBeGreaterThan(0)

    // Masked info hint alert is displayed
    expect(
      screen.getByText('profile.student.masked_info_hint'),
    ).toBeInTheDocument()

    // Masked address is displayed
    expect(screen.getByText('profile.address.title')).toBeInTheDocument()
    expect(screen.getByText('123********')).toBeInTheDocument()

    // Masked phone & email are displayed as plain text without active tel/mailto links
    expect(screen.getByText('******4567')).toBeInTheDocument()
    expect(screen.getByText('mary****************')).toBeInTheDocument()

    expect(screen.queryByRole('link', { name: '******4567' })).toBeNull()
    expect(
      screen.queryByRole('link', { name: 'mary****************' }),
    ).toBeNull()
  })

  test('handles QR code toggling and PDF card printing for student profile', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: 'user-student',
        userDocId: 'student-1',
        accountType: 'student',
      } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    // Toggle QR switch
    const switchEl = screen.getByRole('switch')
    fireEvent.click(switchEl)

    await waitFor(() => {
      expect(QRCode.toDataURL).toHaveBeenCalledWith('1001')
    })

    // Click print card
    const printBtn = screen.getByRole('button', {
      name: /printCards\.singleAction/i,
    })
    fireEvent.click(printBtn)

    expect(exportQrCardsPdf).toHaveBeenCalled()
  })
})
