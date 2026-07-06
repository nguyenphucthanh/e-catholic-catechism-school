import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ImportStep2Config } from './ImportStep2Config'
import type { ImportConfig } from './useImportParser'

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
