import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ImportStep3ColumnMap } from './ImportStep3ColumnMap'

function selectMapping(headerLabel: string, optionName: RegExp | string) {
  const badge = screen.getByText(headerLabel)
  const row = badge.closest('tr') as HTMLElement
  const combobox = row.querySelector('[role="combobox"]') as HTMLElement
  fireEvent.click(combobox)
  const pattern =
    typeof optionName === 'string' ? new RegExp(optionName) : optionName
  const option = screen.getByRole('option', { name: pattern })
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
    // Third combobox in the row is the contact-type select (first is the
    // category select, second is the subfield select revealed for guardian
    // fields).
    const contactTypeCombobox = comboboxes[2] as HTMLElement
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

  test('selecting the Father category reveals a second select with fields in saint name → name → contact1 → contact2 order', () => {
    render(
      <ImportStep3ColumnMap
        csvHeaders={['Name', 'FatherInfo']}
        target="students"
        columnMapping={{ Name: 'fullName' }}
        onMappingChange={onMappingChange}
        relationshipBySlot={{}}
        onRelationshipChange={onRelationshipChange}
        contactTypeByField={{}}
        onContactTypeChange={onContactTypeChange}
        onNext={onNext}
        onBack={onBack}
      />,
    )

    selectMapping('FatherInfo', 'csvImport.columnMap.role.father')

    const badge = screen.getByText('FatherInfo')
    const row = badge.closest('tr') as HTMLElement
    const subCombobox = row.querySelectorAll('[role="combobox"]')[1]
    fireEvent.click(subCombobox)

    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual([
      'csvImport.fields.guardianSaintName',
      'csvImport.fields.guardianName',
      'csvImport.fields.guardianContact1',
      'csvImport.fields.guardianContact2',
    ])
  })

  test('selecting a sub-field in the revealed guardian select calls onMappingChange with the field key', () => {
    render(
      <ImportStep3ColumnMap
        csvHeaders={['Name', 'FatherInfo']}
        target="students"
        columnMapping={{ Name: 'fullName' }}
        onMappingChange={onMappingChange}
        relationshipBySlot={{}}
        onRelationshipChange={onRelationshipChange}
        contactTypeByField={{}}
        onContactTypeChange={onContactTypeChange}
        onNext={onNext}
        onBack={onBack}
      />,
    )

    selectMapping('FatherInfo', 'csvImport.columnMap.role.father')

    const badge = screen.getByText('FatherInfo')
    const row = badge.closest('tr') as HTMLElement
    const subCombobox = row.querySelectorAll('[role="combobox"]')[1]
    fireEvent.click(subCombobox)
    const option = screen.getByRole('option', {
      name: 'csvImport.fields.guardianName',
    })
    fireEvent.pointerDown(option)
    fireEvent.click(option)

    expect(onMappingChange).toHaveBeenCalledWith({
      Name: 'fullName',
      FatherInfo: 'guardian1_name',
    })
  })

  test('selecting the Baptism category reveals a second select with fields in date → place → feast name → sponsor name order, and picking one calls onMappingChange', () => {
    render(
      <ImportStep3ColumnMap
        csvHeaders={['Name', 'BaptismInfo']}
        target="students"
        columnMapping={{ Name: 'fullName' }}
        onMappingChange={onMappingChange}
        relationshipBySlot={{}}
        onRelationshipChange={onRelationshipChange}
        contactTypeByField={{}}
        onContactTypeChange={onContactTypeChange}
        onNext={onNext}
        onBack={onBack}
      />,
    )

    selectMapping('BaptismInfo', 'csvImport.columnMap.sacramentType.baptism')

    const badge = screen.getByText('BaptismInfo')
    const row = badge.closest('tr') as HTMLElement
    const subCombobox = row.querySelectorAll('[role="combobox"]')[1]
    fireEvent.click(subCombobox)

    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual([
      'csvImport.fields.sacramentReceivedDate',
      'csvImport.fields.sacramentReceivedPlace',
      'csvImport.fields.sacramentFeastName',
      'csvImport.fields.sacramentSponsorName',
    ])

    const placeOption = screen.getByRole('option', {
      name: 'csvImport.fields.sacramentReceivedPlace',
    })
    fireEvent.pointerDown(placeOption)
    fireEvent.click(placeOption)

    expect(onMappingChange).toHaveBeenCalledWith({
      Name: 'fullName',
      BaptismInfo: 'sacrament_baptism_receivedPlace',
    })
  })

  test('a column already mapped to a concrete guardian field shows the category selected in the first select and the field selected in the second select', () => {
    render(
      <ImportStep3ColumnMap
        csvHeaders={['Name', 'MotherName']}
        target="students"
        columnMapping={{ Name: 'fullName', MotherName: 'guardian2_name' }}
        onMappingChange={onMappingChange}
        relationshipBySlot={{}}
        onRelationshipChange={onRelationshipChange}
        contactTypeByField={{}}
        onContactTypeChange={onContactTypeChange}
        onNext={onNext}
        onBack={onBack}
      />,
    )

    const badge = screen.getByText('MotherName')
    const row = badge.closest('tr') as HTMLElement
    const comboboxes = row.querySelectorAll('[role="combobox"]')
    expect(comboboxes).toHaveLength(2)
    expect(comboboxes[0].textContent).toContain(
      'csvImport.columnMap.role.mother',
    )
    expect(comboboxes[1].textContent).toContain('csvImport.fields.guardianName')
  })

  test('a column mapped to a core field like fullName does not show a second select', () => {
    render(
      <ImportStep3ColumnMap
        csvHeaders={['Name']}
        target="students"
        columnMapping={{ Name: 'fullName' }}
        onMappingChange={onMappingChange}
        relationshipBySlot={{}}
        onRelationshipChange={onRelationshipChange}
        contactTypeByField={{}}
        onContactTypeChange={onContactTypeChange}
        onNext={onNext}
        onBack={onBack}
      />,
    )

    const badge = screen.getByText('Name')
    const row = badge.closest('tr') as HTMLElement
    const comboboxes = row.querySelectorAll('[role="combobox"]')
    expect(comboboxes).toHaveLength(1)
  })
})
