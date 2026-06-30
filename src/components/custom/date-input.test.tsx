import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DateInput } from './date-input'

describe('DateInput component', () => {
  test('renders placeholder when no value is provided', () => {
    render(<DateInput placeholder="Pick a date" />)
    expect(screen.getByPlaceholderText('Pick a date')).toBeInTheDocument()
  })

  test('renders formatted date when value is provided', () => {
    const testDate = new Date(2026, 5, 30) // June 30, 2026
    render(<DateInput value={testDate} />)

    // Verify it formats the date
    expect(screen.getByDisplayValue('30/06/2026')).toBeInTheDocument()
  })

  test('opens popover calendar on click of the calendar button', () => {
    render(<DateInput placeholder="Pick a date" />)

    const trigger = screen.getByRole('button', { name: /Open calendar/i })
    fireEvent.click(trigger)

    // Check if the calendar grid is in the document when opened
    expect(screen.getByRole('grid')).toBeInTheDocument()
  })

  test('calls onChange and closes popover when date is clicked', () => {
    const handleChange = vi.fn()
    render(<DateInput placeholder="Pick a date" onChange={handleChange} />)

    const trigger = screen.getByRole('button', { name: /Open calendar/i })
    fireEvent.click(trigger)

    // Click on a day button in react-day-picker (e.g. "15")
    const dayButton = screen.getByRole('button', { name: /15/ })
    fireEvent.click(dayButton)

    expect(handleChange).toHaveBeenCalled()
    // It should close popover
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })

  test('calls onChange when typing a valid date and pressing Enter', () => {
    const handleChange = vi.fn()
    render(<DateInput placeholder="Pick a date" onChange={handleChange} />)

    const input = screen.getByPlaceholderText('Pick a date')
    fireEvent.change(input, { target: { value: '15/06/2026' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(handleChange).toHaveBeenCalledWith(expect.any(Date))
    const calledDate = handleChange.mock.calls[0][0] as Date
    expect(calledDate.getFullYear()).toBe(2026)
    expect(calledDate.getMonth()).toBe(5) // June
    expect(calledDate.getDate()).toBe(15)
  })

  test('calls onChange when typing a valid date in different format and blurring', () => {
    const handleChange = vi.fn()
    render(<DateInput placeholder="Pick a date" onChange={handleChange} />)

    const input = screen.getByPlaceholderText('Pick a date')
    fireEvent.change(input, { target: { value: '2026-06-20' } })
    fireEvent.blur(input)

    expect(handleChange).toHaveBeenCalledWith(expect.any(Date))
    const calledDate = handleChange.mock.calls[0][0] as Date
    expect(calledDate.getFullYear()).toBe(2026)
    expect(calledDate.getMonth()).toBe(5) // June
    expect(calledDate.getDate()).toBe(20)
    // Value should reformat to standard dd/MM/yyyy
    expect(screen.getByDisplayValue('20/06/2026')).toBeInTheDocument()
  })

  test('clears input and calls onChange with undefined when typing invalid date', () => {
    const handleChange = vi.fn()
    const testDate = new Date(2026, 5, 30) // June 30, 2026
    const { rerender } = render(
      <DateInput value={testDate} onChange={handleChange} />,
    )

    const input = screen.getByDisplayValue('30/06/2026')
    // Type invalid date
    fireEvent.change(input, { target: { value: '32/13/2026' } })
    fireEvent.blur(input)

    expect(handleChange).toHaveBeenCalledWith(undefined)
    // The component clears internal input, but because `value` prop is still the testDate,
    // we would expect it to stay cleared until rerender, or since it fell back to clear
    // it will render empty. Wait, the implementation sets to '' if value is undefined, but if value is still valid,
    // wait, the onChange is called with undefined. The parent will then update `value` to undefined.
    // Let's simulate parent updating value to undefined
    rerender(<DateInput value={undefined} onChange={handleChange} />)

    // Should be empty
    expect(screen.queryByDisplayValue('30/06/2026')).not.toBeInTheDocument()
  })
})
