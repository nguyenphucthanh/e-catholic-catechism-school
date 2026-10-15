import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import { Route } from './students_.$id'
import { useAuth } from '~/lib/auth'
import { exportQrCardsPdf } from '~/lib/export/qr-card-pdf'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    useParams: vi.fn(),
    useNavigate: vi.fn(),
    Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  }
})

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockqr'),
  },
}))

vi.mock('~/lib/export/qr-card-pdf', () => ({
  exportQrCardsPdf: vi.fn(),
}))

const mockStudentWithSensitiveInfo = {
  _id: 'student-1',
  studentCode: '1001',
  fullName: 'Nguyễn Thị A',
  saintName: 'Maria',
  dateOfBirth: '2015-05-01',
  gender: 'female',
  isActive: true,
  isDeleted: false,
  isEditable: true,
  address: {
    _id: 'addr-1',
    studentId: 'student-1',
    addressLine1: '123 Đường ABC',
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
          value: '0901234567',
          isPrimary: true,
          isDeleted: false,
        },
      ],
    },
  ],
  siblings: [],
  enrollments: [],
}

const mockStudentWithoutSensitiveInfo = {
  ...mockStudentWithSensitiveInfo,
  isEditable: false,
  address: null,
  guardians: [
    {
      ...mockStudentWithSensitiveInfo.guardians[0],
      contacts: [],
    },
  ],
}

describe('StudentDetailPage', () => {
  beforeEach(() => {
    vi.mocked(useParams).mockReturnValue({ id: 'student-1' })
    vi.mocked(useNavigate).mockReturnValue(vi.fn())
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'students:getStudentDetail') {
        return mockStudentWithoutSensitiveInfo
      }
      if (path === 'appConfig:getAccountPrefixes')
        return { student: 'STD', catechist: 'CAT' }
      if (path === 'appConfig:get') {
        return { troopName: 'Đoàn TNTT', parishName: 'Giáo xứ' }
      }
      return undefined
    })
  })

  test('renders student profile with hidden address and hidden guardian contacts for unauthorized catechist', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: 'user-2',
        userDocId: 'catechist-2',
        role: 'user',
      } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    // Name and student info are visible
    expect(screen.getAllByText('Maria Nguyễn Thị A').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/1001/).length).toBeGreaterThan(0)

    // Address section is hidden
    expect(screen.queryByText('profile.address.title')).not.toBeInTheDocument()
    expect(screen.queryByText('123 Đường ABC')).not.toBeInTheDocument()

    // Guardian name is visible, but contact phone is hidden
    expect(screen.getByText('Anna Trần Thị Mẹ')).toBeInTheDocument()
    expect(screen.queryByText('0901234567')).not.toBeInTheDocument()

    // Edit button is not rendered for non-admin
    expect(screen.queryByText('common.edit')).not.toBeInTheDocument()
  })

  test('hides Edit button for admin user when backend reports isEditable: false', () => {
    // Proves the Edit button gate reads data.isEditable, not isAdmin(user) —
    // even an admin-role user must not see Edit when the backend says no.
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'students:getStudentDetail') {
        return { ...mockStudentWithSensitiveInfo, isEditable: false }
      }
      if (path === 'appConfig:getAccountPrefixes')
        return { student: 'STD', catechist: 'CAT' }
      if (path === 'appConfig:get') {
        return { troopName: 'Đoàn TNTT', parishName: 'Giáo xứ' }
      }
      return undefined
    })

    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: 'user-admin',
        userDocId: 'catechist-admin',
        role: 'admin',
      } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.queryByText('common.edit')).not.toBeInTheDocument()
  })

  test('shows Edit button for non-admin catechist when backend reports isEditable: true', () => {
    // Proves a plain (non-admin) catechist who the backend allows to edit
    // (class-assigned catechist / branch head / board member) sees the button.
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'students:getStudentDetail') {
        return { ...mockStudentWithSensitiveInfo, isEditable: true }
      }
      if (path === 'appConfig:getAccountPrefixes')
        return { student: 'STD', catechist: 'CAT' }
      if (path === 'appConfig:get') {
        return { troopName: 'Đoàn TNTT', parishName: 'Giáo xứ' }
      }
      return undefined
    })

    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: 'user-2',
        userDocId: 'catechist-2',
        role: 'user',
      } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.getByText('common.edit')).toBeInTheDocument()
  })

  test('renders address and guardian contacts when sensitive data is present (admin / assigned catechist)', () => {
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'students:getStudentDetail') {
        return mockStudentWithSensitiveInfo
      }
      if (path === 'appConfig:getAccountPrefixes')
        return { student: 'STD', catechist: 'CAT' }
      if (path === 'appConfig:get') {
        return { troopName: 'Đoàn TNTT', parishName: 'Giáo xứ' }
      }
      return undefined
    })

    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: 'user-admin',
        userDocId: 'catechist-admin',
        role: 'admin',
      } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    // Address and guardian contacts are visible
    expect(screen.getByText('profile.address.title')).toBeInTheDocument()
    expect(screen.getByText('123 Đường ABC')).toBeInTheDocument()
    expect(screen.getByText('0901234567')).toBeInTheDocument()
    expect(screen.getByText('common.edit')).toBeInTheDocument()
  })

  test('handles QR code toggling and PDF card printing', async () => {
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'students:getStudentDetail') {
        return mockStudentWithSensitiveInfo
      }
      if (path === 'appConfig:getAccountPrefixes')
        return { student: 'STD', catechist: 'CAT' }
      if (path === 'appConfig:get') {
        return { troopName: 'Đoàn TNTT', parishName: 'Giáo xứ' }
      }
      return undefined
    })

    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: 'user-admin',
        userDocId: 'catechist-admin',
        role: 'admin',
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

  test('renders not found when data is null', () => {
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'students:getStudentDetail') {
        return null
      }
      return undefined
    })

    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: 'user-1',
        userDocId: 'catechist-1',
        role: 'user',
      } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.getByText('students.notFound')).toBeInTheDocument()
  })
})

