import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { toast } from 'sonner'
import { useMutation, useQuery } from 'convex/react'
import { SacramentDetailDialog } from './sacrament-detail-dialog'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { formatDate } from '~/lib/locale'

vi.mock('~/lib/export/csv', () => ({
  exportCsv: vi.fn(),
}))

vi.mock('~/lib/export/pdf', () => ({
  exportPdf: vi.fn(),
}))

vi.mock('~/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, id }: any) => (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      data-testid={`checkbox-${id}`}
    />
  ),
}))

vi.mock('~/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, 'data-testid': testId }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid={testId}>
      {children}
    </button>
  ),
}))

// Mock Select as a native <select> — avoids BaseUI listbox interaction quirks,
// matches the pattern used in bulk-update-sacrament-dialog.test.tsx
vi.mock('~/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select
      data-testid="sacrament-type-select"
      value={value || ''}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
}))

// Mock Dialog to render inline (no portal) when open
vi.mock('~/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) =>
    open ? <div data-testid="mock-dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => (
    <div data-testid="mock-dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogFooter: ({ children }: any) => (
    <div data-testid="mock-dialog-footer">{children}</div>
  ),
}))

function makeStudent(
  overrides: Partial<Doc<'students'>> = {},
): Doc<'students'> {
  return {
    _id: 's1' as Id<'students'>,
    studentCode: 'HS001',
    fullName: 'Nguyen Van A',
    saintName: 'Giuse',
    isActive: true,
    isDeleted: false,
    createdAt: 123,
    ...overrides,
  } as Doc<'students'>
}

function getRow(studentCode: string): HTMLElement {
  return screen
    .getByText(new RegExp(studentCode))
    .closest('div.p-4') as HTMLElement
}

