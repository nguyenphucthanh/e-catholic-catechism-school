import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { useQuery } from 'convex/react'
import { useParams } from '@tanstack/react-router'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import { Route } from './catechists_.$id'
import { useAuth } from '~/lib/auth'
import { exportQrCardsPdf } from '~/lib/export/qr-card-pdf'

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockqr'),
  },
}))

vi.mock('~/lib/export/qr-card-pdf', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  exportQrCardsPdf: vi.fn(),
}))

const mockNavigate = vi.fn()
const mockLoginAsCatechist = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    useParams: vi.fn(),
    useNavigate: () => mockNavigate,
    Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  }
})

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    useQuery: vi.fn(),
    useMutation: () => mockLoginAsCatechist,
  }
})

const mockCatechist = {
  _id: 'catechist-1',
  memberId: 'GLV0001',
  fullName: 'Nguyễn Văn A',
  saintName: 'Giuse',
  dateOfBirth: '1990-01-01',
  gender: 'male',
  role: 'admin',
  isActive: true,
  isDeleted: false,
  joinedDate: '2020-01-01',
  notes: 'Some notes',
  title: 'Anh',
  community: 'GX',
  level: 'Cap 1',
  address: {
    _id: 'addr-1',
    catechistId: 'catechist-1',
    country: 'VN',
    addressLine1: '123 Đường ABC',
    addressLine2: 'Apt 4B',
    city: 'Hồ Chí Minh',
    postalCode: '70000',
    hamlet: 'Thánh Tâm',
    subHamlet: 'Khu 1',
    isDeleted: false,
  },
  contacts: [
    {
      _id: 'contact-1',
      catechistId: 'catechist-1',
      label: 'Personal Phone',
      contactType: 'phone',
      value: '+84912345678',
      isPrimary: true,
      notes: 'Main phone',
      isDeleted: false,
    },
    {
      _id: 'contact-2',
      catechistId: 'catechist-1',
      label: 'Email',
      contactType: 'email',
      value: 'a@example.com',
      isPrimary: false,
      isDeleted: false,
    },
    {
      _id: 'contact-3',
      catechistId: 'catechist-1',
      label: 'Zalo',
      contactType: 'zalo',
      value: '0912345678',
      isPrimary: false,
      isDeleted: false,
    },
    {
      _id: 'contact-4',
      catechistId: 'catechist-1',
      label: 'Other',
      contactType: 'other',
      value: 'custom',
      isPrimary: false,
      isDeleted: false,
    },
  ],
  account: {
    _id: 'account-1',
    isActive: true,
    loginId: 'CAT-GLV0001',
  },
}

const mockClassAssignments = [
  {
    _id: 'cc-1',
    role: 'homeroom',
    classYearId: 'cy-1',
    classId: 'class-1',
    className: 'Ấu Nhi 1',
    branchId: 'branch-1',
    branchName: 'Ấu Nhi',
    academicYearId: 'ay-2024',
    academicYearName: '2024-2025',
  },
  {
    _id: 'cc-2',
    role: 'assistant',
    classYearId: 'cy-2',
    classId: 'class-2',
    className: 'Thiếu Nhi 1',
    branchId: 'branch-2',
    branchName: 'Thiếu Nhi',
    academicYearId: 'ay-2023',
    academicYearName: '2023-2024',
  },
  {
    _id: 'cc-3',
    role: 'substitute',
    classYearId: 'cy-3',
    classId: 'class-3',
    className: 'Ấu Nhi 2',
    branchId: 'branch-1',
    branchName: 'Ấu Nhi',
    academicYearId: 'ay-2024',
    academicYearName: '2024-2025',
  },
]