describe('StudentDetailPage delete flow', () => {
  let deleteMock: ReturnType<typeof vi.fn>
  let navigateMock: ReturnType<typeof vi.fn>

  function mockQueries() {
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'students:getStudentDetail') {
        return mockStudentWithSensitiveInfo
      }
      if (path === 'appConfig:getAccountPrefixes')
        return { student: 'STD', catechist: 'CAT' }
      if (path === 'appConfig:get') {
        return { troopName: 'Đoàn TNTT', parishName: 'Giáo xứ' }
      }
      return undefined
    })
  }

  function mockAuth(role: 'admin' | 'user') {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: role === 'admin' ? 'user-admin' : 'user-2',
        userDocId: role === 'admin' ? 'catechist-admin' : 'catechist-2',
        role,
      } as any,
    })
  }

  beforeEach(() => {
    vi.mocked(useParams).mockReturnValue({ id: 'student-1' })
    deleteMock = vi.fn().mockResolvedValue(undefined)
    navigateMock = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(navigateMock as any)
    vi.mocked(useMutation).mockReturnValue(deleteMock as any)
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    mockQueries()
  })

  test('shows Delete button for admin regardless of isEditable', () => {
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'students:getStudentDetail') {
        return { ...mockStudentWithSensitiveInfo, isEditable: false }
      }
      if (path === 'appConfig:getAccountPrefixes')
        return { student: 'STD', catechist: 'CAT' }
      if (path === 'appConfig:get') {
        return { troopName: 'Đoàn TNTT', parishName: 'Giáo xứ' }
      }
      return undefined
    })
    mockAuth('admin')

    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.getByText('common.delete')).toBeInTheDocument()
  })

  test('hides Delete button for non-admin regardless of isEditable', () => {
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'students:getStudentDetail') {
        return { ...mockStudentWithSensitiveInfo, isEditable: true }
      }
      if (path === 'appConfig:getAccountPrefixes')
        return { student: 'STD', catechist: 'CAT' }
      if (path === 'appConfig:get') {
        return { troopName: 'Đoàn TNTT', parishName: 'Giáo xứ' }
      }
      return undefined
    })
    mockAuth('user')

    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.queryByText('common.delete')).not.toBeInTheDocument()
  })

  test('clicking Delete opens confirmation dialog with title/description', () => {
    mockAuth('admin')

    const Component = (Route as any).options.component
    render(<Component />)

    fireEvent.click(screen.getByText('common.delete'))

    const dialog = screen.getByRole('alertdialog')
    expect(
      within(dialog).getByText('students.delete.title'),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('students.delete.description'),
    ).toBeInTheDocument()
  })

  test('confirming delete calls softDelete mutation, shows success toast, and navigates', async () => {
    mockAuth('admin')

    const Component = (Route as any).options.component
    render(<Component />)

    fireEvent.click(screen.getByText('common.delete'))
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByText('students.delete.confirm'))

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith({
        requesterId: 'catechist-admin',
        studentId: 'student-1',
      })
    })

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('students.deleted')
    })
    expect(navigateMock).toHaveBeenCalledWith({ to: '/students' })

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })

  test('on mutation rejection shows error toast, closes dialog, and does not navigate', async () => {
    deleteMock.mockRejectedValue(new Error('students:notFound'))
    mockAuth('admin')

    const Component = (Route as any).options.component
    render(<Component />)

    fireEvent.click(screen.getByText('common.delete'))
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByText('students.delete.confirm'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
    expect(navigateMock).not.toHaveBeenCalled()
  })

  test('cancel closes dialog without calling the mutation', () => {
    mockAuth('admin')

    const Component = (Route as any).options.component
    render(<Component />)

    fireEvent.click(screen.getByText('common.delete'))
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByText('common.cancel'))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(deleteMock).not.toHaveBeenCalled()
  })
})
