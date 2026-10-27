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
import { Route } from './students'
import { useAuth } from '~/lib/auth'
import { exportQrCardsPdf } from '~/lib/export/qr-card-pdf'

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: () => ({ selectedYearId: 'ay-1' }),
}))

vi.mock('~/lib/export/qr-card-pdf', () => ({
  exportQrCardsPdf: vi.fn(),
}))

const restoreMock = vi.fn()
const permanentDeleteMock = vi.fn()
const softDeleteMock = vi.fn()

const mockRows = [
  {
    _id: 'student-1',
    studentCode: '1001',
    fullName: 'Nguyễn Văn B',
    saintName: 'Maria',
    gender: 'male',
    isActive: true,
    isDeleted: false,
    joinedClasses: [],
  },
]

function mockQueries() {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'academicYears:getActive') return { _id: 'ay-1' }
    if (path === 'branches:list') return []
    if (path === 'classes:list') return []
    if (path === 'classes:listClassYears') return []
    if (path === 'catechistPermissions:getPermissions')
      return { isAdmin: true, isBoardMember: false }
    if (path === 'appConfig:getAccountPrefixes')
      return { student: 'STD', catechist: 'CAT' }
    if (path === 'appConfig:get')
      return { troopName: 'Troop', parishName: 'Parish' }
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
    if (path === 'students:softDelete') return softDeleteMock
    if (path === 'students:restore') return restoreMock
    if (path === 'students:permanentDelete') return permanentDeleteMock
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

describe('StudentsPage', () => {
  beforeEach(() => {
    mockQueries()
    mockAuth('admin')
    restoreMock.mockReset().mockResolvedValue(undefined)
    permanentDeleteMock.mockReset().mockResolvedValue(undefined)
    softDeleteMock.mockReset().mockResolvedValue(undefined)
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  test('shows "Show deleted" toggle only for admin (canManage)', () => {
    renderPage()
    expect(screen.getByText('students.showDeleted')).toBeInTheDocument()
  })

  test('never renders the toggle for a non-admin requester', () => {
    mockAuth('user')
    renderPage()
    expect(screen.queryByText('students.showDeleted')).not.toBeInTheDocument()
    expect(screen.queryByText('students.showActive')).not.toBeInTheDocument()
  })

  test('toggling to deleted view hides Export/Create and swaps fullName to plain text', () => {
    renderPage()

    // Active view: fullName is a link, Export/Create buttons visible
    expect(
      screen.getByRole('link', { name: 'Nguyễn Văn B' }),
    ).toBeInTheDocument()
    expect(screen.getByText('students.export.csv')).toBeInTheDocument()
    expect(screen.getByText('students.actions.create')).toBeInTheDocument()

    fireEvent.click(screen.getByText('students.showDeleted'))

    expect(screen.getByText('students.showActive')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Nguyễn Văn B' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Nguyễn Văn B')).toBeInTheDocument()
    expect(screen.queryByText('students.export.csv')).not.toBeInTheDocument()
    expect(
      screen.queryByText('students.actions.create'),
    ).not.toBeInTheDocument()
  })

  test('deleted-view row actions show Restore and Permanently Delete instead of Edit/Delete', async () => {
    renderPage()
    fireEvent.click(screen.getByText('students.showDeleted'))

    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    await screen.findByText('students.restore')
    expect(
      screen.getByText('students.permanentDelete.action'),
    ).toBeInTheDocument()
    expect(screen.queryByText('common.edit')).not.toBeInTheDocument()
    expect(screen.queryByText('common.delete')).not.toBeInTheDocument()
  })

  test('clicking Restore fires the mutation immediately (no confirm dialog) and shows a success toast', async () => {
    renderPage()
    fireEvent.click(screen.getByText('students.showDeleted'))
    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    const restoreItem = await screen.findByText('students.restore')
    fireEvent.click(restoreItem)

    await waitFor(() => {
      expect(restoreMock).toHaveBeenCalledWith({
        studentId: 'student-1',
      })
    })
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('students.restored')
    })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  test('Restore failure shows an error toast via translateConvexError', async () => {
    restoreMock.mockRejectedValue(new Error('STUDENT_NOT_FOUND'))
    renderPage()
    fireEvent.click(screen.getByText('students.showDeleted'))
    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    const restoreItem = await screen.findByText('students.restore')
    fireEvent.click(restoreItem)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
    expect(toast.success).not.toHaveBeenCalled()
  })

  test('Permanently Delete opens a confirm dialog; confirming fires the mutation and shows a success toast', async () => {
    renderPage()
    fireEvent.click(screen.getByText('students.showDeleted'))
    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    const permDeleteItem = await screen.findByText(
      'students.permanentDelete.action',
    )
    fireEvent.click(permDeleteItem)

    const dialog = screen.getByRole('alertdialog')
    expect(
      within(dialog).getByText('students.permanentDelete.title'),
    ).toBeInTheDocument()

    fireEvent.click(
      within(dialog).getByText('students.permanentDelete.confirm'),
    )

    await waitFor(() => {
      expect(permanentDeleteMock).toHaveBeenCalledWith({
        studentId: 'student-1',
      })
    })
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('students.permanentDeleted')
    })
  })

  test('cancelling Permanently Delete closes the dialog without calling the mutation', async () => {
    renderPage()
    fireEvent.click(screen.getByText('students.showDeleted'))
    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    const permDeleteItem = await screen.findByText(
      'students.permanentDelete.action',
    )
    fireEvent.click(permDeleteItem)

    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByText('common.cancel'))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(permanentDeleteMock).not.toHaveBeenCalled()
  })

  describe('row print card action', () => {
    let queryMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      vi.mocked(exportQrCardsPdf).mockReset().mockResolvedValue(undefined)
      queryMock = vi.fn()
      vi.mocked(useConvex).mockReturnValue({ query: queryMock } as any)
    })

    async function clickPrint() {
      fireEvent.click(
        screen.getByRole('button', { name: 'common.moreActions' }),
      )
      fireEvent.click(await screen.findByText('printCards.singleAction'))
    }

    test('fetches the profile photo URL and passes it as photoUrl', async () => {
      queryMock.mockResolvedValue('https://example.com/photo.jpg')
      renderPage()
      await clickPrint()

      await waitFor(() => {
        expect(exportQrCardsPdf).toHaveBeenCalled()
      })
      const [fnRef, args] = queryMock.mock.calls[0]
      expect(fnRef[Symbol.for('functionName')]).toBe(
        'students:getProfilePhotoUrl',
      )
      expect(args).toEqual({ studentId: 'student-1' })
      expect(vi.mocked(exportQrCardsPdf).mock.calls[0][0]).toEqual([
        expect.objectContaining({
          studentCode: '1001',
          photoUrl: 'https://example.com/photo.jpg',
        }),
      ])
      expect(vi.mocked(exportQrCardsPdf).mock.calls[0][2]).toBe('1001-card.pdf')
    })

    test('still exports with photoUrl undefined when the query rejects', async () => {
      queryMock.mockRejectedValue(new Error('boom'))
      renderPage()
      await clickPrint()

      await waitFor(() => {
        expect(exportQrCardsPdf).toHaveBeenCalled()
      })
      expect(vi.mocked(exportQrCardsPdf).mock.calls[0][0]).toEqual([
        expect.objectContaining({ studentCode: '1001', photoUrl: undefined }),
      ])
    })
  })
})
