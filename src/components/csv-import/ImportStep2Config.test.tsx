import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { ImportStep2Config } from './ImportStep2Config'
import type { ImportConfig } from './useImportParser'
import { useInactiveYear, useSelectedAcademicYear } from '~/lib/academic-year'

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: vi.fn(),
  useInactiveYear: vi.fn(),
}))

const baseConfig: ImportConfig = {
  target: 'students',
  delimiter: ',',
  dateFormat: 'yyyy-MM-dd',
}

const onConfigChange = vi.fn()
const onHeadersParsed = vi.fn()
const onNext = vi.fn()
const onBack = vi.fn()

function selectByCombobox(index: number, optionName: RegExp | string) {
  const comboboxes = screen.getAllByRole('combobox')
  fireEvent.click(comboboxes[index])
  const option = screen.getByRole('option', { name: optionName })
  fireEvent.pointerDown(option)
  fireEvent.click(option)
}

describe('ImportStep2Config', () => {
  beforeEach(() => {
    onConfigChange.mockClear()
    onHeadersParsed.mockClear()
    onNext.mockClear()
    onBack.mockClear()
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: 'year-2024' as any,
      setSelectedYearId: vi.fn(),
    })
    vi.mocked(useInactiveYear).mockReturnValue({
      isInactive: false,
      yearName: '2024-2025',
    })
    vi.mocked(useQuery).mockReturnValue([])
  })

  test('changing the target select calls onConfigChange with new target', () => {
    render(
      <ImportStep2Config
        config={baseConfig}
        rawText="a,b\n1,2"
        onConfigChange={onConfigChange}
        onHeadersParsed={onHeadersParsed}
        onNext={onNext}
        onBack={onBack}
      />,
    )

    selectByCombobox(0, 'csvImport.config.targetCatechists')

    expect(onConfigChange).toHaveBeenCalledWith({
      ...baseConfig,
      target: 'catechists',
    })
  })

  test('changing the delimiter select calls onConfigChange with new delimiter', () => {
    render(
      <ImportStep2Config
        config={baseConfig}
        rawText="a;b\n1;2"
        onConfigChange={onConfigChange}
        onHeadersParsed={onHeadersParsed}
        onNext={onNext}
        onBack={onBack}
      />,
    )

    selectByCombobox(1, 'csvImport.config.delimiterSemicolon')

    expect(onConfigChange).toHaveBeenCalledWith({
      ...baseConfig,
      delimiter: ';',
    })
  })

  test('changing the date format select calls onConfigChange with new dateFormat', () => {
    render(
      <ImportStep2Config
        config={baseConfig}
        rawText="a,b\n1,2"
        onConfigChange={onConfigChange}
        onHeadersParsed={onHeadersParsed}
        onNext={onNext}
        onBack={onBack}
      />,
    )

    selectByCombobox(2, 'DD/MM/YYYY')

    expect(onConfigChange).toHaveBeenCalledWith({
      ...baseConfig,
      dateFormat: 'dd/MM/yyyy',
    })
  })

  test('Next parses the first non-blank line into headers using the configured delimiter and advances', () => {
    render(
      <ImportStep2Config
        config={baseConfig}
        rawText={'\n fullName,dob \nAlice,2020-01-01'}
        onConfigChange={onConfigChange}
        onHeadersParsed={onHeadersParsed}
        onNext={onNext}
        onBack={onBack}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'common.next' }))

    expect(onHeadersParsed).toHaveBeenCalledWith(['fullName', 'dob'])
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  test('Next with empty rawText parses to a single empty header', () => {
    render(
      <ImportStep2Config
        config={baseConfig}
        rawText=""
        onConfigChange={onConfigChange}
        onHeadersParsed={onHeadersParsed}
        onNext={onNext}
        onBack={onBack}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'common.next' }))

    expect(onHeadersParsed).toHaveBeenCalledWith([''])
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  test('changing the class select calls onConfigChange with classYearId', () => {
    vi.mocked(useQuery).mockReturnValue([
      { classYearId: 'cy1', classId: 'c1', className: 'Class 1' },
      { classYearId: 'cy2', classId: 'c2', className: 'Class 2' },
    ])

    render(
      <ImportStep2Config
        config={baseConfig}
        rawText="a,b\n1,2"
        onConfigChange={onConfigChange}
        onHeadersParsed={onHeadersParsed}
        onNext={onNext}
        onBack={onBack}
      />,
    )

    // select index 3 (class selection combobox)
    selectByCombobox(3, 'Class 1')

    expect(onConfigChange).toHaveBeenCalledWith({
      ...baseConfig,
      classYearId: 'cy1',
    })
  })

  test('selecting Do Not Enroll calls onConfigChange with undefined classYearId', () => {
    vi.mocked(useQuery).mockReturnValue([
      { classYearId: 'cy1', classId: 'c1', className: 'Class 1' },
    ])

    render(
      <ImportStep2Config
        config={{ ...baseConfig, classYearId: 'cy1' }}
        rawText="a,b\n1,2"
        onConfigChange={onConfigChange}
        onHeadersParsed={onHeadersParsed}
        onNext={onNext}
        onBack={onBack}
      />,
    )

    selectByCombobox(3, 'csvImport.config.noClass')

    expect(onConfigChange).toHaveBeenCalledWith({
      ...baseConfig,
      classYearId: undefined,
    })
  })

  test('disables class select dropdown and shows warning when academic year is inactive', () => {
    vi.mocked(useInactiveYear).mockReturnValue({
      isInactive: true,
      yearName: '2024-2025',
    })

    render(
      <ImportStep2Config
        config={baseConfig}
        rawText="a,b\n1,2"
        onConfigChange={onConfigChange}
        onHeadersParsed={onHeadersParsed}
        onNext={onNext}
        onBack={onBack}
      />,
    )

    const classSelect = screen.getAllByRole('combobox')[3]
    expect(classSelect).toBeDisabled()
    expect(
      screen.getByText('csvImport.config.inactiveYearWarning'),
    ).toBeInTheDocument()
  })

  test('Back button calls onBack', () => {
    render(
      <ImportStep2Config
        config={baseConfig}
        rawText=""
        onConfigChange={onConfigChange}
        onHeadersParsed={onHeadersParsed}
        onNext={onNext}
        onBack={onBack}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'common.back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
