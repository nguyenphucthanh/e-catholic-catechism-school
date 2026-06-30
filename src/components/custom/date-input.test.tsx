import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DateInput } from './date-input'

describe('DateInput component', () => {
  test('renders placeholder when no value is provided', () => {
    render(<DateInput placeholder="Pick a date" />)
    expect(screen.getByText('Pick a date')).toBeInTheDocument()
  })

  test('renders formatted date when value is provided', () => {
    const testDate = new Date(2026, 5, 30) // June 30, 2026
    render(<DateInput value={testDate} />)

    // Verify it formats the date
    expect(screen.getByText(/June 30/i)).toBeInTheDocument()
  })

  test('opens popover calendar on click', () => {
    render(<DateInput placeholder="Pick a date" />)

    const trigger = screen.getByRole('button', { name: /Pick a date/i })
    fireEvent.click(trigger)

    // Check if the calendar grid is in the document when opened
    expect(screen.getByRole('grid')).toBeInTheDocument()
  })

  test('calls onChange and closes popover when date is clicked', () => {
    const handleChange = vi.fn()
    render(<DateInput placeholder="Pick a date" onChange={handleChange} />)

    const trigger = screen.getByRole('button', { name: /Pick a date/i })
    fireEvent.click(trigger)

    // Click on a day button in react-day-picker (e.g. "15")
    const dayButton = screen.getByRole('button', { name: /15/ })
    fireEvent.click(dayButton)

    expect(handleChange).toHaveBeenCalled()
    // It should close popover
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })
})