describe('CatechistDetailPage', () => {
  beforeEach(() => {
    vi.mocked(useParams).mockReturnValue({ id: 'catechist-1' })
    vi.mocked(useQuery).mockImplementation((_queryRef: any, _args?: any) => {
      const path = _queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:get') {
        return mockCatechist
      }
      if (path === 'catechists:getClassAssignments') {
        return mockClassAssignments
      }
      return undefined
    })
  })

  const mockPeerAuth = () =>
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: 'user-2',
        userDocId: 'catechist-2',
        memberId: 'GLV0002',
        fullName: 'Trần Văn B',
        accountType: 'catechist',
        role: 'user',
      } as any,
    })

  test('peer sees Contacts card with public contacts only, no Address card', () => {
    const publicContact = {
      ...mockCatechist.contacts[0],
      publicity: 'public',
    }
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:get') {
        return { ...mockCatechist, address: null, contacts: [publicContact] }
      }
      return path === 'catechists:getClassAssignments'
        ? mockClassAssignments
        : undefined
    })
    mockPeerAuth()

    const Component = (Route as any).options.component
    render(<Component />)

    expect(
      screen.queryByText('catechists.edit.address.title'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('catechists.edit.contacts.title'),
    ).toBeInTheDocument()
    expect(screen.getByText('+84912345678')).toBeInTheDocument()
    expect(
      screen.getByText('profile.contacts.publicity.public'),
    ).toBeInTheDocument()
  })

  test('hides Address and Contacts cards when peer views profile with no public contacts', () => {
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:get') {
        return { ...mockCatechist, address: null, contacts: [] }
      }
      return path === 'catechists:getClassAssignments'
        ? mockClassAssignments
        : undefined
    })
    mockPeerAuth()

    const Component = (Route as any).options.component
    render(<Component />)

    expect(
      screen.queryByText('catechists.edit.address.title'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('catechists.edit.contacts.title'),
    ).not.toBeInTheDocument()
  })

  test('admin sees public and private badges on contacts', () => {
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:get') {
        return {
          ...mockCatechist,
          contacts: [
            { ...mockCatechist.contacts[0], publicity: 'public' },
            mockCatechist.contacts[1],
          ],
        }
      }
      return path === 'catechists:getClassAssignments'
        ? mockClassAssignments
        : undefined
    })
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: 'user-admin',
        userDocId: 'catechist-admin',
        role: 'admin',
        accountType: 'catechist',
      } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    expect(
      screen.getByText('profile.contacts.publicity.public'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('profile.contacts.publicity.private'),
    ).toBeInTheDocument()
  })

  test('hides Address card when viewing other catechist profile as regular catechist', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: 'user-2',
        userDocId: 'catechist-2',
        memberId: 'GLV0002',
        fullName: 'Trần Văn B',
        accountType: 'catechist',
        role: 'user',
      } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    // Personal info title should be visible and multiple instances of name
    expect(
      screen.getByText('catechists.edit.personal.title'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Giuse Nguyễn Văn A').length).toBeGreaterThan(0)

    // Address and Contacts cards should NOT be rendered
    expect(
      screen.queryByText('catechists.edit.address.title'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('123 Đường ABC')).not.toBeInTheDocument()

    // Class assignments should be rendered
    expect(screen.getByText('2024-2025')).toBeInTheDocument()
    expect(screen.getByText('Ấu Nhi 1')).toBeInTheDocument()
  })

  test('shows Address and Contacts cards when viewing own profile', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: 'user-1',
        userDocId: 'catechist-1',
        memberId: 'GLV0001',
        fullName: 'Nguyễn Văn A',
        accountType: 'catechist',
        role: 'user',
      } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    // Address and Contacts cards should be rendered
    expect(
      screen.getByText('catechists.edit.address.title'),
    ).toBeInTheDocument()
    expect(screen.getByText('123 Đường ABC')).toBeInTheDocument()
    expect(screen.getByText('Apt 4B')).toBeInTheDocument()
    expect(screen.getByText('Hồ Chí Minh')).toBeInTheDocument()
    expect(screen.getByText('70000')).toBeInTheDocument()
    expect(screen.getByText('Thánh Tâm')).toBeInTheDocument()
    expect(screen.getByText('Khu 1')).toBeInTheDocument()
    expect(
      screen.getByText('catechists.edit.contacts.title'),
    ).toBeInTheDocument()
    expect(screen.getByText('+84912345678')).toBeInTheDocument()
    expect(screen.getByText('a@example.com')).toBeInTheDocument()
  })

  test('shows Address and Contacts cards and edit button when viewing as admin', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: 'user-admin',
        userDocId: 'catechist-admin',
        memberId: 'GLV0000',
        fullName: 'Admin User',
        accountType: 'catechist',
        role: 'admin',
      } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    // Address and Contacts cards should be rendered
    expect(
      screen.getByText('catechists.edit.address.title'),
    ).toBeInTheDocument()
    expect(screen.getByText('123 Đường ABC')).toBeInTheDocument()
    expect(
      screen.getByText('catechists.edit.contacts.title'),
    ).toBeInTheDocument()
    expect(screen.getByText('+84912345678')).toBeInTheDocument()

    // Edit action should be visible
    expect(screen.getByText('common.edit')).toBeInTheDocument()
  })

  test('renders loading skeleton state when data is undefined', () => {
    vi.mocked(useQuery).mockImplementation(
      (_queryRef?: any, _args?: any) => undefined,
    )
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

    expect(screen.getByText('catechists.detail.title')).toBeInTheDocument()
  })

  test('renders not found when data is null', () => {
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:get') {
        return null
      }
      return []
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

    expect(screen.getByText('catechists.notFound')).toBeInTheDocument()
  })

  test('renders empty address and empty contacts when data has empty values', () => {
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:get') {
        return {
          ...mockCatechist,
          address: null,
          contacts: [],
        }
      }
      if (path === 'catechists:getClassAssignments') {
        return []
      }
      return undefined
    })

    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: 'user-1',
        userDocId: 'catechist-1',
        memberId: 'GLV0001',
        role: 'user',
      } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.getByText('profile.contacts.empty')).toBeInTheDocument()
    expect(
      screen.getByText('catechists.detail.classes.empty'),
    ).toBeInTheDocument()
  })

  test('shows Login As button when admin views another active catechist with active account', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      loginAs: vi.fn(),
      user: {
        _id: 'user-admin',
        userDocId: 'catechist-admin',
        memberId: 'GLV0000',
        fullName: 'Admin User',
        accountType: 'catechist',
        role: 'admin',
      } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    expect(
      screen.getByText('adminAccounts.actions.loginAs'),
    ).toBeInTheDocument()
  })

  test('handles Login As confirmation flow successfully', async () => {
    const mockLoginAs = vi.fn()
    mockLoginAsCatechist.mockResolvedValueOnce({
      accountType: 'catechist',
      userDocId: 'catechist-1',
      loginId: 'CAT-GLV0001',
      memberId: 'GLV0001',
      fullName: 'Nguyễn Văn A',
      role: 'user',
    })

    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      loginAs: mockLoginAs,
      user: {
        _id: 'user-admin',
        userDocId: 'catechist-admin',
        memberId: 'GLV0000',
        fullName: 'Admin User',
        accountType: 'catechist',
        role: 'admin',
      } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    const loginAsButton = screen.getByText('adminAccounts.actions.loginAs')
    fireEvent.click(loginAsButton)

    expect(
      screen.getByText('adminAccounts.loginAs.confirm.title'),
    ).toBeInTheDocument()

    // Find the confirm action button inside the alert dialog
    const confirmButtons = screen.getAllByText('adminAccounts.actions.loginAs')
    // The second one is inside the AlertDialogFooter
    const confirmButton = confirmButtons[confirmButtons.length - 1]
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(mockLoginAsCatechist).toHaveBeenCalledWith({
        requesterId: 'catechist-admin',
        targetCatechistId: 'catechist-1',
      })
      expect(mockLoginAs).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
    })
  })

  test('does not show Login As button when admin views own profile', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      loginAs: vi.fn(),
      user: {
        _id: 'user-1',
        userDocId: 'catechist-1',
        memberId: 'GLV0001',
        fullName: 'Nguyễn Văn A',
        accountType: 'catechist',
        role: 'admin',
      } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    expect(
      screen.queryByText('adminAccounts.actions.loginAs'),
    ).not.toBeInTheDocument()
  })

  test('does not show Login As button when catechist is inactive', () => {
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:get') {
        return {
          ...mockCatechist,
          isActive: false,
        }
      }
      return []
    })

    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      loginAs: vi.fn(),
      user: {
        _id: 'user-admin',
        userDocId: 'catechist-admin',
        memberId: 'GLV0000',
        fullName: 'Admin User',
        accountType: 'catechist',
        role: 'admin',
      } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    expect(
      screen.queryByText('adminAccounts.actions.loginAs'),
    ).not.toBeInTheDocument()
  })

  test('does not show Login As button when catechist account is inactive or missing', () => {
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:get') {
        return {
          ...mockCatechist,
          account: {
            _id: 'account-1',
            isActive: false,
            loginId: 'CAT-GLV0001',
          },
        }
      }
      return []
    })

    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      loginAs: vi.fn(),
      user: {
        _id: 'user-admin',
        userDocId: 'catechist-admin',
        memberId: 'GLV0000',
        fullName: 'Admin User',
        accountType: 'catechist',
        role: 'admin',
      } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    expect(
      screen.queryByText('adminAccounts.actions.loginAs'),
    ).not.toBeInTheDocument()
  })

  test('does not show Login As button when already impersonating', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      loginAs: vi.fn(),
      impersonatorAdmin: {
        _id: 'user-superadmin',
        userDocId: 'catechist-superadmin',
        memberId: 'GLV9999',
        fullName: 'Super Admin',
        accountType: 'catechist',
        role: 'admin',
      } as any,
      user: {
        _id: 'user-admin',
        userDocId: 'catechist-admin',
        memberId: 'GLV0000',
        fullName: 'Admin User',
        accountType: 'catechist',
        role: 'admin',
      } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    expect(
      screen.queryByText('adminAccounts.actions.loginAs'),
    ).not.toBeInTheDocument()
  })

  test('does not show Login As button when user is not admin', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      loginAs: vi.fn(),
      user: {
        _id: 'user-2',
        userDocId: 'catechist-2',
        memberId: 'GLV0002',
        fullName: 'Trần Văn B',
        accountType: 'catechist',
        role: 'user',
      } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)

    expect(
      screen.queryByText('adminAccounts.actions.loginAs'),
    ).not.toBeInTheDocument()
  })
})

