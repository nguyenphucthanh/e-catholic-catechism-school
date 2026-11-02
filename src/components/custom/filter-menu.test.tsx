import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FilterMenu } from './filter-menu'
import type { FilterMenuFilter } from './filter-menu'

const make = (over: Partial<FilterMenuFilter> = {}): FilterMenuFilter => ({
  key: 'gender',
  label: 'Gender',
  value: '',
  onChange: vi.fn(),
  options: [
    { value: '', label: 'Any gender' },
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
  ],
  ...over,
})

function openSub(label: string) {
  fireEvent.click(screen.getByRole('button', { name: /common\.filter/ }))
  const sub = screen.getByRole('menuitem', { name: label })
  fireEvent.click(sub)
  return sub
}

describe('FilterMenu', () => {
  test('renders the Filter trigger and no badges by default', () => {
    render(<FilterMenu filters={[make()]} />)
    expect(
      screen.getByRole('button', { name: /common\.filter/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'common.removeFilter' }),
    ).not.toBeInTheDocument()
  })

  test('shows a badge with the option label for a non-default value', () => {
    render(<FilterMenu filters={[make({ value: 'male' })]} />)
    expect(screen.getByText('Male')).toBeInTheDocument()
    expect(screen.getByText('Gender:')).toBeInTheDocument()
  })

  test('clicking the badge X calls onChange with the default value', () => {
    const f = make({ value: 'male' })
    render(<FilterMenu filters={[f]} />)
    fireEvent.click(screen.getByRole('button', { name: 'common.removeFilter' }))
    expect(f.onChange).toHaveBeenCalledWith('')
  })

  test('badge X resets to a custom defaultValue', () => {
    const f = make({
      value: 'male',
      defaultValue: 'all',
      options: [
        { value: 'all', label: 'All' },
        { value: 'male', label: 'Male' },
      ],
    })
    render(<FilterMenu filters={[f]} />)
    fireEvent.click(screen.getByRole('button', { name: 'common.removeFilter' }))
    expect(f.onChange).toHaveBeenCalledWith('all')
  })

  test('no badge when value equals a custom defaultValue', () => {
    render(
      <FilterMenu
        filters={[
          make({
            value: 'all',
            defaultValue: 'all',
            options: [{ value: 'all', label: 'All' }],
          }),
        ]}
      />,
    )
    expect(screen.queryByText('Gender:')).not.toBeInTheDocument()
  })

  test('picking the default option from the menu calls onChange("")', async () => {
    const f = make({ value: 'male' })
    render(<FilterMenu filters={[f]} />)
    openSub('Gender')
    fireEvent.click(
      await screen.findByRole('menuitemradio', { name: 'Any gender' }),
    )
    expect(f.onChange).toHaveBeenCalledWith('')
  })

  test('picking a non-default option calls onChange with its value', async () => {
    const f = make()
    render(<FilterMenu filters={[f]} />)
    openSub('Gender')
    fireEvent.click(
      await screen.findByRole('menuitemradio', { name: 'Female' }),
    )
    expect(f.onChange).toHaveBeenCalledWith('female')
  })

  test('disabled filter greys out its submenu trigger', () => {
    render(<FilterMenu filters={[make({ disabled: true })]} />)
    fireEvent.click(screen.getByRole('button', { name: /common\.filter/ }))
    expect(screen.getByRole('menuitem', { name: 'Gender' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})
