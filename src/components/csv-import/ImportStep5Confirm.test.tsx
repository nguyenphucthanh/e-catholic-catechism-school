import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ImportStep5Confirm } from './ImportStep5Confirm'
import type { ValidatedRow } from './useImportParser'

function row(overrides: Partial<ValidatedRow>): ValidatedRow {
  return {
    rowIndex: 0,
    status: 'ok',
    coerced: {},
    issues: [],
    ...overrides,
  }
}

const onBack = vi.fn()
const onStartImport = vi.fn()

describe('ImportStep5Confirm', () => {
  beforeEach(() => {
    onBack.mockClear()
    onStartImport.mockClear()
  })

  test('Start Import button is disabled until the acknowledge checkbox is checked', () => {
    const rows = [row({ rowIndex: 0, status: 'ok' })]
    render(
      <ImportStep5Confirm
        validatedRows={rows}
        target="students"
        onBack={onBack}
        onStartImport={onStartImport}
      />,
    )

    const startBtn = screen.getByRole('button', {
      name: 'csvImport.confirm.startImport',
    })
    expect(startBtn).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox'))

    expect(startBtn).not.toBeDisabled()
    fireEvent.click(startBtn)
    expect(onStartImport).toHaveBeenCalledTimes(1)
  })

  test('Start Import stays disabled even when checked if there are no importable rows', () => {
    const rows = [row({ rowIndex: 0, status: 'error' })]
    render(
      <ImportStep5Confirm
        validatedRows={rows}
        target="students"
        onBack={onBack}
        onStartImport={onStartImport}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox'))

    expect(
      screen.getByRole('button', { name: 'csvImport.confirm.startImport' }),
    ).toBeDisabled()
  })

  test('duplicate names list is hidden by default and expands/collapses on trigger click', async () => {
    const rows = [
      row({ rowIndex: 0, status: 'ok', duplicateWarning: 'Alice' }),
      row({ rowIndex: 1, status: 'ok', duplicateWarning: 'Bob' }),
    ]
    render(
      <ImportStep5Confirm
        validatedRows={rows}
        target="students"
        onBack={onBack}
        onStartImport={onStartImport}
      />,
    )

    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
    expect(
      screen.getByText('csvImport.confirm.showDuplicates'),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'csvImport.confirm.showDuplicates' }),
    )

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(
      screen.getByText('csvImport.confirm.hideDuplicates'),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'csvImport.confirm.hideDuplicates' }),
    )

    await waitFor(() => {
      expect(
        screen.getByText('csvImport.confirm.showDuplicates'),
      ).toBeInTheDocument()
    })
  })

  test('does not render duplicates section when there are no duplicate rows', () => {
    const rows = [row({ rowIndex: 0, status: 'ok' })]
    render(
      <ImportStep5Confirm
        validatedRows={rows}
        target="catechists"
        onBack={onBack}
        onStartImport={onStartImport}
      />,
    )

    expect(
      screen.queryByText('csvImport.confirm.showDuplicates'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('csvImport.confirm.duplicatesAlert'),
    ).not.toBeInTheDocument()
  })

  test('Back button calls onBack', () => {
    render(
      <ImportStep5Confirm
        validatedRows={[]}
        target="students"
        onBack={onBack}
        onStartImport={onStartImport}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'common.back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
