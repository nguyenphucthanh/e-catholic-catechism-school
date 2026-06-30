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
})
