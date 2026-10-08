import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { toast } from 'sonner'
import { AttendancePointConfigDialog } from './attendance-point-config-dialog'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('AttendancePointConfigDialog', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnSave = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders dialog when isOpen is true with inherit global option', () => {
    render(
      <AttendancePointConfigDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        currentConfig={undefined}
        globalConfig={{ mode: 'rate' }}
        onSave={mockOnSave}
      />,
    )

    expect(
      screen.getByText('attendance.summary.configDialogTitle'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('attendance.summary.inheritGlobal'),
    ).toBeInTheDocument()
  })

  test('submitting with custom toggle disabled saves undefined to revert to global', async () => {
    mockOnSave.mockResolvedValue(undefined)

    render(
      <AttendancePointConfigDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        currentConfig={{
          mode: 'type',
          present: 10,
          late: 8,
          excused: 0,
          absentUnset: -1,
        }}
        globalConfig={{ mode: 'rate' }}
        onSave={mockOnSave}
      />,
    )

    // Current config is custom, so toggle is checked initially. Turn off toggle:
    const toggle = screen.getByRole('switch')
    expect(toggle).toBeChecked()
    fireEvent.click(toggle)
    expect(toggle).not.toBeChecked()

    const saveBtn = screen.getByRole('button', { name: 'common.save' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(undefined)
      expect(toast.success).toHaveBeenCalledWith(
        'attendance.summary.configSuccess',
      )
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })

  test('enables custom rule, switches to point per type and saves custom config', async () => {
    mockOnSave.mockResolvedValue(undefined)

    render(
      <AttendancePointConfigDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        currentConfig={undefined}
        globalConfig={{ mode: 'rate' }}
        onSave={mockOnSave}
      />,
    )

    // Enable custom rule
    const toggle = screen.getByRole('switch')
    fireEvent.click(toggle)

    // Switch to point per type
    const pointPerTypeRadio = screen.getByRole('radio', {
      name: 'appConfig.fields.attendancePoint.modeType',
    })
    fireEvent.click(pointPerTypeRadio)

    // Check number inputs rendered
    const presentInput = screen.getByLabelText(
      'appConfig.fields.attendancePoint.present',
    )
    const lateInput = screen.getByLabelText(
      'appConfig.fields.attendancePoint.late',
    )
    const excusedInput = screen.getByLabelText(
      'appConfig.fields.attendancePoint.excused',
    )
    const absentUnsetInput = screen.getByLabelText(
      'appConfig.fields.attendancePoint.absentUnset',
    )

    expect(presentInput).toHaveValue(10)
    expect(lateInput).toHaveValue(9)
    expect(excusedInput).toHaveValue(0)
    expect(absentUnsetInput).toHaveValue(-0.5)

    fireEvent.change(lateInput, { target: { value: '8.5' } })

    const saveBtn = screen.getByRole('button', { name: 'common.save' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        mode: 'type',
        present: 10,
        late: 8.5,
        excused: 0,
        absentUnset: -0.5,
      })
      expect(toast.success).toHaveBeenCalledWith(
        'attendance.summary.configSuccess',
      )
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })

  test('handles save failure with error toast', async () => {
    mockOnSave.mockRejectedValue(new Error('Network failure'))

    render(
      <AttendancePointConfigDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        currentConfig={undefined}
        globalConfig={{ mode: 'rate' }}
        onSave={mockOnSave}
      />,
    )

    const saveBtn = screen.getByRole('button', { name: 'common.save' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('attendance.summary.configError')
    })
  })

  test('cancel button closes dialog', () => {
    render(
      <AttendancePointConfigDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        currentConfig={undefined}
        globalConfig={{ mode: 'rate' }}
        onSave={mockOnSave}
      />,
    )

    const cancelBtn = screen.getByRole('button', { name: 'common.cancel' })
    fireEvent.click(cancelBtn)

    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })
})
