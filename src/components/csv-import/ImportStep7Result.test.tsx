import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ImportStep7Result } from './ImportStep7Result'
import type { ValidatedRow } from './useImportParser'
import type { ImportRowResult } from '~/routes/_authenticated/_catechist/_admin/import'

function row(overrides: Partial<ValidatedRow>): ValidatedRow {
  return {
    rowIndex: 0,
    status: 'ok',
    coerced: {},
    issues: [],
    ...overrides,
  }
}

const onImportMore = vi.fn()
const onDone = vi.fn()

describe('ImportStep7Result', () => {
  beforeEach(() => {
    onImportMore.mockClear()
    onDone.mockClear()
  })

  test('renders success, partial and failed counts and a view link to the student record', () => {
    const validatedRows: Array<ValidatedRow> = [
      row({ rowIndex: 0, status: 'ok', coerced: { fullName: 'Alice' } }),
      row({ rowIndex: 1, status: 'partial', coerced: { fullName: 'Bob' } }),
      row({ rowIndex: 2, status: 'ok', coerced: { fullName: 'Carol' } }),
    ]
    const importResults: Array<ImportRowResult> = [
      { index: 0, status: 'ok', id: 'stu1' },
      { index: 1, status: 'ok', id: 'stu2' },
      { index: 2, status: 'error', error: 'DUPLICATE' },
    ]

    render(
      <ImportStep7Result
        importResults={importResults}
        validatedRows={validatedRows}
        target="students"
        onImportMore={onImportMore}
        onDone={onDone}
      />,
    )

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('DUPLICATE')).toBeInTheDocument()

    const viewLinks = screen.getAllByRole('link', {
      name: 'csvImport.result.viewRecord',
    })
    expect(viewLinks).toHaveLength(2)
    expect(viewLinks[0]).toHaveAttribute('href', '/students/$id')
  })

  test('renders links to catechist records when target is catechists', () => {
    const validatedRows: Array<ValidatedRow> = [
      row({ rowIndex: 0, status: 'ok', coerced: { fullName: 'GLV A' } }),
    ]
    const importResults: Array<ImportRowResult> = [
      { index: 0, status: 'ok', id: 'cat1' },
    ]

    render(
      <ImportStep7Result
        importResults={importResults}
        validatedRows={validatedRows}
        target="catechists"
        onImportMore={onImportMore}
        onDone={onDone}
      />,
    )

    const viewLink = screen.getByRole('link', {
      name: 'csvImport.result.viewRecord',
    })
    expect(viewLink).toHaveAttribute('href', '/catechists/$id')
  })

  test('does not render a view link for failed rows', () => {
    const validatedRows: Array<ValidatedRow> = [
      row({ rowIndex: 0, status: 'error', coerced: {} }),
    ]
    const importResults: Array<ImportRowResult> = [
      { index: 0, status: 'error', error: 'boom' },
    ]

    render(
      <ImportStep7Result
        importResults={importResults}
        validatedRows={validatedRows}
        target="students"
        onImportMore={onImportMore}
        onDone={onDone}
      />,
    )

    expect(
      screen.queryByRole('link', { name: 'csvImport.result.viewRecord' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()
  })

  test('shows a row that is not found in validatedRows with a placeholder full name', () => {
    const importResults: Array<ImportRowResult> = [
      { index: 99, status: 'ok', id: 'x1' },
    ]

    render(
      <ImportStep7Result
        importResults={importResults}
        validatedRows={[]}
        target="students"
        onImportMore={onImportMore}
        onDone={onDone}
      />,
    )

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  test('Import More and Done buttons call their respective handlers', () => {
    render(
      <ImportStep7Result
        importResults={[]}
        validatedRows={[]}
        target="students"
        onImportMore={onImportMore}
        onDone={onDone}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'csvImport.result.importMore' }),
    )
    expect(onImportMore).toHaveBeenCalledTimes(1)

    fireEvent.click(
      screen.getByRole('button', { name: 'csvImport.result.done' }),
    )
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
