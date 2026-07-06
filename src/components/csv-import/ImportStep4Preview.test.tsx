import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { ImportStep4Preview } from './ImportStep4Preview'
import type { ImportConfig } from './useImportParser'

const config: ImportConfig = {
  target: 'students',
  delimiter: ',',
  dateFormat: 'yyyy-MM-dd',
}

const columnMapping: Record<string, string | null> = {
  Name: 'fullName',
  Phone: 'guardian_phone',
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

  test('Back button calls onBack', () => {
    renderStep()
    fireEvent.click(screen.getByRole('button', { name: 'common.back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
