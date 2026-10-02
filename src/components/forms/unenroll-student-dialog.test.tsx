import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { UnenrollStudentDialog } from './unenroll-student-dialog'
import type { Id } from '../../../convex/_generated/dataModel'

const requesterId = 'catechist1' as Id<'catechists'>
const studentClassId = 'sc1' as Id<'studentClasses'>

describe('UnenrollStudentDialog', () => {
  const onOpenChange = vi.fn()
  const onSuccess = vi.fn()
  let updateStatus: ReturnType<typeof vi.fn>

  function renderDialog(
    props: Partial<React.ComponentProps<typeof UnenrollStudentDialog>> = {},
  ) {
    return render(
      <UnenrollStudentDialog
        isOpen
        onOpenChange={onOpenChange}
        requesterId={requesterId}
        studentClassId={studentClassId}
        studentName="Peter Nguyen Van A"
        className="Au Nhi 1"
        onSuccess={onSuccess}
        {...props}
      />,
    )
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-02T10:00:00Z'))
    updateStatus = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReset()
    vi.mocked(useMutation).mockReturnValue(updateStatus as any)
    onOpenChange.mockClear()
    onSuccess.mockClear()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('does not render the dialog when isOpen is false', () => {
    renderDialog({ isOpen: false })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  test('renders title, description and action buttons when open', () => {
    renderDialog()

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(
      screen.getByText('classes.enrollment.remove.title'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('classes.enrollment.remove.description'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'common.cancel' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'classes.enrollment.remove.confirm' }),
    ).toBeInTheDocument()
  })

  test("withdraws the enrollment with today's date, toasts, closes and calls onSuccess", async () => {
    renderDialog()

    fireEvent.click(
      screen.getByRole('button', { name: 'classes.enrollment.remove.confirm' }),
    )

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(updateStatus).toHaveBeenCalledTimes(1)
    expect(updateStatus).toHaveBeenCalledWith({
      requesterId,
      studentClassIds: [studentClassId],
      status: 'withdrawn',
      statusChangedDate: '2026-10-02',
    })
    expect(toast.success).toHaveBeenCalledWith(
      'classes.enrollment.remove.success',
    )
    expect(toast.error).not.toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  test('does not require onSuccess', async () => {
    renderDialog({ onSuccess: undefined })

    fireEvent.click(
      screen.getByRole('button', { name: 'classes.enrollment.remove.confirm' }),
    )

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  test('does nothing on confirm when no student is targeted', async () => {
    renderDialog({ studentClassId: null })

    fireEvent.click(
      screen.getByRole('button', { name: 'classes.enrollment.remove.confirm' }),
    )

    await act(async () => {})
    expect(updateStatus).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  test('shows an error toast and stays open when the mutation throws', async () => {
    updateStatus.mockRejectedValue(new Error('boom'))
    renderDialog()

    fireEvent.click(
      screen.getByRole('button', { name: 'classes.enrollment.remove.confirm' }),
    )

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'classes.enrollment.remove.error',
      ),
    )
    expect(toast.success).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(onSuccess).not.toHaveBeenCalled()
    // Buttons re-enabled so the user can retry
    expect(
      screen.getByRole('button', { name: 'classes.enrollment.remove.confirm' }),
    ).not.toBeDisabled()
  })

  test('disables both buttons while the request is in flight', async () => {
    let resolve!: () => void
    updateStatus.mockReturnValue(
      new Promise<void>((r) => {
        resolve = r
      }),
    )
    renderDialog()

    fireEvent.click(
      screen.getByRole('button', { name: 'classes.enrollment.remove.confirm' }),
    )

    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: 'classes.enrollment.remove.confirm',
        }),
      ).toBeDisabled(),
    )
    expect(screen.getByRole('button', { name: 'common.cancel' })).toBeDisabled()

    resolve()
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  test('closes via onOpenChange when Cancel is clicked without calling the mutation', async () => {
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalled())
    expect(onOpenChange.mock.calls[0][0]).toBe(false)
    expect(updateStatus).not.toHaveBeenCalled()
  })
})
