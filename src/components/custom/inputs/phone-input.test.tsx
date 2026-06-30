import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import React from 'react'
import { PhoneInput } from './phone-input'

describe('PhoneInput component', () => {
  test('renders successfully without crashing', () => {
    const { container } = render(<PhoneInput country="vn" value="" />)
    const input = container.querySelector('input')
    expect(input).toBeInTheDocument()
  })

  test('displays the correct dial code for the configured country', () => {
    const { container } = render(<PhoneInput country="vn" value="" />)
    const input = container.querySelector('input')
    expect(input?.value).toBe('+84')
  })

  test('calls onChange when the input value changes', () => {
    const handleChange = vi.fn()
    const { container } = render(
      <PhoneInput country="vn" value="" onChange={handleChange} />,
    )
    const input = container.querySelector('input')
    if (input) {
      fireEvent.change(input, { target: { value: '84912345678' } })
    }
    expect(handleChange).toHaveBeenCalled()
  })

  test('correctly forwards ref to the input element', () => {
    const ref = React.createRef<any>()
    render(<PhoneInput country="vn" value="" ref={ref} />)

    expect(ref.current).not.toBeNull()
    expect(ref.current.tagName).toBe('INPUT')
  })

  test('handles null ref gracefully without throwing pointer errors', () => {
    expect(() => {
      render(<PhoneInput country="vn" value="" ref={null} />)
    }).not.toThrow()
  })
})
