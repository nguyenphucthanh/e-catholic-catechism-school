import { describe, expect, test } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DataTable } from './data-table'
import type { ColumnDef } from '@tanstack/react-table'

interface TestData {
  id: string
  name: string
  role: string
}

const columns: Array<ColumnDef<TestData>> = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'role',
    header: 'Role',
  },
]

const testData: Array<TestData> = [
  { id: '1', name: 'Alice', role: 'Admin' },
  { id: '2', name: 'Bob', role: 'User' },
  { id: '3', name: 'Charlie', role: 'Guest' },
]

describe('DataTable component', () => {
  test('renders headers and data rows successfully', () => {
    render(<DataTable columns={columns} data={testData} />)

    // Verify headers
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Role')).toBeInTheDocument()

    // Verify rows
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
  })

  test('performs column filtering based on search input', () => {
    render(
      <DataTable
        columns={columns}
        data={testData}
        searchColumnKey="name"
        searchPlaceholder="Search name..."
      />,
    )

    const searchInput = screen.getByPlaceholderText('Search name...')
    expect(searchInput).toBeInTheDocument()

    // Filter for "Alice"
    fireEvent.change(searchInput, { target: { value: 'Alice' } })

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
    expect(screen.queryByText('Charlie')).not.toBeInTheDocument()
  })

  test('shows empty state when no results match', () => {
    render(
      <DataTable
        columns={columns}
        data={testData}
        searchColumnKey="name"
        searchPlaceholder="Search name..."
      />,
    )

    const searchInput = screen.getByPlaceholderText('Search name...')
    fireEvent.change(searchInput, { target: { value: 'Zack' } })

    expect(screen.getByText('No results.')).toBeInTheDocument()
  })

  test('renders page size selector with default value of 50', () => {
    render(<DataTable columns={columns} data={testData} />)
    expect(screen.getByText('Show')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  test('toggles column visibility via the Columns dropdown menu', () => {
    render(<DataTable columns={columns} data={testData} />)

    fireEvent.click(screen.getByRole('button', { name: /Columns/i }))

    const nameCheckboxItem = screen.getByRole('menuitemcheckbox', {
      name: 'Name',
    })
    expect(nameCheckboxItem).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(nameCheckboxItem)

    // Column header should disappear once hidden
    expect(
      screen.queryByRole('columnheader', { name: 'Name' }),
    ).not.toBeInTheDocument()
  })

  test('changes page size when a new value is selected from the Show dropdown', () => {
    const manyRows: Array<TestData> = Array.from({ length: 120 }, (_, i) => ({
      id: String(i),
      name: `Row ${i}`,
      role: 'User',
    }))
    render(<DataTable columns={columns} data={manyRows} />)

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: '100' }))

    expect(screen.getByText('100')).toBeInTheDocument()
  })

  test('navigates to the next and previous page using pagination buttons', () => {
    const manyRows: Array<TestData> = Array.from({ length: 120 }, (_, i) => ({
      id: String(i),
      name: `Row ${i}`,
      role: 'User',
    }))
    render(<DataTable columns={columns} data={manyRows} />)

    const prevButton = screen.getByRole('button', { name: /Previous/i })
    const nextButton = screen.getByRole('button', { name: /Next/i })

    expect(prevButton).toBeDisabled()
    expect(nextButton).not.toBeDisabled()
    expect(screen.getByText(/Page 1 of/)).toBeInTheDocument()

    fireEvent.click(nextButton)
    expect(screen.getByText(/Page 2 of/)).toBeInTheDocument()
    expect(prevButton).not.toBeDisabled()

    fireEvent.click(prevButton)
    expect(screen.getByText(/Page 1 of/)).toBeInTheDocument()
    expect(prevButton).toBeDisabled()
  })

  test('disables next page button when there is only a single page', () => {
    render(<DataTable columns={columns} data={testData} />)

    const nextButton = screen.getByRole('button', { name: /Next/i })
    expect(nextButton).toBeDisabled()
  })
})
