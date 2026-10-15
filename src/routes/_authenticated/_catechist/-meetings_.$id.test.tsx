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
import { Route } from './meetings_.$id'
import { useAuth } from '~/lib/auth'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn(() => (options: any) => ({ options })),
  useParams: () => ({ id: 'm-1' }),
  useNavigate: () => navigateMock,
  Link: ({ to, search, children, ...props }: any) => (
    <a
      href={to}
      data-search={search ? JSON.stringify(search) : undefined}
      {...props}
    >
      {children}
    </a>
  ),
}))

const cancelMock = vi.fn()
const deleteMock = vi.fn()

const base = {
  _id: 'm-1',
  title: 'Họp T10',
  meetingDate: '2024-10-07',
  scope: 'branch',
  branchName: 'Ấu Nhi',
  startTime: '09:00',
  endTime: '10:00',
  location: 'Hall',
  notes: 'Bring files',
  isCancelled: false,
  canManage: true,
  canRecord: true,
}

let meeting: unknown

function renderPage() {
  const Component = (Route as any).options.component
  return render(<Component />)
}

describe('MeetingDetailPage', () => {
  beforeEach(() => {
    meeting = base
    cancelMock.mockReset().mockResolvedValue(null)
    deleteMock.mockReset().mockResolvedValue(null)
    navigateMock.mockReset()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { userDocId: 'cat-1', accountType: 'catechist' } as any,
    })
    vi.mocked(useQuery).mockImplementation(((ref: any, args?: any) =>
      ref?.[Symbol.for('functionName')] === 'catechistMeetings:getMeeting' &&
      args !== 'skip'
        ? meeting
        : undefined) as any)
    vi.mocked(useMutation).mockImplementation(((ref: any) => {
      const path = ref?.[Symbol.for('functionName')]
      if (path === 'catechistMeetings:cancelMeeting') return cancelMock
      if (path === 'catechistMeetings:softDeleteMeeting') return deleteMock
      return vi.fn()
    }) as any)
  })

  test('renders details with time range, location, scope and notes', () => {
    renderPage()
    expect(screen.getByText('Họp T10')).toBeInTheDocument()
    expect(screen.getByText('09:00 - 10:00')).toBeInTheDocument()
    expect(screen.getByText('Hall')).toBeInTheDocument()
    expect(screen.getByText('Bring files')).toBeInTheDocument()
    expect(screen.getByText('meetings.scope.branchNamed')).toBeInTheDocument()
  })

  test('shows dashes for missing optional fields and start-only time', () => {
    meeting = {
      ...base,
      endTime: undefined,
      location: undefined,
      notes: undefined,
    }
    renderPage()
    expect(screen.getByText('09:00')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  test('shows dash for time when there is no start time', () => {
    meeting = { ...base, startTime: undefined, endTime: undefined }
    renderPage()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })

  test('shows a skeleton while loading and a not-found card for null', () => {
    meeting = undefined
    const { unmount } = renderPage()
    expect(screen.queryByText('meetings.detail.info')).not.toBeInTheDocument()
    expect(screen.queryByText('meetings.notFound')).not.toBeInTheDocument()
    unmount()
    meeting = null
    renderPage()
    expect(screen.getByText('meetings.notFound')).toBeInTheDocument()
  })

  test('attendance link deep-links to the meeting', () => {
    renderPage()
    const link = screen.getByText('meetings.takeAttendance').closest('a')!
    expect(link).toHaveAttribute('href', '/attendance/catechists')
    expect(JSON.parse(link.dataset.search!)).toEqual({
      category: 'meeting',
      date: '2024-10-07',
      meetingId: 'm-1',
    })
  })

  test('managers see edit, cancel and delete', () => {
    renderPage()
    expect(screen.getByText('common.edit').closest('a')).toHaveAttribute(
      'href',
      '/meetings/$id/edit',
    )
    expect(screen.getByText('meetings.cancel.action')).toBeInTheDocument()
    expect(screen.getByText('common.delete')).toBeInTheDocument()
  })

  test('non-manager without record permission sees no actions', () => {
    meeting = { ...base, canManage: false, canRecord: false }
    renderPage()
    expect(
      screen.queryByText('meetings.takeAttendance'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('common.edit')).not.toBeInTheDocument()
    expect(screen.queryByText('meetings.cancel.action')).not.toBeInTheDocument()
    expect(screen.queryByText('common.delete')).not.toBeInTheDocument()
  })

  test('cancelled meeting hides attendance and cancel and shows the badge', () => {
    meeting = { ...base, isCancelled: true }
    renderPage()
    expect(screen.getByText('meetings.cancelledBadge')).toBeInTheDocument()
    expect(
      screen.queryByText('meetings.takeAttendance'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('meetings.cancel.action')).not.toBeInTheDocument()
    expect(screen.getByText('common.delete')).toBeInTheDocument()
  })

  test('cancel asks for confirmation, then cancels', async () => {
    renderPage()
    fireEvent.click(screen.getByText('meetings.cancel.action'))
    const dialog = await screen.findByRole('alertdialog')
    expect(cancelMock).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByText('meetings.cancel.action'))
    await waitFor(() =>
      expect(cancelMock).toHaveBeenCalledWith({
        requesterId: 'cat-1',
        meetingId: 'm-1',
      }),
    )
    expect(toast.success).toHaveBeenCalledWith('meetings.cancelled')
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    )
  })

  test('cancel dialog back button does not cancel', async () => {
    renderPage()
    fireEvent.click(screen.getByText('meetings.cancel.action'))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByText('common.back'))
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    )
    expect(cancelMock).not.toHaveBeenCalled()
  })

  test('cancel failure toasts a translated error and closes the dialog', async () => {
    cancelMock.mockRejectedValue(new Error('CATECHIST_MEETING_NOT_FOUND'))
    renderPage()
    fireEvent.click(screen.getByText('meetings.cancel.action'))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByText('meetings.cancel.action'))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('meetings.errors.notFound'),
    )
    expect(toast.success).not.toHaveBeenCalled()
  })

  test('delete confirms, soft-deletes and navigates to the list', async () => {
    renderPage()
    fireEvent.click(screen.getByText('common.delete'))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByText('common.delete'))
    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith({
        requesterId: 'cat-1',
        meetingId: 'm-1',
      }),
    )
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({ to: '/meetings' }),
    )
  })

  test('closing the delete dialog does not delete or navigate', async () => {
    renderPage()
    fireEvent.click(screen.getByText('common.delete'))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByText('common.cancel'))
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    )
    expect(deleteMock).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
