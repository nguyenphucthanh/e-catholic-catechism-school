import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Route } from './catechists'
import { useAuth } from '~/lib/auth'

const restoreMock = vi.fn()
const permanentDeleteMock = vi.fn()
const softDeleteMock = vi.fn()

const mockRows = [
  {
    _id: 'catechist-1',
    memberId: 'GLV0001',
    fullName: 'Nguyễn Văn A',
    saintName: 'Giuse',
    title: 'Thầy',
    gender: 'male',
    role: 'user',
    isActive: true,
    isDeleted: false,
    assignedClasses: [],
  },
]

function mockQueries() {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'academicYears:getActive') return { _id: 'ay-1' }
    if (path === 'branches:list') return []
    if (path === 'catechistPermissions:getPermissions')
      return { isAdmin: true, isBoardMember: false }
    return undefined
  })
  vi.mocked(usePaginatedQuery).mockReturnValue({
    results: mockRows,
    isLoading: false,
    status: 'Exhausted',
    loadMore: vi.fn(),
  } as any)
  vi.mocked(useMutation).mockImplementation(((fnRef: any) => {
    const path = fnRef?.[Symbol.for('functionName')]
    if (path === 'catechists:softDelete') return softDeleteMock
    if (path === 'catechists:restore') return restoreMock
    if (path === 'catechists:permanentDelete') return permanentDeleteMock
    return vi.fn()
  }) as any)
}

function mockAuth(role: 'admin' | 'user') {
  vi.mocked(useAuth).mockReturnValue({
    login: vi.fn(),
    logout: vi.fn(),
    user: {
      userDocId: 'catechist-admin',
      loginId: 'CAT-ADMIN',
      memberId: 'GLV0000',
      fullName: 'Admin User',
      accountType: 'catechist',
      role,
    } as any,
  })
}

function renderPage() {
  const Component = (Route as any).options.component
  return render(<Component />)
}

describe('CatechistsPage', () => {
  beforeEach(() => {
    mockQueries()
    mockAuth('admin')
    restoreMock.mockReset().mockResolvedValue(undefined)
    permanentDeleteMock.mockReset().mockResolvedValue(undefined)
    softDeleteMock.mockReset().mockResolvedValue(undefined)
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  test('renders title column between member ID and saint name', () => {
    renderPage()
    const headers = screen
      .getAllByRole('columnheader')
      .map((h) => h.textContent)
    const idx = headers.findIndex((h) => h.includes('catechists.col.title'))
    expect(headers[idx - 1]).toContain('catechists.col.memberId')
    expect(headers[idx + 1]).toContain('catechists.col.saintName')
    expect(screen.getByText('Thầy')).toBeInTheDocument()
  })

  test('shows "Show deleted" toggle only for admin (canManage)', () => {
    renderPage()
    expect(screen.getByText('catechists.showDeleted')).toBeInTheDocument()
  })

  test('never renders the toggle for a non-admin requester', () => {
    mockAuth('user')
    renderPage()
    expect(screen.queryByText('catechists.showDeleted')).not.toBeInTheDocument()
    expect(screen.queryByText('catechists.showActive')).not.toBeInTheDocument()
  })

  test('toggling to deleted view hides Export/Create and swaps fullName to plain text', () => {
    renderPage()

    // Active view: fullName is a link, Export/Create buttons visible
    expect(
      screen.getByRole('link', { name: 'Nguyễn Văn A' }),
    ).toBeInTheDocument()
    expect(screen.getByText('catechists.export.csv')).toBeInTheDocument()
    expect(screen.getByText('catechists.actions.create')).toBeInTheDocument()

    fireEvent.click(screen.getByText('catechists.showDeleted'))

    expect(screen.getByText('catechists.showActive')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Nguyễn Văn A' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.queryByText('catechists.export.csv')).not.toBeInTheDocument()
    expect(
      screen.queryByText('catechists.actions.create'),
    ).not.toBeInTheDocument()
  })

  test('deleted-view row actions show Restore and Permanently Delete instead of Edit/Delete', async () => {
    renderPage()
    fireEvent.click(screen.getByText('catechists.showDeleted'))

    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    await screen.findByText('catechists.restore')
    expect(
      screen.getByText('catechists.permanentDelete.action'),
    ).toBeInTheDocument()
    expect(screen.queryByText('common.edit')).not.toBeInTheDocument()
    expect(screen.queryByText('common.delete')).not.toBeInTheDocument()
  })

  test('clicking Restore fires the mutation immediately (no confirm dialog) and shows a success toast', async () => {
    renderPage()
    fireEvent.click(screen.getByText('catechists.showDeleted'))
    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    const restoreItem = await screen.findByText('catechists.restore')
    fireEvent.click(restoreItem)

    await waitFor(() => {
      expect(restoreMock).toHaveBeenCalledWith({
        requesterId: 'catechist-admin',
        catechistId: 'catechist-1',
      })
    })
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('catechists.restored')
    })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  test('Restore failure shows an error toast via translateConvexError', async () => {
    restoreMock.mockRejectedValue(new Error('CATECHIST_NOT_FOUND'))
    renderPage()
    fireEvent.click(screen.getByText('catechists.showDeleted'))
    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    const restoreItem = await screen.findByText('catechists.restore')
    fireEvent.click(restoreItem)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
    expect(toast.success).not.toHaveBeenCalled()
  })

  test('Permanently Delete opens a confirm dialog; confirming fires the mutation and shows a success toast', async () => {
    renderPage()
    fireEvent.click(screen.getByText('catechists.showDeleted'))
    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    const permDeleteItem = await screen.findByText(
      'catechists.permanentDelete.action',
    )
    fireEvent.click(permDeleteItem)

    const dialog = screen.getByRole('alertdialog')
    expect(
      within(dialog).getByText('catechists.permanentDelete.title'),
    ).toBeInTheDocument()

    fireEvent.click(
      within(dialog).getByText('catechists.permanentDelete.confirm'),
    )

    await waitFor(() => {
      expect(permanentDeleteMock).toHaveBeenCalledWith({
        requesterId: 'catechist-admin',
        catechistId: 'catechist-1',
      })
    })
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('catechists.permanentDeleted')
    })
  })

  test('cancelling Permanently Delete closes the dialog without calling the mutation', async () => {
    renderPage()
    fireEvent.click(screen.getByText('catechists.showDeleted'))
    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    const permDeleteItem = await screen.findByText(
      'catechists.permanentDelete.action',
    )
    fireEvent.click(permDeleteItem)

    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByText('common.cancel'))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(permanentDeleteMock).not.toHaveBeenCalled()
  })
})
