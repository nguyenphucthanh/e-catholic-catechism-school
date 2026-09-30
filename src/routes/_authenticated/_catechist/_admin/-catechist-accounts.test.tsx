import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, usePaginatedQuery } from 'convex/react'
import { toast } from 'sonner'
import { Route } from './catechist-accounts'
import { useAuth } from '~/lib/auth'

const grantAccountMock = vi.fn()
const resetPasswordMock = vi.fn()
const unlockAccountMock = vi.fn()
const toggleStatusMock = vi.fn()
const bulkGrantMock = vi.fn()
const bulkResetMock = vi.fn()
const loginAsCatechistMock = vi.fn()

const mockCatechistActive = {
  _id: 'cat-1',
  memberId: 'GLV0001',
  fullName: 'Nguyễn Văn A',
  saintName: 'Giuse',
  gender: 'male',
  role: 'user',
  isActive: true,
  isDeleted: false,
}

const mockAccountUnlocked = {
  _id: 'acc-1',
  loginId: 'GLV0001',
  passwordHash: 'hash1',
  accountType: 'catechist',
  userRefId: 'cat-1',
  isActive: true,
  createdAt: Date.now(),
  isDeleted: false,
}

const mockAccountLocked = {
  _id: 'acc-2',
  loginId: 'GLV0002',
  passwordHash: 'hash2',
  accountType: 'catechist',
  userRefId: 'cat-2',
  isActive: true,
  failedLoginAttempts: 5,
  lockoutUntil: Date.now() + 15 * 60 * 1000, // locked for 15 mins
  createdAt: Date.now(),
  isDeleted: false,
}

const mockCatechistLocked = {
  _id: 'cat-2',
  memberId: 'GLV0002',
  fullName: 'Trần Văn B',
  saintName: 'Phêrô',
  gender: 'male',
  role: 'user',
  isActive: true,
  isDeleted: false,
}

let mockResults: Array<any> = []

function mockConvex() {
  vi.mocked(usePaginatedQuery).mockImplementation(
    () =>
      ({
        results: mockResults,
        isLoading: false,
        status: 'Exhausted',
        loadMore: vi.fn(),
      }) as any,
  )

  vi.mocked(useMutation).mockImplementation(((fnRef: any) => {
    const path = fnRef?.[Symbol.for('functionName')]
    if (path === 'accountAdmin:grantCatechistAccount') return grantAccountMock
    if (path === 'accountAdmin:resetPassword') return resetPasswordMock
    if (path === 'accountAdmin:unlockAccount') return unlockAccountMock
    if (path === 'accountAdmin:toggleAccountStatus') return toggleStatusMock
    if (path === 'accountAdmin:bulkGrantCatechistAccounts') return bulkGrantMock
    if (path === 'accountAdmin:bulkResetPasswords') return bulkResetMock
    if (path === 'accountAdmin:loginAsCatechist') return loginAsCatechistMock
    return vi.fn()
  }) as any)
}

function mockAuth() {
  vi.mocked(useAuth).mockReturnValue({
    login: vi.fn(),
    logout: vi.fn(),
    user: {
      userDocId: 'cat-admin',
      loginId: 'ADMIN',
      memberId: 'GLV0000',
      fullName: 'Admin User',
      accountType: 'catechist',
      role: 'admin',
    } as any,
  })
}

function renderPage() {
  const Component = (Route as any).options.component
  return render(<Component />)
}

describe('AdminCatechistAccountsPage - Lockout and Unlock', () => {
  beforeEach(() => {
    mockResults = [
      { catechist: mockCatechistActive, account: mockAccountUnlocked },
    ]
    mockConvex()
    mockAuth()
    grantAccountMock
      .mockReset()
      .mockResolvedValue({ username: 'GLV0001', password: 'p' })
    resetPasswordMock
      .mockReset()
      .mockResolvedValue({ username: 'GLV0001', password: 'p' })
    unlockAccountMock.mockReset().mockResolvedValue(undefined)
    toggleStatusMock.mockReset().mockResolvedValue(undefined)
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  test('does not show locked badge or unlock action for unlocked account', async () => {
    renderPage()

    expect(
      screen.getByText('adminAccounts.status.hasAccount'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('adminAccounts.status.locked'),
    ).not.toBeInTheDocument()

    // Open dropdown menu
    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))

    await waitFor(() => {
      expect(
        screen.getByText('adminAccounts.actions.resetPassword'),
      ).toBeInTheDocument()
    })
    expect(
      screen.queryByText('adminAccounts.actions.unlock'),
    ).not.toBeInTheDocument()
  })

  test('shows locked badge when account is currently locked', () => {
    mockResults = [
      { catechist: mockCatechistLocked, account: mockAccountLocked },
    ]
    renderPage()

    expect(
      screen.getByText('adminAccounts.status.hasAccount'),
    ).toBeInTheDocument()
    expect(screen.getByText('adminAccounts.status.locked')).toBeInTheDocument()
  })

  test('shows unlock menu item and calls unlockAccount mutation on click', async () => {
    mockResults = [
      { catechist: mockCatechistLocked, account: mockAccountLocked },
    ]
    renderPage()

    // Open dropdown menu
    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))

    const unlockItem = await screen.findByText('adminAccounts.actions.unlock')
    expect(unlockItem).toBeInTheDocument()

    // Click unlock
    fireEvent.click(unlockItem)

    await waitFor(() => {
      expect(unlockAccountMock).toHaveBeenCalledWith({
        requesterId: 'cat-admin',
        accountId: 'acc-2',
      })
      expect(toast.success).toHaveBeenCalledWith('adminAccounts.unlockSuccess')
    })
  })

  test('shows error toast when unlockAccount mutation fails', async () => {
    unlockAccountMock.mockRejectedValue(new Error('ACCOUNT_NOT_FOUND'))
    mockResults = [
      { catechist: mockCatechistLocked, account: mockAccountLocked },
    ]
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    const unlockItem = await screen.findByText('adminAccounts.actions.unlock')
    fireEvent.click(unlockItem)

    await waitFor(() => {
      expect(unlockAccountMock).toHaveBeenCalledWith({
        requesterId: 'cat-admin',
        accountId: 'acc-2',
      })
      expect(toast.error).toHaveBeenCalled()
    })
  })
})
