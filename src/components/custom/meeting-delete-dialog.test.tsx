import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { MeetingDeleteDialog } from './meeting-delete-dialog'

const deleteMock = vi.fn()
const onClose = vi.fn()
const onDeleted = vi.fn()
const meeting = { _id: 'meet-1' as any, title: 'Họp T10' }

function renderDialog(m: typeof meeting | null = meeting, withCb = true) {
  return render(
    <MeetingDeleteDialog
      requesterId={'cat-1' as any}
      meeting={m}
      onClose={onClose}
      onDeleted={withCb ? onDeleted : undefined}
    />,
  )
}

describe('MeetingDeleteDialog', () => {
  beforeEach(() => {
    deleteMock.mockReset().mockResolvedValue(null)
    onClose.mockReset()
    onDeleted.mockReset()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    vi.mocked(useMutation).mockImplementation(((ref: any) =>
      ref?.[Symbol.for('functionName')] ===
      'catechistMeetings:softDeleteMeeting'
        ? deleteMock
        : vi.fn()) as any)
  })

  test('renders nothing while meeting is null', () => {
    renderDialog(null)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  test('shows the confirmation when a meeting is provided', () => {
    renderDialog()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('meetings.delete.title')).toBeInTheDocument()
  })

  test('confirming soft-deletes, toasts, closes and notifies', async () => {
    renderDialog()
    fireEvent.click(screen.getByText('common.delete'))
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1))
    expect(deleteMock).toHaveBeenCalledWith({
      requesterId: 'cat-1',
      meetingId: 'meet-1',
    })
    expect(toast.success).toHaveBeenCalledWith('meetings.deleted')
    expect(onClose).toHaveBeenCalled()
  })

  test('works without an onDeleted callback', async () => {
    renderDialog(meeting, false)
    fireEvent.click(screen.getByText('common.delete'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalledWith('meetings.deleted')
  })

  test('failure shows an error toast and does not notify', async () => {
    deleteMock.mockRejectedValue(new Error('CATECHIST_MEETING_NOT_FOUND'))
    renderDialog()
    fireEvent.click(screen.getByText('common.delete'))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('meetings.errors.notFound'),
    )
    expect(toast.success).not.toHaveBeenCalled()
    expect(onDeleted).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  test('cancel closes without deleting', async () => {
    renderDialog()
    fireEvent.click(screen.getByText('common.cancel'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(deleteMock).not.toHaveBeenCalled()
  })
})
