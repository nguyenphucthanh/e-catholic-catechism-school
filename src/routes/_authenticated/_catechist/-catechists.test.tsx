import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import {
  useConvex,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from 'convex/react'
import { toast } from 'sonner'
import { Route } from './catechists'
import { useAuth } from '~/lib/auth'
import { exportQrCardsPdf } from '~/lib/export/qr-card-pdf'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(() => 'toast-id'),
    dismiss: vi.fn(),
  },
}))

vi.mock('~/lib/export/qr-card-pdf', () => ({
  exportQrCardsPdf: vi.fn(),
}))

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
    if (path === 'appConfig:get')
      return { catechistTitles: ['Trợ tá'], troopName: 'T', parishName: 'P' }
    if (path === 'appConfig:getAccountPrefixes')
      return { student: 'STD', catechist: 'CAT' }
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

  test('title filter passes selected title to the list query', async () => {
    renderPage()
    fireEvent.click(
      screen.getByText('catechists.filters.anyTitle').closest('button')!,
    )
    const option = await screen.findByRole('option', {
      name: 'profile.personal.title.cha',
    })
    fireEvent.pointerDown(option)
    fireEvent.click(option)
    await waitFor(() => {
      const calls = vi.mocked(usePaginatedQuery).mock.calls
      expect((calls[calls.length - 1][1] as any).title).toBe('Cha')
    })
  })

  test('title filter lists custom titles from app config and passes them to the query', async () => {
    renderPage()
    fireEvent.click(
      screen.getByText('catechists.filters.anyTitle').closest('button')!,
    )
    const option = await screen.findByRole('option', { name: 'Trợ tá' })
    fireEvent.pointerDown(option)
    fireEvent.click(option)
    await waitFor(() => {
      const calls = vi.mocked(usePaginatedQuery).mock.calls
      expect((calls[calls.length - 1][1] as any).title).toBe('Trợ tá')
    })
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

  test.each([
    ['board member', { isBoardMember: true }, true, false],
    ['branch head', { isBranchHead: true }, false, true],
    ['both', { isBoardMember: true, isBranchHead: true }, true, true],
    ['neither', {}, false, false],
  ])('fullName cell badges: %s', (_n, flags, board, head) => {
    vi.mocked(usePaginatedQuery).mockReturnValue({
      results: [{ ...mockRows[0], ...flags }],
      isLoading: false,
      status: 'Exhausted',
      loadMore: vi.fn(),
    } as any)
    renderPage()
    expect(!!screen.queryByText('catechists.badge.boardMember')).toBe(board)
    expect(!!screen.queryByText('catechists.badge.branchHead')).toBe(head)
  })

  describe('bulk print QR cards', () => {
    let queryMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      vi.mocked(exportQrCardsPdf).mockReset().mockResolvedValue(undefined)
      vi.mocked(toast.info).mockClear()
      queryMock = vi.fn()
      vi.mocked(useConvex).mockReturnValue({ query: queryMock } as any)
    })

    async function openMenu() {
      fireEvent.click(screen.getByText('printCards.menuLabel'))
      await screen.findByText('printCards.allCatechists')
    }

    test('"all" queries listForQrCards and exports mapped items with a dated filename', async () => {
      queryMock.mockResolvedValue([
        {
          catechistId: 'c1',
          memberId: 'GLV0001',
          fullName: 'A',
          saintName: 'Giuse',
          photoUrl: null,
        },
        {
          catechistId: 'c2',
          memberId: 'GLV0002',
          fullName: 'B',
          photoUrl: 'https://x/p.jpg',
        },
      ])
      renderPage()
      await openMenu()
      fireEvent.click(screen.getByText('printCards.allCatechists'))

      await waitFor(() => expect(exportQrCardsPdf).toHaveBeenCalled())
      expect(queryMock.mock.calls[0][0][Symbol.for('functionName')]).toBe(
        'catechists:listForQrCards',
      )
      const [items, , filename] = vi.mocked(exportQrCardsPdf).mock.calls[0]
      expect(items).toEqual([
        {
          type: 'catechist',
          memberId: 'GLV0001',
          fullName: 'A',
          saintName: 'Giuse',
          photoUrl: undefined,
        },
        {
          type: 'catechist',
          memberId: 'GLV0002',
          fullName: 'B',
          saintName: undefined,
          photoUrl: 'https://x/p.jpg',
        },
      ])
      expect(filename).toMatch(/^catechists-cards-\d{4}-\d{2}-\d{2}\.pdf$/)
    })

    test('"all" with no catechists shows an info toast and does not export', async () => {
      queryMock.mockResolvedValue([])
      renderPage()
      await openMenu()
      fireEvent.click(screen.getByText('printCards.allCatechists'))

      await waitFor(() =>
        expect(toast.info).toHaveBeenCalledWith(
          'printCards.noCatechists',
          expect.anything(),
        ),
      )
      expect(exportQrCardsPdf).not.toHaveBeenCalled()
    })

    test('"selected" is disabled until a row is ticked, then exports with photo URLs', async () => {
      queryMock.mockResolvedValue('https://x/p.jpg')
      renderPage()
      await openMenu()
      expect(screen.getByText('printCards.selectedCatechists')).toHaveAttribute(
        'aria-disabled',
        'true',
      )
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: 'Escape',
      })

      fireEvent.click(
        screen.getByRole('checkbox', { name: 'common.selectRow' }),
      )
      await openMenu()
      fireEvent.click(screen.getByText('printCards.selectedCatechists'))

      await waitFor(() => expect(exportQrCardsPdf).toHaveBeenCalled())
      expect(queryMock.mock.calls[0][0][Symbol.for('functionName')]).toBe(
        'catechists:getProfilePhotoUrl',
      )
      expect(queryMock.mock.calls[0][1]).toEqual({ catechistId: 'catechist-1' })
      expect(vi.mocked(exportQrCardsPdf).mock.calls[0][0]).toEqual([
        expect.objectContaining({
          type: 'catechist',
          memberId: 'GLV0001',
          photoUrl: 'https://x/p.jpg',
        }),
      ])
    })

    test('hides the checkbox column and print menu in the deleted view', () => {
      renderPage()
      expect(
        screen.getByRole('checkbox', { name: 'common.selectRow' }),
      ).toBeInTheDocument()

      fireEvent.click(screen.getByText('catechists.showDeleted'))

      expect(screen.queryByText('printCards.menuLabel')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('checkbox', { name: 'common.selectRow' }),
      ).not.toBeInTheDocument()
    })
  })
})
