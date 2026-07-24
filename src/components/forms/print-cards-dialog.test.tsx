import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useQuery } from 'convex/react'
import { PrintCardsDialog } from './print-cards-dialog'
import type { Id } from '../../../convex/_generated/dataModel'
import * as qrCardPdf from '~/lib/export/qr-card-pdf'

vi.mock('~/lib/export/qr-card-pdf', () => ({
  exportQrCardsPdf: vi.fn(),
}))

// Mock Dialog to render inline
vi.mock('~/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) =>
    open ? <div data-testid="mock-dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => (
    <div data-testid="mock-dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}))

// Mock ScrollArea
vi.mock('~/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => (
    <div data-testid="mock-scroll-area">{children}</div>
  ),
}))

describe('PrintCardsDialog', () => {
  const mockOnOpenChange = vi.fn()

  const mockStudents = [
    {
      _id: 's1' as Id<'students'>,
      studentCode: 'HS001',
      fullName: 'Nguyen Van A',
      saintName: 'Giuse',
    },
    {
      _id: 's2' as Id<'students'>,
      studentCode: 'HS002',
      fullName: 'Le Thi B',
      saintName: 'Maria',
    },
  ]

  beforeEach(() => {
    vi.mocked(useQuery).mockReturnValue({
      parishName: 'Giáo Xứ Thái Hà',
      troopName: 'Đoàn TNTT Anrê Phú Yên',
      nameFormat: 'lastName_firstName',
    } as any)
    mockOnOpenChange.mockClear()
    vi.mocked(qrCardPdf.exportQrCardsPdf).mockClear()
  })

  test('does not render when isOpen is false', () => {
    render(
      <PrintCardsDialog
        isOpen={false}
        onOpenChange={mockOnOpenChange}
        title="Au Nhi 1"
        students={mockStudents}
        filename="au-nhi-1-cards.pdf"
      />,
    )
    expect(screen.queryByTestId('mock-dialog')).toBeNull()
  })

  test('renders the student list', () => {
    render(
      <PrintCardsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        title="Au Nhi 1"
        students={mockStudents}
        filename="au-nhi-1-cards.pdf"
      />,
    )

    expect(screen.getByText(/Giuse Nguyen Van A/)).toBeInTheDocument()
    expect(screen.getByText(/Maria Le Thi B/)).toBeInTheDocument()
  })

  test('shows an error toast when submitting with no student selected', async () => {
    const { toast } = await import('sonner')
    render(
      <PrintCardsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        title="Au Nhi 1"
        students={mockStudents}
        filename="au-nhi-1-cards.pdf"
      />,
    )

    fireEvent.click(screen.getByText('printCards.submit'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'classes.sacraments.bulkUpdate.noStudentsSelected',
      )
    })
    expect(qrCardPdf.exportQrCardsPdf).not.toHaveBeenCalled()
  })

  test('selecting students and submitting exports a PDF for the selected students only', async () => {
    render(
      <PrintCardsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        title="Au Nhi 1"
        students={mockStudents}
        filename="au-nhi-1-cards.pdf"
      />,
    )

    fireEvent.click(screen.getByText('Giuse Nguyen Van A'))
    fireEvent.click(screen.getByText('printCards.submit'))

    await waitFor(() => {
      expect(qrCardPdf.exportQrCardsPdf).toHaveBeenCalledWith(
        [
          {
            studentCode: 'HS001',
            fullName: 'Nguyen Van A',
            saintName: 'Giuse',
          },
        ],
        {
          troopName: 'Đoàn TNTT Anrê Phú Yên',
          parishName: 'Giáo Xứ Thái Hà',
          studentCodeLabel: 'printCards.studentCodeLabel',
        },
        'au-nhi-1-cards.pdf',
      )
    })
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  test('select-all toggles every student', async () => {
    render(
      <PrintCardsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        title="Au Nhi 1"
        students={mockStudents}
        filename="au-nhi-1-cards.pdf"
      />,
    )

    fireEvent.click(screen.getByText('classes.sacraments.bulkUpdate.selectAll'))
    fireEvent.click(screen.getByText('printCards.submit'))

    await waitFor(() => {
      expect(qrCardPdf.exportQrCardsPdf).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ studentCode: 'HS001' }),
          expect.objectContaining({ studentCode: 'HS002' }),
        ]),
        expect.anything(),
        'au-nhi-1-cards.pdf',
      )
    })
  })

  test('cancel button closes the dialog without exporting', () => {
    render(
      <PrintCardsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        title="Au Nhi 1"
        students={mockStudents}
        filename="au-nhi-1-cards.pdf"
      />,
    )

    fireEvent.click(screen.getByText('common.cancel'))

    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    expect(qrCardPdf.exportQrCardsPdf).not.toHaveBeenCalled()
  })

  test('sorts by first name when nameFormat is firstName_lastName', () => {
    vi.mocked(useQuery).mockReturnValue({
      parishName: 'Giáo Xứ Thái Hà',
      troopName: 'Đoàn TNTT Anrê Phú Yên',
      nameFormat: 'firstName_lastName',
    } as any)

    render(
      <PrintCardsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        title="Au Nhi 1"
        students={mockStudents}
        filename="au-nhi-1-cards.pdf"
      />,
    )

    // 'Le Thi B' should sort before 'Nguyen Van A' when comparing full names directly
    const names = screen
      .getAllByText(/Nguyen Van A|Le Thi B/)
      .map((el) => el.textContent)
    expect(names[0]).toMatch(/Le Thi B/)
    expect(names[1]).toMatch(/Nguyen Van A/)
  })

  test('clicking a selected student again deselects it', async () => {
    render(
      <PrintCardsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        title="Au Nhi 1"
        students={mockStudents}
        filename="au-nhi-1-cards.pdf"
      />,
    )

    fireEvent.click(screen.getByText('Giuse Nguyen Van A'))
    fireEvent.click(screen.getByText('Giuse Nguyen Van A'))
    fireEvent.click(screen.getByText('printCards.submit'))

    const { toast } = await import('sonner')
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'classes.sacraments.bulkUpdate.noStudentsSelected',
      )
    })
    expect(qrCardPdf.exportQrCardsPdf).not.toHaveBeenCalled()
  })

  test('select-all toggles off when every student is already selected', async () => {
    render(
      <PrintCardsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        title="Au Nhi 1"
        students={mockStudents}
        filename="au-nhi-1-cards.pdf"
      />,
    )

    const selectAllLabel = screen.getByText(
      'classes.sacraments.bulkUpdate.selectAll',
    )
    fireEvent.click(selectAllLabel)
    fireEvent.click(selectAllLabel)
    fireEvent.click(screen.getByText('printCards.submit'))

    const { toast } = await import('sonner')
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'classes.sacraments.bulkUpdate.noStudentsSelected',
      )
    })
    expect(qrCardPdf.exportQrCardsPdf).not.toHaveBeenCalled()
  })

  test('shows empty state when there are no students', () => {
    render(
      <PrintCardsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        title="Au Nhi 1"
        students={[]}
        filename="au-nhi-1-cards.pdf"
      />,
    )

    expect(
      screen.getByText('classes.enrollment.noStudents'),
    ).toBeInTheDocument()
  })

  test('does nothing on submit when appConfig has not loaded yet', () => {
    vi.mocked(useQuery).mockReturnValue(undefined as any)

    render(
      <PrintCardsDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        title="Au Nhi 1"
        students={mockStudents}
        filename="au-nhi-1-cards.pdf"
      />,
    )

    fireEvent.click(screen.getByText('Giuse Nguyen Van A'))
    fireEvent.click(screen.getByText('printCards.submit'))

    expect(qrCardPdf.exportQrCardsPdf).not.toHaveBeenCalled()
    expect(mockOnOpenChange).not.toHaveBeenCalledWith(false)
  })
})