describe('CatechistDetailPage delete flow', () => {
  // useMutation is mocked at module level to always return
  // mockLoginAsCatechist, regardless of which api function is requested
  // (see the convex/react mock above), so it doubles as the softDelete mock.
  const deleteMock = mockLoginAsCatechist

  function mockQueries() {
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:get') {
        return mockCatechist
      }
      if (path === 'catechists:getClassAssignments') {
        return mockClassAssignments
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
    vi.mocked(useParams).mockReturnValue({ id: 'catechist-1' })
    deleteMock.mockReset().mockResolvedValue(undefined)
    mockNavigate.mockClear()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    mockQueries()
  })

  test('shows Delete button for admin', () => {
    mockAuth('admin')

    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.getByText('common.delete')).toBeInTheDocument()
  })

  test('hides Delete button for non-admin', () => {
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
      within(dialog).getByText('catechists.delete.title'),
    ).toBeInTheDocument()
  })

  test('confirming delete calls softDelete mutation, shows success toast, and navigates', async () => {
    mockAuth('admin')

    const Component = (Route as any).options.component
    render(<Component />)

    fireEvent.click(screen.getByText('common.delete'))
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByText('catechists.delete.confirm'))

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith({
        requesterId: 'catechist-admin',
        catechistId: 'catechist-1',
      })
    })

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('catechists.deleted')
    })
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/catechists' })

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })

  test('on mutation rejection shows error toast, closes dialog, and does not navigate', async () => {
    deleteMock.mockRejectedValue(new Error('CATECHIST_IN_USE_BY_ASSIGNMENT'))
    mockAuth('admin')

    const Component = (Route as any).options.component
    render(<Component />)

    fireEvent.click(screen.getByText('common.delete'))
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByText('catechists.delete.confirm'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalledWith({ to: '/catechists' })
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

describe('CatechistDetailPage QR card', () => {
  function setup(
    appConfig: any = { troopName: 'Đoàn', parishName: 'Giáo xứ' },
  ) {
    vi.mocked(useParams).mockReturnValue({ id: 'catechist-1' })
    vi.mocked(exportQrCardsPdf).mockClear()
    vi.mocked(QRCode.toDataURL).mockClear()
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:get') return mockCatechist
      if (path === 'catechists:getClassAssignments') return mockClassAssignments
      if (path === 'appConfig:getAccountPrefixes')
        return { student: 'STD', catechist: 'CAT' }
      if (path === 'appConfig:get') return appConfig
      return undefined
    })
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { _id: 'u', userDocId: 'catechist-2', role: 'user' } as any,
    })
    const Component = (Route as any).options.component
    render(<Component />)
  }

  test('Print card exports a catechist card PDF', () => {
    setup()
    fireEvent.click(screen.getByText('printCards.singleAction'))

    expect(exportQrCardsPdf).toHaveBeenCalledWith(
      [
        {
          type: 'catechist',
          memberId: 'GLV0001',
          fullName: 'Nguyễn Văn A',
          saintName: 'Giuse',
        },
      ],
      {
        troopName: 'Đoàn',
        parishName: 'Giáo xứ',
        studentCodeLabel: 'printCards.studentCodeLabel',
        catechistCodeLabel: 'printCards.catechistCodeLabel',
        studentPrefix: 'STD',
        catechistPrefix: 'CAT',
      },
      'GLV0001-card.pdf',
    )
  })

  test('Print card does nothing until app config is loaded', () => {
    setup(null)
    fireEvent.click(screen.getByText('printCards.singleAction'))
    expect(exportQrCardsPdf).not.toHaveBeenCalled()
  })

  test('show QR switch swaps avatar for QR image and back', async () => {
    setup()
    expect(screen.queryByAltText('GLV0001')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('switch'))

    const img = await screen.findByAltText('GLV0001')
    expect(img).toHaveAttribute('src', 'data:image/png;base64,mockqr')
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      JSON.stringify({ type: 'catechist', memberId: 'GLV0001' }),
    )

    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() =>
      expect(screen.queryByAltText('GLV0001')).not.toBeInTheDocument(),
    )
  })
})

describe('CatechistDetailPage login id copy', () => {
  test('copy button writes the login id to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    vi.mocked(useParams).mockReturnValue({ id: 'catechist-1' })
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:get') return mockCatechist
      if (path === 'catechists:getClassAssignments') return mockClassAssignments
      return undefined
    })
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { _id: 'a', userDocId: 'catechist-admin', role: 'admin' } as any,
    })

    const Component = (Route as any).options.component
    render(<Component />)
    fireEvent.click(screen.getByText('catechists.detail.viewLoginId'))
    fireEvent.click(await screen.findByRole('button', { name: 'common.copy' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('CAT-GLV0001'))
  })
})