describe('SacramentDetailDialog', () => {
  const mockOnOpenChange = vi.fn()
  const requesterId = 'cat123' as Id<'catechists'>
  const classYearId = 'cy123' as Id<'classYears'>
  let mockUpdate: any

  const student1 = makeStudent({ _id: 's1' as Id<'students'> })
  const student2 = makeStudent({
    _id: 's2' as Id<'students'>,
    studentCode: 'HS002',
    fullName: 'Le Thi B',
    saintName: 'Maria',
  })

  const studentsProp = [
    {
      student: student1,
      sacramentDates: { confirmation: '2026-05-10', baptism: undefined },
    },
    {
      student: student2,
      sacramentDates: { confirmation: undefined, baptism: '2020-01-01' },
    },
    // Withdrawn/no-student row should be filtered out
    { student: null, sacramentDates: {} },
  ]

  beforeEach(() => {
    mockUpdate = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockUpdate)
    vi.mocked(useQuery).mockReturnValue(undefined)
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    mockOnOpenChange.mockClear()
  })

  test('does not render when isOpen is false', () => {
    render(
      <SacramentDetailDialog
        isOpen={false}
        onOpenChange={mockOnOpenChange}
        students={studentsProp}
        requesterId={requesterId}
        classYearId={classYearId}
      />,
    )
    expect(screen.queryByTestId('mock-dialog')).toBeNull()
    // Query should be skipped while closed
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), 'skip')
  })

  test('filters out rows without a student and renders only active students', () => {
    render(
      <SacramentDetailDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        students={studentsProp}
        requesterId={requesterId}
        classYearId={classYearId}
      />,
    )

    expect(screen.getByTestId('mock-dialog')).toBeInTheDocument()
    expect(screen.getByText(/Giuse Nguyen Van A/)).toBeInTheDocument()
    expect(screen.getByText(/Maria Le Thi B/)).toBeInTheDocument()
    // Count card title text includes "2"
    expect(screen.getByText(/^2/)).toBeInTheDocument()
  })

  test('shows empty state when no students have sacrament data', () => {
    render(
      <SacramentDetailDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        students={[{ student: null, sacramentDates: {} }]}
        requesterId={requesterId}
        classYearId={classYearId}
      />,
    )

    expect(
      screen.getByText('classes.sacraments.detail.noStudentsWithSacrament'),
    ).toBeInTheDocument()
  })

  test('shows received date for the selected sacrament type, and "not received" otherwise', () => {
    render(
      <SacramentDetailDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        students={studentsProp}
        requesterId={requesterId}
        classYearId={classYearId}
      />,
    )

    // Default sacramentType is 'confirmation'
    const row1 = getRow('HS001')
    expect(within(row1).getByText(formatDate('2026-05-10'))).toBeInTheDocument()

    const row2 = getRow('HS002')
    expect(
      within(row2).getByText('classes.sacraments.detail.notReceived'),
    ).toBeInTheDocument()
  })

  test('switching sacrament type updates the received-date display', () => {
    render(
      <SacramentDetailDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        students={studentsProp}
        requesterId={requesterId}
        classYearId={classYearId}
      />,
    )

    const select = screen.getByTestId('sacrament-type-select')
    fireEvent.change(select, { target: { value: 'baptism' } })

    const row1 = getRow('HS001')
    expect(
      within(row1).getByText('classes.sacraments.detail.notReceived'),
    ).toBeInTheDocument()

    const row2 = getRow('HS002')
    expect(within(row2).getByText(formatDate('2020-01-01'))).toBeInTheDocument()
  })

  test('prefills feastName/sponsorName/notes from existing sacrament data for the selected type', () => {
    vi.mocked(useQuery).mockReturnValue([
      {
        studentId: 's1',
        records: [
          {
            sacramentType: 'confirmation',
            feastName: 'Peter',
            sponsorName: 'John Doe',
            notes: 'Some notes',
          },
        ],
      },
    ])

    render(
      <SacramentDetailDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        students={studentsProp}
        requesterId={requesterId}
        classYearId={classYearId}
      />,
    )

    const row1 = getRow('HS001')
    const feastInput = within(row1).getByPlaceholderText(
      'students.form.sacrament.feastName.placeholder',
    )
    const sponsorInput = within(row1).getByPlaceholderText(
      'students.form.sacrament.sponsorName.placeholder',
    )
    const notesInput = within(row1)
      .getAllByRole('textbox')
      .find((el) => (el as HTMLInputElement).value === 'Some notes')

    expect(feastInput).toHaveValue('Peter')
    expect(sponsorInput).toHaveValue('John Doe')
    expect(notesInput).toHaveValue('Some notes')
  })

  test('editing a field then blurring saves via updateStudentSacramentDetails and shows success toast', async () => {
    render(
      <SacramentDetailDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        students={studentsProp}
        requesterId={requesterId}
        classYearId={classYearId}
      />,
    )

    const row1 = getRow('HS001')
    const feastNameInput = within(row1).getByPlaceholderText(
      'students.form.sacrament.feastName.placeholder',
    )

    fireEvent.change(feastNameInput, { target: { value: 'Phanxico' } })
    expect(feastNameInput).toHaveValue('Phanxico')

    fireEvent.blur(feastNameInput)

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        requesterId,
        studentId: 's1',
        sacramentType: 'confirmation',
        feastName: 'Phanxico',
      })
    })
    expect(toast.success).toHaveBeenCalledWith('common.saved')
  })

  test('blurring a field with an emptied value sends undefined for that field', async () => {
    vi.mocked(useQuery).mockReturnValue([
      {
        studentId: 's1',
        records: [
          {
            sacramentType: 'confirmation',
            feastName: 'Peter',
          },
        ],
      },
    ])

    render(
      <SacramentDetailDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        students={studentsProp}
        requesterId={requesterId}
        classYearId={classYearId}
      />,
    )

    const row1 = getRow('HS001')
    const feastNameInput = within(row1).getByPlaceholderText(
      'students.form.sacrament.feastName.placeholder',
    )

    fireEvent.change(feastNameInput, { target: { value: '' } })
    fireEvent.blur(feastNameInput)

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        requesterId,
        studentId: 's1',
        sacramentType: 'confirmation',
        feastName: undefined,
      })
    })
  })

  test('blurring a field that was never edited does not call the mutation', () => {
    render(
      <SacramentDetailDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        students={studentsProp}
        requesterId={requesterId}
        classYearId={classYearId}
      />,
    )

    const row1 = getRow('HS001')
    const feastNameInput = within(row1).getByPlaceholderText(
      'students.form.sacrament.feastName.placeholder',
    )

    // Blur without any prior change event
    fireEvent.blur(feastNameInput)

    expect(mockUpdate).not.toHaveBeenCalled()
  })

  test('shows an error toast when the save mutation rejects', async () => {
    mockUpdate.mockRejectedValue(new Error('SAVE_FAILED'))

    render(
      <SacramentDetailDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        students={studentsProp}
        requesterId={requesterId}
        classYearId={classYearId}
      />,
    )

    const row1 = getRow('HS001')
    const sponsorInput = within(row1).getByPlaceholderText(
      'students.form.sacrament.sponsorName.placeholder',
    )

    fireEvent.change(sponsorInput, { target: { value: 'New Sponsor' } })
    fireEvent.blur(sponsorInput)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('common.error')
    })
  })

  test('queries getClassSacramentDetails with requesterId/classYearId when open', () => {
    render(
      <SacramentDetailDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        students={studentsProp}
        requesterId={requesterId}
        classYearId={classYearId}
      />,
    )

    expect(useQuery).toHaveBeenCalledWith(expect.anything(), {
      requesterId,
      classYearId,
    })
  })

  test('export button opens the export dialog', () => {
    render(
      <SacramentDetailDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        students={studentsProp}
        requesterId={requesterId}
        classYearId={classYearId}
      />,
    )

    const exportButton = screen.getByText('common.export')
    fireEvent.click(exportButton)

    // Export button text is visible
    expect(exportButton).toBeInTheDocument()
  })

  test('export dialog shows field checkboxes and export buttons', () => {
    render(
      <SacramentDetailDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        students={studentsProp}
        requesterId={requesterId}
        classYearId={classYearId}
      />,
    )

    const exportButton = screen.getByText('common.export')
    fireEvent.click(exportButton)

    // Check if field checkboxes are present
    expect(screen.getByTestId('checkbox-receivedDate')).toBeInTheDocument()
    expect(screen.getByTestId('checkbox-receivedPlace')).toBeInTheDocument()
    expect(screen.getByTestId('checkbox-feastName')).toBeInTheDocument()
    expect(screen.getByTestId('checkbox-sponsorName')).toBeInTheDocument()
    expect(screen.getByTestId('checkbox-notes')).toBeInTheDocument()
  })

  test('export CSV/PDF buttons are disabled when no fields selected', () => {
    render(
      <SacramentDetailDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        students={studentsProp}
        requesterId={requesterId}
        classYearId={classYearId}
      />,
    )

    const exportButton = screen.getByText('common.export')
    fireEvent.click(exportButton)

    // Uncheck all by unchecking default selections
    const receivedDateCheckbox = screen.getByTestId('checkbox-receivedDate')
    const receivedPlaceCheckbox = screen.getByTestId('checkbox-receivedPlace')
    const feastNameCheckbox = screen.getByTestId('checkbox-feastName')
    const sponsorNameCheckbox = screen.getByTestId('checkbox-sponsorName')

    fireEvent.click(receivedDateCheckbox)
    fireEvent.click(receivedPlaceCheckbox)
    fireEvent.click(feastNameCheckbox)
    fireEvent.click(sponsorNameCheckbox)

    const csvButton = screen.getByText('common.exportCsv')
    const pdfButton = screen.getByText('common.exportPdf')

    expect(csvButton).toBeDisabled()
    expect(pdfButton).toBeDisabled()
  })
})
