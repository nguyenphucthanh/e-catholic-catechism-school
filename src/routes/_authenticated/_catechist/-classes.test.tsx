import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Route } from './classes'
import { useAuth } from '~/lib/auth'

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: () => ({ selectedYearId: 'ay-1' }),
}))

const softDeleteMock = vi.fn()

const mockClasses = [
  {
    _id: 'class-1',
    branchId: 'branch-1',
    name: 'Ấu Nhi 1',
    classType: 'regular',
    studentCount: 3,
    isDeleted: false,
  },
]

function mockQueries() {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'classes:list') return mockClasses
    if (path === 'branches:list')
      return [{ _id: 'branch-1', name: 'Ấu Nhi', sortOrder: 1 }]
    return undefined
  })
  vi.mocked(useMutation).mockImplementation(((fnRef: any) => {
    const path = fnRef?.[Symbol.for('functionName')]
    if (path === 'classes:softDelete') return softDeleteMock
    return vi.fn()
  }) as any)
}

function mockAuth() {
  vi.mocked(useAuth).mockReturnValue({
    login: vi.fn(),
    logout: vi.fn(),
    user: {
      userDocId: 'catechist-admin',
      loginId: 'CAT-ADMIN',
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

async function openDeleteDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
  fireEvent.click(await screen.findByText('common.delete'))
  await screen.findByRole('alertdialog')
}

describe('ClassesPage delete flow', () => {
  beforeEach(() => {
    mockQueries()
    mockAuth()
    softDeleteMock.mockReset().mockResolvedValue(undefined)
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  test('confirming delete calls the mutation, shows a success toast and closes the dialog', async () => {
    renderPage()
    await openDeleteDialog()
    fireEvent.click(screen.getByText('classes.delete.confirm'))

    await waitFor(() => {
      expect(softDeleteMock).toHaveBeenCalledWith({
        requesterId: 'catechist-admin',
        classId: 'class-1',
      })
    })
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('classes.deleted')
    })
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })

  test('a blocked delete shows the reason inside the dialog instead of a toast', async () => {
    softDeleteMock.mockRejectedValue(new Error('CLASS_HAS_ACTIVE_ENROLLMENTS'))
    renderPage()
    await openDeleteDialog()
    fireEvent.click(screen.getByText('classes.delete.confirm'))

    expect(
      await screen.findByText('classes.deleteInUseError'),
    ).toBeInTheDocument()
    expect(screen.getByText('classes.delete.failedTitle')).toBeInTheDocument()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.queryByText('classes.delete.confirm')).not.toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
  })

  test('past-year history error is shown in the dialog and "Got it" dismisses it', async () => {
    softDeleteMock.mockRejectedValue(new Error('CLASS_HAS_PAST_YEAR_HISTORY'))
    renderPage()
    await openDeleteDialog()
    fireEvent.click(screen.getByText('classes.delete.confirm'))

    expect(
      await screen.findByText('classes.deleteHistoryError'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByText('common.gotIt'))
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })

  test('reopening the dialog after a failure shows the confirm prompt again', async () => {
    softDeleteMock.mockRejectedValueOnce(
      new Error('CLASS_HAS_ACTIVE_ENROLLMENTS'),
    )
    renderPage()
    await openDeleteDialog()
    fireEvent.click(screen.getByText('classes.delete.confirm'))
    await screen.findByText('classes.deleteInUseError')
    fireEvent.click(screen.getByText('common.gotIt'))
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    await openDeleteDialog()
    expect(screen.getByText('classes.delete.title')).toBeInTheDocument()
    expect(screen.getByText('classes.delete.confirm')).toBeInTheDocument()
    expect(
      screen.queryByText('classes.deleteInUseError'),
    ).not.toBeInTheDocument()
  })

  test('an unknown error falls back to the generic delete error inside the dialog', async () => {
    softDeleteMock.mockRejectedValue(new Error('something odd'))
    renderPage()
    await openDeleteDialog()
    fireEvent.click(screen.getByText('classes.delete.confirm'))

    expect(await screen.findByText('classes.deleteError')).toBeInTheDocument()
    expect(screen.getByText('classes.delete.failedTitle')).toBeInTheDocument()
    expect(screen.getByText('common.gotIt')).toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  test('cancelling the confirm prompt does not call the mutation', async () => {
    renderPage()
    await openDeleteDialog()
    fireEvent.click(screen.getByText('common.cancel'))

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
    expect(softDeleteMock).not.toHaveBeenCalled()
  })
})
