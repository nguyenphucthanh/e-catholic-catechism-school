import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScanDialog } from './scan-dialog'
import type { ScanFeedback } from './use-scan-feedback'

let scannerProps: { active: boolean; onScan: (c: string) => void } | undefined
vi.mock('~/components/custom/qr-scanner', () => ({
  QRScanner: (p: { active: boolean; onScan: (c: string) => void }) => {
    scannerProps = p
    return <div data-testid="qr-scanner" />
  },
}))

const onScan = vi.fn()
const onOpenChange = vi.fn()

function renderDialog(
  feedback: ScanFeedback | null,
  extra: Partial<Parameters<typeof ScanDialog>[0]> = {},
) {
  return render(
    <ScanDialog
      open
      onOpenChange={onOpenChange}
      active
      onScan={onScan}
      feedback={feedback}
      unknownLabelKey="my.unknown.key"
      {...extra}
    />,
  )
}

describe('ScanDialog', () => {
  beforeEach(() => {
    scannerProps = undefined
    onScan.mockReset()
  })

  it('renders the title and passes active/onScan to the scanner', () => {
    renderDialog(null)
    expect(
      screen.getAllByText('attendance.createSession.scanStart').length,
    ).toBeGreaterThan(0)
    expect(scannerProps?.active).toBe(true)
    scannerProps?.onScan('x')
    expect(onScan).toHaveBeenCalledWith('x')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    renderDialog(null, { open: false })
    expect(screen.queryByTestId('qr-scanner')).not.toBeInTheDocument()
  })

  it('forwards active=false', () => {
    renderDialog(null, { active: false })
    expect(scannerProps?.active).toBe(false)
  })

  it('success pill: green with name and success label', () => {
    renderDialog({ status: 'success', name: 'An' })
    const pill = screen.getByRole('status')
    expect(pill).toHaveTextContent('An — attendance.scanning.overlay.success')
    expect(pill).toHaveClass('bg-emerald-600')
  })

  it('duplicate pill: amber with duplicate label', () => {
    renderDialog({ status: 'duplicate', name: 'Binh' })
    const pill = screen.getByRole('status')
    expect(pill).toHaveTextContent(
      'Binh — attendance.scanning.overlay.duplicate',
    )
    expect(pill).toHaveClass('bg-amber-500')
  })

  it('unknown pill: red and shows the unknown label key only', () => {
    renderDialog({ status: 'unknown', name: 'ignored' })
    const pill = screen.getByRole('status')
    expect(pill).toHaveTextContent('my.unknown.key')
    expect(pill).not.toHaveTextContent('ignored')
    expect(pill).toHaveClass('bg-red-600')
  })
})
