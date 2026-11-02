import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { toast } from 'sonner'
import { DefaultAttendanceStatusDialog } from './default-attendance-status-dialog'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('DefaultAttendanceStatusDialog', () => {
  const onOpenChange = vi.fn()
  const onSave = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderDialog = (
    props: Partial<Parameters<typeof DefaultAttendanceStatusDialog>[0]> = {},
  ) =>
    render(
      <DefaultAttendanceStatusDialog
        isOpen
        onOpenChange={onOpenChange}
        onSave={onSave}
        {...props}
      />,
    )

  test('without override: switch off, radios hidden, inherit text shown', () => {
    renderDialog({ globalStatus: 'late' })
    expect(screen.getByRole('switch')).not.toBeChecked()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(
      screen.getByText('attendance.summary.inheritGlobal'),
    ).toBeInTheDocument()
  })

  test('saving with switch off clears the override', async () => {
    onSave.mockResolvedValue(undefined)
    renderDialog({ currentStatus: 'late' })
    const toggle = screen.getByRole('switch')
    expect(toggle).toBeChecked()
    fireEvent.click(toggle)
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(undefined)
      expect(toast.success).toHaveBeenCalledWith(
        'attendance.createSession.defaultStatusSuccess',
      )
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  test('custom radios preselect the current status and save a new choice', async () => {
    onSave.mockResolvedValue(undefined)
    renderDialog({ currentStatus: 'late' })
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    expect(
      screen.getByRole('radio', { name: 'attendance.status.late' }),
    ).toBeChecked()
    fireEvent.click(
      screen.getByRole('radio', { name: 'attendance.status.excused_absence' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('excused_absence'))
  })

  test('enabling custom with no override starts from the global status', async () => {
    onSave.mockResolvedValue(undefined)
    renderDialog({ globalStatus: 'unexcused_absence' })
    fireEvent.click(screen.getByRole('switch'))
    expect(
      screen.getByRole('radio', {
        name: 'attendance.status.unexcused_absence',
      }),
    ).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith('unexcused_absence'),
    )
  })

  test('enabling custom with no override and no global falls back to present', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('switch'))
    expect(
      screen.getByRole('radio', { name: 'attendance.status.present' }),
    ).toBeChecked()
  })

  test('save failure shows error toast and keeps dialog open', async () => {
    onSave.mockRejectedValue(new Error('boom'))
    renderDialog({ currentStatus: 'present' })
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'attendance.createSession.defaultStatusError',
      ),
    )
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  test('cancel closes the dialog', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
