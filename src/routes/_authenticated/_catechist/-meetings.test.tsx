import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Route } from './meetings'
import { useAuth } from '~/lib/auth'

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: () => ({ selectedYearId: 'ay-1' }),
}))

const cancelMock = vi.fn()
const deleteMock = vi.fn()

const mk = (over: Record<string, unknown>) => ({
  _id: 'm-1',
  title: 'Họp toàn xứ',
  meetingDate: '2024-10-07',
  scope: 'all',
  branchName: null,
  location: 'Hall',
  isCancelled: false,
  canManage: true,
  canRecord: true,
  ...over,
})

let meetings: Array<unknown> | undefined
let perms: unknown

function setup() {
  vi.mocked(useQuery).mockImplementation(((ref: any, args?: any) => {
    const path = ref?.[Symbol.for('functionName')]
    if (path === 'catechistMeetings:listMeetings')
      return args === 'skip' ? undefined : meetings
    if (path === 'catechistPermissions:getPermissions')
      return args === 'skip' ? undefined : perms
    return undefined
  }) as any)
  vi.mocked(useMutation).mockImplementation(((ref: any) => {
    const path = ref?.[Symbol.for('functionName')]
    if (path === 'catechistMeetings:cancelMeeting') return cancelMock
    if (path === 'catechistMeetings:softDeleteMeeting') return deleteMock
    return vi.fn()
  }) as any)
}

function renderPage() {
  const Component = (Route as any).options.component
  return render(<Component />)
}

const openActions = () =>
  fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))

describe('MeetingsPage', () => {
  beforeEach(() => {
    meetings = [mk({})]
    perms = { isAdmin: true, isBoardMember: false }
    cancelMock.mockReset().mockResolvedValue(null)
    deleteMock.mockReset().mockResolvedValue(null)
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        userDocId: 'cat-1',
        accountType: 'catechist',
        role: 'admin',
      } as any,
    })
    setup()
  })

  test('renders header, title link and location', () => {
    renderPage()
    expect(screen.getByText('meetings.subtitle')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Họp toàn xứ' })
    expect(link).toHaveAttribute('href', '/meetings/$id')
    expect(screen.getByText('Hall')).toBeInTheDocument()
    expect(screen.getByText('meetings.scope.all')).toBeInTheDocument()
  })

  test('shows scope badges for branch and a cancelled badge', () => {
    meetings = [
      mk({
        _id: 'm-2',
        title: 'Branch',
        scope: 'branch',
        branchName: 'Ấu Nhi',
      }),
      mk({ _id: 'm-3', title: 'Cancelled', isCancelled: true }),
      mk({ _id: 'm-4', title: 'Board', scope: 'board' }),
    ]
    renderPage()
    expect(screen.getByText('meetings.scope.branchNamed')).toBeInTheDocument()
    expect(screen.getByText('meetings.scope.board')).toBeInTheDocument()
    expect(screen.getAllByText('meetings.cancelledBadge')).toHaveLength(1)
  })

  test('search filters rows by title', async () => {
    meetings = [mk({}), mk({ _id: 'm-2', title: 'Họp Ban Điều Hành' })]
    renderPage()
    fireEvent.change(
      screen.getByPlaceholderText('meetings.searchPlaceholder'),
      {
        target: { value: 'Điều' },
      },
    )
    await waitFor(() =>
      expect(screen.queryByText('Họp toàn xứ')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Họp Ban Điều Hành')).toBeInTheDocument()
  })

  test.each([
    ['admin', { isAdmin: true, isBoardMember: false }, true],
    ['board member', { isAdmin: false, isBoardMember: true }, true],
    ['other catechist', { isAdmin: false, isBoardMember: false }, false],
    ['loading permissions', undefined, false],
  ])('create button for %s: %s', (_n, p, visible) => {
    perms = p
    renderPage()
    const btn = screen.queryByText('meetings.actions.create')
    if (visible) {
      expect(btn).toBeInTheDocument()
      expect(btn!.closest('a')).toHaveAttribute('href', '/meetings/create')
    } else {
      expect(btn).not.toBeInTheDocument()
    }
  })

  test('manager sees view, attendance, edit, cancel and delete actions', async () => {
    renderPage()
    openActions()
    await screen.findByText('common.view')
    expect(
      screen.getByText('meetings.takeAttendance').closest('a'),
    ).toHaveAttribute('href', '/attendance/catechists')
    expect(screen.getByText('common.edit')).toBeInTheDocument()
    expect(screen.getByText('meetings.cancel.action')).toBeInTheDocument()
    expect(screen.getByText('common.delete')).toBeInTheDocument()
  })

  test('non-manager only sees view (and attendance when allowed)', async () => {
    meetings = [mk({ canManage: false, canRecord: false })]
    renderPage()
    openActions()
    await screen.findByText('common.view')
    expect(
      screen.queryByText('meetings.takeAttendance'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('common.edit')).not.toBeInTheDocument()
    expect(screen.queryByText('common.delete')).not.toBeInTheDocument()
  })

  test('cancelled meetings hide the attendance and cancel actions', async () => {
    meetings = [mk({ isCancelled: true })]
    renderPage()
    openActions()
    await screen.findByText('common.view')
    expect(
      screen.queryByText('meetings.takeAttendance'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('meetings.cancel.action')).not.toBeInTheDocument()
    expect(screen.getByText('common.delete')).toBeInTheDocument()
  })

  test('cancel action calls the mutation and toasts', async () => {
    renderPage()
    openActions()
    fireEvent.click(await screen.findByText('meetings.cancel.action'))
    await waitFor(() =>
      expect(cancelMock).toHaveBeenCalledWith({
        meetingId: 'm-1',
      }),
    )
    expect(toast.success).toHaveBeenCalledWith('meetings.cancelled')
  })

  test('cancel failure shows a translated error toast', async () => {
    cancelMock.mockRejectedValue(
      new Error('CATECHIST_MEETING_INACTIVE_ACADEMIC_YEAR'),
    )
    renderPage()
    openActions()
    fireEvent.click(await screen.findByText('meetings.cancel.action'))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('meetings.errors.inactiveYear'),
    )
    expect(toast.success).not.toHaveBeenCalled()
  })

  test('delete opens the confirm dialog; confirming soft-deletes', async () => {
    renderPage()
    openActions()
    fireEvent.click(await screen.findByText('common.delete'))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByText('common.delete'))
    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith({
        meetingId: 'm-1',
      }),
    )
  })

  test('closing the delete dialog does not delete', async () => {
    renderPage()
    openActions()
    fireEvent.click(await screen.findByText('common.delete'))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByText('common.cancel'))
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    )
    expect(deleteMock).not.toHaveBeenCalled()
  })
})
