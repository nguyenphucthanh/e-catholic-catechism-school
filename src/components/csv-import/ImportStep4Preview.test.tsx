import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { ImportStep4Preview } from './ImportStep4Preview'
import type { ContactType } from './csvFieldDefinitions'
import type { ImportConfig } from './useImportParser'

const config: ImportConfig = {
  target: 'students',
  delimiter: ',',
  dateFormat: 'yyyy-MM-dd',
}

const columnMapping: Record<string, string | null> = {
  Name: 'fullName',
  Phone: 'guardian1_contact_1',
}

const contactTypeByField: Record<string, ContactType> = {
  guardian1_contact_1: 'phone',
}

// Row 0: Alice, valid phone -> ok, and marked duplicate
// Row 1: Bob, invalid phone -> partial (non-blocking issue)
// Row 2: (blank name), invalid phone -> error (blocking required issue)
// Row 3: Carol, valid phone -> ok, not duplicate
const rawText = [
  'Name,Phone',
  'Alice,+84987654321',
  'Bob,12345',
  ',5551234',
  'Carol,+84987654322',
].join('\n')

const onValidatedRows = vi.fn()
const onNext = vi.fn()
const onBack = vi.fn()

function setupDuplicates(
  names: Array<{ fullName: string }> = [{ fullName: 'Alice' }],
) {
  vi.mocked(useQuery).mockReturnValue(names)
}

function renderStep(overrideRawText = rawText) {
  return render(
    <ImportStep4Preview
      rawText={overrideRawText}
      config={config}
      columnMapping={columnMapping}
      contactTypeByField={contactTypeByField}
      requesterId={'catechist1' as any}
      onValidatedRows={onValidatedRows}
      onNext={onNext}
      onBack={onBack}
    />,
  )
}

describe('ImportStep4Preview', () => {
  beforeEach(() => {
    onValidatedRows.mockClear()
    onNext.mockClear()
    onBack.mockClear()
    setupDuplicates()
  })

  test('renders all rows by default with correct status counts and duplicate badge', () => {
    renderStep()

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Carol')).toBeInTheDocument()

    expect(
      screen.getByRole('tab', {
        name: /csvImport\.preview\.filter\.all.*\(4\)/,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', {
        name: /csvImport\.preview\.filter\.ok.*\(2\)/,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', {
        name: /csvImport\.preview\.filter\.partial.*\(1\)/,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', {
        name: /csvImport\.preview\.filter\.error.*\(1\)/,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', {
        name: /csvImport\.preview\.filter\.duplicates.*\(1\)/,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByText('csvImport.preview.duplicateBadge'),
    ).toBeInTheDocument()
  })

  test('filtering by OK tab shows only OK rows', () => {
    renderStep()

    fireEvent.click(
      screen.getByRole('tab', { name: /csvImport\.preview\.filter\.ok/ }),
    )

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Carol')).toBeInTheDocument()
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
  })

  test('filtering by Error tab shows only the error row', () => {
    renderStep()

    fireEvent.click(
      screen.getByRole('tab', { name: /csvImport\.preview\.filter\.error/ }),
    )

    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
    expect(screen.queryByText('Carol')).not.toBeInTheDocument()
    // The error row has no fullName mapped successfully, rendered as em dash.
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  test('filtering by Duplicates tab shows only rows with a duplicate warning', () => {
    renderStep()

    fireEvent.click(
      screen.getByRole('tab', {
        name: /csvImport\.preview\.filter\.duplicates/,
      }),
    )

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Carol')).not.toBeInTheDocument()
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
  })

  test('Proceed button is disabled when there are no importable (ok/partial) rows', () => {
    setupDuplicates([])
    // Every row is missing fullName -> all rows are 'error' status.
    const allErrorRawText = ['Name,Phone', ',123', ',456'].join('\n')

    renderStep(allErrorRawText)

    expect(
      screen.getByText('csvImport.preview.noImportable'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'csvImport.preview.proceed' }),
    ).toBeDisabled()
  })

  test('Proceed button is enabled when importable rows exist and calls onNext', () => {
    renderStep()

    const proceedBtn = screen.getByRole('button', {
      name: 'csvImport.preview.proceed',
    })
    expect(proceedBtn).not.toBeDisabled()
    fireEvent.click(proceedBtn)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  test('all checkboxes are checked by default except duplication-warn rows', () => {
    renderStep()

    const checkboxes = screen.getAllByRole('checkbox')
    // Select All should be unchecked because Alice is unchecked by default
    expect(checkboxes[0]).toHaveAttribute('aria-checked', 'false')
    // Row 0: Alice (duplicate)
    expect(checkboxes[1]).toHaveAttribute('aria-checked', 'false')
    // Row 1: Bob
    expect(checkboxes[2]).toHaveAttribute('aria-checked', 'true')
    // Row 2: (blank name)
    expect(checkboxes[3]).toHaveAttribute('aria-checked', 'true')
    // Row 3: Carol
    expect(checkboxes[4]).toHaveAttribute('aria-checked', 'true')
  })

  test('unchecking and checking individual rows updates next button state', () => {
    renderStep()

    const proceedBtn = screen.getByRole('button', {
      name: 'csvImport.preview.proceed',
    })

    // Uncheck Bob, blank, Carol (re-query checkboxes each time to avoid stale DOM references)
    fireEvent.click(screen.getAllByRole('checkbox')[2])
    fireEvent.click(screen.getAllByRole('checkbox')[3])
    fireEvent.click(screen.getAllByRole('checkbox')[4])

    // Now all rows are unchecked -> proceed button should be disabled
    expect(proceedBtn).toBeDisabled()

    // Check Bob back -> proceed button becomes enabled
    fireEvent.click(screen.getAllByRole('checkbox')[2])
    expect(proceedBtn).not.toBeDisabled()
  })

  test('select all checkbox toggles all visible rows', () => {
    renderStep()

    const checkboxes = screen.getAllByRole('checkbox')

    // Clicking Select All when some are unchecked should check all
    fireEvent.click(checkboxes[0])

    const updatedCheckboxes = screen.getAllByRole('checkbox')
    expect(updatedCheckboxes[0]).toHaveAttribute('aria-checked', 'true')
    expect(updatedCheckboxes[1]).toHaveAttribute('aria-checked', 'true')
    expect(updatedCheckboxes[2]).toHaveAttribute('aria-checked', 'true')
    expect(updatedCheckboxes[3]).toHaveAttribute('aria-checked', 'true')
    expect(updatedCheckboxes[4]).toHaveAttribute('aria-checked', 'true')

    // Clicking Select All again should uncheck all
    fireEvent.click(updatedCheckboxes[0])

    const finalCheckboxes = screen.getAllByRole('checkbox')
    expect(finalCheckboxes[0]).toHaveAttribute('aria-checked', 'false')
    expect(finalCheckboxes[1]).toHaveAttribute('aria-checked', 'false')
    expect(finalCheckboxes[2]).toHaveAttribute('aria-checked', 'false')
    expect(finalCheckboxes[3]).toHaveAttribute('aria-checked', 'false')
    expect(finalCheckboxes[4]).toHaveAttribute('aria-checked', 'false')
  })

  test('Back button calls onBack', () => {
    renderStep()
    fireEvent.click(screen.getByRole('button', { name: 'common.back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
