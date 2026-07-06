import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ImportStep3ColumnMap } from './ImportStep3ColumnMap'

function selectMapping(headerLabel: string, optionName: RegExp | string) {
  const badge = screen.getByText(headerLabel)
  const row = badge.closest('tr') as HTMLElement
  const combobox = row.querySelector('[role="combobox"]') as HTMLElement
  fireEvent.click(combobox)
  const option = screen.getByRole('option', { name: optionName })
  fireEvent.pointerDown(option)
  fireEvent.click(option)
}

describe('ImportStep3ColumnMap', () => {
  const onMappingChange = vi.fn()
  const onNext = vi.fn()
  const onBack = vi.fn()

  beforeEach(() => {
    onMappingChange.mockClear()
    onNext.mockClear()
    onBack.mockClear()
  })

  test('blocks Next when required fullName field is not mapped', () => {
    render(
      <ImportStep3ColumnMap
        csvHeaders={['Name', 'DOB']}
        target="students"
        columnMapping={{}}
        onMappingChange={onMappingChange}
        onNext={onNext}
        onBack={onBack}
      />,
    )

    expect(
      screen.getByText('csvImport.columnMap.requiredWarning'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common.next' })).toBeDisabled()
  })

  test('shows inline duplicate error when two columns map to the same target field', () => {
    render(
      <ImportStep3ColumnMap
        csvHeaders={['Name', 'FullName2']}
        target="students"
        columnMapping={{ Name: 'fullName', FullName2: 'fullName' }}
        onMappingChange={onMappingChange}
        onNext={onNext}
        onBack={onBack}
      />,
    )

    const duplicateErrors = screen.getAllByText(
      'csvImport.columnMap.duplicateError',
    )
    expect(duplicateErrors.length).toBe(2)
    expect(screen.getByRole('button', { name: 'common.next' })).toBeDisabled()
  })

  test('enables Next once fullName is mapped uniquely with no duplicates', () => {
    render(
      <ImportStep3ColumnMap
        csvHeaders={['Name', 'DOB']}
        target="students"
        columnMapping={{ Name: 'fullName', DOB: 'dob' }}
        onMappingChange={onMappingChange}
        onNext={onNext}
        onBack={onBack}
      />,
    )

    expect(
      screen.queryByText('csvImport.columnMap.requiredWarning'),
    ).not.toBeInTheDocument()
    const nextBtn = screen.getByRole('button', { name: 'common.next' })
    expect(nextBtn).not.toBeDisabled()
    fireEvent.click(nextBtn)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  test('changing a column mapping via the select calls onMappingChange with the skip value cleared', () => {
    render(
      <ImportStep3ColumnMap
        csvHeaders={['Name']}
        target="students"
        columnMapping={{}}
        onMappingChange={onMappingChange}
        onNext={onNext}
        onBack={onBack}
      />,
    )

    selectMapping('Name', 'csvImport.columnMap.skip')

    expect(onMappingChange).toHaveBeenCalledWith({ Name: null })
  })

  test('Back button calls onBack', () => {
    render(
      <ImportStep3ColumnMap
        csvHeaders={['Name']}
        target="catechists"
        columnMapping={{}}
        onMappingChange={onMappingChange}
        onNext={onNext}
        onBack={onBack}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'common.back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
