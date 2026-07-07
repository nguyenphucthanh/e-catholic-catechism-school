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
  const onRelationshipChange = vi.fn()
  const onContactTypeChange = vi.fn()
  const onNext = vi.fn()
  const onBack = vi.fn()

  beforeEach(() => {
    onMappingChange.mockClear()
    onRelationshipChange.mockClear()
    onContactTypeChange.mockClear()
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
        relationshipBySlot={{}}
        onRelationshipChange={onRelationshipChange}
        contactTypeByField={{}}
        onContactTypeChange={onContactTypeChange}
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
        relationshipBySlot={{}}
        onRelationshipChange={onRelationshipChange}
        contactTypeByField={{}}
        onContactTypeChange={onContactTypeChange}
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
        relationshipBySlot={{}}
        onRelationshipChange={onRelationshipChange}
        contactTypeByField={{}}
        onContactTypeChange={onContactTypeChange}
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
        relationshipBySlot={{}}
        onRelationshipChange={onRelationshipChange}
        contactTypeByField={{}}
        onContactTypeChange={onContactTypeChange}
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
        relationshipBySlot={{}}
        onRelationshipChange={onRelationshipChange}
        contactTypeByField={{}}
        onContactTypeChange={onContactTypeChange}
        onNext={onNext}
        onBack={onBack}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'common.back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  test('mapping a column to guardian1_name reveals the relationship input, and typing calls onRelationshipChange(1, value)', () => {
    render(
      <ImportStep3ColumnMap
        csvHeaders={['Name', 'Relation']}
        target="students"
        columnMapping={{ Name: 'fullName', Relation: 'guardian1_name' }}
        onMappingChange={onMappingChange}
        relationshipBySlot={{}}
        onRelationshipChange={onRelationshipChange}
        contactTypeByField={{}}
        onContactTypeChange={onContactTypeChange}
        onNext={onNext}
        onBack={onBack}
      />,
    )

    const relationshipInput = screen.getByPlaceholderText(
      'csvImport.columnMap.relationshipPlaceholder',
    )
    fireEvent.change(relationshipInput, { target: { value: 'Mother' } })

    expect(onRelationshipChange).toHaveBeenCalledWith(1, 'Mother')
  })

  test('mapping a column to guardian2_contact_1 reveals the contact type select, and changing it calls onContactTypeChange', () => {
    render(
      <ImportStep3ColumnMap
        csvHeaders={['Name', 'Contact']}
        target="students"
        columnMapping={{ Name: 'fullName', Contact: 'guardian2_contact_1' }}
        onMappingChange={onMappingChange}
        relationshipBySlot={{}}
        onRelationshipChange={onRelationshipChange}
        contactTypeByField={{}}
        onContactTypeChange={onContactTypeChange}
        onNext={onNext}
        onBack={onBack}
      />,
    )

    const badge = screen.getByText('Contact')
    const row = badge.closest('tr') as HTMLElement
    const comboboxes = row.querySelectorAll('[role="combobox"]')
    // Second combobox in the row is the contact-type select (first is the
    // field-mapping select shared by every row).
    const contactTypeCombobox = comboboxes[1] as HTMLElement
    fireEvent.click(contactTypeCombobox)

    const emailOption = screen.getByRole('option', {
      name: 'csvImport.columnMap.contactType.email',
    })
    fireEvent.pointerDown(emailOption)
    fireEvent.click(emailOption)

    expect(onContactTypeChange).toHaveBeenCalledWith(
      'guardian2_contact_1',
      'email',
    )
  })
})
